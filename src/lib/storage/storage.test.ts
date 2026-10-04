import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { imageKey, keyOwner } from "./adapter";
import { createLocalStorage } from "./local";
import { createSpacesStorage } from "./spaces";

describe("keys", () => {
  it("embeds the owner and validates the shape", () => {
    const key = imageKey("user123", "image/png");
    expect(key).toMatch(/^recipes\/user123\/[0-9a-f-]{36}\.png$/);
    expect(keyOwner(key)).toBe("user123");
    expect(keyOwner("recipes/user123/../../etc/passwd")).toBeNull();
  });
});

describe("local storage", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "uploads-"));
  });
  afterEach(() => rm(root, { recursive: true, force: true }));

  it("saves, resolves, and deletes a file", async () => {
    const storage = createLocalStorage(root);
    const key = imageKey("u1", "image/jpeg");
    const url = await storage.save(key, new Uint8Array([1, 2, 3]), "image/jpeg");

    expect(url).toBe(`/uploads/${key}`);
    expect(storage.keyFromUrl(url)).toBe(key);
    expect([...(await readFile(path.join(root, key)))]).toEqual([1, 2, 3]);

    await storage.delete(url);
    await expect(stat(path.join(root, key))).rejects.toThrow();
  });

  it("refuses keys outside the expected shape", async () => {
    const storage = createLocalStorage(root);
    await expect(storage.save("../escape.jpg", new Uint8Array(), "image/jpeg")).rejects.toThrow();
    expect(storage.keyFromUrl("/uploads/../../.env")).toBeNull();
    expect(storage.keyFromUrl("https://elsewhere.example/recipes/u1/x.jpg")).toBeNull();
  });
});

describe("spaces storage", () => {
  const config = {
    key: "k",
    secret: "s",
    region: "nyc3",
    endpoint: "https://nyc3.digitaloceanspaces.com",
    bucket: "larder-images",
    cdnUrl: "https://larder-images.nyc3.cdn.digitaloceanspaces.com/",
  };

  it("uploads public, immutable objects and returns the CDN URL", async () => {
    const send = vi.fn().mockResolvedValue({});
    const storage = createSpacesStorage(config, { send } as never);
    const key = imageKey("u1", "image/webp");

    const url = await storage.save(key, new Uint8Array([1]), "image/webp");

    expect(url).toBe(`https://larder-images.nyc3.cdn.digitaloceanspaces.com/${key}`);
    expect(send.mock.calls[0][0].input).toMatchObject({
      Bucket: "larder-images",
      Key: key,
      ContentType: "image/webp",
      ACL: "public-read",
    });
  });

  it("deletes only URLs it issued", async () => {
    const send = vi.fn().mockResolvedValue({});
    const storage = createSpacesStorage(config, { send } as never);
    await storage.delete("https://evil.example/recipes/u1/x.jpg");
    expect(send).not.toHaveBeenCalled();

    const key = imageKey("u1", "image/jpeg");
    await storage.delete(`https://larder-images.nyc3.cdn.digitaloceanspaces.com/${key}`);
    expect(send.mock.calls[0][0].input).toEqual({ Bucket: "larder-images", Key: key });
  });
});
