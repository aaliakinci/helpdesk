import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from "@nestjs/swagger";

import {
  HealthService,
  RequestContextService,
  type LivenessReport,
  type ReadinessReport,
} from "../../../platform/index.js";

interface StatusResponse {
  status(statusCode: number): this;
}

@ApiTags("health")
@Controller("health")
export class HealthController {
  public constructor(
    private readonly health: HealthService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get("live")
  @ApiOperation({ summary: "Report API process liveness" })
  @ApiOkResponse({ description: "The API process is alive." })
  public liveness(): LivenessReport {
    return this.health.liveness("support-api", this.requestContext.traceId ?? "unavailable");
  }

  @Get("ready")
  @ApiOperation({ summary: "Report API dependency readiness" })
  @ApiOkResponse({ description: "All required dependencies are ready." })
  @ApiServiceUnavailableResponse({ description: "At least one required dependency is down." })
  public async readiness(
    @Res({ passthrough: true }) response: StatusResponse,
  ): Promise<ReadinessReport> {
    const report = await this.health.readiness(
      "support-api",
      this.requestContext.traceId ?? "unavailable",
    );
    response.status(report.status === "ready" ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return report;
  }
}
