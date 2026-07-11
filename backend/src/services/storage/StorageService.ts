import type { Readable } from "node:stream";

export interface StoredObject {
  /** Opaque key used to retrieve/delete the object later (e.g. a disk path or S3 key). */
  key: string;
}

/**
 * Storage abstraction so file persistence can move from local disk (Phase 1) to an
 * S3-compatible bucket (later) without touching callers. Binaries never live in the DB.
 */
export interface StorageService {
  /** Persist a buffer and return its storage key. */
  put(params: {
    userId: string;
    fileName: string;
    contentType: string;
    buffer: Buffer;
  }): Promise<StoredObject>;

  /** Open a readable stream for a stored object. */
  getStream(key: string): Promise<Readable>;

  /** Remove a stored object. Must not throw if the object is already gone. */
  delete(key: string): Promise<void>;

  /** A URL/path clients can use to fetch the object (implementation-specific). */
  getUrl(key: string): string;
}
