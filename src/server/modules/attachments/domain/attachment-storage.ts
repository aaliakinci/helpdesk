export const ATTACHMENT_STORAGE = Symbol("ATTACHMENT_STORAGE");

export interface AttachmentStorage {
  delete(storageKey: string): Promise<void>;
  get(storageKey: string): Promise<Buffer>;
  put(storageKey: string, content: Buffer, contentType: string): Promise<void>;
}

export const ATTACHMENT_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/plain",
] as const;

export type AttachmentContentType = (typeof ATTACHMENT_CONTENT_TYPES)[number];
