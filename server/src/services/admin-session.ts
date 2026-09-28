import { randomBytes } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "relab_admin_sid";

type AdminSession = {
  createdAt: number;
  expiresAt: number;
};

const sessions = new Map<string, AdminSession>();

export function pruneExpiredAdminSessions(now = Date.now()) {
  for (const [id, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(id);
  }
}

export function createAdminSession(ttlMs: number, now = Date.now()) {
  pruneExpiredAdminSessions(now);
  const id = randomBytes(32).toString("base64url");
  sessions.set(id, { createdAt: now, expiresAt: now + ttlMs });
  return id;
}

export function getAdminSession(id: string | undefined, now = Date.now()) {
  if (!id) return null;
  pruneExpiredAdminSessions(now);
  const session = sessions.get(id);
  if (!session || session.expiresAt <= now) {
    if (id) sessions.delete(id);
    return null;
  }
  return session;
}

export function destroyAdminSession(id: string | undefined) {
  if (id) sessions.delete(id);
}

export function parseCookieValue(header: string | undefined, name: string) {
  if (!header) return "";
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return part.slice(separator + 1).trim();
    }
  }
  return "";
}

export function buildAdminSessionCookie(id: string, secure: boolean, maxAgeSeconds?: number) {
  const parts = [`${ADMIN_SESSION_COOKIE}=${id}`, "Path=/", "HttpOnly", "SameSite=Strict"];
  if (typeof maxAgeSeconds === "number") parts.push(`Max-Age=${maxAgeSeconds}`);
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearAdminSessionCookie(secure: boolean) {
  const parts = [`${ADMIN_SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Strict", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function resetAdminSessionsForTests() {
  sessions.clear();
}

export function adminSessionCountForTests() {
  return sessions.size;
}
