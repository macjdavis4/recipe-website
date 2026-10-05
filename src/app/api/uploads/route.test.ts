import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/storage", async () => {
  const signature = await import("@/lib/storage/file-signature");
  const adapter = await import("@/lib/storage/adapter");
  const strip = await import("@/lib/storage/strip-metadata");
  return {
    stripImageMetadata: strip.stripImageMetadata,
    MAX_UPLOAD_BYTES: 5 * 1024 * 1024,
    detectImageType: signature.detectImageType,
    imageKey: adapter.imageKey,
    getStorage: () => ({ save: mocks.save }),
  };
});

const { POST } = await import("./route");

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// A real PNG with a GPS location in its EXIF, like a phone photo.
const photoWithGps = async () =>
  new Uint8Array(
    await sharp({ create: { width: 8, height: 8, channels: 3, background: "#c96" } })
      .withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "41/1 52/1 0/1" } })
      .png()
      .toBuffer(),
  );

function upload(bytes: number[] | Uint8Array, name = "photo.png") {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(bytes)], name, { type: "image/png" }));
  return new Request("http://localhost/api/uploads", { method: "POST", body: form });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "u1" } });
  mocks.save.mockImplementation(async (key: string) => `/uploads/${key}`);
});

describe("POST /api/uploads", () => {
  it("requires login", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await POST(upload(PNG))).status).toBe(401);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("stores a real image under the user's key, without its metadata", async () => {
    const res = await POST(upload(await photoWithGps()));
    expect(res.status).toBe(201);
    expect((await res.json()).url).toMatch(/^\/uploads\/recipes\/u1\/[0-9a-f-]{36}\.png$/);
    const [, saved, type] = mocks.save.mock.calls[0];
    expect(type).toBe("image/png");
    expect((await sharp(saved).metadata()).exif).toBeUndefined();
  });

  it("rejects a file that only starts like a PNG (415)", async () => {
    expect((await POST(upload([...PNG, 1, 2, 3]))).status).toBe(415);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("rejects a non-image even when named and typed like one (415)", async () => {
    const res = await POST(upload([...new TextEncoder().encode("<svg onload=alert(1)>")]));
    expect(res.status).toBe(415);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("rejects files over 5 MB (413)", async () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(PNG);
    expect((await POST(upload(big))).status).toBe(413);
  });

  it("rejects a missing file (400)", async () => {
    const req = new Request("http://localhost/api/uploads", {
      method: "POST",
      body: new FormData(),
    });
    expect((await POST(req)).status).toBe(400);
  });
});
