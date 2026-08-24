import { Module } from "@nestjs/common";

import { PlatformModule } from "../../../platform/index.js";
import { MessagingModule } from "../../../modules/messaging/index.js";
import { SlaWorkerModule } from "../../../modules/sla/index.js";
import { WorkerHealthServer } from "./worker-health-server.service.js";

@Module({
  imports: [PlatformModule, MessagingModule, SlaWorkerModule],
  providers: [WorkerHealthServer],
})
export class WorkerModule {}
