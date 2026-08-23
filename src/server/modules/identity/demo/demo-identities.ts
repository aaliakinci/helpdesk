export const DEMO_TENANTS = {
  acme: "00000000-0000-4000-8000-000000000101",
  globex: "00000000-0000-4000-8000-000000000102",
} as const;

export const DEMO_USERS = {
  owner: "00000000-0000-4000-8000-000000000201",
  manager: "00000000-0000-4000-8000-000000000202",
  agent: "00000000-0000-4000-8000-000000000203",
  requester: "00000000-0000-4000-8000-000000000204",
  auditor: "00000000-0000-4000-8000-000000000205",
  globexAgent: "00000000-0000-4000-8000-000000000206",
  disabled: "00000000-0000-4000-8000-000000000207",
} as const;

export const DEMO_MEMBERSHIPS = {
  acmeOwner: "00000000-0000-4000-8000-000000000501",
  globexOwner: "00000000-0000-4000-8000-000000000502",
  acmeManager: "00000000-0000-4000-8000-000000000503",
  acmeAgent: "00000000-0000-4000-8000-000000000504",
  acmeRequester: "00000000-0000-4000-8000-000000000505",
  acmeAuditor: "00000000-0000-4000-8000-000000000506",
  globexAgent: "00000000-0000-4000-8000-000000000507",
  acmeDisabled: "00000000-0000-4000-8000-000000000508",
} as const;

export const DEMO_EMAILS = {
  owner: "owner@demo.helpdesk.test",
  manager: "manager@demo.helpdesk.test",
  agent: "agent@demo.helpdesk.test",
  requester: "requester@demo.helpdesk.test",
  auditor: "auditor@demo.helpdesk.test",
  globexAgent: "globex.agent@demo.helpdesk.test",
  disabled: "disabled@demo.helpdesk.test",
} as const;
