import { BadRequestException } from "@nestjs/common";

import type { AuditListInput } from "../application/audit-query.service.js";

export function decodeAuditListQuery(query: Readonly<Record<string, unknown>>): AuditListInput {
  const allowed = [
    "action",
    "actorType",
    "actorUserId",
    "aggregateType",
    "from",
    "page",
    "pageSize",
    "to",
  ];
  if (Object.keys(query).some((key) => !allowed.includes(key))) {
    throw new BadRequestException("query contains an unsupported field.");
  }
  const actorType = optionalString(query.actorType, 20);
  if (actorType !== null && actorType !== "SYSTEM" && actorType !== "USER") {
    throw new BadRequestException("actorType is invalid.");
  }
  const from = optionalDate(query.from, "from");
  const to = optionalDate(query.to, "to");
  if (from && to && from > to) throw new BadRequestException("audit date range is invalid.");
  return {
    action: optionalString(query.action, 100),
    actorType,
    actorUserId: optionalUuid(query.actorUserId),
    aggregateType: optionalString(query.aggregateType, 80),
    from,
    page: positiveInteger(query.page, 1, 1_000_000),
    pageSize: positiveInteger(query.pageSize, 25, 100),
    to,
  };
}

function optionalDate(value: unknown, name: string): Date | null {
  const text = optionalString(value, 40);
  if (text === null) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`${name} is invalid.`);
  return date;
}

function optionalString(value: unknown, maximum: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > maximum) {
    throw new BadRequestException("query value is invalid.");
  }
  return value;
}

function optionalUuid(value: unknown): string | null {
  const text = optionalString(value, 36);
  if (text === null) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(text)) {
    throw new BadRequestException("actorUserId is invalid.");
  }
  return text;
}

function positiveInteger(value: unknown, fallback: number, maximum: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string" || !/^[1-9][0-9]*$/u.test(value)) {
    throw new BadRequestException("pagination value is invalid.");
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > maximum) {
    throw new BadRequestException("pagination value is outside the allowed range.");
  }
  return number;
}
