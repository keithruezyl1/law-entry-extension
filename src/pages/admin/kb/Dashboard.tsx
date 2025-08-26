import React from 'react';
import { DashboardHeader } from '../../../components/kb/DashboardHeader';
import { computeDayIndex, loadPlanFromUrl, parseWorkbook, rowsForDay, toISODate } from '../../../lib/plan/planLoader';
import { PersonCard } from '../../../components/kb/PersonCard';
import { GLI_CPA_TYPES } from '../../../lib/plan/config';
import { exportDate, clearDate, getDay1Date, setDay1Date } from '../../../lib/plan/progressStore';

export default function Dashboard() {
  const [date, setDate] = React.useState<Date>(new Date());
  const [day1Date, setDay1DateState] = React.useState<string | null>(getDay1Date());
  const dayIndex = computeDayIndex(date, day1Date);
  const [rows, setRows] = React.useState<any[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadPlanFromUrl().then(setRows).catch(() => setRows([]));
  }, []);

  const onImportPlan = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xlsx';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const buf = await file.arrayBuffer();
        const parsed = parseWorkbook(buf);
        setRows(parsed);
      };
      input.click();
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  };

  const todayISO = toISODate(date);
  const dayRows = React.useMemo(() => (rows ? rowsForDay(rows, dayIndex) : []), [rows, dayIndex]);

  const handleDateSelect = (newDate: Date) => {
    if (!day1Date && window.confirm('Set this date as Day 1 for cumulative progress tracking?')) {
      const newDateISO = toISODate(newDate);
      setDay1Date(newDateISO);
      setDay1DateState(newDateISO);
    }
  };

  // Build per-person requirements
  const people = ['P1', 'P2', 'P3', 'P4', 'P5'];
  const reqByPerson: Record<string, any> = {};
  for (const p of people) {
    const r = dayRows.find((x: any) => String(x.Person).trim() === p) || {};
    const req: any = { total: Number(r.Total || 0), ordinanceNote: r.OrdinanceNote || undefined };
    for (const t of GLI_CPA_TYPES) {
      req[t] = Number(r[t] || 0);
    }
    reqByPerson[p] = req;
  }

  // Collect FocusNotes for the day
  const focus = dayRows.map((r: any) => r.FocusNotes).filter(Boolean).join(' • ');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <DashboardHeader
          date={date}
          dayIndex={dayIndex}
          onChangeDate={setDate}
          onImportPlan={onImportPlan}
          onDateSelect={handleDateSelect}
          day1Date={day1Date}
          onClearToday={() => {
            if (window.confirm('Clear all progress for today?')) {
              clearDate(todayISO);
              // refresh by re-rendering
              setDate(new Date(date.getTime()));
            }
          }}
        />
        {error && <div className="mb-4 text-sm text-red-600 text-center">{error}</div>}
        {!rows && <div className="text-sm text-muted-foreground text-center">Loading plan…</div>}
        {rows && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 justify-items-center">
            {people.map((p) => (
              <PersonCard key={p} person={p} dateISO={todayISO} requirements={reqByPerson[p]} />
            ))}
          </div>
        )}
        {focus && (
          <div className="mt-6 text-center">
            <div className="text-xs text-muted-foreground bg-white rounded-full px-4 py-2 inline-block shadow-sm">{focus}</div>
          </div>
        )}
      </div>
    </div>
  );
}


