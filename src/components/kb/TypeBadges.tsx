import React from 'react';

export type BadgeItem = {
  key: string;
  label: string;
  count: number;
  target: number;
  color?: string; // Not used in current purge-safe mapping, kept for API compat
};

type Props = {
  items: BadgeItem[];
  stacked?: boolean;
  showAll?: boolean; // when true, show regardless of count/target
};

// Static class maps so Tailwind can tree-shake correctly (no dynamic class names)
const colorClassByKey: Record<string, { bg: string; text: string; border: string }> = {
  constitution_provision: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  statute_section: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
  rule_of_court: { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' },
  agency_circular: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  doj_issuance: { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200' },
  executive_issuance: { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-200' },
  rights_advisory: { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-200' },
  city_ordinance_section: { bg: 'bg-slate-200', text: 'text-slate-900', border: 'border-slate-300' },
};

export function TypeBadges({ items, stacked = true, showAll = false }: Props) {
  const visible = items.filter((it) => showAll || it.count >= it.target);

  return (
    <div className="flex items-center justify-end select-none">
      {visible.map((it, idx) => {
        const color = colorClassByKey[it.key] || { bg: 'bg-gray-100', text: 'text-gray-900', border: 'border-gray-200' };
        const overlapClass = stacked && idx > 0 ? '-ml-2 sm:-ml-3' : '';
        const zClass = stacked ? `z-[${100 - idx}]` : '';

        return (
          <div
            key={it.key}
            className={`relative ${overlapClass} ${zClass} inline-flex items-center rounded-full ${color.bg} ${color.text} border ${color.border} shadow-sm px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm`}
            title={`${it.label}: ${it.count}/${it.target}`}
          >
            <span className="font-bold whitespace-nowrap">{it.label}</span>
            <span className="ml-2 rounded-full bg-white/85 text-gray-900 border border-white/70 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-extrabold tracking-tight">
              {it.count}/{it.target}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default TypeBadges;


