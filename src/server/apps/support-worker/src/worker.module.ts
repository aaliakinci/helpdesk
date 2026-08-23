import { Module } from "@nestjs/common";

import { PlatformModule } from "../../../platform/index.js";
import { WorkerHealthServer } from "./worker-health-server.service.js";

@Module({
  imports: [PlatformModule],
  providers: [WorkerHealthServer],
})
export class WorkerModule {}
