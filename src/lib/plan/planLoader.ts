import { differenceInCalendarDays, format } from "date-fns";
import { KB_PROJECT_START } from "./config";

// Loads plan directly from a JSON file bundled with the app
export async function loadPlanFromJson(url: string = "/Civilify_KB30_Schedule_CorePH.json") {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch plan JSON: ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error("Invalid plan JSON format");
  return rows as any[];
}

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

