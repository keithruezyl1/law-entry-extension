# 📋 Civilify Law Entry App - Entry Creation Guide

## 🏗️ Entry Creation Process Overview

The Civilify Law Entry App uses a **5-step creation workflow** to ensure comprehensive and accurate legal entries. Each step builds upon the previous one, with real-time validation and preview functionality.

### **📝 5-Step Creation Workflow:**

1. **Basics** - Core identification fields
2. **Sources & Dates** - Source URLs and important dates  
3. **Content** - Legal text, summary, and tags
4. **Type-Specific & Relations** - Fields unique to each entry type + legal bases/related sections
5. **Review & Publish** - Final review, validation, and submission

---

## 🔧 Base Fields (All Entry Types)

Every entry in the system includes these core fields:

### **Core Identification**
```javascript
entry_id: string          // Auto-generated stable ID (e.g., "RA4136-Sec7-123456")
type: string             // Entry type (see below)
title: string            // Human-readable label
jurisdiction: string     // "PH", "PH-CEBU-CITY", "PH-MANILA", "PH-QUEZON-CITY"
law_family: string       // Collection/book (e.g., "RA 4136", "Rules of Court")
section_id?: string      // Article/Section if applicable (e.g., "Sec. 7", "Art. 308")
canonical_citation: string // Formal cite string (e.g., "RPC Art. 308")
```

### **Lifecycle Management**
```javascript
status: string           // "active" | "amended" | "repealed"
effective_date: string   // ISO date
amendment_date?: string  // ISO date (required if status = "amended")
last_reviewed: string    // ISO date (auto-set to current date for new entries)
```

### **Content**
```javascript
summary: string          // 1-3 sentence neutral synopsis
text: string            // Clean, normalized legal text (substance-only)
source_urls: string[]   // Official/public sources (at least 1 required)
tags: string[]          // Retrieval hints (e.g., ["arrest", "search", "traffic"])
```

### **Access Control**
```javascript
visibility: {
  gli: boolean,         // General Legal Information
  cpa: boolean         // CPA mode
}
```

### **Relations (Step 4)**
```javascript
legal_bases: string[]    // Legal bases (required for rights_advisory)
related_sections: string[] // Related sections (optional)
```

---

## 📚 Entry Types & Type-Specific Fields

The system supports **8 distinct entry types**, each with specialized fields tailored to their legal context.

### **1. 📜 Constitution Provision**
**Description:** Article/Section of the PH Constitution  
**Team Assignment:** Tagarao (3/day)

**Type-Specific Fields:**
```javascript
topics: string[]              // Required: e.g., ["arrest", "search", "detention", "privacy"]
related_sections: string[]    // Optional: refs to statutes/ROC that operationalize the right
jurisprudence: string[]       // Optional: key case short cites (GR no., year, doctrine)
```

**Example:**
- **Title:** "Protection Against Unreasonable Searches and Seizures"
- **Topics:** ["search", "seizure", "privacy", "warrant"]
- **Jurisprudence:** ["GR 123456, 2020", "GR 789012, 2019"]

---

### **2. ⚖️ Statute Section** 
**Description:** RA/RPC section (incl. IRR content if needed)  
**Team Assignment:** Arda (7/day), Sendrijas (8/day)

**Type-Specific Fields:**
```javascript
elements: string[]            // Required: enumerated elements/requirements
penalties: string[]           // Required: human-readable penalties (ranges/qualifiers)
defenses: string[]            // Optional: typical statutory defenses/exceptions
prescriptive_period: {        // Optional: { value: number, unit: "days|months|years" }
  value: number,
  unit: string
}
standard_of_proof: string     // Optional: e.g., "criminal:beyond_reasonable_doubt"
related_sections: string[]    // Optional: related sections
legal_bases: string[]         // Optional: legal bases
```

**Example:**
- **Title:** "Theft of Personal Property"
- **Elements:** ["Taking of personal property", "Belonging to another", "With intent to gain", "Without violence or intimidation"]
- **Penalties:** ["Prision mayor minimum to prision mayor medium (6 years, 1 day to 8 years)"]
- **Prescriptive Period:** { value: 10, unit: "years" }

---

### **3. 🏛️ City Ordinance Section**
**Description:** Cebu City ordinance section  
**Team Assignment:** Arda (3/day)

