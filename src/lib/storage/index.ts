import "server-only";
import { getEnv } from "@/lib/env";
import { keyOwner, type StorageAdapter } from "./adapter";
import { createLocalStorage } from "./local";
import { createSpacesStorage } from "./spaces";

export { imageKey, type ImageContentType } from "./adapter";
export { detectImageType } from "./file-signature";
export { stripImageMetadata } from "./strip-metadata";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

let storage: StorageAdapter | undefined;

export function getStorage(): StorageAdapter {
  if (storage) return storage;
  const env = getEnv();
  // env.ts guarantees every SPACES_* value is set when the driver is "spaces".
  storage =
    env.STORAGE_DRIVER === "spaces"
      ? createSpacesStorage({
          key: env.SPACES_KEY!,
          secret: env.SPACES_SECRET!,
          region: env.SPACES_REGION!,
          endpoint: env.SPACES_ENDPOINT!,
          bucket: env.SPACES_BUCKET!,
          cdnUrl: env.SPACES_CDN_URL!,
        })
      : createLocalStorage();
  return storage;
}

/** True when url is an image we stored for this user. */
export function isOwnUpload(url: string, userId: string): boolean {
  const key = getStorage().keyFromUrl(url);
  return key !== null && keyOwner(key) === userId;
}

/** Best-effort delete. A failed cleanup must not fail the user's request. */
export async function deleteUpload(url: string | null | undefined): Promise<void> {
  if (!url) return;
  try {
    await getStorage().delete(url);
  } catch (error) {
    console.error("Failed to delete upload", error);
  }
}
