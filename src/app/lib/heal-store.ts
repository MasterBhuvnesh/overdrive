/**
 * In-memory PR history store.
 * Replace with MongoDB/PostgreSQL in production.
 */
import "server-only";
import type { PRHistoryItem } from "./heal-types";

const prHistory: PRHistoryItem[] = [];

export function addPRRecord(item: PRHistoryItem): void {
  prHistory.unshift(item); // newest first
  if (prHistory.length > 100) prHistory.length = 100;
}

export function getPRHistory(sessionUserId?: string): PRHistoryItem[] {
  if (sessionUserId) {
    return prHistory.filter((h) => h.sessionUserId === sessionUserId);
  }
  return [...prHistory];
}

export function getPRRecordById(id: string): PRHistoryItem | undefined {
  return prHistory.find((h) => h.id === id);
}