**Type-Specific Fields:**
```javascript
elements: string[]            // Required: enumerated elements/requirements
penalties: string[]           // Required: human-readable penalties (ranges/qualifiers)
defenses: string[]            // Optional: typical statutory defenses/exceptions
related_sections: string[]    // Optional: related sections
legal_bases: string[]         // Optional: legal bases
```

**Example:**
- **Title:** "Noise Pollution Control"
- **Elements:** ["Excessive noise", "During prohibited hours", "In residential areas"]
- **Penalties:** ["Fine of P1,000 to P5,000", "Community service for 1-3 days"]

---

### **4. ⚖️ Rule of Court**
**Description:** Rule & Section (Criminal Procedure)  
**Team Assignment:** Delos Cientos (7/day)

**Type-Specific Fields:**
```javascript
rule_no: string               // Required: e.g., "Rule 113"
section_no: string            // Required: e.g., "Sec. 5"
triggers: string[]            // Required: when the rule applies
time_limits: string[]         // Optional: deadlines ("within 12 hours", "10 days")
required_forms: string[]      // Optional: required forms
related_sections: string[]    // Optional: related sections
```

**Example:**
- **Title:** "Arrest Without Warrant"
- **Rule No:** "Rule 113"
- **Section No:** "Sec. 5"
- **Triggers:** ["In flagrante delicto", "Escape from custody", "Hot pursuit"]
- **Time Limits:** ["Within 12 hours of arrest", "File complaint within 36 hours"]

---

### **5. 📋 Agency Circular**
**Description:** LTO/PNP/other agency circulars & admin orders  
**Team Assignment:** Paden (2/day), Sendrijas (2/day)

**Type-Specific Fields:**
```javascript
circular_no: string           // Required: circular number
section_no?: string           // Optional: section number if applicable
applicability: string[]       // Required: domains/actors touched (licensing, towing, breath test)
legal_bases: string[]         // Optional: legal bases
supersedes: string[]          // Optional: earlier circulars affected
```

**Example:**
- **Title:** "Driver's License Renewal Procedures"
- **Circular No:** "LTO MC 2024-001"
- **Applicability:** ["Driver's license renewal", "Medical examination", "Biometric capture"]
- **Supersedes:** ["LTO MC 2023-015"]

---

### **6. 🏛️ DOJ Issuance**
**Description:** DOJ circular/opinion/guideline  
**Team Assignment:** Delos Cientos (2/day), Tagarao (2/day)

**Type-Specific Fields:**
```javascript
issuance_no: string           // Required: issuance number
applicability: string[]       // Required: applicability
legal_bases: string[]         // Optional: legal bases
supersedes: string[]          // Optional: supersedes
```

**Example:**
- **Title:** "Guidelines on Cybercrime Investigation"
- **Issuance No:** "DOJ Circular 2024-001"
- **Applicability:** ["Cybercrime cases", "Digital evidence handling", "International cooperation"]

---

### **7. 📜 Executive Issuance**
**Description:** Official Gazette (EOs, newly signed RAs, etc.)  
**Team Assignment:** Tagarao (1/day)

**Type-Specific Fields:**
```javascript
instrument_no: string         // Required: instrument number
applicability: string[]       // Required: applicability
legal_bases: string[]         // Optional: legal bases
supersedes: string[]          // Optional: supersedes
```

**Example:**
- **Title:** "National ID System Implementation"
- **Instrument No:** "EO 2024-001"
- **Applicability:** ["All government agencies", "Private sector partners", "Citizen registration"]

---

### **8. 👮 PNP SOP**
**Description:** PNP manual/SOP item  
**Team Assignment:** Paden (5/day)

**Type-Specific Fields:**
```javascript
steps_brief: string[]         // Required: 3–10 concise operational steps
forms_required: string[]      // Optional: forms required
failure_states: string[]      // Optional: pitfalls / suppression risks
legal_bases: string[]         // Required: legal bases (must have ≥1)
```

**Example:**
- **Title:** "Arrest Procedure SOP"
- **Steps Brief:** [
    "1. Identify yourself and show badge",
    "2. State reason for arrest",
    "3. Read Miranda rights",
    "4. Conduct search incident to arrest",
    "5. Transport to station within 12 hours"
  ]
- **Legal Bases:** ["Rule 113, Rules of Court", "RA 7438", "PNP Manual"]

---

### **9. 📋 Incident Checklist**
**Description:** Guided template (phases → steps)  
**Team Assignment:** Paden (3/day)

