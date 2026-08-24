import { Module } from "@nestjs/common";

import { PlatformModule } from "../../platform/index.js";
import { IdentityModule } from "../identity/index.js";
import { SupportEventWriter } from "../support/application/support-event-writer.service.js";
import { SlaLifecycleService } from "./application/sla-lifecycle.service.js";
import { SlaPolicyService } from "./application/sla-policy.service.js";
import { SlaController } from "./presentation/sla.controller.js";

@Module({
  controllers: [SlaController],
  exports: [SlaLifecycleService],
  imports: [PlatformModule, IdentityModule],
  providers: [SlaLifecycleService, SlaPolicyService, SupportEventWriter],
})
export class SlaModule {}
