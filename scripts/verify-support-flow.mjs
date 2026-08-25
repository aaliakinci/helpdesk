import assert from "node:assert/strict";

const apiUrl = process.env.HELPDESK_API_URL ?? "http://127.0.0.1:8080";
const demoPassword = process.env.DEMO_SEED_PASSWORD;
if (!demoPassword) throw new Error("DEMO_SEED_PASSWORD is required for the support smoke test.");

const acmeTenantId = "00000000-0000-4000-8000-000000000101";
const globexTenantId = "00000000-0000-4000-8000-000000000102";

const requester = await login("requester@demo.helpdesk.test", acmeTenantId);
const agent = await login("agent@demo.helpdesk.test", acmeTenantId);
const createdResponse = await request("/api/v1/tickets", {
  authorization: `Bearer ${requester.accessToken}`,
  body: {
    description: "The customer portal cannot print the weekly support report.",
    priority: "HIGH",
    requesterContactId: null,
    subject: `Support smoke ${Date.now()}`,
  },
  method: "POST",
});
assert.equal(createdResponse.status, 201);
const created = await createdResponse.json();
assert.equal(created.status, "NEW");
assert.equal(created.comments.length, 0);
const automaticallyAssigned = await waitForAssignment(created.id, agent.accessToken);

const attachmentContent = "Requester attachment smoke evidence";
const attachmentForm = new FormData();
attachmentForm.set(
  "file",
  new Blob([attachmentContent], { type: "text/plain" }),
  "support-smoke.txt",
);
attachmentForm.set("visibility", "PUBLIC");
const attachmentResponse = await fetch(`${apiUrl}/api/v1/tickets/${created.id}/attachments`, {
  body: attachmentForm,
  headers: { Accept: "application/json", Authorization: `Bearer ${requester.accessToken}` },
  method: "POST",
});
assert.equal(attachmentResponse.status, 201);
const attachment = await attachmentResponse.json();
assert.equal(attachment.fileName, "support-smoke.txt");
assert.equal(attachment.visibility, "PUBLIC");
const attachmentDownload = await fetch(`${apiUrl}/api/v1/attachments/${attachment.id}`, {
  headers: { Authorization: `Bearer ${requester.accessToken}` },
});
assert.equal(attachmentDownload.status, 200);
assert.equal(await attachmentDownload.text(), attachmentContent);

const requesterReplyResponse = await request(`/api/v1/tickets/${created.id}/comments`, {
  authorization: `Bearer ${requester.accessToken}`,
  body: {
    body: "This blocks our weekly export.",
    expectedVersion: automaticallyAssigned.version,
    visibility: "PUBLIC",
  },
  method: "POST",
});
assert.equal(requesterReplyResponse.status, 201);
const requesterReply = await requesterReplyResponse.json();
assert.equal(requesterReply.version, automaticallyAssigned.version + 1);

const internalResponse = await request(`/api/v1/tickets/${created.id}/comments`, {
  authorization: `Bearer ${agent.accessToken}`,
  body: {
    body: "Check the rendering worker logs.",
    expectedVersion: requesterReply.version,
    visibility: "INTERNAL",
  },
  method: "POST",
});
assert.equal(internalResponse.status, 201);
const withInternal = await internalResponse.json();
assert.equal(
  withInternal.comments.some((comment) => comment.visibility === "INTERNAL"),
  true,
);

const publicResponse = await request(`/api/v1/tickets/${created.id}/comments`, {
  authorization: `Bearer ${agent.accessToken}`,
  body: {
    body: "We are investigating the report renderer.",
    expectedVersion: withInternal.version,
    visibility: "PUBLIC",
  },
  method: "POST",
});
assert.equal(publicResponse.status, 201);
const withPublic = await publicResponse.json();
assert.ok(withPublic.firstResponseAtUtc);

