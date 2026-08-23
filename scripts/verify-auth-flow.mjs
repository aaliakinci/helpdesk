import assert from "node:assert/strict";

const apiUrl = process.env.HELPDESK_API_URL ?? "http://127.0.0.1:8080";
const webOrigin = process.env.HELPDESK_WEB_ORIGIN ?? "http://127.0.0.1:5173";
const demoPassword = process.env.DEMO_SEED_PASSWORD;
if (!demoPassword) throw new Error("DEMO_SEED_PASSWORD is required for the identity smoke test.");

const tenantIds = {
  acme: "00000000-0000-4000-8000-000000000101",
  globex: "00000000-0000-4000-8000-000000000102",
};
const memberships = {
  acmeAgent: "00000000-0000-4000-8000-000000000504",
  globexAgent: "00000000-0000-4000-8000-000000000507",
};

const protectedResponse = await request("/api/v1/identity/me");
assert.equal(protectedResponse.status, 401);
assert.match(protectedResponse.headers.get("content-type") ?? "", /application\/problem\+json/);

const selection = await login("owner@demo.helpdesk.test", null);
assert.equal(selection.response.status, 200);
assert.equal(selection.body.requiresTenantSelection, true);
assert.equal(selection.body.tenants.length, 2);
assert.equal(selection.cookie, null);

const owner = await login("owner@demo.helpdesk.test", tenantIds.acme);
assert.equal(owner.response.status, 200);
assert.equal(owner.body.activeTenant.id, tenantIds.acme);
assert.ok(owner.body.accessToken);
assert.ok(owner.cookie?.includes("helpdesk_refresh="));
assert.match(owner.setCookie ?? "", /HttpOnly/i);
assert.match(owner.setCookie ?? "", /SameSite=Strict/i);
assert.equal("refreshToken" in owner.body, false);

const me = await request("/api/v1/identity/me", {
  authorization: `Bearer ${owner.body.accessToken}`,
});
assert.equal(me.status, 200);
assert.equal((await me.json()).activeTenant.id, tenantIds.acme);

const crossTenantRead = await request(`/api/v1/memberships/${memberships.globexAgent}`, {
  authorization: `Bearer ${owner.body.accessToken}`,
});
assert.equal(crossTenantRead.status, 404);

const rejectedOrigin = await request("/api/v1/auth/refresh", {
  cookie: owner.cookie,
  method: "POST",
  origin: "https://untrusted.example.test",
});
assert.equal(rejectedOrigin.status, 403);

const rotatedResponse = await request("/api/v1/auth/refresh", {
  cookie: owner.cookie,
  method: "POST",
  origin: webOrigin,
});
assert.equal(rotatedResponse.status, 200);
const rotatedBody = await rotatedResponse.json();
const rotatedCookie = cookiePair(rotatedResponse.headers.get("set-cookie"));
assert.ok(rotatedCookie);

const reused = await request("/api/v1/auth/refresh", {
  cookie: owner.cookie,
  method: "POST",
  origin: webOrigin,
});
assert.equal(reused.status, 401);
const familyRevoked = await request("/api/v1/identity/me", {
  authorization: `Bearer ${rotatedBody.accessToken}`,
});
assert.equal(familyRevoked.status, 401);

const auditor = await login("auditor@demo.helpdesk.test", tenantIds.acme);
const auditorMutation = await request(`/api/v1/memberships/${memberships.acmeAgent}/role`, {
  authorization: `Bearer ${auditor.body.accessToken}`,
  body: { role: "AUDITOR" },
  method: "PATCH",
});
assert.equal(auditorMutation.status, 403);

const requester = await login("requester@demo.helpdesk.test", tenantIds.acme);
const requesterIdentity = await request("/api/v1/identity/me", {
  authorization: `Bearer ${requester.body.accessToken}`,
});
assert.equal(requesterIdentity.status, 200);
const requesterBody = await requesterIdentity.json();
assert.equal(requesterBody.activeTenant.role, "REQUESTER");
assert.ok(requesterBody.requesterContactId);

const disabled = await login("disabled@demo.helpdesk.test", tenantIds.acme);
assert.equal(disabled.response.status, 401);

let rateLimitedStatus = 0;
for (let attempt = 0; attempt < 6; attempt += 1) {
  const response = await login("missing-rate-limit@demo.helpdesk.test", tenantIds.acme);
  rateLimitedStatus = response.response.status;
}
assert.equal(rateLimitedStatus, 429);

const switchOwner = await login("owner@demo.helpdesk.test", tenantIds.acme);
const switched = await request("/api/v1/auth/switch-tenant", {
  authorization: `Bearer ${switchOwner.body.accessToken}`,
  body: { tenantId: tenantIds.globex },
  method: "POST",
});
assert.equal(switched.status, 200);
const switchedBody = await switched.json();
assert.equal(switchedBody.activeTenant.id, tenantIds.globex);
const oldAccess = await request("/api/v1/identity/me", {
  authorization: `Bearer ${switchOwner.body.accessToken}`,
});
assert.equal(oldAccess.status, 401);

process.stdout.write(
  "Identity login, tenant isolation, refresh rotation/reuse, RBAC, requester binding, rate limit, and tenant-switch smoke checks passed.\n",
);

async function login(email, tenantId) {
  const response = await request("/api/v1/auth/login", {
    body: { email, password: demoPassword, tenantId },
    method: "POST",
  });
  const body = await response.json();
  const setCookie = response.headers.get("set-cookie");
  return { body, cookie: cookiePair(setCookie), response, setCookie };
}

function cookiePair(setCookie) {
  return setCookie?.split(";", 1)[0] ?? null;
}

function request(path, options = {}) {
  const headers = { Accept: "application/json", ...(options.headers ?? {}) };
  if (options.authorization) headers.Authorization = options.authorization;
  if (options.cookie) headers.Cookie = options.cookie;
  if (options.origin) headers.Origin = options.origin;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(`${apiUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}
