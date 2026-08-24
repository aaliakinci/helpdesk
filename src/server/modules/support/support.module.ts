import { Module } from "@nestjs/common";

import { PlatformModule } from "../../platform/index.js";
import { IdentityModule } from "../identity/index.js";
import { SlaModule } from "../sla/index.js";
import { CustomerService } from "./application/customer.service.js";
import { AssignmentCommandService } from "./application/assignment-command.service.js";
import { OperationsQueryService } from "./application/operations-query.service.js";
import { QueueCommandService } from "./application/queue-command.service.js";
import { QueueQueryService } from "./application/queue-query.service.js";
import { SupportEventWriter } from "./application/support-event-writer.service.js";
import { TicketCommandService } from "./application/ticket-command.service.js";
import { TicketQueryService } from "./application/ticket-query.service.js";
import { CustomersController } from "./presentation/customers.controller.js";
import { OperationsController } from "./presentation/operations.controller.js";
import { QueuesController } from "./presentation/queues.controller.js";
import { TicketsController } from "./presentation/tickets.controller.js";

@Module({
  imports: [PlatformModule, IdentityModule, SlaModule],
  controllers: [CustomersController, OperationsController, QueuesController, TicketsController],
  providers: [
    AssignmentCommandService,
    CustomerService,
    OperationsQueryService,
    QueueCommandService,
    QueueQueryService,
    SupportEventWriter,
    TicketCommandService,
    TicketQueryService,
  ],
})
export class SupportModule {}
