import "dotenv/config";

import { defineConfig } from "prisma/config";

const localGenerateUrl = "postgresql://generate:generate@127.0.0.1:5432/helpdesk";

export default defineConfig({
  schema: "src/server/prisma/schema.prisma",
  migrations: {
    path: "src/server/prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? localGenerateUrl,
  },
});
