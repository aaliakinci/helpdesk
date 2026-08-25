import { Module } from "@nestjs/common";

import { PlatformConfigService, PlatformModule } from "../../platform/index.js";
import { IdentityModule } from "../identity/index.js";
import { SupportEventWriter } from "../support/application/support-event-writer.service.js";
import { AttachmentService } from "./application/attachment.service.js";
import { ATTACHMENT_STORAGE, type AttachmentStorage } from "./domain/attachment-storage.js";
import { LocalAttachmentStorage } from "./infrastructure/local-attachment-storage.js";
import { S3AttachmentStorage } from "./infrastructure/s3-attachment-storage.js";
import { AttachmentsController } from "./presentation/attachments.controller.js";

@Module({
  controllers: [AttachmentsController],
  exports: [AttachmentService],
  imports: [PlatformModule, IdentityModule],
  providers: [
    AttachmentService,
    SupportEventWriter,
    {
      inject: [PlatformConfigService],
      provide: ATTACHMENT_STORAGE,
      useFactory: async (config: PlatformConfigService): Promise<AttachmentStorage> => {
        if (config.values.attachmentStorageDriver === "s3") {
          return new S3AttachmentStorage(config.values);
        }
        const storage = new LocalAttachmentStorage(config.values.attachmentLocalDirectory);
        await storage.ensureReady();
        return storage;
      },
    },
  ],
})
export class AttachmentsModule {}
