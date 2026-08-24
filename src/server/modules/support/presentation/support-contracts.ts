import { BadRequestException } from "@nestjs/common";

import {
  isCommentVisibility,
  isTicketPriority,
  isTicketStatus,
  type TicketCommentVisibility,
  type TicketPriority,
  type TicketStatus,
} from "../domain/ticket-policy.js";
import type { TicketListInput } from "../application/support.types.js";

export function decodeCreateCustomer(body: unknown): { readonly name: string } {
  const value = requireRecord(body);
  assertKeys(value, ["name"]);
  return { name: requireTrimmedString(value.name, "name", 2, 160) };
}

export function decodeUpdateCustomer(body: unknown): {
  readonly expectedVersion: number;
  readonly name: string;
} {
  const value = requireRecord(body);
  assertKeys(value, ["expectedVersion", "name"]);
  return {
    expectedVersion: requirePositiveInteger(value.expectedVersion, "expectedVersion"),
    name: requireTrimmedString(value.name, "name", 2, 160),
  };
}

export function decodeContactWrite(body: unknown): {
  readonly displayName: string;
  readonly email: string;
  readonly expectedVersion: number;
} {
  const value = requireRecord(body);
  assertKeys(value, ["displayName", "email", "expectedVersion"]);
  return {
    displayName: requireTrimmedString(value.displayName, "displayName", 2, 120),
    email: normalizeEmail(value.email),
    expectedVersion: requirePositiveInteger(value.expectedVersion, "expectedVersion"),
  };
}

export function decodeCreateTicket(body: unknown): {
  readonly description: string;
  readonly priority: TicketPriority;
  readonly requesterContactId: string | null;
  readonly subject: string;
} {
  const value = requireRecord(body);
  assertKeys(value, ["description", "priority", "requesterContactId", "subject"]);
  if (!isTicketPriority(value.priority)) {
    throw new BadRequestException("priority is invalid.");
  }
  return {
    description: requireTrimmedString(value.description, "description", 1, 10_000),
    priority: value.priority,
    requesterContactId:
      value.requesterContactId === null || value.requesterContactId === undefined
        ? null
        : requireUuid(value.requesterContactId),
    subject: requireTrimmedString(value.subject, "subject", 3, 200),
  };
}

export function decodeCommentWrite(body: unknown): {
  readonly body: string;
  readonly expectedVersion: number;
  readonly visibility: TicketCommentVisibility;
} {
  const value = requireRecord(body);
  assertKeys(value, ["body", "expectedVersion", "visibility"]);
  if (!isCommentVisibility(value.visibility)) {
    throw new BadRequestException("visibility is invalid.");
  }
  return {
    body: requireTrimmedString(value.body, "body", 1, 10_000),
    expectedVersion: requirePositiveInteger(value.expectedVersion, "expectedVersion"),
    visibility: value.visibility,
  };
}

export function decodeStatusWrite(body: unknown): {
  readonly expectedVersion: number;
  readonly status: TicketStatus;
} {
  const value = requireRecord(body);
  assertKeys(value, ["expectedVersion", "status"]);
  if (!isTicketStatus(value.status)) throw new BadRequestException("status is invalid.");
  return {
    expectedVersion: requirePositiveInteger(value.expectedVersion, "expectedVersion"),
    status: value.status,
  };
}

export function decodeExpectedVersion(body: unknown): number {
  const value = requireRecord(body);
  assertKeys(value, ["expectedVersion"]);
  return requirePositiveInteger(value.expectedVersion, "expectedVersion");
}

export function decodeTicketListQuery(query: Readonly<Record<string, unknown>>): TicketListInput {
  assertKeys(query, [
    "assignment",
    "page",
    "pageSize",
    "priority",
    "queueId",
    "sortBy",
    "sortDirection",
    "status",
  ]);
  const status = optionalSingleString(query.status);
  const priority = optionalSingleString(query.priority);
  const queueId = optionalSingleString(query.queueId);
  const assignment = optionalSingleString(query.assignment) ?? "ALL";
  const sortBy = optionalSingleString(query.sortBy) ?? "updatedAt";
  const sortDirection = optionalSingleString(query.sortDirection) ?? "desc";
  if (status !== null && !isTicketStatus(status)) {
    throw new BadRequestException("status filter is invalid.");
  }
  if (priority !== null && !isTicketPriority(priority)) {
    throw new BadRequestException("priority filter is invalid.");
  }
  if (!(["createdAt", "number", "priority", "updatedAt"] as const).includes(sortBy as never)) {
    throw new BadRequestException("sortBy is invalid.");
  }
  if (sortDirection !== "asc" && sortDirection !== "desc") {
    throw new BadRequestException("sortDirection is invalid.");
  }
  if (!(["ALL", "MINE", "UNASSIGNED"] as const).includes(assignment as never)) {
    throw new BadRequestException("assignment filter is invalid.");
  }
  return {
    assignment: assignment as TicketListInput["assignment"],
    page: optionalPositiveInteger(query.page, "page", 1),
    pageSize: optionalPositiveInteger(query.pageSize, "pageSize", 20, 100),
    priority,
    queueId: queueId === null ? null : requireUuid(queueId),
    sortBy: sortBy as TicketListInput["sortBy"],
    sortDirection,
    status,
  };
}

