import { Module } from "@nestjs/common";

import { PlatformModule } from "../../platform/index.js";
import { IdentityModule } from "../identity/index.js";
import { CustomerService } from "./application/customer.service.js";
import { TicketCommandService } from "./application/ticket-command.service.js";
import { TicketQueryService } from "./application/ticket-query.service.js";
import { CustomersController } from "./presentation/customers.controller.js";
import { TicketsController } from "./presentation/tickets.controller.js";

@Module({
  imports: [PlatformModule, IdentityModule],
  controllers: [CustomersController, TicketsController],
  providers: [CustomerService, TicketCommandService, TicketQueryService],
})
export class SupportModule {}
