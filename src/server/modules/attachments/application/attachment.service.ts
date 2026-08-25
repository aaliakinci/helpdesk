import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { basename } from "node:path";
import { fileTypeFromBuffer } from "file-type";

import {
  PlatformConfigService,
  PrismaService,
  writeStructuredLog,
} from "../../../platform/index.js";
import type { AuthenticatedIdentity } from "../../identity/domain/identity.types.js";
import { hasPermission } from "../../identity/domain/permissions.js";
import { SupportEventWriter } from "../../support/application/support-event-writer.service.js";
import { ticketReadScope } from "../../support/application/ticket-access.js";
import {
  ATTACHMENT_CONTENT_TYPES,
  ATTACHMENT_STORAGE,
  type AttachmentContentType,
  type AttachmentStorage,
} from "../domain/attachment-storage.js";

export interface AttachmentView {
  readonly byteSize: number;
  readonly commentId: string | null;
  readonly contentType: AttachmentContentType;
  readonly createdAtUtc: string;
  readonly createdBy: { readonly displayName: string; readonly id: string };
  readonly fileName: string;
  readonly id: string;
  readonly visibility: "INTERNAL" | "PUBLIC";
}

interface UploadedFile {
  readonly buffer: Buffer;
  readonly mimetype: string;
  readonly originalname: string;
  readonly size: number;
}

@Injectable()
export class AttachmentService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly config: PlatformConfigService,
    private readonly events: SupportEventWriter,
    @Inject(ATTACHMENT_STORAGE) private readonly storage: AttachmentStorage,
  ) {}

  public async upload(
    identity: AuthenticatedIdentity,
    ticketId: string,
    input: {
      readonly commentId: string | null;
      readonly file: UploadedFile | undefined;
      readonly visibility: "INTERNAL" | "PUBLIC";
    },
  ): Promise<AttachmentView> {
    const file = input.file;
    if (!file) throw new BadRequestException("An attachment file is required.");
    this.assertCanUpload(identity, input.visibility);
    if (
      file.size !== file.buffer.byteLength ||
      file.size < 1 ||
      file.size > this.config.values.attachmentMaxBytes
    ) {
      throw new BadRequestException("Attachment size is outside the allowed range.");
    }
    const ticket = await this.findTicket(identity, ticketId);
    if (ticket.status === "CLOSED") throw new ConflictException("Closed tickets are immutable.");
    if (input.commentId) {
      const comment = await this.prisma.ticketComment.findUnique({
        where: { tenantId_id: { id: input.commentId, tenantId: identity.tenantId } },
        select: { ticketId: true, visibility: true },
      });
      if (
        !comment ||
        comment.ticketId !== ticket.id ||
        comment.visibility !== input.visibility ||
        (identity.role === "REQUESTER" && comment.visibility !== "PUBLIC")
      ) {
        throw new NotFoundException("Ticket comment was not found.");
      }
    }

    const contentType = await detectContentType(file.buffer);
    if (normalizeContentType(file.mimetype) !== contentType) {
      throw new BadRequestException("Declared and detected attachment types do not match.");
    }
    const fileName = normalizeFileName(file.originalname);
    const checksumSha256 = createHash("sha256").update(file.buffer).digest("hex");
    const storageKey = `${identity.tenantId}/${randomUUID()}`;
    try {
      await this.storage.put(storageKey, file.buffer, contentType);
    } catch (error: unknown) {
      writeStructuredLog("support-api", "error", "attachment.object.write_failed", {
        reason: safeStorageFailureReason(error),
        tenantId: identity.tenantId,
      });
      throw new ServiceUnavailableException("Attachment storage is unavailable.");
    }

    try {
      const attachment = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.attachment.create({
          data: {
            byteSize: file.buffer.byteLength,
            checksumSha256,
            commentId: input.commentId,
            contentType,
            createdByUserId: identity.userId,
            fileName,
            storageKey,
            tenantId: identity.tenantId,
            ticketId: ticket.id,
            visibility: input.visibility,
          },
          include: { createdBy: { select: { displayName: true, id: true } } },
        });
        await this.events.write(transaction, identity, {
          action: "ticket.attachment.added",
          aggregateId: ticket.id,
          aggregateType: "ticket",
          eventType: "ticket.attachment-added.v1",
          metadata: {
            attachmentId: created.id,
            byteSize: file.buffer.byteLength,
            contentType,
            visibility: input.visibility,
          },
          payload: {
            attachmentId: created.id,
            ticketId: ticket.id,
            ticketNumber: ticket.number,
            version: ticket.version,
            visibility: input.visibility,
          },
        });
        return created;
      });
      return toAttachmentView(attachment);
    } catch (error: unknown) {
      await this.storage.delete(storageKey).catch((cleanupError: unknown) => {
        writeStructuredLog("support-api", "error", "attachment.orphan_cleanup.failed", {
          reason: cleanupError instanceof Error ? cleanupError.name : "UnknownError",
        });
      });
      throw error;
    }
  }

  public async download(
    identity: AuthenticatedIdentity,
    attachmentId: string,
  ): Promise<{ readonly attachment: AttachmentView; readonly content: Buffer }> {
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        tenantId: identity.tenantId,
        ticket: { is: ticketReadScope(identity) },
        ...(identity.role === "REQUESTER" ? { visibility: "PUBLIC" } : {}),
      },
      include: { createdBy: { select: { displayName: true, id: true } } },
    });
    if (!attachment) throw new NotFoundException("Attachment was not found.");
    let content: Buffer;
    try {
      content = await this.storage.get(attachment.storageKey);
    } catch (error: unknown) {
      writeStructuredLog("support-api", "error", "attachment.object.unavailable", {
        attachmentId: attachment.id,
        reason: error instanceof Error ? error.name : "UnknownError",
        tenantId: attachment.tenantId,
      });
      throw new ServiceUnavailableException("Attachment content is unavailable.");
    }
    const checksum = createHash("sha256").update(content).digest("hex");
    if (!attachment.checksumSha256 || checksum !== attachment.checksumSha256) {
      writeStructuredLog("support-api", "error", "attachment.integrity.failed", {
        attachmentId: attachment.id,
        tenantId: attachment.tenantId,
      });
      throw new ServiceUnavailableException("Attachment integrity verification failed.");
    }
    return { attachment: toAttachmentView(attachment), content };
  }

  private async findTicket(identity: AuthenticatedIdentity, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { AND: [ticketReadScope(identity)], id: ticketId },
      select: { id: true, number: true, status: true, version: true },
    });
    if (!ticket) throw new NotFoundException("Ticket was not found.");
    return ticket;
  }

  private assertCanUpload(
    identity: AuthenticatedIdentity,
    visibility: "INTERNAL" | "PUBLIC",
  ): void {
    if (identity.role === "REQUESTER") {
      if (visibility !== "PUBLIC")
        throw new ForbiddenException("Requester attachments must be public.");
      return;
    }
    if (!hasPermission(identity.role, "tickets.manage")) {
      throw new ForbiddenException("The operation is not permitted.");
    }
  }
}

