import { Module } from "@nestjs/common";

import { PlatformModule } from "../../platform/index.js";
import { IdentityModule } from "../identity/index.js";
import { RealtimeAudienceService } from "./application/realtime-audience.service.js";
import { RealtimeRabbitMqBridgeService } from "./application/realtime-rabbitmq-bridge.service.js";
import { RealtimeGateway } from "./presentation/realtime.gateway.js";

@Module({
  imports: [PlatformModule, IdentityModule],
  providers: [RealtimeAudienceService, RealtimeGateway, RealtimeRabbitMqBridgeService],
})
export class RealtimeModule {}
