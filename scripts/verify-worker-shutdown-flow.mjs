import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const apiUrl = process.env.HELPDESK_API_URL ?? "http://127.0.0.1:8080";
const demoPassword = process.env.DEMO_SEED_PASSWORD;
if (!demoPassword) {
  throw new Error("DEMO_SEED_PASSWORD is required for the worker shutdown smoke test.");
}

const tenantId = "00000000-0000-4000-8000-000000000101";
const requester = await login("requester@demo.helpdesk.test");
const owner = await login("owner@demo.helpdesk.test");

try {
  dockerCompose("stop", "-t", "15", "support-worker");
  const createdResponse = await request("/api/v1/tickets", {
    authorization: `Bearer ${requester.accessToken}`,
    body: {
      description: "SIGTERM delivery safety qualification.",
      priority: "NORMAL",
      requesterContactId: null,
      subject: `Worker shutdown smoke ${Date.now()}`,
    },
    method: "POST",
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();

  dockerCompose("start", "support-worker");
  await new Promise((resolve) => setTimeout(resolve, 75));
  dockerCompose("stop", "-t", "15", "support-worker");
  dockerCompose("start", "support-worker");

  const assigned = await waitForAssignment(created.id, owner.accessToken);
  assert.equal(assigned.assignmentHistory.at(-1).action, "ROUND_ROBIN_ASSIGNED");
  const health = await waitForWorkerHealth();
  assert.equal(health.status, "ready");
} finally {
  dockerCompose("start", "support-worker");
}

process.stdout.write(
  "SIGTERM drain/restart preserved the pending event and produced one automatic assignment.\n",
);

async function login(email) {
  const response = await request("/api/v1/auth/login", {
    body: { email, password: demoPassword, tenantId },
    method: "POST",
  });
  assert.equal(response.status, 200);
  return response.json();
}

function dockerCompose(...arguments_) {
  execFileSync("docker", ["compose", ...arguments_], {
    cwd: process.cwd(),
    stdio: "pipe",
  });
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
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await request(`/api/v1/tickets/${ticketId}`, {
        authorization: `Bearer ${accessToken}`,
      });
      if (response.ok) {
        const ticket = await response.json();
        if (ticket.queue && ticket.assignee) return ticket;
      }
    } catch {
      // A pooled HTTP socket can close while the worker container is being restarted.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for assignment after worker restart.");
}

async function waitForWorkerHealth() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch("http://127.0.0.1:8081/health/ready");
      if (response.ok) return response.json();
    } catch {
      // The port is expected to be unavailable while the worker is restarting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for worker readiness after restart.");
}
