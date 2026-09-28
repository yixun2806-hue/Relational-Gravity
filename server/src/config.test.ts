import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

const base = {
  DATABASE_URL: "postgresql://relab:relab@127.0.0.1:5432/relab",
  JWT_SECRET: "dev-only-change-me",
};

describe("admin password configuration", () => {
  it("allows empty admin password in development", () => {
    const config = loadConfig({ ...base, NODE_ENV: "development", ADMIN_PASSWORD: "" });
    expect(config.ADMIN_USERNAME).toBe("admin");
    expect(config.ADMIN_PASSWORD).toBe("");
  });

  it("requires an explicit admin password in production", () => {
    expect(() => loadConfig({ ...base, NODE_ENV: "production", ADMIN_PASSWORD: "" })).toThrow(
      "生产环境必须配置 ADMIN_PASSWORD",
    );
  });

  it("defaults admin session ttl to 12 hours", () => {
    const config = loadConfig({ ...base, NODE_ENV: "development", ADMIN_PASSWORD: "secret" });
    expect(config.ADMIN_SESSION_TTL_HOURS).toBe(12);
  });
});