async function detectContentType(content: Buffer): Promise<AttachmentContentType> {
  const detected = await fileTypeFromBuffer(content).catch(() => null);
  if (detected && ATTACHMENT_CONTENT_TYPES.includes(detected.mime as AttachmentContentType)) {
    return detected.mime as AttachmentContentType;
  }
  if (!detected && isSafePlainText(content)) return "text/plain";
  throw new BadRequestException("Attachment type is not allowed.");
}

function isSafePlainText(content: Buffer): boolean {
  if (content.includes(0)) return false;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(content);
    return !Array.from(text).some((character) => isUnsafeTextControl(character, true));
  } catch {
    return false;
  }
}

function normalizeContentType(value: string): string {
  return value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function normalizeFileName(value: string): string {
  const normalized = Array.from(basename(value.normalize("NFC")))
    .filter((character) => !isUnsafeTextControl(character, false))
    .join("")
    .trim();
  if (!normalized || normalized === "." || normalized === "..") {
    throw new BadRequestException("Attachment file name is invalid.");
  }
  return Array.from(normalized).slice(0, 180).join("");
}

function isUnsafeTextControl(character: string, allowWhitespace: boolean): boolean {
  const code = character.codePointAt(0) ?? 0;
  if (allowWhitespace && (code === 9 || code === 10 || code === 13)) return false;
  return code <= 31 || code === 127;
}

function safeStorageFailureReason(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    if (typeof code === "string" && /^[A-Z][A-Z0-9_]{0,39}$/u.test(code)) return code;
  }
  return error instanceof Error ? error.name : "UnknownError";
}

function toAttachmentView(attachment: {
  readonly byteSize: bigint;
  readonly commentId: string | null;
  readonly contentType: string;
  readonly createdAt: Date;
  readonly createdBy: { readonly displayName: string; readonly id: string };
  readonly fileName: string;
  readonly id: string;
  readonly visibility: "INTERNAL" | "PUBLIC";
}): AttachmentView {
  return {
    byteSize: Number(attachment.byteSize),
    commentId: attachment.commentId,
    contentType: attachment.contentType as AttachmentContentType,
    createdAtUtc: attachment.createdAt.toISOString(),
    createdBy: attachment.createdBy,
    fileName: attachment.fileName,
    id: attachment.id,
    visibility: attachment.visibility,
  };
}
