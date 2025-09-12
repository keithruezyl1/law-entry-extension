const fs = require('fs');
const path = require('path');

// JSON lives one level up in ../public/
const filePath = path.join(__dirname, '..', 'public', 'Civilify_KB30_Schedule_CorePH.json');

/**
 * Rebalance Days 10–30 according to Templates A–D (aggregate per day across 5 people = 50 items).
 * Does not modify Days 1–9. Preserves Day/Person/FocusNotes and leaves OrdinanceNote as-is.
 */

/** Aggregate day templates */
const TEMPLATES = {
  A: {
    constitution_provision: 3,
    statute_section: 16,
    rule_of_court: 12,
    agency_circular: 2,
    doj_issuance: 5,
    executive_issuance: 2,
    rights_advisory: 7,
    city_ordinance_section: 3,
  },
  B: {
    constitution_provision: 3,
    statute_section: 15,
    rule_of_court: 13,
    agency_circular: 3,
    doj_issuance: 5,
    executive_issuance: 2,
    rights_advisory: 7,
    city_ordinance_section: 2,
  },
  C: {
    constitution_provision: 3,
    statute_section: 15,
    rule_of_court: 12,
    agency_circular: 3,
    doj_issuance: 4,
    executive_issuance: 5,
    rights_advisory: 7,
    city_ordinance_section: 1,
  },
  D: {
    constitution_provision: 3,
    statute_section: 18,
    rule_of_court: 11,
    agency_circular: 1,
    doj_issuance: 5,
    executive_issuance: 2,
    rights_advisory: 7,
    city_ordinance_section: 3,
  },
};

/** Day → Base Template (Days 10–30 inclusive) */
const DAY_TEMPLATE = {
  10: 'A', 11: 'A', 12: 'A', 13: 'A', 14: 'A',
  15: 'B',
  16: 'A', 17: 'A', 18: 'A', 19: 'A',
  20: 'B', 21: 'B', 22: 'B',
  23: 'C',
  24: 'B',
  25: 'C',
  26: 'B', 27: 'B', 28: 'B',
  29: 'C',
  30: 'D',
};

/**
 * Adjusted variants per day to hit final targets:
 * - Reduce Statute by 70 overall; increase DOJ +30, Executive +10, Ordinance +30 across Days 10–30
 * - Keep Constitution, ROC, Agency, Rights unchanged vs base templates per day
 */
const VARIANT_BY_DAY = {
  // A-based days: 8 with stronger shift (E_dbl), 1 with lighter shift (E_std)
  10: 'E_dbl', 11: 'E_dbl', 12: 'E_dbl', 13: 'E_dbl', 14: 'E_dbl',
  16: 'E_dbl', 17: 'E_dbl', 18: 'E_dbl',
  19: 'E_std',
  // B-based days: 7 standard (F_std), 1 stronger (F_dbl)
  15: 'F_std', 20: 'F_std', 21: 'F_std', 22: 'F_std', 24: 'F_std', 26: 'F_std', 27: 'F_std',
  28: 'F_dbl',
  // C-based days: standard (G_std)
  23: 'G_std', 25: 'G_std', 29: 'G_std',
  // D-based day: standard (H_std)
  30: 'H_std',
};

/**
 * Build aggregate totals for a given day with variant adjustments.
 * Variants are expressed as deltas relative to base template to preserve daily total of 50.
 */
function buildDayAggregate(day) {
  const baseKey = DAY_TEMPLATE[day];
  const base = TEMPLATES[baseKey];
  if (!base) throw new Error(`No base template for day ${day}`);
  const variant = VARIANT_BY_DAY[day];
  const agg = { ...base };
  // Define per-variant deltas
  const deltas = {
    // A-based variants
    E_std: { statute_section: -3, doj_issuance: +1, executive_issuance: +1, city_ordinance_section: +1 },
    E_dbl: { statute_section: -4, doj_issuance: +2, executive_issuance: +1, city_ordinance_section: +1 },
    // B-based variants
    F_std: { statute_section: -3, doj_issuance: +1, city_ordinance_section: +2 },
    F_dbl: { statute_section: -4, doj_issuance: +2, executive_issuance: +1, city_ordinance_section: +1 },
    // C-based variant
    G_std: { statute_section: -2, doj_issuance: +1, city_ordinance_section: +1 },
    // D-based variant
    H_std: { statute_section: -4, doj_issuance: +1, city_ordinance_section: +3 },
  }[variant];
  if (!deltas) return agg;
  for (const [k, v] of Object.entries(deltas)) {
    agg[k] = (agg[k] || 0) + v;
  }
  return agg;
}

