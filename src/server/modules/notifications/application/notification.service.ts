import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../../platform/index.js";
import type { AuthenticatedIdentity } from "../../identity/index.js";

export interface NotificationItem {
  readonly createdAtUtc: string;
  readonly id: string;
  readonly kind: string;
  readonly readAtUtc: string | null;
  readonly subject: string | null;
  readonly ticketId: string | null;
  readonly ticketNumber: number | null;
}

@Injectable()
export class NotificationService {
  public constructor(private readonly prisma: PrismaService) {}

  public async list(identity: AuthenticatedIdentity): Promise<{
    readonly cursor: { readonly createdAtUtc: string; readonly id: string } | null;
    readonly items: readonly NotificationItem[];
    readonly unreadCount: number;
  }> {
    const where = {
      recipientMembershipId: identity.membershipId,
      tenantId: identity.tenantId,
    } as const;
    const [rows, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
        where,
      }),
      this.prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    const items = rows.map(toNotificationItem);
    const newest = items[0];
    return {
      cursor: newest ? { createdAtUtc: newest.createdAtUtc, id: newest.id } : null,
      items,
      unreadCount,
    };
  }

  public async markRead(identity: AuthenticatedIdentity, notificationId: string): Promise<void> {
    const updated = await this.prisma.notification.updateMany({
      data: { readAt: new Date() },
      where: {
        id: notificationId,
        recipientMembershipId: identity.membershipId,
        tenantId: identity.tenantId,
      },
    });
    if (updated.count !== 1) throw new NotFoundException("Notification was not found.");
  }

  public async markAllRead(identity: AuthenticatedIdentity): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      data: { readAt: new Date() },
      where: {
        readAt: null,
        recipientMembershipId: identity.membershipId,
        tenantId: identity.tenantId,
      },
    });
    return result.count;
  }
}

function toNotificationItem(notification: {
  createdAt: Date;
  id: string;
  kind: string;
  payload: unknown;
  readAt: Date | null;
  ticketId: string | null;
}): NotificationItem {
  const payload = asRecord(notification.payload);
  const knownAssignment = notification.kind === "TICKET_AUTO_ASSIGNED";
  return {
    createdAtUtc: notification.createdAt.toISOString(),
    id: notification.id,
    kind: notification.kind,
    readAtUtc: notification.readAt?.toISOString() ?? null,
    subject: knownAssignment && typeof payload?.subject === "string" ? payload.subject : null,
    ticketId: notification.ticketId,
    ticketNumber:
      knownAssignment && Number.isInteger(payload?.ticketNumber)
        ? Number(payload?.ticketNumber)
        : null,
  };
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}
