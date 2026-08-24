import assert from "node:assert/strict";
import { io } from "socket.io-client";

const apiUrl = process.env.HELPDESK_API_URL ?? "http://127.0.0.1:8080";
const webOrigin = process.env.WEB_ORIGIN ?? "http://127.0.0.1:5173";
const demoPassword = process.env.DEMO_SEED_PASSWORD;
if (!demoPassword) throw new Error("DEMO_SEED_PASSWORD is required for the realtime smoke test.");

const tenantId = "00000000-0000-4000-8000-000000000101";
const requesterLogin = await login("requester@demo.helpdesk.test");
const agentLogin = await login("agent@demo.helpdesk.test");
const ownerLogin = await login("owner@demo.helpdesk.test");
const requesterEvents = [];
const agentEvents = [];
const requesterSocket = await connect(requesterLogin.body.accessToken, requesterEvents);
const agentSocket = await connect(agentLogin.body.accessToken, agentEvents);

try {
  const createdResponse = await request("/api/v1/tickets", {
    authorization: requesterLogin.body.accessToken,
    body: {
      description: "Realtime authorization and reconciliation smoke test.",
      priority: "NORMAL",
      requesterContactId: null,
      subject: `Realtime smoke ${Date.now()}`,
    },
    method: "POST",
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();

  const requesterAssignment = await waitForEvent(
    requesterEvents,
    (event) => event.ticketId === created.id && event.type === "ticket.assigned",
  );
  assert.deepEqual(Object.keys(requesterAssignment).sort(), [
    "eventId",
    "occurredAtUtc",
    "ticketId",
    "type",
    "version",
  ]);
  await waitForEvent(
    agentEvents,
    (event) => event.ticketId === created.id && event.type === "ticket.assigned",
  );

  const requesterTicket = await waitForTicketAssignment(
    created.id,
    requesterLogin.body.accessToken,
  );
  assert.equal(requesterTicket.assignmentStatus, "ASSIGNED");
  assert.equal("queue" in requesterTicket, false);
  assert.equal("assignee" in requesterTicket, false);
  assert.equal("assignmentHistory" in requesterTicket, false);

  const notification = await waitForNotification(created.id, agentLogin.body.accessToken);
  assert.equal(notification.ticketId, created.id);

  const ownerTicketResponse = await request(`/api/v1/tickets/${created.id}`, {
    authorization: ownerLogin.body.accessToken,
  });
  assert.equal(ownerTicketResponse.status, 200);
  const ownerTicket = await ownerTicketResponse.json();
  const beforeInternal = requesterEvents.length;
  const internalResponse = await request(`/api/v1/tickets/${created.id}/comments`, {
    authorization: ownerLogin.body.accessToken,
    body: {
      body: "Internal realtime privacy probe.",
      expectedVersion: ownerTicket.version,
      visibility: "INTERNAL",
    },
    method: "POST",
  });
  assert.equal(internalResponse.status, 201);
  await waitForEvent(
    agentEvents,
    (event) => event.ticketId === created.id && event.type === "ticket.comment_added",
  );
  await delay(750);
  assert.equal(
    requesterEvents.slice(beforeInternal).some((event) => event.type === "ticket.comment_added"),
    false,
  );

  const disconnect = once(requesterSocket, "disconnect");
  const logoutResponse = await request("/api/v1/auth/logout", {
    cookie: requesterLogin.cookie,
    method: "POST",
  });
  assert.equal(logoutResponse.status, 204);
  await disconnect;

  process.stdout.write(
    "Authorized realtime assignment, requester privacy, notification refetch data, and session disconnect checks passed.\n",
  );
} finally {
  requesterSocket.disconnect();
  agentSocket.disconnect();
}

async function login(email) {
  const response = await request("/api/v1/auth/login", {
    body: { email, password: demoPassword, tenantId },
    method: "POST",
  });
  assert.equal(response.status, 200);
  return {
    body: await response.json(),
    cookie: response.headers.get("set-cookie") ?? "",
  };
}

function connect(accessToken, events) {
  return new Promise((resolve, reject) => {
    const socket = io(`${apiUrl}/support`, {
      auth: { accessToken },
      extraHeaders: { Origin: webOrigin },
      path: "/socket.io",
      reconnection: false,
      transports: ["websocket"],
    });
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Timed out connecting to realtime gateway."));
    }, 5_000);
    socket.on("support.invalidate", (event) => events.push(event));
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function request(path, options = {}) {
  const headers = { Accept: "application/json" };
  if (options.authorization) headers.Authorization = `Bearer ${options.authorization}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.cookie) headers.Cookie = options.cookie;
  if (options.cookie) headers.Origin = webOrigin;
  return fetch(`${apiUrl}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    method: options.method ?? "GET",
  });
}

async function waitForEvent(events, predicate) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const event = events.find(predicate);
    if (event) return event;
    await delay(50);
  }
  throw new Error("Timed out waiting for realtime event.");
}

async function waitForTicketAssignment(ticketId, accessToken) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const response = await request(`/api/v1/tickets/${ticketId}`, { authorization: accessToken });
    assert.equal(response.status, 200);
    const ticket = await response.json();
    if (ticket.assignmentStatus === "ASSIGNED") return ticket;
    await delay(50);
  }
  throw new Error("Timed out waiting for requester-safe assignment projection.");
}

async function waitForNotification(ticketId, accessToken) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const response = await request("/api/v1/notifications", { authorization: accessToken });
    assert.equal(response.status, 200);
    const page = await response.json();
    const notification = page.items.find((item) => item.ticketId === ticketId);
    if (notification) return notification;
    await delay(50);
  }
  throw new Error("Timed out waiting for assignment notification.");
}

function once(socket, eventName) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${eventName}.`)), 5_000);
    socket.once(eventName, (value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
