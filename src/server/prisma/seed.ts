import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  DEMO_EMAILS,
  DEMO_MEMBERSHIPS,
  DEMO_TENANTS,
  DEMO_USERS,
} from "../modules/identity/demo/demo-identities.js";
import { PasswordHasher } from "../modules/identity/security/password-hasher.js";
import { PrismaClient } from "../platform/database/generated/client.js";

const customerId = "00000000-0000-4000-8000-000000000301";
const requesterContactId = "00000000-0000-4000-8000-000000000401";

async function seed(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const demoPassword = process.env.DEMO_SEED_PASSWORD;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for seeding.");
  if (!demoPassword) throw new Error("DEMO_SEED_PASSWORD is required for seeding.");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const passwordHasher = new PasswordHasher();
  try {
    await prisma.$connect();
    await prisma.$transaction(async (transaction) => {
      await transaction.tenant.upsert({
        where: { id: DEMO_TENANTS.acme },
        create: {
          id: DEMO_TENANTS.acme,
          name: "Acme Support",
          slug: "acme-support",
          status: "ACTIVE",
          timeZone: "Europe/Istanbul",
        },
        update: { name: "Acme Support", status: "ACTIVE", timeZone: "Europe/Istanbul" },
      });
      await transaction.tenant.upsert({
        where: { id: DEMO_TENANTS.globex },
        create: {
          id: DEMO_TENANTS.globex,
          name: "Globex Service",
          slug: "globex-service",
          status: "ACTIVE",
          timeZone: "Europe/London",
        },
        update: { name: "Globex Service", status: "ACTIVE", timeZone: "Europe/London" },
      });

      const users = [
        {
          id: DEMO_USERS.owner,
          email: DEMO_EMAILS.owner,
          displayName: "Demo Owner",
          status: "ACTIVE" as const,
        },
        {
          id: DEMO_USERS.manager,
          email: DEMO_EMAILS.manager,
          displayName: "Demo Manager",
          status: "ACTIVE" as const,
        },
        {
          id: DEMO_USERS.agent,
          email: DEMO_EMAILS.agent,
          displayName: "Demo Agent",
          status: "ACTIVE" as const,
        },
        {
          id: DEMO_USERS.requester,
          email: DEMO_EMAILS.requester,
          displayName: "Demo Requester",
          status: "ACTIVE" as const,
        },
        {
          id: DEMO_USERS.auditor,
          email: DEMO_EMAILS.auditor,
          displayName: "Demo Auditor",
          status: "ACTIVE" as const,
        },
        {
          id: DEMO_USERS.globexAgent,
          email: DEMO_EMAILS.globexAgent,
          displayName: "Globex Agent",
          status: "ACTIVE" as const,
        },
        {
          id: DEMO_USERS.disabled,
          email: DEMO_EMAILS.disabled,
          displayName: "Disabled Demo User",
          status: "DISABLED" as const,
        },
      ];
      for (const user of users) {
        const passwordHash = await passwordHasher.hash(demoPassword);
        await transaction.user.upsert({
          where: { id: user.id },
          create: { ...user, passwordHash },
          update: {
            displayName: user.displayName,
            email: user.email,
            passwordHash,
            status: user.status,
          },
        });
      }

      await transaction.customer.upsert({
        where: { id: customerId },
        create: { id: customerId, name: "Northwind Demo Customer", tenantId: DEMO_TENANTS.acme },
        update: { name: "Northwind Demo Customer" },
      });
      await transaction.customerContact.upsert({
        where: { id: requesterContactId },
        create: {
          customerId,
          displayName: "Demo Requester",
          email: DEMO_EMAILS.requester,
          id: requesterContactId,
          tenantId: DEMO_TENANTS.acme,
          userId: DEMO_USERS.requester,
        },
        update: {
          displayName: "Demo Requester",
          email: DEMO_EMAILS.requester,
          userId: DEMO_USERS.requester,
        },
      });

      const memberships = [
        {
          id: DEMO_MEMBERSHIPS.acmeOwner,
          tenantId: DEMO_TENANTS.acme,
          userId: DEMO_USERS.owner,
          role: "OWNER" as const,
          status: "ACTIVE" as const,
          customerContactId: null,
        },
        {
          id: DEMO_MEMBERSHIPS.globexOwner,
          tenantId: DEMO_TENANTS.globex,
          userId: DEMO_USERS.owner,
          role: "OWNER" as const,
          status: "ACTIVE" as const,
          customerContactId: null,
        },
        {
          id: DEMO_MEMBERSHIPS.acmeManager,
          tenantId: DEMO_TENANTS.acme,
          userId: DEMO_USERS.manager,
          role: "MANAGER" as const,
          status: "ACTIVE" as const,
          customerContactId: null,
        },
        {
          id: DEMO_MEMBERSHIPS.acmeAgent,
          tenantId: DEMO_TENANTS.acme,
          userId: DEMO_USERS.agent,
          role: "AGENT" as const,
          status: "ACTIVE" as const,
          customerContactId: null,
        },
        {
          id: DEMO_MEMBERSHIPS.acmeRequester,
          tenantId: DEMO_TENANTS.acme,
          userId: DEMO_USERS.requester,
          role: "REQUESTER" as const,
          status: "ACTIVE" as const,
          customerContactId: requesterContactId,
        },
        {
          id: DEMO_MEMBERSHIPS.acmeAuditor,
          tenantId: DEMO_TENANTS.acme,
          userId: DEMO_USERS.auditor,
          role: "AUDITOR" as const,
          status: "ACTIVE" as const,
          customerContactId: null,
        },
        {
          id: DEMO_MEMBERSHIPS.globexAgent,
          tenantId: DEMO_TENANTS.globex,
          userId: DEMO_USERS.globexAgent,
          role: "AGENT" as const,
          status: "ACTIVE" as const,
          customerContactId: null,
        },
        {
          id: DEMO_MEMBERSHIPS.acmeDisabled,
          tenantId: DEMO_TENANTS.acme,
          userId: DEMO_USERS.disabled,
          role: "AGENT" as const,
          status: "DISABLED" as const,
          customerContactId: null,
        },
      ];
      for (const membership of memberships) {
        await transaction.tenantMembership.upsert({
          where: { id: membership.id },
          create: membership,
          update: {
            customerContactId: membership.customerContactId,
            role: membership.role,
            status: membership.status,
            tenantId: membership.tenantId,
            userId: membership.userId,
          },
        });
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}

void seed().catch((error: unknown) => {
  process.stderr.write(
    `Demo seed failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
  );
  process.exitCode = 1;
});
