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
    const servicesBlock = compose.split(/^services:\n/m)[1].split(/^\S/m)[0];
    const services = servicesBlock
      .split(/^(?=  [a-z][\w-]*:\n)/m)
      .filter((block) => block.trim())
      .map((block) => block.trim().split(":")[0]);

    it("runs only the app (nginx and Managed PostgreSQL live outside Docker)", () => {
      expect(services).toEqual(["app"]);
    });

    it("restarts unless stopped and has a healthcheck", () => {
      expect(compose).toContain("restart: unless-stopped");
      expect(compose).toContain("healthcheck:");
    });

    it("publishes the app only on loopback, never on a public interface", () => {
      const ports = [...compose.matchAll(/^\s+- "([^"]+)"$/gm)].map((m) => m[1]);
      expect(ports).toEqual(["127.0.0.1:3000:3000"]);
    });

    it("takes DATABASE_URL from .env instead of building one", () => {
      expect(compose).not.toMatch(/DATABASE_URL:/);
      expect(compose).toContain("env_file: .env");
    });
  });

  describe("nginx site template", () => {
    const conf = read("deploy/nginx/larder.conf.template");

    it("proxies to the loopback app with the headers the app relies on", () => {
      expect(conf).toContain("server 127.0.0.1:3000;");
      expect(conf).toContain("proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;");
      expect(conf).toContain("proxy_set_header Host $http_host;");
      expect(conf).toContain("proxy_set_header X-Forwarded-Host $http_host;");
    });

    it("streams AI answers without buffering", () => {
      expect(conf).toMatch(/location \/api\/ai\/ \{[^}]*proxy_buffering off;/);
    });

    it("allows photo uploads up to the app's 5 MB limit", () => {
      expect(conf).toMatch(/client_max_body_size 6m;/);
    });

    it("sets security headers only at server level, so locations inherit them", () => {
      for (const header of [
        "Strict-Transport-Security",
        "Content-Security-Policy",
        "X-Frame-Options",
      ]) {
        expect(conf).toContain(`add_header ${header}`);
      }
      const locations = conf.match(/^\s+location [^{]+\{[^}]*\}/gm) ?? [];
      expect(locations.length).toBeGreaterThan(0);
      for (const block of locations) expect(block).not.toContain("add_header");
    });
  });
});
