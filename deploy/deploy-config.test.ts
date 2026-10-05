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

  describe("docker-compose.prod.yml", () => {
    const compose = read("deploy/docker-compose.prod.yml");
    // Top-level service blocks: two-space indented keys under "services:".
    const servicesBlock = compose.split(/^services:\n/m)[1].split(/^\S/m)[0];
    const services = Object.fromEntries(
      servicesBlock
        .split(/^(?=  [a-z][\w-]*:\n)/m)
        .filter((block) => block.trim())
        .map((block) => [block.trim().split(":")[0], block]),
    );

    it("defines the app, database, proxy, and backup services", () => {
      expect(Object.keys(services).sort()).toEqual(["app", "backup", "caddy", "db"]);
    });

    it.each(["app", "backup", "caddy", "db"])(
      "%s restarts unless stopped and has a healthcheck",
      (name) => {
        expect(services[name]).toContain("restart: unless-stopped");
        expect(services[name]).toContain("healthcheck:");
      },
    );

    it("publishes ports only from Caddy, never Postgres", () => {
      const withPorts = Object.entries(services).filter(([, block]) =>
        /^\s+ports:/m.test(block as string),
      );
      expect(withPorts.map(([name]) => name)).toEqual(["caddy"]);
      expect(compose).not.toMatch(/5432:5432/);
    });
  });
});
