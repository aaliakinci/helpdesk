import { MiddlewareConsumer, Module, type NestModule, RequestMethod } from "@nestjs/common";

import { PlatformModule, RequestContextMiddleware } from "../../../platform/index.js";
import { IdentityModule } from "../../../modules/identity/index.js";
import { NotificationsModule } from "../../../modules/notifications/index.js";
import { RealtimeModule } from "../../../modules/realtime/index.js";
import { SupportModule } from "../../../modules/support/index.js";
import { HealthController } from "./health.controller.js";
import { SystemController } from "./system.controller.js";

@Module({
  imports: [PlatformModule, IdentityModule, NotificationsModule, RealtimeModule, SupportModule],
  controllers: [HealthController, SystemController],
})
export class AppModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes({ path: "*splat", method: RequestMethod.ALL });
  }
}
