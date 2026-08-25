import { Module } from "@nestjs/common";

import { PlatformModule } from "../../platform/index.js";
import { IdentityModule } from "../identity/index.js";
import { AuditQueryService } from "./application/audit-query.service.js";
import { AuditController } from "./presentation/audit.controller.js";

@Module({
  controllers: [AuditController],
  imports: [PlatformModule, IdentityModule],
  providers: [AuditQueryService],
})
export class AuditModule {}
