import { differenceInCalendarDays, format } from "date-fns";
import { KB_PROJECT_START } from "./config";

// Loads plan directly from a JSON file bundled with the app
export async function loadPlanFromJson(url: string = "/Civilify_KB30_Schedule_CorePH.json") {
  // Try to fetch with cache disabled to avoid 304 without body
  try {
    let res = await fetch(url, { cache: 'no-store' });
    if (!res.ok || res.status === 304) {
      // Retry with cache-busting query
      const bust = url.includes('?') ? `${url}&_=${Date.now()}` : `${url}?_=${Date.now()}`;
      res = await fetch(bust, { cache: 'reload' });
    }
    if (!res.ok) throw new Error(`Failed to fetch plan JSON: ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error("Invalid plan JSON format");
    return rows as any[];
  } catch (e) {
    console.error('loadPlanFromJson failed; returning empty plan', e);
    return [] as any[];
  }
}

// Prefer static plan bundled in codebase
// If you need a code-bundled fallback, place JSON under src and import it here.

// Convert wall-clock time into the "plan date" that rolls over at 08:00 local time
export function getPlanDate(date: Date = new Date()): Date {
  const d = new Date(date);
  const hours = d.getHours();
  if (hours < 8) {
    // Before 8 AM, still count as previous day
    const prev = new Date(d);
    prev.setDate(d.getDate() - 1);
    return new Date(prev.getFullYear(), prev.getMonth(), prev.getDate());
  }
  // Same day (8 AM onwards)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function toISODate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function computeDayIndex(now: Date, day1Date?: string | null) {
  const planNow = getPlanDate(now);
  const baseline = day1Date ? new Date(day1Date) : KB_PROJECT_START;
  return Math.max(1, Math.min(30, differenceInCalendarDays(planNow, baseline) + 1));
}

export function rowsForDay(rows: any[], day: number) {
  return rows.filter((r) => Number(r.Day) === Number(day));
}

// Start/end bounds for the current plan day (8:00 to next day 8:00)
export function getPlanWindowBounds(now: Date): { start: Date; end: Date } {
  const planDate = getPlanDate(now);
  const start = new Date(planDate);
  start.setHours(8, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

