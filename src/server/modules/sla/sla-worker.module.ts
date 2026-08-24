import { Module } from "@nestjs/common";

import { PlatformModule } from "../../platform/index.js";
import { SupportEventWriter } from "../support/application/support-event-writer.service.js";
import { SlaSchedulerService } from "./application/sla-scheduler.service.js";

@Module({
  exports: [SlaSchedulerService],
  imports: [PlatformModule],
  providers: [SlaSchedulerService, SupportEventWriter],
})
export class SlaWorkerModule {}
