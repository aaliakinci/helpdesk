import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
  HealthService,
  RequestContextService,
  type ReadinessReport,
} from "../../../platform/index.js";

@ApiTags("system")
@Controller("api/v1/system")
export class SystemController {
  public constructor(
    private readonly health: HealthService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get("status")
  @ApiOperation({ summary: "Return the public platform readiness status" })
  @ApiOkResponse({ description: "The current platform readiness state." })
  public async status(): Promise<ReadinessReport> {
    return this.health.readiness("support-api", this.requestContext.traceId ?? "unavailable");
  }
}
