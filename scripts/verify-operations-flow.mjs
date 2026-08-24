import assert from "node:assert/strict";

const apiUrl = process.env.HELPDESK_API_URL ?? "http://127.0.0.1:8080";
const demoPassword = process.env.DEMO_SEED_PASSWORD;
if (!demoPassword) throw new Error("DEMO_SEED_PASSWORD is required for the operations smoke test.");

const acmeTenantId = "00000000-0000-4000-8000-000000000101";
const globexTenantId = "00000000-0000-4000-8000-000000000102";
const owner = await login("owner@demo.helpdesk.test", acmeTenantId);
const queueResponse = await request("/api/v1/queues", {
  authorization: `Bearer ${owner.accessToken}`,
  body: {
    description: "Queue and assignment HTTP qualification",
    name: `Operations smoke ${Date.now()}`,
  },
  method: "POST",
});
assert.equal(queueResponse.status, 201);
let queue = await queueResponse.json();
assert.equal(queue.version, 1);

const eligibleResponse = await request("/api/v1/queues/eligible-members", {
  authorization: `Bearer ${owner.accessToken}`,
});
assert.equal(eligibleResponse.status, 200);
const eligible = await eligibleResponse.json();
const agentMembership = eligible.find((member) => member.email === "agent@demo.helpdesk.test");
assert.ok(agentMembership);

const memberResponse = await request(`/api/v1/queues/${queue.id}/members`, {
  authorization: `Bearer ${owner.accessToken}`,
  body: {
    expectedVersion: queue.version,
    membershipId: agentMembership.membershipId,
    status: "ACTIVE",
  },
  method: "POST",
});
assert.equal(memberResponse.status, 201);
queue = await memberResponse.json();
assert.equal(queue.activeMemberCount, 1);

const requester = await login("requester@demo.helpdesk.test", acmeTenantId);
const ticketResponse = await request("/api/v1/tickets", {
  authorization: `Bearer ${requester.accessToken}`,
  body: {
    description: "The operations smoke ticket needs queue routing.",
    priority: "NORMAL",
    requesterContactId: null,
    subject: `Operations routing ${Date.now()}`,
  },
  method: "POST",
});
assert.equal(ticketResponse.status, 201);
let ticket = await ticketResponse.json();

ticket = await waitForAssignment(ticket.id, owner.accessToken);
assert.equal(ticket.queue.name, "General Support");
assert.equal(ticket.assignee.membershipId, agentMembership.membershipId);

const initialUnassignResponse = await request(`/api/v1/tickets/${ticket.id}/unassign`, {
  authorization: `Bearer ${owner.accessToken}`,
  body: { expectedVersion: ticket.version },
  method: "POST",
});
assert.equal(initialUnassignResponse.status, 201);
ticket = await initialUnassignResponse.json();

const queueTicketResponse = await request(`/api/v1/tickets/${ticket.id}/queue`, {
  authorization: `Bearer ${owner.accessToken}`,
  body: { expectedVersion: ticket.version, queueId: queue.id },
  method: "POST",
});
assert.equal(queueTicketResponse.status, 201);
ticket = await queueTicketResponse.json();
assert.equal(ticket.queue.id, queue.id);
assert.equal(ticket.assignee, null);

const agent = await login("agent@demo.helpdesk.test", acmeTenantId);
const agentDetailResponse = await request(`/api/v1/tickets/${ticket.id}`, {
  authorization: `Bearer ${agent.accessToken}`,
});
assert.equal(agentDetailResponse.status, 200);

const takeOverResponse = await request(`/api/v1/tickets/${ticket.id}/take-over`, {
  authorization: `Bearer ${agent.accessToken}`,
  body: { expectedVersion: ticket.version },
  method: "POST",
});
assert.equal(takeOverResponse.status, 201);
ticket = await takeOverResponse.json();
assert.equal(ticket.assignee.membershipId, agentMembership.membershipId);

const unassignResponse = await request(`/api/v1/tickets/${ticket.id}/unassign`, {
  authorization: `Bearer ${owner.accessToken}`,
  body: { expectedVersion: ticket.version },
  method: "POST",
});
assert.equal(unassignResponse.status, 201);
ticket = await unassignResponse.json();
assert.equal(ticket.assignee, null);

const roundRobinResponse = await request(`/api/v1/tickets/${ticket.id}/round-robin`, {
  authorization: `Bearer ${owner.accessToken}`,
  body: { expectedVersion: ticket.version, queueId: queue.id },
  method: "POST",
});
assert.equal(roundRobinResponse.status, 201);
ticket = await roundRobinResponse.json();
assert.equal(ticket.assignee.membershipId, agentMembership.membershipId);
assert.deepEqual(
  ticket.assignmentHistory.map((entry) => entry.action),
  [
    "ROUND_ROBIN_ASSIGNED",
    "UNASSIGNED",
    "QUEUED",
    "TAKEN_OVER",
    "UNASSIGNED",
    "ROUND_ROBIN_ASSIGNED",
  ],
);

const filteredResponse = await request(
  `/api/v1/tickets?page=1&pageSize=10&assignment=MINE&queueId=${queue.id}`,
  { authorization: `Bearer ${agent.accessToken}` },
);
assert.equal(filteredResponse.status, 200);
const filtered = await filteredResponse.json();
assert.equal(
  filtered.items.some((item) => item.id === ticket.id),
  true,
);

const dashboardResponse = await request("/api/v1/operations/dashboard", {
  authorization: `Bearer ${owner.accessToken}`,
});
assert.equal(dashboardResponse.status, 200);
const dashboard = await dashboardResponse.json();
assert.equal(
  dashboard.queues.some((item) => item.id === queue.id),
  true,
);
assert.equal(dashboard.sla.status, "ACTIVE");
assert.equal(typeof dashboard.sla.approachingTickets, "number");
assert.equal(typeof dashboard.sla.breachedTickets, "number");

const workloadResponse = await request(`/api/v1/operations/agent-workload?queueId=${queue.id}`, {
  authorization: `Bearer ${owner.accessToken}`,
});
assert.equal(workloadResponse.status, 200);
const workload = await workloadResponse.json();
assert.equal(
  workload.some(
    (item) => item.membershipId === agentMembership.membershipId && item.assignedOpenTickets >= 1,
  ),
  true,
);

const auditor = await login("auditor@demo.helpdesk.test", acmeTenantId);
const auditorMutation = await request("/api/v1/queues", {
  authorization: `Bearer ${auditor.accessToken}`,
  body: { description: null, name: "Auditor mutation" },
  method: "POST",
});
assert.equal(auditorMutation.status, 403);

const globex = await login("globex.agent@demo.helpdesk.test", globexTenantId);
const crossTenant = await request(`/api/v1/tickets/${ticket.id}`, {
  authorization: `Bearer ${globex.accessToken}`,
});
assert.equal(crossTenant.status, 404);

process.stdout.write(
  "Queue management, active membership, queue routing, take-over, unassign, locked round-robin, assignment history, filters, dashboard/workload, RBAC, and tenant isolation smoke checks passed.\n",
);

async function login(email, tenantId) {
  const response = await request("/api/v1/auth/login", {
    body: { email, password: demoPassword, tenantId },
    method: "POST",
  });
  assert.equal(response.status, 200);
  return response.json();
}

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
