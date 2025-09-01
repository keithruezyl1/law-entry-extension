import React from 'react';
import { DashboardHeader } from '../../../components/kb/DashboardHeader';
import { computeDayIndex, parseWorkbook, rowsForDay, toISODate } from '../../../lib/plan/planLoader';
import { PersonCard } from '../../../components/kb/PersonCard';
import { GLI_CPA_TYPES } from '../../../lib/plan/config';
import { exportDate, clearDate, setDay1Date } from '../../../lib/plan/progressStore';
import { getActivePlan, importPlan } from '../../../services/plansApi';

export default function Dashboard() {
  const [date, setDate] = React.useState<Date>(new Date());
  const [day1Date, setDay1DateState] = React.useState<string | null>(null);
  const dayIndex = computeDayIndex(date, day1Date);
  const [rows, setRows] = React.useState<any[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Load active plan from database on mount
  React.useEffect(() => {
    const loadActivePlan = async () => {
      try {
        setLoading(true);
        const activePlan = await getActivePlan();
        if (activePlan) {
          setRows(activePlan.plan_data);
          // Set the day1 date from the database plan
          if (activePlan.day1_date) {
            setDay1DateState(activePlan.day1_date);
            setDay1Date(activePlan.day1_date);
          }
        } else {
          setRows(null);
        }
      } catch (err) {
        console.error('Failed to load active plan:', err);
        setError('Failed to load active plan from database');
        setRows(null);
      } finally {
        setLoading(false);
      }
    };

    loadActivePlan();
  }, []);

  const onImportPlan = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xlsx';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        
        try {
          setLoading(true);
          const buf = await file.arrayBuffer();
          const parsed = parseWorkbook(buf);
          
          // Get plan name from filename
          const planName = file.name.replace('.xlsx', '');
          
          // Import plan to database
          const planId = await importPlan(planName, day1Date || new Date().toISOString().split('T')[0], parsed);
          
          if (planId) {
            // Update local state with the new plan
            setRows(parsed);
            setError(null);
            // Refresh the page to ensure all components get the new plan
            window.location.reload();
          }
        } catch (err: any) {
          console.error('Failed to import plan:', err);
          setError(`Failed to import plan: ${err.message}`);
        } finally {
          setLoading(false);
        }
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
        {loading && <div className="text-sm text-muted-foreground text-center">Loading plan…</div>}
        {!loading && rows && (
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


