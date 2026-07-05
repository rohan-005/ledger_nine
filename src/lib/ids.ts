import { randomUUID } from "crypto";

export function generateId(prefix: "run" | "ev" | "ct" | "score" | "rep" | "ag"): string {
  const uuid = randomUUID().replace(/-/g, "");
  return `${prefix}_${uuid}`;
}
