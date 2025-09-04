export const KB_PROJECT_START = new Date("2025-08-22");
export const PLAN_FILENAME = "Civilify_KB30_Schedule_CorePH.xlsx";

export const GLI_CPA_TYPES = [
  "statute_section",
  "rule_of_court",
  "rights_advisory",
  "constitution_provision",
  "agency_circular",
  "doj_issuance",
  "executive_issuance",
  "city_ordinance_section",
] as const;

export type PlanType = typeof GLI_CPA_TYPES[number];