**Type-Specific Fields:**
```javascript
incident: string              // Required: scenario name (e.g., "DUI", "Road Crash", "Hot Pursuit")
phases: object[]              // Required: ordered groups (Arrival, Rights, Actions, Documents…)
forms: string[]               // Optional: forms
handoff: string[]             // Optional: handoff
rights_callouts: string[]     // Optional: rights callouts
```

**Example:**
- **Title:** "DUI Apprehension Checklist"
- **Incident:** "DUI Apprehension"
- **Phases:** [
    {
      "name": "Arrival",
      "steps": ["Secure scene", "Assess safety", "Identify driver"]
    },
    {
      "name": "Rights",
      "steps": ["Read Miranda rights", "Explain consequences", "Offer counsel"]
    }
  ]

---

### **10. ⚖️ Rights Advisory**
**Description:** Bill of Rights/CHR-style rights card  
**Team Assignment:** Delos Cientos (1/day), Tagarao (4/day)

**Type-Specific Fields:**
```javascript
rights_scope: string          // Required: "arrest" | "search" | "detention" | "minors" | "GBV" | "counsel" | "privacy"
advice_points: string[]       // Required: short actionable lines
legal_bases: string[]         // Required: legal bases (must have ≥1)
related_sections: string[]    // Optional: related sections
```

**Example:**
- **Title:** "Rights During Arrest"
- **Rights Scope:** "arrest"
- **Advice Points:** [
    "You have the right to remain silent",
    "You have the right to counsel",
    "You have the right to be informed of charges",
    "You have the right to medical attention if needed"
  ]
- **Legal Bases:** ["1987 Constitution, Art. III, Sec. 12", "RA 7438"]

---

## 🔍 Special Features

### **📊 Prescriptive Period Display**
The system intelligently parses and displays prescriptive periods:
- **Valid Format:** `{"value": 15, "unit": "years"}` → **"15 Years"**
- **Invalid/NA:** Shows **"No Prescriptive Period"**

### **🔍 Duplicate Detection**
- Real-time semantic search during entry creation
- Shows potential matches with similarity scores
- Prevents duplicate entries

### **📱 Entry ID Generation**
Auto-generated stable IDs with timestamps for uniqueness:
- **Examples:** `RPC-Art308-123456`, `RA4136-Sec7-789012`, `ROC-Rule113-Sec5-345678`
- **Format:** `{LAW_FAMILY}-{SECTION}-{TIMESTAMP}`
- Ensures uniqueness across the system

### **✅ Validation & Review**
**Step 5 (Review & Publish)** includes comprehensive validation:
- Cross-field validation rules
- Required field validation
- Entry ID format validation
- **Options:** Save Draft, Submit for Review, Publish Directly

---

## 👥 Team Member Assignments & Daily Quotas

| **Member** | **Focus Area** | **Daily Quotas** |
|------------|----------------|------------------|
| **Arda (P1)** | RPC + Cebu Ordinances | 7 statute_section, 3 city_ordinance_section |
| **Delos Cientos (P2)** | Rules of Court + DOJ | 7 rule_of_court, 2 doj_issuance, 1 rights_advisory |
| **Paden (P3)** | PNP SOPs + Incident Checklists | 5 pnp_sop, 3 incident_checklist, 2 agency_circular |
| **Sendrijas (P4)** | Statute Sections + Agency Circulars | 8 statute_section, 2 agency_circular |
| **Tagarao (P5)** | Rights + Constitution + Policy | 4 rights_advisory, 3 constitution_provision, 2 doj_issuance, 1 executive_issuance |

---

## 🚀 Getting Started

### **For New Users:**
1. **Login** with your assigned credentials
2. **Navigate** to "Create New Entry" from the dashboard
3. **Follow** the 5-step process, ensuring all required fields are completed
4. **Review** your entry in Step 5 before publishing
5. **Submit** for review or publish directly (based on permissions)

### **Best Practices:**
- **Use clear, descriptive titles** that accurately reflect the legal content
- **Provide comprehensive summaries** that capture the essence in 1-3 sentences
- **Include multiple source URLs** for verification and credibility
- **Add relevant tags** to improve searchability
- **Complete all type-specific fields** to maximize the entry's utility
- **Review carefully** before publishing to ensure accuracy

---

## 📞 Support

For questions or issues with entry creation, contact your team lead or refer to the internal documentation. The system is designed to be intuitive and user-friendly while maintaining the highest standards of legal accuracy and completeness.

---

*This guide is maintained by the Civilify development team and updated as the system evolves.*

































