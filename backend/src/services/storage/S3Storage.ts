import { randomUUID } from "node:crypto";
import path from "node:path";
import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { StorageService, StoredObject } from "./StorageService";

export interface S3StorageConfig {
  endpoint: string; // e.g. https://<accountid>.r2.cloudflarestorage.com  (or Supabase S3 endpoint)
  region: string; // "auto" for R2
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string; // optional CDN/public URL prefix
}

/**
 * S3-compatible object storage. Works with Cloudflare R2 and Supabase Storage.
 * Files never touch the DB; the storage key is `<userId>/<uuid><ext>`.
 */
export class S3Storage implements StorageService {
  private readonly client: S3Client;

  constructor(private readonly config: S3StorageConfig) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region || "auto",
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true, // required by R2 & Supabase
    });
  }

  async put({
    userId,
    fileName,
    contentType,
    buffer,
  }: {
    userId: string;
    fileName: string;
    contentType: string;
    buffer: Buffer;
  }): Promise<StoredObject> {
    const ext = path.extname(fileName).toLowerCase();
    const key = `${userId}/${randomUUID()}${ext}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return { key };
  }

  async getStream(key: string): Promise<Readable> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
    if (!res.Body) throw new Error("Empty object body");
    return res.Body as Readable;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  getUrl(key: string): string {
    if (this.config.publicBaseUrl) {
      return `${this.config.publicBaseUrl.replace(/\/$/, "")}/${key}`;
    }
    // No public URL configured — files are served via the authenticated download route.
    return key;
  }
}
