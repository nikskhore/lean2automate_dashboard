import path from "node:path";
import { env } from "../../config/env";
import { LocalDiskStorage } from "./LocalDiskStorage";
import { S3Storage } from "./S3Storage";
import type { StorageService } from "./StorageService";

// Factory: pick the storage driver from config.
function createStorage(): StorageService {
  if (env.STORAGE_DRIVER === "s3") {
    const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = env;
    if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
      throw new Error(
        "STORAGE_DRIVER=s3 requires S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY",
      );
    }
    return new S3Storage({
      endpoint: S3_ENDPOINT,
      region: env.S3_REGION,
      bucket: S3_BUCKET,
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
      publicBaseUrl: env.S3_PUBLIC_URL,
    });
  }
  const baseDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
  return new LocalDiskStorage(baseDir);
}

export const storage: StorageService = createStorage();
export type { StorageService } from "./StorageService";
