import React from 'react';

export type BadgeItem = {
  key: string;
  label: string;
  count: number;
  target: number;
  color?: string; // Tailwind color name, e.g., 'blue'
};

type Props = {
  items: BadgeItem[];
  stacked?: boolean;
  showAll?: boolean; // when true, show regardless of count/target
};

const defaultColorByKey: Record<string, string> = {
  constitution_provision: 'blue',
  statute_section: 'emerald',
  rule_of_court: 'indigo',
  agency_circular: 'orange',
  doj_issuance: 'rose',
  executive_issuance: 'violet',
  rights_advisory: 'cyan',
  city_ordinance_section: 'slate',
};

export function TypeBadges({ items, stacked = true, showAll = false }: Props) {
  const visible = items.filter((it) => showAll || it.count >= it.target);

  return (
    <div className="flex items-center justify-end select-none">
      {visible.map((it, idx) => {
        const color = it.color || defaultColorByKey[it.key] || 'gray';
        const overlapClass = stacked && idx > 0 ? '-ml-2' : '';
        const zClass = stacked ? `z-[${100 - idx}]` : '';
        const bg = `bg-${color}-100`;
        const border = `border-${color}-200`;
        const text = `text-${color}-800`;
        return (
          <div
            key={it.key}
            className={`relative ${overlapClass} ${zClass} inline-flex items-center rounded-full ${bg} ${text} border ${border} px-3 py-1 text-xs font-semibold shadow-sm`}
            title={`${it.label}: ${it.count}/${it.target}`}
          >
            <span className="whitespace-nowrap">{it.label}</span>
            <span className="ml-2 rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-bold text-gray-900 border border-white/60">{it.count}/{it.target}</span>
          </div>
        );
      })}
    </div>
  );
}

export default TypeBadges;


