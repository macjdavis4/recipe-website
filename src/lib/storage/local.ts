import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { isValidKey, type StorageAdapter } from "./adapter";

const URL_PREFIX = "/uploads/";

/** Dev storage: files under public/uploads, served by Next.js at /uploads. */
export function createLocalStorage(
  root = path.join(process.cwd(), "public", "uploads"),
): StorageAdapter {
  const keyFromUrl = (url: string) => {
    if (!url.startsWith(URL_PREFIX)) return null;
    const key = url.slice(URL_PREFIX.length);
    return isValidKey(key) ? key : null;
  };

  return {
    async save(key, data) {
      if (!isValidKey(key)) throw new Error("Invalid storage key");
      const file = path.join(root, key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, data);
      return `${URL_PREFIX}${key}`;
    },
    async delete(url) {
      const key = keyFromUrl(url);
      if (key) await rm(path.join(root, key), { force: true });
    },
    keyFromUrl,
  };
}
