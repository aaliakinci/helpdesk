import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../platform/index.js";
import type { TenantRole } from "../../identity/domain/permissions.js";
import type { RealtimeEventProjection } from "../domain/realtime-invalidation.js";
import { realtimeQueueRoom, realtimeRoleRoom, realtimeUserRoom } from "../domain/realtime-rooms.js";

export interface ResolvedRealtimeEvent {
  readonly invalidation: RealtimeEventProjection["invalidation"];
  readonly rooms: readonly string[];
}

const STAFF_ROLES: readonly TenantRole[] = ["OWNER", "MANAGER", "AUDITOR"];

@Injectable()
export class RealtimeAudienceService {
  public constructor(private readonly prisma: PrismaService) {}

  public async resolve(
    tenantId: string,
    projection: RealtimeEventProjection,
  ): Promise<ResolvedRealtimeEvent | null> {
    const ticket = await this.prisma.ticket.findUnique({
      where: {
        tenantId_id: { id: projection.invalidation.ticketId, tenantId },
      },
      select: {
        currentQueueId: true,
        requesterContact: { select: { userId: true } },
      },
    });
    if (!ticket) return null;

    const rooms = new Set(STAFF_ROLES.map((role) => realtimeRoleRoom(tenantId, role)));
    const queueIds = new Set(projection.relatedQueueIds);
    if (ticket.currentQueueId) queueIds.add(ticket.currentQueueId);
    if (queueIds.size === 0) rooms.add(realtimeRoleRoom(tenantId, "AGENT"));
    for (const queueId of queueIds) rooms.add(realtimeQueueRoom(tenantId, queueId));
    if (projection.requesterVisible && ticket.requesterContact.userId) {
      rooms.add(realtimeUserRoom(tenantId, ticket.requesterContact.userId));
    }
    return { invalidation: projection.invalidation, rooms: [...rooms] };
  }
}
