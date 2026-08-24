import { ForbiddenException } from "@nestjs/common";

import type { Prisma } from "../../../platform/database/generated/client.js";
import type { AuthenticatedIdentity } from "../../identity/domain/identity.types.js";
import { hasPermission } from "../../identity/domain/permissions.js";

export function ticketReadScope(identity: AuthenticatedIdentity): Prisma.TicketWhereInput {
  if (identity.role === "REQUESTER") {
    if (!hasPermission(identity.role, "tickets.read-own") || !identity.customerContactId) {
      throw new ForbiddenException("The operation is not permitted.");
    }
    return { requesterContactId: identity.customerContactId, tenantId: identity.tenantId };
  }
  if (!hasPermission(identity.role, "tickets.read")) {
    throw new ForbiddenException("The operation is not permitted.");
  }
  if (identity.role === "AGENT") {
    return {
      OR: [
        { currentQueueId: null },
        {
          currentQueue: {
            members: {
              some: { membershipId: identity.membershipId, status: "ACTIVE" },
            },
          },
        },
      ],
      tenantId: identity.tenantId,
    };
  }
  return { tenantId: identity.tenantId };
}
