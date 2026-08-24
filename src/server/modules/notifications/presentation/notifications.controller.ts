import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import type { AuthenticatedIdentity } from "../../identity/index.js";
import { AccessTokenGuard, CurrentIdentity } from "../../identity/presentation/identity-http.js";
import { requireUuid } from "../../support/presentation/support-contracts.js";
import { NotificationService } from "../application/notification.service.js";

@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller("api/v1/notifications")
export class NotificationsController {
  public constructor(private readonly notifications: NotificationService) {}

  @Get()
  @ApiOperation({ summary: "List notifications for the active tenant membership" })
  public list(@CurrentIdentity() identity: AuthenticatedIdentity) {
    return this.notifications.list(identity);
  }

  @Post("read-all")
  @ApiOperation({ summary: "Mark all active-membership notifications as read" })
  public async markAllRead(@CurrentIdentity() identity: AuthenticatedIdentity) {
    return { updatedCount: await this.notifications.markAllRead(identity) };
  }

  @Post(":notificationId/read")
  @ApiOperation({ summary: "Mark one active-membership notification as read" })
  public async markRead(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Param("notificationId") notificationId: string,
  ) {
    await this.notifications.markRead(identity, requireUuid(notificationId));
    return { updated: true };
  }
}
