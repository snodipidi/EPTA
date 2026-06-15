/**
 * Storage abstraction. The rest of the app depends on this interface, never on a
 * concrete backend — so swapping local disk (dev) for S3/MinIO (prod) is a
 * one-line provider change in MediaModule, with zero call-site impact.
 * DECISION: "preparation for S3" per the spec means modelling the seam now; the
 * S3 implementation drops in when @aws-sdk/client-s3 is added.
 */
export abstract class StorageService {
  /** Persist bytes under `key`; returns the stored key. */
  abstract put(key: string, body: Buffer, contentType: string): Promise<string>;

  /** Remove an object (best-effort). */
  abstract remove(key: string): Promise<void>;

  /** Public, client-fetchable URL for a stored key. */
  abstract publicUrl(key: string): string;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