export function decodeCreateQueue(body: unknown): {
  readonly description: string | null;
  readonly name: string;
} {
  const value = requireRecord(body);
  assertKeys(value, ["description", "name"]);
  return {
    description: optionalTrimmedString(value.description, "description", 500),
    name: requireTrimmedString(value.name, "name", 2, 120),
  };
}

export function decodeUpdateQueue(body: unknown): {
  readonly description: string | null;
  readonly expectedVersion: number;
  readonly name: string;
  readonly status: "ACTIVE" | "DISABLED";
} {
  const value = requireRecord(body);
  assertKeys(value, ["description", "expectedVersion", "name", "status"]);
  if (value.status !== "ACTIVE" && value.status !== "DISABLED") {
    throw new BadRequestException("status is invalid.");
  }
  return {
    description: optionalTrimmedString(value.description, "description", 500),
    expectedVersion: requirePositiveInteger(value.expectedVersion, "expectedVersion"),
    name: requireTrimmedString(value.name, "name", 2, 120),
    status: value.status,
  };
}

export function decodeQueueMemberWrite(body: unknown): {
  readonly expectedVersion: number;
  readonly membershipId: string;
  readonly status: "ACTIVE" | "DISABLED";
} {
  const value = requireRecord(body);
  assertKeys(value, ["expectedVersion", "membershipId", "status"]);
  if (value.status !== "ACTIVE" && value.status !== "DISABLED") {
    throw new BadRequestException("status is invalid.");
  }
  return {
    expectedVersion: requirePositiveInteger(value.expectedVersion, "expectedVersion"),
    membershipId: requireUuid(value.membershipId),
    status: value.status,
  };
}

export function decodeQueueAssignmentWrite(body: unknown): {
  readonly expectedVersion: number;
  readonly queueId: string;
} {
  const value = requireRecord(body);
  assertKeys(value, ["expectedVersion", "queueId"]);
  return {
    expectedVersion: requirePositiveInteger(value.expectedVersion, "expectedVersion"),
    queueId: requireUuid(value.queueId),
  };
}

export function decodeManualAssignmentWrite(body: unknown): {
  readonly assigneeMembershipId: string;
  readonly expectedVersion: number;
  readonly queueId: string;
} {
  const value = requireRecord(body);
  assertKeys(value, ["assigneeMembershipId", "expectedVersion", "queueId"]);
  return {
    assigneeMembershipId: requireUuid(value.assigneeMembershipId),
    expectedVersion: requirePositiveInteger(value.expectedVersion, "expectedVersion"),
    queueId: requireUuid(value.queueId),
  };
}

export function decodeWorkloadQuery(query: Readonly<Record<string, unknown>>): string | null {
  assertKeys(query, ["queueId"]);
  const queueId = optionalSingleString(query.queueId);
  return queueId === null ? null : requireUuid(queueId);
}

export function requireUuid(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new BadRequestException("identifier is invalid.");
  }
  return value;
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequestException("request body must be an object.");
  }
  return value as Record<string, unknown>;
}

function assertKeys(value: Readonly<Record<string, unknown>>, allowed: readonly string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new BadRequestException("request contains an unsupported field.");
  }
}

function requireTrimmedString(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number,
): string {
  if (typeof value !== "string") throw new BadRequestException(`${name} is required.`);
  const normalized = value.trim();
  const length = Array.from(normalized).length;
  if (length < minimum || length > maximum) {
    throw new BadRequestException(`${name} has an invalid length.`);
  }
  return normalized;
}

function optionalTrimmedString(value: unknown, name: string, maximum: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  return requireTrimmedString(value, name, 1, maximum);
}

function requirePositiveInteger(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new BadRequestException(`${name} must be a positive integer.`);
  }
  return Number(value);
}

function optionalPositiveInteger(
  value: unknown,
  name: string,
  fallback: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const text = optionalSingleString(value);
  if (text === null) return fallback;
  if (!/^[1-9][0-9]*$/.test(text)) {
    throw new BadRequestException(`${name} must be a positive integer.`);
  }
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    throw new BadRequestException(`${name} is outside the allowed range.`);
  }
  return parsed;
}

function optionalSingleString(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new BadRequestException("query value is invalid.");
  return value;
}

function normalizeEmail(value: unknown): string {
  const email = requireTrimmedString(value, "email", 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException("email is invalid.");
  }
  return email;
}
