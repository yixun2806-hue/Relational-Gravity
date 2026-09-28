import { createHash, randomBytes } from "node:crypto";

export function generateInviteCode(): string {
  return randomBytes(18).toString("base64url");
}

export function isInviteCode(value: string): boolean {
  return /^[A-Za-z0-9_-]{24}$/.test(value);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomNonce(): string {
  return randomBytes(24).toString("hex");
}
