import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { stripImageMetadata } from "./strip-metadata";

// A 40x20 photo with a GPS location and "rotate 90°" orientation, like a phone takes.
async function phonePhoto(format: "jpeg" | "png" | "webp") {
  return new Uint8Array(
    await sharp({ create: { width: 40, height: 20, channels: 3, background: "#c96" } })
      .withExif({
        IFD0: { Make: "PhoneCo", Model: "Pocket 9" },
        IFD3: { GPSLatitudeRef: "N", GPSLatitude: "41/1 52/1 0/1" },
      })
      .withMetadata({ orientation: 6 })
      [format]()
      .toBuffer(),
  );
}

describe("stripImageMetadata", () => {
  it.each([
    ["jpeg", "image/jpeg"],
    ["png", "image/png"],
    ["webp", "image/webp"],
  ] as const)("removes EXIF and GPS from %s and keeps the format", async (format, type) => {
    const original = await phonePhoto(format);
    expect((await sharp(original).metadata()).exif).toBeDefined();

    const meta = await sharp(await stripImageMetadata(original, type)).metadata();
    expect(meta.format).toBe(format);
    expect(meta.exif).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
  });

  it("applies the orientation to the pixels so the photo stays upright", async () => {
    const meta = await sharp(
      await stripImageMetadata(await phonePhoto("jpeg"), "image/jpeg"),
    ).metadata();
    expect([meta.width, meta.height]).toEqual([20, 40]);
  });

  it("rejects bytes that only look like an image", async () => {
    const fake = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 1, 2, 3]);
    await expect(stripImageMetadata(fake, "image/jpeg")).rejects.toThrow();
  });
});
