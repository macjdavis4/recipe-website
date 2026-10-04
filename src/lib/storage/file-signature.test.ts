import { describe, expect, it } from "vitest";
import { detectImageType } from "./file-signature";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe("detectImageType", () => {
  it("detects JPEG, PNG, and WebP by magic bytes", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toBe("image/jpeg");
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe(
      "image/png",
    );
    expect(detectImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBPVP8 ")))).toBe(
      "image/webp",
    );
  });

  it("rejects other files, including ones that only look similar", () => {
    expect(detectImageType(bytes(...ascii("GIF89a")))).toBeNull();
    expect(detectImageType(bytes(...ascii("<svg xmlns")))).toBeNull();
    expect(detectImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVE")))).toBeNull();
    expect(detectImageType(bytes(...ascii("%PDF-1.7")))).toBeNull();
    expect(detectImageType(bytes(0xff, 0xd8))).toBeNull();
    expect(detectImageType(bytes())).toBeNull();
  });
});
