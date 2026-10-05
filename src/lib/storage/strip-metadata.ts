import "server-only";
import sharp from "sharp";
import type { ImageContentType } from "./adapter";

// Phone photos are large; refuse anything bigger than ~50 megapixels before decoding it.
const MAX_INPUT_PIXELS = 50_000_000;

/**
 * Re-encodes an uploaded photo so it carries no metadata: no EXIF (GPS
 * location, camera, time), XMP, or comments. The EXIF orientation is applied
 * to the pixels first, so phone photos stay the right way up. Re-encoding also
 * means only real image data is ever stored. Throws if the file can't be decoded.
 */
export async function stripImageMetadata(
  bytes: Uint8Array,
  contentType: ImageContentType,
): Promise<Uint8Array> {
  // sharp drops all metadata unless asked to keep it, and converts to sRGB.
  const image = sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).rotate();
  const encoded =
    contentType === "image/jpeg"
      ? image.jpeg({ quality: 88, mozjpeg: true })
      : contentType === "image/png"
        ? image.png({ compressionLevel: 9 })
        : image.webp({ quality: 85 });
  return new Uint8Array(await encoded.toBuffer());
}
