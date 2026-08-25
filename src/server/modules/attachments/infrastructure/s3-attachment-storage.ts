import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import type { PlatformEnvironment } from "../../../platform/config/environment.js";
import type { AttachmentStorage } from "../domain/attachment-storage.js";

export class S3AttachmentStorage implements AttachmentStorage {
  private readonly bucket: string;
  private readonly client: S3Client;
  private readonly timeoutMs: number;

  public constructor(config: PlatformEnvironment) {
    if (
      !config.attachmentS3AccessKeyId ||
      !config.attachmentS3Bucket ||
      !config.attachmentS3Endpoint ||
      !config.attachmentS3Region ||
      !config.attachmentS3SecretAccessKey
    ) {
      throw new Error("S3 attachment storage configuration is incomplete.");
    }
    this.bucket = config.attachmentS3Bucket;
    this.timeoutMs = config.uploadTimeoutMs;
    this.client = new S3Client({
      credentials: {
        accessKeyId: config.attachmentS3AccessKeyId,
        secretAccessKey: config.attachmentS3SecretAccessKey,
      },
      endpoint: config.attachmentS3Endpoint,
      forcePathStyle: config.attachmentS3ForcePathStyle,
      region: config.attachmentS3Region,
    });
  }

  public async delete(storageKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }), {
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
  }

  public async get(storageKey: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      { abortSignal: AbortSignal.timeout(this.timeoutMs) },
    );
    if (!result.Body) throw new Error("Attachment object body is missing.");
    return Buffer.from(await result.Body.transformToByteArray());
  }

  public async put(storageKey: string, content: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Body: content,
        Bucket: this.bucket,
        ContentLength: content.byteLength,
        ContentType: contentType,
        Key: storageKey,
      }),
      { abortSignal: AbortSignal.timeout(this.timeoutMs) },
    );
  }
}
