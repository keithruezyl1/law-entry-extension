import React from 'react';
import { format } from 'date-fns';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';

type Props = {
  date: Date;
  dayIndex: number;
  onChangeDate: (d: Date) => void;
  onImportPlan: () => void;
  onExportToday?: () => void;
  onClearToday?: () => void;
  onDateSelect?: (d: Date) => void;
  day1Date?: string | null;
};

export function DashboardHeader({ date, dayIndex, onChangeDate, onImportPlan, onExportToday, onClearToday, onDateSelect, day1Date }: Props) {
  const { user } = useAuth();
  
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    onChangeDate(newDate);
    
    if (onDateSelect) {
      onDateSelect(newDate);
    }
  };

  return (
    <div className="mb-8 text-center">
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-gray-800 mb-2">Civilify Law Entry</h1>
        <div className="text-lg text-gray-600">
          Day {dayIndex} of 30 • {format(date, 'PPP')}
          {day1Date && (
            <span className="ml-3 text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
              Day 1: {format(new Date(day1Date), 'MMM d')}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-center gap-3">
        <input
          type="date"
          className="border-2 border-blue-500 rounded-xl h-10 px-3 text-sm bg-blue-50"
          value={format(date, 'yyyy-MM-dd')}
          onChange={handleDateChange}
          aria-label="Select date"
        />
        {/* P5-only buttons */}
        {user?.personId === 'P5' && (
          <>
            <Button type="button" variant="outline" onClick={onImportPlan}>Import Plan</Button>
            {onClearToday && <Button type="button" variant="destructive" onClick={onClearToday}>Clear Today</Button>}
          </>
        )}
      </div>
    </div>
  );
}


