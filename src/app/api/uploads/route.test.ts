import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/storage", async () => {
  const signature = await import("@/lib/storage/file-signature");
  const adapter = await import("@/lib/storage/adapter");
  return {
    MAX_UPLOAD_BYTES: 5 * 1024 * 1024,
    detectImageType: signature.detectImageType,
    imageKey: adapter.imageKey,
    getStorage: () => ({ save: mocks.save }),
  };
});

const { POST } = await import("./route");

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

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

  it("stores a real image under the user's key", async () => {
    const res = await POST(upload([...PNG, 1, 2, 3]));
    expect(res.status).toBe(201);
    expect((await res.json()).url).toMatch(/^\/uploads\/recipes\/u1\/[0-9a-f-]{36}\.png$/);
    expect(mocks.save.mock.calls[0][2]).toBe("image/png");
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
