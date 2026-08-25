import { constants } from "node:fs";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { AttachmentStorage } from "../domain/attachment-storage.js";

export class LocalAttachmentStorage implements AttachmentStorage {
  private readonly root: string;

  public constructor(directory: string) {
    this.root = resolve(directory);
  }

  public async delete(storageKey: string): Promise<void> {
    await rm(this.pathFor(storageKey), { force: true });
  }

  public async ensureReady(): Promise<void> {
    await mkdir(this.root, { mode: 0o700, recursive: true });
    await access(this.root, constants.R_OK | constants.W_OK | constants.X_OK);
  }

  public get(storageKey: string): Promise<Buffer> {
    return readFile(this.pathFor(storageKey));
  }

  public async put(storageKey: string, content: Buffer): Promise<void> {
    const path = this.pathFor(storageKey);
    await mkdir(dirname(path), { mode: 0o700, recursive: true });
    await writeFile(path, content, { flag: "wx", mode: 0o600 });
  }

  private pathFor(storageKey: string): string {
    assertStorageKey(storageKey);
    const path = resolve(this.root, ...storageKey.split("/"));
    if (!path.startsWith(`${this.root}/`))
      throw new Error("Attachment storage key escaped its root.");
    return path;
  }
}

function assertStorageKey(value: string): void {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value,
    )
  ) {
    throw new Error("Attachment storage key is invalid.");
  }
}
