import { createServer, type Server as HttpServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient, type RedisClientType } from "redis";
import { Server as SocketIoServer } from "socket.io";
import { io as createSocketClient, type Socket } from "socket.io-client";

import { PlatformConfigService } from "../../src/server/platform/config/environment.js";

describe("Socket.IO Redis scale-out", () => {
  const redisUrl = new PlatformConfigService().values.redisUrl;
  const scaleOutKey = `helpdesk.integration.${process.pid}.${Date.now()}`;
  const redisClients: RedisClientType[] = [];
  const httpServers: HttpServer[] = [];
  const ioServers: SocketIoServer[] = [];
  let browser: Socket | undefined;

  beforeAll(async () => {
    for (let index = 0; index < 2; index += 1) {
      const publisher = createClient({ url: redisUrl });
      const subscriber = publisher.duplicate();
      publisher.on("error", () => undefined);
      subscriber.on("error", () => undefined);
      await Promise.all([publisher.connect(), subscriber.connect()]);
      redisClients.push(publisher, subscriber);

      const http = createServer();
      const io = new SocketIoServer(http, { transports: ["websocket"] });
      io.adapter(
        createAdapter(publisher, subscriber, {
          key: scaleOutKey,
        }),
      );
      await listen(http);
      httpServers.push(http);
      ioServers.push(io);
    }
  });

  afterAll(async () => {
    browser?.disconnect();
    await Promise.all(ioServers.map(closeIo));
    await Promise.all(httpServers.map(closeHttp));
    await Promise.all(
      redisClients.map(async (client) => {
        if (client.isOpen) await client.quit();
      }),
    );
  });

  it("delivers a room invalidation emitted by another API instance", async () => {
    const secondAddress = httpServers[1]?.address();
    if (!secondAddress || typeof secondAddress === "string") throw new Error("Missing test port.");
    browser = createSocketClient(`http://127.0.0.1:${secondAddress.port}`, {
      transports: ["websocket"],
    });
    await once(browser, "connect");
    const secondSocket = ioServers[1]?.sockets.sockets.values().next().value;
    if (!secondSocket) throw new Error("Second API instance has no connected socket.");
    await secondSocket.join("tenant:test:queue:general");

    const received = once(browser, "support.invalidate");
    ioServers[0]?.to("tenant:test:queue:general").emit("support.invalidate", {
      eventId: "cross-instance-event",
    });

    await expect(received).resolves.toMatchObject({ eventId: "cross-instance-event" });
  });
});

function listen(server: HttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function closeIo(server: SocketIoServer): Promise<void> {
  return new Promise((resolve) => {
    void server.close(() => resolve());
  });
}

function closeHttp(server: HttpServer): Promise<void> {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function once(socket: Socket, event: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}.`)), 5_000);
    socket.once(event, (value: unknown) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}
