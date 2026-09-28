import { describe, expect, it } from "vitest";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCountForTests,
  buildAdminSessionCookie,
  clearAdminSessionCookie,
  createAdminSession,
  destroyAdminSession,
  getAdminSession,
  parseCookieValue,
  resetAdminSessionsForTests,
} from "./admin-session.js";

describe("admin sessions", () => {
  it("creates a cryptographically random session and looks it up", () => {
    resetAdminSessionsForTests();
    const id = createAdminSession(12 * 60 * 60 * 1000);
    expect(id.length).toBeGreaterThanOrEqual(40);
    expect(getAdminSession(id)).not.toBeNull();
    expect(adminSessionCountForTests()).toBe(1);
  });

  it("expires and destroys sessions", () => {
    resetAdminSessionsForTests();
    const id = createAdminSession(-1);
    expect(getAdminSession(id)).toBeNull();
    const live = createAdminSession(1000);
    destroyAdminSession(live);
    expect(getAdminSession(live)).toBeNull();
  });

  it("builds an HttpOnly SameSite=Strict session cookie without credentials", () => {
    const cookie = buildAdminSessionCookie("abc", true);
    expect(cookie).toContain(`${ADMIN_SESSION_COOKIE}=abc`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Secure");
    expect(cookie).not.toContain("admin123456");
    expect(cookie).not.toContain("Basic ");
    expect(clearAdminSessionCookie(false)).toContain("Max-Age=0");
    expect(parseCookieValue(`${ADMIN_SESSION_COOKIE}=abc; other=1`, ADMIN_SESSION_COOKIE)).toBe("abc");
    expect(buildAdminSessionCookie("abc", false, 12 * 3600)).toContain("Max-Age=43200");
    expect(buildAdminSessionCookie("abc", false)).not.toContain("Max-Age=");
  });
});
