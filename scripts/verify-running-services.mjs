const apiBaseUrl = process.env.HELPDESK_API_URL ?? "http://127.0.0.1:8080";
const workerBaseUrl = process.env.HELPDESK_WORKER_URL ?? "http://127.0.0.1:8081";
const webBaseUrl = process.env.HELPDESK_WEB_URL ?? "http://127.0.0.1:5173";

const apiLiveness = await readJson(`${apiBaseUrl}/health/live`, 200);
assert(apiLiveness.status === "alive", "API liveness status is invalid.");

const apiReadiness = await readJson(`${apiBaseUrl}/health/ready`, 200);
assertReady(apiReadiness, "API");

const publicStatus = await readJson(`${apiBaseUrl}/api/v1/system/status`, 200);
assertReady(publicStatus, "Public system status");

const workerReadiness = await readJson(`${workerBaseUrl}/health/ready`, 200);
assertReady(workerReadiness, "Worker");

const openApi = await readJson(`${apiBaseUrl}/openapi.json`, 200);
assert(typeof openApi.paths === "object" && openApi.paths !== null, "OpenAPI paths are missing.");

const missingResponse = await fetch(`${apiBaseUrl}/not-found?ignored=true`, {
  headers: { "x-request-id": "smoke-request-1" },
});
assert(missingResponse.status === 404, "Unknown API route must return 404.");
assert(
  missingResponse.headers.get("content-type")?.startsWith("application/problem+json") === true,
  "Unknown API route must return Problem Details.",
);
const missingProblem = await missingResponse.json();
assert(missingProblem.traceId === "smoke-request-1", "Problem Details trace ID is invalid.");
assert(missingProblem.instance === "/not-found", "Problem Details must not retain query values.");

const webResponse = await fetch(webBaseUrl);
assert(webResponse.ok, `Web returned ${webResponse.status}.`);
assert((await webResponse.text()).includes("<title>Helpdesk</title>"), "Web shell is invalid.");

console.log("API, worker, OpenAPI, Problem Details, and web service smoke checks passed.");

async function readJson(url, expectedStatus) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  assert(response.status === expectedStatus, `${url} returned ${response.status}.`);
  return response.json();
}

function assertReady(report, name) {
  assert(report.status === "ready", `${name} is not ready.`);
  for (const dependency of ["postgresql", "rabbitmq", "redis"]) {
    assert(report.checks?.[dependency]?.status === "up", `${name} ${dependency} is not up.`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
