import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import type { AuthenticatedIdentity } from "../../identity/domain/identity.types.js";
import {
  AccessTokenGuard,
  CurrentIdentity,
  PermissionGuard,
  RequirePermission,
} from "../../identity/presentation/identity-http.js";
import { CustomerService } from "../application/customer.service.js";
import {
  decodeContactWrite,
  decodeCreateCustomer,
  decodeUpdateCustomer,
  requireUuid,
} from "./support-contracts.js";

@ApiTags("customers")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, PermissionGuard)
@RequirePermission("customers.read")
@Controller("api/v1/customers")
export class CustomersController {
  public constructor(private readonly customers: CustomerService) {}

  @Get()
  @ApiOperation({ summary: "List customers and contacts in the active tenant" })
  public list(@CurrentIdentity() identity: AuthenticatedIdentity) {
    return this.customers.listCustomers(identity);
  }

  @Post()
  @RequirePermission("customers.manage")
  @ApiOperation({ summary: "Create an active-tenant customer" })
  public create(@CurrentIdentity() identity: AuthenticatedIdentity, @Body() body: unknown) {
    return this.customers.createCustomer(identity, decodeCreateCustomer(body));
  }

  @Get(":customerId")
  @ApiOperation({ summary: "Read an active-tenant customer" })
  public get(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Param("customerId") customerId: string,
  ) {
    return this.customers.getCustomer(identity, requireUuid(customerId));
  }

  @Patch(":customerId")
  @RequirePermission("customers.manage")
  @ApiOperation({ summary: "Update a customer with optimistic concurrency" })
  public update(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Param("customerId") customerId: string,
    @Body() body: unknown,
  ) {
    return this.customers.updateCustomer(
      identity,
      requireUuid(customerId),
      decodeUpdateCustomer(body),
    );
  }

  @Post(":customerId/contacts")
  @RequirePermission("customers.manage")
  @ApiOperation({ summary: "Add a contact to an active-tenant customer" })
  public createContact(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Param("customerId") customerId: string,
    @Body() body: unknown,
  ) {
    return this.customers.createContact(
      identity,
      requireUuid(customerId),
      decodeContactWrite(body),
    );
  }

  @Patch(":customerId/contacts/:contactId")
  @RequirePermission("customers.manage")
  @ApiOperation({ summary: "Update a customer contact with aggregate revision protection" })
  public updateContact(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Param("customerId") customerId: string,
    @Param("contactId") contactId: string,
    @Body() body: unknown,
  ) {
    return this.customers.updateContact(
      identity,
      requireUuid(customerId),
      requireUuid(contactId),
      decodeContactWrite(body),
    );
  }

  @Get(":customerId/history")
  @ApiOperation({ summary: "Read customer and contact change history" })
  public history(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Param("customerId") customerId: string,
  ) {
    return this.customers.listHistory(identity, requireUuid(customerId));
  }
}
