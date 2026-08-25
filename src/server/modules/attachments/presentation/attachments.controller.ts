import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";

import type { AuthenticatedIdentity } from "../../identity/domain/identity.types.js";
import { AccessTokenGuard, CurrentIdentity } from "../../identity/presentation/identity-http.js";
import { AttachmentService } from "../application/attachment.service.js";
import { decodeAttachmentWrite, requireUuid } from "./attachment-contracts.js";

interface MultipartFile {
  readonly buffer: Buffer;
  readonly mimetype: string;
  readonly originalname: string;
  readonly size: number;
}

interface HttpResponse {
  setHeader(name: string, value: string): void;
}

@ApiTags("attachments")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller("api/v1")
export class AttachmentsController {
  public constructor(private readonly attachments: AttachmentService) {}

  @Post("tickets/:ticketId/attachments")
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload a private, validated ticket attachment" })
  @UseInterceptors(
    FileInterceptor("file", { limits: { fields: 2, files: 1, fileSize: 10_485_760 } }),
  )
  public upload(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Param("ticketId") ticketId: string,
    @UploadedFile() file: MultipartFile | undefined,
    @Body() body: unknown,
  ) {
    return this.attachments.upload(identity, requireUuid(ticketId), {
      ...decodeAttachmentWrite(body),
      file,
    });
  }

  @Get("attachments/:attachmentId")
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  @ApiOperation({ summary: "Download an authorized private attachment" })
  public async download(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Param("attachmentId") attachmentId: string,
    @Res({ passthrough: true }) response: HttpResponse,
  ): Promise<StreamableFile> {
    const result = await this.attachments.download(identity, requireUuid(attachmentId));
    response.setHeader("Content-Type", result.attachment.contentType);
    response.setHeader("Content-Length", String(result.attachment.byteSize));
    response.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(result.attachment.fileName)}`,
    );
    return new StreamableFile(result.content);
  }
}
