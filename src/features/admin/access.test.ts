import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  env: { ADMIN_EMAILS: " Owner@Example.com , second@example.com" as string | undefined },
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: m.findUnique } } }));
vi.mock("@/lib/env", () => ({ getEnv: () => m.env }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { assertAdmin, getAdmin, isAdminEmail, parseAdminEmails, requireAdminPage } =
  await import("./access");

const owner = { id: "u1", email: "owner@example.com", emailVerified: new Date() };

beforeEach(() => {
  m.env.ADMIN_EMAILS = " Owner@Example.com , second@example.com";
  m.auth.mockResolvedValue({ user: { id: "u1" } });
  m.findUnique.mockResolvedValue(owner);
});

describe("parseAdminEmails / isAdminEmail", () => {
  it("normalizes case and spacing and ignores blanks", () => {
    expect(parseAdminEmails(" A@x.com,, b@X.com ")).toEqual(["a@x.com", "b@x.com"]);
    expect(parseAdminEmails(undefined)).toEqual([]);
    expect(isAdminEmail("OWNER@example.com")).toBe(true);
    expect(isAdminEmail("someone@example.com")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
  });

  it("lets nobody in when ADMIN_EMAILS is unset", () => {
    m.env.ADMIN_EMAILS = undefined;
    expect(isAdminEmail("owner@example.com")).toBe(false);
  });
});

describe("getAdmin", () => {
  it("returns the listed, verified account", async () => {
    expect(await getAdmin()).toEqual({ id: "u1", email: "owner@example.com" });
  });

  it("refuses guests, unlisted accounts, and unverified emails", async () => {
    m.auth.mockResolvedValueOnce(null);
    expect(await getAdmin()).toBeNull();

    m.findUnique.mockResolvedValueOnce({ ...owner, email: "cook@example.com" });
    expect(await getAdmin()).toBeNull();

    // Someone who signed up with the admin's address but never proved the inbox.
    m.findUnique.mockResolvedValueOnce({ ...owner, emailVerified: null });
    expect(await getAdmin()).toBeNull();
  });

  it("checks the database email, not the one in the session", async () => {
    m.auth.mockResolvedValue({ user: { id: "u2", email: "owner@example.com" } });
    m.findUnique.mockResolvedValue({
      id: "u2",
      email: "changed@example.com",
      emailVerified: new Date(),
    });
    expect(await getAdmin()).toBeNull();
  });
});

describe("requireAdminPage / assertAdmin", () => {
  it("hide the area with a 404 and refuse actions with a 403", async () => {
    m.auth.mockResolvedValue(null);
    await expect(requireAdminPage()).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(assertAdmin()).rejects.toMatchObject({ status: 403 });
  });
});
