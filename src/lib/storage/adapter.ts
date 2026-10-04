export type ImageContentType = "image/jpeg" | "image/png" | "image/webp";

export interface StorageAdapter {
  /** Stores the bytes under key and returns the public URL. */
  save(key: string, data: Uint8Array, contentType: ImageContentType): Promise<string>;
  /** Deletes a file this adapter issued. Unknown URLs are ignored. */
  delete(url: string): Promise<void>;
  /** The storage key for a URL this adapter issued, or null. */
  keyFromUrl(url: string): string | null;
}

export const EXTENSIONS: Record<ImageContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// recipes/<userId>/<uuid>.<ext>. The user id in the key lets us check that a
// recipe only points at its author's own uploads.
const KEY_PATTERN = /^recipes\/([a-z0-9]{1,40})\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

export function imageKey(userId: string, contentType: ImageContentType): string {
  return `recipes/${userId}/${crypto.randomUUID()}.${EXTENSIONS[contentType]}`;
}

export function isValidKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

export function keyOwner(key: string): string | null {
  return key.match(KEY_PATTERN)?.[1] ?? null;
}
