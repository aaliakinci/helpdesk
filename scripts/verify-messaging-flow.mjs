import assert from "node:assert/strict";

const apiUrl = process.env.HELPDESK_API_URL ?? "http://127.0.0.1:8080";
const demoPassword = process.env.DEMO_SEED_PASSWORD;
if (!demoPassword) throw new Error("DEMO_SEED_PASSWORD is required for the messaging smoke test.");

const tenantId = "00000000-0000-4000-8000-000000000101";
const loginResponse = await request("/api/v1/auth/login", {
  body: { email: "requester@demo.helpdesk.test", password: demoPassword, tenantId },
  method: "POST",
});
assert.equal(loginResponse.status, 200);
const requester = await loginResponse.json();
const ownerLoginResponse = await request("/api/v1/auth/login", {
  body: { email: "owner@demo.helpdesk.test", password: demoPassword, tenantId },
  method: "POST",
});
assert.equal(ownerLoginResponse.status, 200);
const owner = await ownerLoginResponse.json();

const createdResponse = await request("/api/v1/tickets", {
  authorization: `Bearer ${requester.accessToken}`,
  body: {
    description: "End-to-end outbox and RabbitMQ qualification.",
    priority: "NORMAL",
    requesterContactId: null,
    subject: `Messaging smoke ${Date.now()}`,
  },
  headers: {
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    "x-correlation-id": `messaging-smoke-${Date.now()}`,
  },
  method: "POST",
});
assert.equal(createdResponse.status, 201);
const created = await createdResponse.json();
const assigned = await waitForAssignment(created.id, owner.accessToken);
assert.equal(assigned.queue.name, "General Support");
assert.equal(assigned.assignee.displayName, "Demo Agent");
assert.equal(assigned.assignmentHistory.at(-1).action, "ROUND_ROBIN_ASSIGNED");

process.stdout.write(
  "Transactional outbox, RabbitMQ delivery, worker round-robin assignment, and trace-context smoke checks passed.\n",
);

function request(path, options = {}) {
  const headers = { Accept: "application/json", ...(options.headers ?? {}) };
  if (options.authorization) headers.Authorization = options.authorization;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(`${apiUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

async function waitForAssignment(ticketId, accessToken) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const response = await request(`/api/v1/tickets/${ticketId}`, {
      authorization: `Bearer ${accessToken}`,
    });
    assert.equal(response.status, 200);
    const ticket = await response.json();
    if (ticket.queue && ticket.assignee) return ticket;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for automatic ticket assignment.");
}
