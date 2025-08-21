// Entry types for the law knowledge base
export const ENTRY_TYPES = {
  constitution_provision: {
    label: 'Constitution Provision',
    description: 'Article/Section of the PH Constitution',
    fields: {
      // No additional fields beyond base fields
    }
  },
  statute_section: {
    label: 'Statute Section',
    description: 'RA/RPC section (incl. IRR content if needed)',
    fields: {
      elements: { type: 'array', label: 'Elements', required: false },
      penalties: { type: 'array', label: 'Penalties', required: false },
      related_sections: { type: 'array', label: 'Related Sections', required: false }
    }
  },
  city_ordinance_section: {
    label: 'City Ordinance Section',
    description: 'Cebu City ordinance section',
    fields: {
      elements: { type: 'array', label: 'Elements', required: false },
      penalties: { type: 'array', label: 'Penalties', required: false },
      related_sections: { type: 'array', label: 'Related Sections', required: false }
    }
  },
  rule_of_court: {
    label: 'Rule of Court',
    description: 'Rule & Section (Criminal Procedure)',
    fields: {
      rule_no: { type: 'string', label: 'Rule Number', required: true },
      section_no: { type: 'string', label: 'Section Number', required: true },
      triggers: { type: 'array', label: 'Triggers', required: false },
      time_limits: { type: 'array', label: 'Time Limits', required: false }
    }
  },
  agency_circular: {
    label: 'Agency Circular',
    description: 'LTO/PNP/other agency circulars & admin orders',
    fields: {
      circular_no: { type: 'string', label: 'Circular Number', required: true },
      section_no: { type: 'string', label: 'Section Number', required: false },
      applicability: { type: 'array', label: 'Applicability', required: false },
      legal_bases: { type: 'array', label: 'Legal Bases', required: false }
    }
  },
  doj_issuance: {
    label: 'DOJ Issuance',
    description: 'DOJ circular/opinion/guideline',
    fields: {
      issuance_no: { type: 'string', label: 'Issuance Number', required: true },
      applicability: { type: 'array', label: 'Applicability', required: false },
      supersedes: { type: 'array', label: 'Supersedes', required: false },
      legal_bases: { type: 'array', label: 'Legal Bases', required: false }
    }
  },
  executive_issuance: {
    label: 'Executive Issuance',
    description: 'Official Gazette (EOs, newly signed RAs, etc.)',
    fields: {
      instrument_no: { type: 'string', label: 'Instrument Number', required: true },
      applicability: { type: 'array', label: 'Applicability', required: false },
      supersedes: { type: 'array', label: 'Supersedes', required: false },
      legal_bases: { type: 'array', label: 'Legal Bases', required: false }
    }
  },
  pnp_sop: {
    label: 'PNP SOP',
    description: 'PNP manual/SOP item',
    fields: {
      steps_brief: { type: 'array', label: 'Steps Brief', required: true },
      legal_bases: { type: 'array', label: 'Legal Bases', required: true },
      forms_required: { type: 'array', label: 'Forms Required', required: false },
      failure_states: { type: 'array', label: 'Failure States', required: false }
    }
  },
  traffic_rule: {
    label: 'Traffic Rule',
    description: 'User-facing card (violation/licensing + fines)',
    fields: {
      violation_code: { type: 'string', label: 'Violation Code', required: true },
      violation_name: { type: 'string', label: 'Violation Name', required: true },
      fine_schedule: { type: 'array', label: 'Fine Schedule', required: false },
      license_action: { type: 'string', label: 'License Action', required: false },
      apprehension_flow: { type: 'array', label: 'Apprehension Flow', required: false },
      legal_bases: { type: 'array', label: 'Legal Bases', required: true }
    }
  },
  incident_checklist: {
    label: 'Incident Checklist',
    description: 'Guided template (phases → steps)',
    fields: {
      incident: { type: 'string', label: 'Incident', required: true },
      phases: { type: 'array', label: 'Phases', required: true },
      forms: { type: 'array', label: 'Forms', required: false },
      handoff: { type: 'array', label: 'Handoff', required: false },
      rights_callouts: { type: 'array', label: 'Rights Callouts', required: false }
    }
  },
  rights_advisory: {
    label: 'Rights Advisory',
    description: 'Bill of Rights/CHR-style rights card',
    fields: {
      rights_scope: { type: 'select', label: 'Rights Scope', required: true, options: [
        { value: 'arrest', label: 'Arrest' },
        { value: 'search', label: 'Search' },
        { value: 'detention', label: 'Detention' },
        { value: 'minors', label: 'Minors' },
        { value: 'GBV', label: 'GBV' },
        { value: 'counsel', label: 'Counsel' },
        { value: 'privacy', label: 'Privacy' }
      ]},
      advice_points: { type: 'array', label: 'Advice Points', required: true },
      legal_bases: { type: 'array', label: 'Legal Bases', required: true }
    }
  }
};

export const getEntryType = (type) => {
  return ENTRY_TYPES[type] || null;
};

export const getEntryTypeOptions = () => {
  return Object.entries(ENTRY_TYPES).map(([value, type]) => ({
    value,
    label: type.label,
    description: type.description
  }));
};

// Team member assignments for daily quotas
export const TEAM_MEMBER_ASSIGNMENTS = {
  1: {
    name: 'P1',
    description: 'RPC + Cebu Ordinances',
    dailyQuota: {
      statute_section: 7,
      city_ordinance_section: 3
    },
    fallback: 'executive_issuance'
  },
  2: {
    name: 'P2',
    description: 'Rules of Court + DOJ (procedure-heavy)',
    dailyQuota: {
      rule_of_court: 7,
      doj_issuance: 2,
      rights_advisory: 1
    },
    fallback: 'executive_issuance'
  },
  3: {
    name: 'P3',
    description: 'PNP SOPs + Incident Checklists',
    dailyQuota: {
      pnp_sop: 5,
      incident_checklist: 3,
      agency_circular: 2
    },
    fallback: null
  },
  4: {
    name: 'P4',
    description: 'Traffic/LTO lane',
    dailyQuota: {
      traffic_rule: 6,
      statute_section: 2,
      agency_circular: 2
    },
    fallback: null
  },
  5: {
    name: 'P5',
    description: 'Rights + Constitution + Policy',
    dailyQuota: {
      rights_advisory: 4,
      constitution_provision: 3,
      doj_issuance: 2,
      executive_issuance: 1
    },
    fallback: null
  }
};

export const getTeamMember = (id) => {
  return TEAM_MEMBER_ASSIGNMENTS[id] || null;
};

export const getAllTeamMembers = () => {
  return Object.entries(TEAM_MEMBER_ASSIGNMENTS).map(([id, member]) => ({
    id: parseInt(id),
    ...member
  }));
};





