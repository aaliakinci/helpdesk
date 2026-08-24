import { Module } from "@nestjs/common";

import { PlatformModule } from "../../platform/index.js";
import { IdentityModule } from "../identity/index.js";
import { NotificationService } from "./application/notification.service.js";
import { NotificationsController } from "./presentation/notifications.controller.js";

@Module({
  controllers: [NotificationsController],
  imports: [PlatformModule, IdentityModule],
  providers: [NotificationService],
})
export class NotificationsModule {}
