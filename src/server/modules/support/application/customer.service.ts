import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../../../platform/index.js";
import type { AuthenticatedIdentity } from "../../identity/domain/identity.types.js";
import { hasPermission } from "../../identity/domain/permissions.js";
import type { CustomerHistoryItem, CustomerSummary } from "./support.types.js";

@Injectable()
export class CustomerService {
  public constructor(private readonly prisma: PrismaService) {}

  public async listCustomers(identity: AuthenticatedIdentity): Promise<readonly CustomerSummary[]> {
    this.assertRead(identity);
    const customers = await this.prisma.customer.findMany({
      where: { tenantId: identity.tenantId },
      include: { contacts: { orderBy: { displayName: "asc" } } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return customers.map(toCustomerSummary);
  }

  public async getCustomer(
    identity: AuthenticatedIdentity,
    customerId: string,
  ): Promise<CustomerSummary> {
    this.assertRead(identity);
    const customer = await this.prisma.customer.findUnique({
      where: { tenantId_id: { tenantId: identity.tenantId, id: customerId } },
      include: { contacts: { orderBy: { displayName: "asc" } } },
    });
    if (!customer) throw new NotFoundException("Customer was not found.");
    return toCustomerSummary(customer);
  }

  public async createCustomer(
    identity: AuthenticatedIdentity,
    input: { readonly name: string },
  ): Promise<CustomerSummary> {
    this.assertManage(identity);
    const customer = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.customer.create({
        data: { name: input.name, tenantId: identity.tenantId },
        include: { contacts: true },
      });
      await transaction.customerHistoryEntry.create({
        data: {
          action: "customer.created",
          actorUserId: identity.userId,
          changes: { name: { to: input.name } },
          customerId: created.id,
          subjectId: created.id,
          subjectType: "customer",
          tenantId: identity.tenantId,
        },
      });
      return created;
    });
    return toCustomerSummary(customer);
  }

  public async updateCustomer(
    identity: AuthenticatedIdentity,
    customerId: string,
    input: { readonly expectedVersion: number; readonly name: string },
  ): Promise<CustomerSummary> {
    this.assertManage(identity);
    await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.customer.findUnique({
        where: { tenantId_id: { tenantId: identity.tenantId, id: customerId } },
      });
      if (!current) throw new NotFoundException("Customer was not found.");
      const advanced = await transaction.customer.updateMany({
        where: { id: customerId, tenantId: identity.tenantId, version: input.expectedVersion },
        data: { name: input.name, version: { increment: 1 } },
      });
      if (advanced.count !== 1) throw new ConflictException("Customer revision is stale.");
      await transaction.customerHistoryEntry.create({
        data: {
          action: "customer.updated",
          actorUserId: identity.userId,
          changes: { name: { from: current.name, to: input.name } },
          customerId,
          subjectId: customerId,
          subjectType: "customer",
          tenantId: identity.tenantId,
        },
      });
    });
    return this.getCustomer(identity, customerId);
  }

  public async createContact(
    identity: AuthenticatedIdentity,
    customerId: string,
    input: {
      readonly displayName: string;
      readonly email: string;
      readonly expectedVersion: number;
    },
  ): Promise<CustomerSummary> {
    this.assertManage(identity);
    try {
      await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.customer.findUnique({
          where: { tenantId_id: { tenantId: identity.tenantId, id: customerId } },
        });
        if (!current) throw new NotFoundException("Customer was not found.");
        const advanced = await transaction.customer.updateMany({
          where: { id: customerId, tenantId: identity.tenantId, version: input.expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (advanced.count !== 1) throw new ConflictException("Customer revision is stale.");
        const contact = await transaction.customerContact.create({
          data: {
            customerId,
            displayName: input.displayName,
            email: input.email,
            tenantId: identity.tenantId,
          },
        });
        await transaction.customerHistoryEntry.create({
          data: {
            action: "customer.contact.created",
            actorUserId: identity.userId,
            changes: { displayName: { to: input.displayName }, email: { to: input.email } },
            customerId,
            subjectId: contact.id,
            subjectType: "customer_contact",
            tenantId: identity.tenantId,
          },
        });
      });
    } catch (error: unknown) {
      if (isPrismaErrorCode(error, "P2002")) {
        throw new ConflictException("A contact with this email already exists.");
      }
      throw error;
    }
    return this.getCustomer(identity, customerId);
  }

  public async updateContact(
    identity: AuthenticatedIdentity,
    customerId: string,
    contactId: string,
    input: {
      readonly displayName: string;
      readonly email: string;
      readonly expectedVersion: number;
    },
  ): Promise<CustomerSummary> {
    this.assertManage(identity);
    try {
      await this.prisma.$transaction(async (transaction) => {
        const customer = await transaction.customer.findUnique({
          where: { tenantId_id: { tenantId: identity.tenantId, id: customerId } },
        });
        const contact = await transaction.customerContact.findFirst({
          where: { id: contactId, customerId, tenantId: identity.tenantId },
        });
        if (!customer || !contact) throw new NotFoundException("Customer contact was not found.");
        const advanced = await transaction.customer.updateMany({
          where: { id: customerId, tenantId: identity.tenantId, version: input.expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (advanced.count !== 1) throw new ConflictException("Customer revision is stale.");
        await transaction.customerContact.update({
          where: { id: contact.id },
          data: { displayName: input.displayName, email: input.email },
        });
        await transaction.customerHistoryEntry.create({
          data: {
            action: "customer.contact.updated",
            actorUserId: identity.userId,
            changes: {
              displayName: { from: contact.displayName, to: input.displayName },
              email: { from: contact.email, to: input.email },
            },
            customerId,
            subjectId: contact.id,
            subjectType: "customer_contact",
            tenantId: identity.tenantId,
          },
        });
      });
    } catch (error: unknown) {
      if (isPrismaErrorCode(error, "P2002")) {
        throw new ConflictException("A contact with this email already exists.");
      }
      throw error;
    }
    return this.getCustomer(identity, customerId);
  }

  public async listHistory(
    identity: AuthenticatedIdentity,
    customerId: string,
  ): Promise<readonly CustomerHistoryItem[]> {
    this.assertRead(identity);
    const customer = await this.prisma.customer.findUnique({
      where: { tenantId_id: { tenantId: identity.tenantId, id: customerId } },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException("Customer was not found.");
    const entries = await this.prisma.customerHistoryEntry.findMany({
      where: { customerId, tenantId: identity.tenantId },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    });
    return entries.map((entry) => ({
      action: entry.action,
      actorUserId: entry.actorUserId,
      changes: entry.changes,
      id: entry.id,
      occurredAtUtc: entry.occurredAt.toISOString(),
      subjectId: entry.subjectId,
      subjectType: entry.subjectType,
    }));
  }

  private assertRead(identity: AuthenticatedIdentity): void {
    if (!hasPermission(identity.role, "customers.read")) {
      throw new ForbiddenException("The operation is not permitted.");
    }
  }

  private assertManage(identity: AuthenticatedIdentity): void {
    if (!hasPermission(identity.role, "customers.manage")) {
      throw new ForbiddenException("The operation is not permitted.");
    }
  }
}

function toCustomerSummary(customer: {
  contacts: readonly {
    displayName: string;
    email: string;
    id: string;
    userId: string | null;
  }[];
  createdAt: Date;
  id: string;
  name: string;
  updatedAt: Date;
  version: number;
}): CustomerSummary {
  return {
    contacts: customer.contacts.map((contact) => ({
      displayName: contact.displayName,
      email: contact.email,
      id: contact.id,
      userId: contact.userId,
    })),
    createdAtUtc: customer.createdAt.toISOString(),
    id: customer.id,
    name: customer.name,
    updatedAtUtc: customer.updatedAt.toISOString(),
    version: customer.version,
  };
}

function isPrismaErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}
