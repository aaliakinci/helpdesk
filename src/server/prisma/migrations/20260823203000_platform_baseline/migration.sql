CREATE TABLE "platform_metadata" (
    "key" VARCHAR(100) NOT NULL,
    "value" VARCHAR(500) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_metadata_pkey" PRIMARY KEY ("key")
);

INSERT INTO "platform_metadata" ("key", "value")
VALUES ('schema_version', '1');
