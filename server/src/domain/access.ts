export type AccessRoleName = "buyer" | "guest";

export function canCreateTest(role: AccessRoleName) {
  return role !== "guest";
}
