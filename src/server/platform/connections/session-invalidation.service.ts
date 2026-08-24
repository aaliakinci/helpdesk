import { Injectable, type BeforeApplicationShutdown } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { createClient, type RedisClientType } from "redis";

import { PlatformConfigService } from "../config/environment.js";
import { writeStructuredLog } from "../observability/json-logger.js";

const CHANNEL = "helpdesk.session-invalidation.v1";

export type SessionInvalidation =
  | { readonly id: string; readonly scope: "MEMBERSHIP" }
  | { readonly id: string; readonly scope: "SESSION" }
  | { readonly id: string; readonly scope: "USER" };

type SessionInvalidationListener = (event: SessionInvalidation) => void;

@Injectable()
export class SessionInvalidationService implements BeforeApplicationShutdown {
  private readonly instanceId = randomUUID();
  private readonly listeners = new Set<SessionInvalidationListener>();
  private publisher: RedisClientType | undefined;
  private subscriber: RedisClientType | undefined;
  private subscriptionPromise: Promise<void> | undefined;

  public constructor(private readonly config: PlatformConfigService) {}

  public subscribe(listener: SessionInvalidationListener): () => void {
    this.listeners.add(listener);
    void this.ensureSubscribed().catch(() => {
      writeStructuredLog("support-api", "warn", "session_invalidation.subscribe.deferred");
    });
    return () => this.listeners.delete(listener);
  }

  public async publish(event: SessionInvalidation): Promise<void> {
    this.notify(event);
    try {
      const publisher = await this.ensurePublisher();
      await publisher.publish(CHANNEL, JSON.stringify({ ...event, sourceId: this.instanceId }));
    } catch (error: unknown) {
      writeStructuredLog("support-api", "warn", "session_invalidation.publish.failed", {
        reason: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }

  public async beforeApplicationShutdown(): Promise<void> {
    const clients = [this.subscriber, this.publisher];
    this.subscriber = undefined;
    this.publisher = undefined;
    this.subscriptionPromise = undefined;
    await Promise.all(
      clients.map(async (client) => {
        if (!client?.isOpen) return;
        try {
          await client.quit();
        } catch {
          client.destroy();
        }
      }),
    );
  }

  private async ensurePublisher(): Promise<RedisClientType> {
    this.publisher ??= this.createClient();
    if (!this.publisher.isOpen) await this.publisher.connect();
    return this.publisher;
  }

  private async ensureSubscribed(): Promise<void> {
    if (this.subscriber?.isReady) return;
    this.subscriptionPromise ??= this.connectSubscriber().finally(() => {
      this.subscriptionPromise = undefined;
    });
    await this.subscriptionPromise;
  }

  private async connectSubscriber(): Promise<void> {
    this.subscriber ??= this.createClient();
    if (!this.subscriber.isOpen) await this.subscriber.connect();
    await this.subscriber.subscribe(CHANNEL, (raw) => {
      const decoded = decodeInvalidation(raw);
      if (!decoded || decoded.sourceId === this.instanceId) return;
      this.notify(decoded.event);
    });
  }

  private createClient(): RedisClientType {
    const client = createClient({
      socket: { connectTimeout: 1_000, reconnectStrategy: false },
      url: this.config.values.redisUrl,
    });
    client.on("error", () => undefined);
    return client;
  }

  private notify(event: SessionInvalidation): void {
    for (const listener of this.listeners) listener(event);
  }
}

function decodeInvalidation(
  raw: string,
): { readonly event: SessionInvalidation; readonly sourceId: string } | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Readonly<Record<string, unknown>>;
    if (typeof record.id !== "string" || typeof record.sourceId !== "string") return null;
    if (record.scope !== "MEMBERSHIP" && record.scope !== "SESSION" && record.scope !== "USER") {
      return null;
    }
    return {
      event: { id: record.id, scope: record.scope },
      sourceId: record.sourceId,
    };
  } catch {
    return null;
  }
}
