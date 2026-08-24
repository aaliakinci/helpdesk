import type { TicketPriority, TicketStatus } from "../api/ticketContract";

export type TicketAssignmentFilter = "ALL" | "MINE" | "UNASSIGNED";
export type TicketSortField = "createdAt" | "number" | "priority" | "updatedAt";
export type TicketSortDirection = "asc" | "desc";

export interface TicketListQuery {
  readonly assignment: TicketAssignmentFilter;
  readonly page: number;
  readonly pageSize: 10 | 25 | 50;
  readonly priority: TicketPriority | null;
  readonly queueId: string | null;
  readonly search: string;
  readonly sortBy: TicketSortField;
  readonly sortDirection: TicketSortDirection;
  readonly status: TicketStatus | null;
}

export const defaultTicketListQuery: TicketListQuery = {
  assignment: "ALL",
  page: 1,
  pageSize: 10,
  priority: null,
  queueId: null,
  search: "",
  sortBy: "updatedAt",
  sortDirection: "desc",
  status: null,
};

const ASSIGNMENTS: readonly TicketAssignmentFilter[] = ["ALL", "MINE", "UNASSIGNED"];
const PRIORITIES: readonly TicketPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];
const STATUSES: readonly TicketStatus[] = ["NEW", "OPEN", "PENDING", "RESOLVED", "CLOSED"];
const SORT_FIELDS: readonly TicketSortField[] = ["createdAt", "number", "priority", "updatedAt"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function parseTicketListQuery(search: string): TicketListQuery {
  const parameters = new URLSearchParams(search);
  const searchTerm = (parameters.get("search") ?? "").trim().slice(0, 120);
  return {
    assignment: fromAllowed(parameters.get("assignment"), ASSIGNMENTS) ?? "ALL",
    page: positiveInteger(parameters.get("page"), 1),
    pageSize: fromAllowed(parameters.get("pageSize"), ["10", "25", "50"] as const)
      ? (Number(parameters.get("pageSize")) as 10 | 25 | 50)
      : 10,
    priority: fromAllowed(parameters.get("priority"), PRIORITIES),
    queueId: UUID.test(parameters.get("queueId") ?? "") ? parameters.get("queueId") : null,
    search: searchTerm,
    sortBy: fromAllowed(parameters.get("sortBy"), SORT_FIELDS) ?? "updatedAt",
    sortDirection: fromAllowed(parameters.get("sortDirection"), ["asc", "desc"] as const) ?? "desc",
    status: fromAllowed(parameters.get("status"), STATUSES),
  };
}

export function serializeTicketListQuery(query: TicketListQuery): string {
  const parameters = new URLSearchParams();
  if (query.search) parameters.set("search", query.search.trim().slice(0, 120));
  if (query.status) parameters.set("status", query.status);
  if (query.priority) parameters.set("priority", query.priority);
  if (query.assignment !== "ALL") parameters.set("assignment", query.assignment);
  if (query.queueId) parameters.set("queueId", query.queueId);
  if (query.sortBy !== "updatedAt") parameters.set("sortBy", query.sortBy);
  if (query.sortDirection !== "desc") parameters.set("sortDirection", query.sortDirection);
  if (query.page !== 1) parameters.set("page", String(query.page));
  if (query.pageSize !== 10) parameters.set("pageSize", String(query.pageSize));
  const result = parameters.toString();
  return result ? `?${result}` : "";
}

function fromAllowed<Value extends string>(
  value: string | null,
  allowed: readonly Value[],
): Value | null {
  return value && allowed.includes(value as Value) ? (value as Value) : null;
}

function positiveInteger(value: string | null, fallback: number): number {
  if (!value || !/^[1-9][0-9]*$/u.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= 10_000 ? parsed : fallback;
}
