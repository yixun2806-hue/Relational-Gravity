import { describe, expect, it } from "vitest";
import { canCreateTest } from "./access.js";

describe("web access roles", () => {
  it("lets buyers create tests", () => {
    expect(canCreateTest("buyer")).toBe(true);
  });

  it("keeps invited guests from creating their own tests", () => {
    expect(canCreateTest("guest")).toBe(false);
  });
});
