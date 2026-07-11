import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import type { StorageService, StoredObject } from "./StorageService";

/**
 * Writes files to `<baseDir>/<userId>/<uuid><ext>`. The storage key is the path relative
 * to baseDir, so files stay scoped per user and are trivial to migrate to a bucket later.
 */
export class LocalDiskStorage implements StorageService {
  constructor(private readonly baseDir: string) {}

  private resolve(key: string): string {
    // Guard against path traversal in stored keys.
    const full = path.resolve(this.baseDir, key);
    if (!full.startsWith(path.resolve(this.baseDir))) {
      throw new Error("Invalid storage key");
    }
    return full;
  }

  async put({
    userId,
    fileName,
    buffer,
  }: {
    userId: string;
    fileName: string;
    contentType: string;
    buffer: Buffer;
  }): Promise<StoredObject> {
    const ext = path.extname(fileName).toLowerCase();
    const key = path.posix.join(userId, `${randomUUID()}${ext}`);
    const dest = this.resolve(key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, buffer);
    return { key };
  }

  async getStream(key: string): Promise<Readable> {
    const full = this.resolve(key);
    await fs.access(full); // throws if missing -> surfaces as 404 upstream
    return createReadStream(full);
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolve(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  getUrl(key: string): string {
    // Local files are served via the authenticated download route, not a direct URL.
    return key;
  }
}
