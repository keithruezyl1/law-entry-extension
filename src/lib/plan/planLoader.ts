import * as XLSX from "xlsx";
import { differenceInCalendarDays, format } from "date-fns";
import { KB_PROJECT_START, PLAN_FILENAME } from "./config";

export async function loadPlanFromUrl(url: string = `/plans/${PLAN_FILENAME}`) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch plan: ${res.status}`);
  const buf = await res.arrayBuffer();
  return parseWorkbook(buf);
}

export function parseWorkbook(buf: ArrayBuffer) {
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets["Daily Plan"];
  if (!sheet) throw new Error("Daily Plan sheet not found");
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: 0 });
  return rows as any[];
}

export function computeDayIndex(date: Date, day1Date?: string | null) {
  if (!day1Date) {
    // If no Day 1 is set, use the hardcoded start date
    return Math.max(1, Math.min(30, differenceInCalendarDays(date, KB_PROJECT_START) + 1));
  }
  
  // Calculate from user's Day 1 date
  const day1 = new Date(day1Date);
  return Math.max(1, Math.min(30, differenceInCalendarDays(date, day1) + 1));
}

export function rowsForDay(rows: any[], day: number) {
  return rows.filter((r) => Number(r.Day) === Number(day));
}

export function toISODate(date: Date) {
  return format(date, "yyyy-MM-dd");
}


