import { BadRequestException } from "@nestjs/common";

export function decodeAttachmentWrite(body: unknown): {
  readonly commentId: string | null;
  readonly visibility: "INTERNAL" | "PUBLIC";
} {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequestException("multipart fields are invalid.");
  }
  const value = body as Readonly<Record<string, unknown>>;
  if (Object.keys(value).some((key) => key !== "commentId" && key !== "visibility")) {
    throw new BadRequestException("request contains an unsupported field.");
  }
  const visibility = value.visibility ?? "PUBLIC";
  if (visibility !== "PUBLIC" && visibility !== "INTERNAL") {
    throw new BadRequestException("visibility is invalid.");
  }
  return {
    commentId:
      value.commentId === undefined || value.commentId === null || value.commentId === ""
        ? null
        : requireUuid(value.commentId),
    visibility,
  };
}

export function requireUuid(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)
  ) {
    throw new BadRequestException("identifier is invalid.");
  }
  return value;
}
