const key = (date: string, person: string, type: string) => `kbprog:${date}:${person}:${type}`;
const day1Key = 'kbprog:day1';

export function getDay1Date(): string | null {
  try {
    return localStorage.getItem(day1Key);
  } catch {
    return null;
  }
}

export function setDay1Date(dateISO: string) {
  try {
    localStorage.setItem(day1Key, dateISO);
  } catch {}
}

export function getCount(dateISO: string, person: string, type: string) {
  try {
    return Number(localStorage.getItem(key(dateISO, person, type)) ?? "0");
  } catch {
    return 0;
  }
}

export function getCumulativeCount(endDateISO: string, person: string, type: string) {
  const day1 = getDay1Date();
  if (!day1) return getCount(endDateISO, person, type);
  
  let total = 0;
  try {
    const startDate = new Date(day1);
    const endDate = new Date(endDateISO);
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      total += getCount(dateStr, person, type);
    }
  } catch {}
  
  return total;
}

export function setCount(dateISO: string, person: string, type: string, val: number) {
  try {
    localStorage.setItem(key(dateISO, person, type), String(Math.max(0, val)));
  } catch {}
}

export function increment(dateISO: string, person: string, type: string, max?: number) {
  const cur = getCount(dateISO, person, type);
  const next = Math.min(max ?? Infinity, cur + 1);
  setCount(dateISO, person, type, next);
  return next;
}

export function decrement(dateISO: string, person: string, type: string) {
  const cur = getCount(dateISO, person, type);
  const next = Math.max(0, cur - 1);
  setCount(dateISO, person, type, next);
  return next;
}

export function exportDate(dateISO: string) {
  const out: Record<string, number> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) as string;
      if (!k) continue;
      if (k.startsWith(`kbprog:${dateISO}:`)) {
        out[k] = Number(localStorage.getItem(k) || '0');
      }
    }
  } catch {}
  return out;
}

export function clearDate(dateISO: string) {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) as string;
      if (k && k.startsWith(`kbprog:${dateISO}:`)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {}
}


