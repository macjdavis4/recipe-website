import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("deploy config", () => {
  it("pins the same Prisma CLI version in the Dockerfile as package.json", () => {
    const pkg = JSON.parse(read("package.json"));
    const wanted = (pkg.devDependencies.prisma as string).replace(/^[\^~]/, "");
    const installed = JSON.parse(read("node_modules/prisma/package.json")).version;
    const pinned = read("deploy/Dockerfile").match(/ARG PRISMA_VERSION=(\S+)/)?.[1];
    expect(pinned).toBe(installed);
    expect(installed.split(".")[0]).toBe(wanted.split(".")[0]);
  });

  it("generates a Prisma engine for Alpine (musl)", () => {
    expect(read("prisma/schema.prisma")).toContain("linux-musl-openssl-3.0.x");
  });

  it("never runs migrate dev or db push at start-up", () => {
    const entrypoint = read("deploy/entrypoint.sh");
    expect(entrypoint).toContain("prisma migrate deploy");
    expect(entrypoint).not.toMatch(/^[^#]*(migrate dev|db push)/m);
  });

  it("keeps .env files out of the Docker build context", () => {
    expect(read(".dockerignore")).toMatch(/^\.env$/m);
  });
});