const priorityResponse = await request(`/api/v1/tickets/${created.id}/priority`, {
  authorization: `Bearer ${agent.accessToken}`,
  body: { expectedVersion: withPublic.version, priority: "LOW" },
  method: "PATCH",
});
assert.equal(priorityResponse.status, 200);
const priorityChanged = await priorityResponse.json();
assert.equal(priorityChanged.priority, "LOW");
assert.equal(priorityChanged.priorityHistory.at(-1)?.fromPriority, "HIGH");
assert.equal(priorityChanged.priorityHistory.at(-1)?.toPriority, "LOW");

const staleResponse = await request(`/api/v1/tickets/${created.id}/comments`, {
  authorization: `Bearer ${agent.accessToken}`,
  body: {
    body: "Stale mutation",
    expectedVersion: withInternal.version,
    visibility: "PUBLIC",
  },
  method: "POST",
});
assert.equal(staleResponse.status, 409);

const requesterDetailResponse = await request(`/api/v1/tickets/${created.id}`, {
  authorization: `Bearer ${requester.accessToken}`,
});
assert.equal(requesterDetailResponse.status, 200);
const requesterDetail = await requesterDetailResponse.json();
assert.equal(Object.hasOwn(requesterDetail, "priorityHistory"), false);
assert.equal(
  requesterDetail.attachments.some((item) => item.id === attachment.id),
  true,
);
assert.equal(
  requesterDetail.comments.every((comment) => comment.visibility === "PUBLIC"),
  true,
);
assert.equal(
  requesterDetail.comments.some((comment) => comment.body.includes("worker logs")),
  false,
);

const listResponse = await request(
  "/api/v1/tickets?page=1&pageSize=10&sortBy=number&sortDirection=desc",
  {
    authorization: `Bearer ${requester.accessToken}`,
  },
);
assert.equal(listResponse.status, 200);
const list = await listResponse.json();
assert.equal(
  list.items.some((ticket) => ticket.id === created.id),
  true,
);

const resolvedResponse = await request(`/api/v1/tickets/${created.id}/status`, {
  authorization: `Bearer ${agent.accessToken}`,
  body: { expectedVersion: priorityChanged.version, status: "RESOLVED" },
  method: "PATCH",
});
assert.equal(resolvedResponse.status, 200);
const resolved = await resolvedResponse.json();
assert.ok(resolved.resolvedAtUtc);

const closedResponse = await request(`/api/v1/tickets/${created.id}/status`, {
  authorization: `Bearer ${agent.accessToken}`,
  body: { expectedVersion: resolved.version, status: "CLOSED" },
  method: "PATCH",
});
assert.equal(closedResponse.status, 200);
const closed = await closedResponse.json();
assert.ok(closed.closedAtUtc);

const directOpenResponse = await request(`/api/v1/tickets/${created.id}/status`, {
  authorization: `Bearer ${agent.accessToken}`,
  body: { expectedVersion: closed.version, status: "OPEN" },
  method: "PATCH",
});
assert.equal(directOpenResponse.status, 409);

const reopenedResponse = await request(`/api/v1/tickets/${created.id}/reopen`, {
  authorization: `Bearer ${agent.accessToken}`,
  body: { expectedVersion: closed.version },
  method: "POST",
});
assert.equal(reopenedResponse.status, 201);
const reopened = await reopenedResponse.json();
assert.notEqual(reopened.id, created.id);
assert.equal(reopened.reopenedFrom.id, created.id);

const auditor = await login("auditor@demo.helpdesk.test", acmeTenantId);
const auditorMutation = await request(`/api/v1/tickets/${reopened.id}/comments`, {
  authorization: `Bearer ${auditor.accessToken}`,
  body: { body: "Auditor mutation", expectedVersion: 1, visibility: "INTERNAL" },
  method: "POST",
});
assert.equal(auditorMutation.status, 403);

const globex = await login("globex.agent@demo.helpdesk.test", globexTenantId);
const crossTenant = await request(`/api/v1/tickets/${created.id}`, {
  authorization: `Bearer ${globex.accessToken}`,
});
assert.equal(crossTenant.status, 404);

process.stdout.write(
  "Ticket create/list/detail, requester attachment upload/download, staff-only priority history, requester projection, public/internal replies, optimistic conflict, lifecycle, linked reopen, RBAC, and tenant isolation smoke checks passed.\n",
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
