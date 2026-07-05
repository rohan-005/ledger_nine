// src/lib/time.ts
export function now(): string {
  return new Date().toISOString();
}

export function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}