const CATEGORIES = [
  'constitution_provision',
  'statute_section',
  'rule_of_court',
  'agency_circular',
  'doj_issuance',
  'executive_issuance',
  'rights_advisory',
  'city_ordinance_section',
];

function loadSchedule() {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function saveSchedule(data) {
  const content = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(filePath, content, 'utf8');
}

function rebalanceDay(entriesForDay, templateTotals) {
  // Prepare five persons P1..P5 in order
  const personsOrder = ['P1', 'P2', 'P3', 'P4', 'P5'];
  const allocations = personsOrder.map(() => ({ Total: 0 }));

  // Initialize category counts to 0 per person
  for (const alloc of allocations) {
    for (const cat of CATEGORIES) alloc[cat] = 0;
  }

  // Greedy fair distribution: assign one item at a time to the least-loaded person
  for (const cat of CATEGORIES) {
    let remaining = templateTotals[cat];
    let cursor = 0;
    while (remaining > 0) {
      // Find next suitable person with minimal current load and < 10 total
      let bestIdx = -1;
      let bestLoad = Infinity;
      for (let i = 0; i < allocations.length; i++) {
        const idx = (cursor + i) % allocations.length;
        const load = allocations[idx].Total;
        if (load < 10 && load < bestLoad) {
          bestLoad = load;
          bestIdx = idx;
        }
      }
      if (bestIdx === -1) {
        throw new Error('No available person under 10 items while items remain to assign.');
      }
      allocations[bestIdx][cat] += 1;
      allocations[bestIdx].Total += 1;
      remaining -= 1;
      cursor = (bestIdx + 1) % allocations.length;
    }
  }

  // Verify each person totals 10
  allocations.forEach((a, idx) => {
    if (a.Total !== 10) {
      throw new Error(`Person index ${idx} does not total 10 (got ${a.Total}).`);
    }
  });

  // Map allocations back into the 5 entries, preserving metadata
  const allocByPerson = Object.fromEntries(personsOrder.map((p, i) => [p, allocations[i]]));
  for (const entry of entriesForDay) {
    const alloc = allocByPerson[entry.Person];
    for (const cat of CATEGORIES) {
      entry[cat] = alloc[cat];
    }
    entry.Total = 10;
    // Keep OrdinanceNote as-is; FocusNotes kept as-is
  }
}

function computeTotals(data) {
  const totals = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  for (const row of data) {
    for (const cat of CATEGORIES) totals[cat] += Number(row[cat] || 0);
  }
  return totals;
}

function main() {
  const data = loadSchedule();

  // Group indices by day for quick access
  const dayToIndices = new Map();
  data.forEach((row, idx) => {
    if (!dayToIndices.has(row.Day)) dayToIndices.set(row.Day, []);
    dayToIndices.get(row.Day).push(idx);
  });

  // Rebalance days 10–30
  for (let day = 10; day <= 30; day++) {
    const tmplKey = DAY_TEMPLATE[day];
    if (!tmplKey) continue; // Should not happen
    const indices = dayToIndices.get(day) || [];
    if (indices.length !== 5) {
      throw new Error(`Day ${day} does not have exactly 5 person entries (found ${indices.length}).`);
    }
    const entriesForDay = indices.map((i) => data[i]);
    const dayAggregate = buildDayAggregate(day);
    rebalanceDay(entriesForDay, dayAggregate);
  }

  saveSchedule(data);

  // Print totals
  const totals = computeTotals(data);
  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
  console.log(JSON.stringify({ totals, grandTotal }, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.stack || String(err));
    process.exit(1);
  }
}


