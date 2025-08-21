// civilify-kb-schemas.ts (copied into app src/lib for CRA compatibility)
import { z } from "zod";

export const TypeEnum = z.enum([
  "constitution_provision",
  "statute_section",
  "city_ordinance_section",
  "rule_of_court",
  "agency_circular",
  "doj_issuance",
  "executive_issuance",
  "pnp_sop",
  "traffic_rule",
  "incident_checklist",
  "rights_advisory",
]);

export const StatusEnum = z.enum(["active", "amended", "repealed", "draft", "approved", "published"]);
export const PackCategoryEnum = z.enum(["sop", "checklist", "traffic", "rights", "roc"]);

const JurisdictionOther = z
  .string()
  .min(3, "Enter a jurisdiction like 'Cavite' or 'Quezon City'")
  .max(40, "Keep it under 40 characters")
  .regex(/^[A-Za-zÀ-ÿ]+(?:[-' ]+[A-Za-zÀ-ÿ]+)*(?: City| Province)?$/, "Use title case, letters/spaces only (e.g., 'Cavite', 'Quezon City', 'Baguio')");
export const Jurisdiction = z.union([z.literal("PH"), JurisdictionOther]);

export const Url = z.string().url("Provide a valid URL");
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const EntryRef = z.discriminatedUnion("type", [
  z.object({ type: z.literal("internal"), entry_id: z.string().min(1), note: z.string().optional() }),
  z.object({ type: z.literal("external"), citation: z.string().min(1), url: Url.optional(), note: z.string().optional() }),
]);
export type EntryRef = z.infer<typeof EntryRef>;

export const LegalBasis = z.discriminatedUnion("type", [
  z.object({ type: z.literal("internal"), entry_id: z.string().min(1), note: z.string().optional(), topic: z.string().optional() }),
  z.object({ type: z.literal("external"), citation: z.string().min(1), url: Url.optional(), note: z.string().optional(), topic: z.string().optional() }),
]);
export type LegalBasis = z.infer<typeof LegalBasis>;

export const FineRow = z.object({ offense_no: z.number().int().gte(1), amount: z.number().gte(0), currency: z.string().default("PHP") });
export type FineRow = z.infer<typeof FineRow>;

export const IncidentStep = z.object({
  text: z.string().min(1, "Step text is required"),
  condition: z.string().optional(),
  deadline: z.string().optional(),
  evidence_required: z.array(z.string()).default([]),
  legal_bases: z.array(LegalBasis).default([]),
  failure_state: z.string().optional(),
});
export const IncidentPhase = z.object({ name: z.string().min(1), steps: z.array(IncidentStep).min(1, "Add at least one step") });

export const BaseEntry = z.object({
  type: TypeEnum,
  entry_id: z.string().min(1),
  title: z.string().min(3),
  jurisdiction: Jurisdiction,
  law_family: z.string().min(1),
  section_id: z.string().optional(),
  canonical_citation: z.string().min(1),
  status: StatusEnum,
  effective_date: IsoDate,
  amendment_date: IsoDate.nullable().optional(),
  summary: z.string().min(1),
  text: z.string().min(1, "Paste the normalized legal text"),
  source_urls: z.array(Url).min(1, "Provide at least one official/public source"),
  tags: z.array(z.string()).default([]),
  last_reviewed: IsoDate,
  visibility: z.object({ gli: z.boolean().default(true), police: z.boolean().default(false), cpa: z.boolean().default(false) }),
  offline: z.object({ pack_include: z.boolean().default(false), pack_category: PackCategoryEnum.optional(), pack_priority: z.number().int().min(1).max(3).optional() }).default({ pack_include: false }),
});

export const ConstitutionProvision = BaseEntry.extend({ type: z.literal("constitution_provision"), topics: z.array(z.string()).default([]), related_sections: z.array(EntryRef).default([]), jurisprudence: z.array(z.string()).default([]).optional() });
export const StatuteSection = BaseEntry.extend({
  type: z.literal("statute_section"),
  elements: z.array(z.string()).default([]),
  penalties: z.array(z.string()).default([]),
  defenses: z.array(z.string()).default([]).optional(),
  prescriptive_period: z.object({ value: z.number().positive(), unit: z.enum(["days", "months", "years"]) }).optional(),
  standard_of_proof: z.string().optional(),
  related_sections: z.array(EntryRef).default([]),
  legal_bases: z.array(LegalBasis).default([]),
});
export const CityOrdinanceSection = BaseEntry.extend({ type: z.literal("city_ordinance_section"), elements: z.array(z.string()).default([]), penalties: z.array(z.string()).default([]), defenses: z.array(z.string()).default([]).optional(), related_sections: z.array(EntryRef).default([]), legal_bases: z.array(LegalBasis).default([]) });
export const RuleOfCourt = BaseEntry.extend({ type: z.literal("rule_of_court"), rule_no: z.string().min(1), section_no: z.string().min(1), triggers: z.array(z.string()).default([]), time_limits: z.array(z.string()).default([]), required_forms: z.array(z.string()).default([]).optional(), related_sections: z.array(EntryRef).default([]) });
export const AgencyCircular = BaseEntry.extend({ type: z.literal("agency_circular"), circular_no: z.string().min(1), section_no: z.string().optional(), applicability: z.array(z.string()).default([]), legal_bases: z.array(LegalBasis).default([]), supersedes: z.array(EntryRef).default([]) });
export const DojIssuance = BaseEntry.extend({ type: z.literal("doj_issuance"), issuance_no: z.string().min(1), applicability: z.array(z.string()).default([]), legal_bases: z.array(LegalBasis).default([]), supersedes: z.array(EntryRef).default([]) });
export const ExecutiveIssuance = BaseEntry.extend({ type: z.literal("executive_issuance"), instrument_no: z.string().min(1), applicability: z.array(z.string()).default([]), legal_bases: z.array(LegalBasis).default([]), supersedes: z.array(EntryRef).default([]) });
export const PnpSop = BaseEntry.extend({ type: z.literal("pnp_sop"), steps_brief: z.array(z.string()).min(1, "Add at least one step"), forms_required: z.array(z.string()).default([]), failure_states: z.array(z.string()).default([]), legal_bases: z.array(LegalBasis).min(1, "Add at least one legal basis") });
export const TrafficRule = BaseEntry.extend({ type: z.literal("traffic_rule"), violation_code: z.string().min(1), violation_name: z.string().min(1), fine_schedule: z.array(FineRow).default([]), license_action: z.string().optional(), apprehension_flow: z.array(z.string()).default([]), lead_agency: z.enum(["PNP", "LTO", "LGU-traffic"]).default("LTO"), police_role: z.string().default("Handoff / secure scene"), legal_bases: z.array(LegalBasis).min(1, "Add at least one legal basis") });
export const IncidentChecklist = BaseEntry.extend({ type: z.literal("incident_checklist"), incident: z.string().min(1), phases: z.array(IncidentPhase).min(1, "Add at least one phase"), forms: z.array(z.string()).default([]), handoff: z.array(z.string()).default([]), rights_callouts: z.array(z.string()).default([]) });
export const RightsAdvisory = BaseEntry.extend({ type: z.literal("rights_advisory"), rights_scope: z.enum(["arrest", "search", "detention", "minors", "GBV", "counsel", "privacy"]), advice_points: z.array(z.string()).min(1, "Add at least one advice point"), legal_bases: z.array(LegalBasis).min(1, "Add at least one legal basis"), related_sections: z.array(EntryRef).default([]) });

export const EntrySchema = z.discriminatedUnion("type", [ConstitutionProvision, StatuteSection, CityOrdinanceSection, RuleOfCourt, AgencyCircular, DojIssuance, ExecutiveIssuance, PnpSop, TrafficRule, IncidentChecklist, RightsAdvisory]);
export type Entry = z.infer<typeof EntrySchema>;
export type TypeEnumType = z.infer<typeof TypeEnum>;
export const schemasByType: Record<TypeEnumType, z.ZodTypeAny> = {
  constitution_provision: ConstitutionProvision,
  statute_section: StatuteSection,
  city_ordinance_section: CityOrdinanceSection,
  rule_of_court: RuleOfCourt,
  agency_circular: AgencyCircular,
  doj_issuance: DojIssuance,
  executive_issuance: ExecutiveIssuance,
  pnp_sop: PnpSop,
  traffic_rule: TrafficRule,
  incident_checklist: IncidentChecklist,
  rights_advisory: RightsAdvisory,
} as const;

export function validateBusinessRules(entry: Entry): string[] {
  const errors: string[] = [];
  if (entry.status === "amended" && !entry.amendment_date) errors.push("amendment_date is required when status is 'amended'.");
  if (entry.offline.pack_include && !entry.offline.pack_category) errors.push("offline.pack_category is required when 'pack_include' is true.");
  
  // Type-specific validations
  if (entry.type === "pnp_sop" && "legal_bases" in entry && entry.legal_bases.length === 0) errors.push("PNP SOP must include at least one legal basis.");
  if (entry.type === "traffic_rule" && "legal_bases" in entry && entry.legal_bases.length === 0) errors.push("Traffic rule must include at least one legal basis.");
  if (entry.type === "rights_advisory" && "legal_bases" in entry && entry.legal_bases.length === 0) errors.push("Rights advisory must include at least one legal basis.");
  
  if (entry.type === "incident_checklist" && "phases" in entry) {
    const missing = entry.phases
      .flatMap((p: any, pi: number) => p.steps.map((s: any, si: number) => ({ pi, si, ok: (s.legal_bases ?? []).length > 0 })).filter((x: any) => !x.ok))
      .map((x: any) => `Phase ${x.pi + 1}, Step ${x.si + 1} needs at least one legal basis.`);
    errors.push(...missing);
  }
  
  const j = Jurisdiction.safeParse(entry.jurisdiction);
  if (!j.success) errors.push("Jurisdiction must be 'PH' or a title-cased location like 'Quezon City'.");
  return errors;
}



