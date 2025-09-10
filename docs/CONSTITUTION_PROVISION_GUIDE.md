# 📜 Civilify Law Entry App - Constitution Provision Entry Guide

## 🎯 Overview

This guide is specifically designed for creating **Constitution Provision** entries in the Civilify Law Entry App. Constitution provisions are fundamental legal principles from the 1987 Philippine Constitution that form the bedrock of Philippine law.

## 🏗️ Constitution Provision Entry Structure

### **📝 Base Fields (Required for All Entries)**

```javascript
entry_id: string          // Auto-generated stable ID (e.g., "CONST-Art3Sec12-123456")
type: "constitution_provision"  // Always "constitution_provision"
title: string            // Human-readable label (e.g., "Protection Against Unreasonable Searches")
jurisdiction: string     // Usually "PH" for national constitution
law_family: string       // "1987 Constitution" or "Philippine Constitution"
section_id?: string      // Article/Section (e.g., "Article 3 Section 12", "Article 3 Section 2")
canonical_citation: string // Formal cite (e.g., "1987 Constitution, Article 3 Section 12")
status: string           // "active" | "amended" | "repealed" | "draft" | "approved" | "published"
effective_date: string   // ISO date (usually "1987-02-02" for 1987 Constitution)
amendment_date?: string  // ISO date (only if status = "amended")
summary: string          // 1-3 sentence neutral synopsis
text: string            // Clean, normalized constitutional text
source_urls: string[]   // Official sources (at least 1 required)
tags: string[]          // Retrieval hints (e.g., ["arrest", "search", "privacy"])
last_reviewed: string    // ISO date (auto-set to current date for new entries)
```

### **🔒 Access Control**
```javascript
visibility: {
  gli: boolean,         // General Legal Information (usually true)
  cpa: boolean         // CPA mode (usually true for constitution)
}
```


### **📜 Constitution-Specific Fields**
```javascript
topics: string[]              // Required: constitutional topics/themes
jurisprudence: string[]       // Optional: key Supreme Court cases (array of strings, not objects)
legal_bases: object[]         // Optional: legal bases with full details (Step 4)
related_sections: object[]    // Optional: related constitutional sections with full details (Step 4)
```

### **📋 Citation Format for External References (related_sections & legal_bases)**
```javascript
{
  "type": "external",         // Always "external" for constitution provisions
  "citation": "string",       // Full citation text
  "url": "string",           // Complete URL
  "title": "string",         // Document title
  "note": "string"           // Short description
}
```

---

## 📚 Constitution Provision Examples

### **Example 1: Bill of Rights - Search and Seizure**

```json
{
  "entry_id": "CONST-Art3Sec2-123456",
  "type": "constitution_provision",
  "title": "Protection Against Unreasonable Searches and Seizures",
  "jurisdiction": "PH",
  "law_family": "1987 Constitution",
  "section_id": "Article 3 Section 2",
  "canonical_citation": "1987 Constitution, Article 3 Section 2",
  "status": "active",
  "effective_date": "1987-02-02",
  "summary": "Constitutional protection against unreasonable searches and seizures, requiring probable cause and judicial warrant.",
  "text": "The right of the people to be secure in their persons, houses, papers, and effects against unreasonable searches and seizures of whatever nature and for any purpose shall be inviolable, and no search warrant or warrant of arrest shall issue except upon probable cause to be determined personally by the judge after examination under oath or affirmation of the complainant and the witnesses he may produce, and particularly describing the place to be searched and the persons or things to be seized.",
  "source_urls": [
    "https://www.officialgazette.gov.ph/constitutions/1987-constitution/",
    "https://www.lawphil.net/consti/cons1987.html"
  ],
  "tags": ["search", "seizure", "warrant", "privacy", "probable_cause"],
  "last_reviewed": "2024-01-15",
  "visibility": {
    "gli": true,
    "cpa": true
  },
  "topics": ["search", "seizure", "privacy", "warrant", "probable_cause"],
  "jurisprudence": [
    "People v. Marti, GR 81561, 1991",
    "People v. Doria, GR 125299, 1999",
    "People v. Chua Ho San, GR 128222, 2001"
  ],
  "legal_bases": [
    {
      "type": "external",
      "citation": "1987 Constitution, Article 3 Section 2",
      "url": "https://www.officialgazette.gov.ph/constitutions/1987-constitution/",
      "title": "Protection Against Unreasonable Searches and Seizures",
      "note": "Primary constitutional basis for search and seizure protections"
    }
  ],
  "related_sections": [
    {
      "type": "external",
      "citation": "1987 Constitution, Article 3 Section 3",
      "url": "https://www.officialgazette.gov.ph/constitutions/1987-constitution/",
      "title": "Privacy of Communication and Correspondence",
      "note": "Constitutional protection of privacy in communications"
    },
    {
      "type": "external",
      "citation": "1987 Constitution, Article 3 Section 12",
      "url": "https://www.officialgazette.gov.ph/constitutions/1987-constitution/",
      "title": "Rights of Persons Under Custodial Investigation",
      "note": "Constitutional rights during police investigation"
    },
    {
      "type": "external",
      "citation": "1987 Constitution, Article 3 Section 14",
      "url": "https://www.officialgazette.gov.ph/constitutions/1987-constitution/",
      "title": "Right to Due Process",
      "note": "Fundamental due process protections"
    }
  ]
}
```

### **Example 2: Bill of Rights - Custodial Investigation**

```json
{
  "entry_id": "CONST-Art3Sec12-123456",
  "type": "constitution_provision",
  "title": "Rights of Persons Under Custodial Investigation",
  "jurisdiction": "PH Philippines (PH)",
  "law_family": "1987 Constitution",
  "section_id": "Article 3 Section 12",
  "canonical_citation": "1987 Constitution, Article 3 Section 12",
  "status": "active",
  "effective_date": "1987-02-02",
  "summary": "Constitutional rights that apply when a person is under investigation for the commission of an offense, including the right to remain silent and to counsel.",
  "text": "Any person under investigation for the commission of an offense shall have the right to be informed of his right to remain silent and to have competent and independent counsel preferably of his own choice. If the person cannot afford the services of counsel, he must be provided with one. These rights cannot be waived except in writing and in the presence of counsel.",
  "source_urls": [
    "https://www.officialgazette.gov.ph/constitutions/1987-constitution/",
    "https://www.lawphil.net/consti/cons1987.html"
  ],
  "tags": ["custodial", "investigation", "rights", "counsel", "silence", "miranda"],
  "last_reviewed": "2024-01-15",
  "visibility": {
    "gli": true,
    "cpa": true
  },
  "topics": ["custodial", "investigation", "counsel", "silence", "waiver"],
  "jurisprudence": [
    "People v. Galit, GR 51770, 1982",
    "People v. Andan, GR 116437, 1997",
    "People v. Rapeza, GR 169431, 2006"
  ],
  "legal_bases": [
    {
      "type": "external",
      "citation": "1987 Constitution, Article 3 Section 12",
      "url": "https://www.officialgazette.gov.ph/constitutions/1987-constitution/",
      "title": "Rights of Persons Under Custodial Investigation",
      "note": "Primary constitutional basis for custodial investigation rights"
    }
  ],
  "related_sections": [
    {
      "type": "external",
      "citation": "1987 Constitution, Article 3 Section 13",
      "url": "https://www.officialgazette.gov.ph/constitutions/1987-constitution/",
      "title": "Right to Bail",
      "note": "Constitutional right to bail for most offenses"
    },
    {
      "type": "external",
      "citation": "1987 Constitution, Article 3 Section 14",
      "url": "https://www.officialgazette.gov.ph/constitutions/1987-constitution/",
      "title": "Right to Due Process",
      "note": "Fundamental due process protections in legal proceedings"
    },
    {
      "type": "external",
      "citation": "1987 Constitution, Article 3 Section 2",
      "url": "https://www.officialgazette.gov.ph/constitutions/1987-constitution/",
      "title": "Protection Against Unreasonable Searches and Seizures",
      "note": "Constitutional protection during searches and arrests"
    }
  ]
}
```

### **Example 3: Bill of Rights - Right to Bail**

```json
{
  "entry_id": "CONST-Art3Sec13-123456",
  "type": "constitution_provision",
  "title": "Right to Bail",
  "jurisdiction": "PH",
  "law_family": "1987 Constitution",
  "section_id": "Article 3 Section 13",
  "canonical_citation": "1987 Constitution, Article 3 Section 13",
  "status": "active",
  "effective_date": "1987-02-02",
  "summary": "Constitutional right to bail for all persons except those charged with capital offenses when evidence of guilt is strong.",
  "text": "All persons, except those charged with offenses punishable by reclusion perpetua when evidence of guilt is strong, shall, before conviction, be bailable by sufficient sureties, or be released on recognizance as may be provided by law. The right to bail shall not be impaired even when the privilege of the writ of habeas corpus is suspended. Excessive bail shall not be required.",
  "source_urls": [
    "https://www.officialgazette.gov.ph/constitutions/1987-constitution/",
    "https://www.lawphil.net/consti/cons1987.html"
  ],
  "tags": ["bail", "release", "recognizance", "capital_offense", "habeas_corpus"],
  "last_reviewed": "2024-01-15",
  "visibility": {
    "gli": true,
    "cpa": true
  },
  "topics": ["bail", "release", "capital_offense", "recognizance", "excessive_bail"],
  "jurisprudence": [
    "People v. Honrada, GR 119123, 1996",
    "People v. Cabral, GR 188329, 2010",
    "People v. Temporada, GR 173473, 2008"
  ],
  "legal_bases": [
    {
      "type": "external",
      "citation": "1987 Constitution, Article 3 Section 13",
      "url": "https://www.officialgazette.gov.ph/constitutions/1987-constitution/",
      "title": "Right to Bail",
      "note": "Primary constitutional basis for bail rights"
    }
  ],
  "related_sections": [
    {
      "type": "external",
      "citation": "1987 Constitution, Article 3 Section 12",
      "url": "https://www.officialgazette.gov.ph/constitutions/1987-constitution/",
      "title": "Rights of Persons Under Custodial Investigation",
      "note": "Constitutional rights during police investigation and arrest"
    },
    {
      "type": "external",
      "citation": "1987 Constitution, Article 3 Section 15",
      "url": "https://www.officialgazette.gov.ph/constitutions/1987-constitution/",
      "title": "Writ of Habeas Corpus",
      "note": "Constitutional protection against unlawful detention"
    },
    {
      "type": "external",
      "citation": "1987 Constitution, Article 3 Section 14",
      "url": "https://www.officialgazette.gov.ph/constitutions/1987-constitution/",
      "title": "Right to Due Process",
      "note": "Fundamental due process protections in legal proceedings"
    }
  ]
}
```

---

## ⚠️ Critical Validation Requirements

### **Entry ID Generation**
- **Format:** `CONST-{SectionID}-{6-digit-timestamp}`
- **Examples:** `CONST-Art3Sec2-123456`, `CONST-Art3Sec12-789012`
- **Auto-generated:** The system generates this automatically based on section_id and timestamp
- **Validation:** Must match pattern `/^CONST-[A-Za-z0-9]+-\d{6}$/`

#### **How Auto-Generation Works:**
The system automatically generates entry IDs using this process:

1. **Prefix:** Always starts with `CONST-` for constitution provisions
2. **Section ID:** Extracted from the `section_id` field:
   - `"Article 3 Section 2"` → `"Art3Sec2"`
   - `"Article 3 Section 12"` → `"Art3Sec12"`
   - `"Article 2 Section 1"` → `"Art2Sec1"`
3. **Timestamp:** Last 6 digits of current timestamp (milliseconds since epoch)
   - Example: `1705123456789` → `"234567"`
4. **Final Format:** `CONST-{SectionID}-{6-digit-timestamp}`

#### **Generation Examples:**
```javascript
// Input section_id: "Article 3 Section 2"
// Generated entry_id: "CONST-Art3Sec2-123456"

// Input section_id: "Article 3 Section 12" 
// Generated entry_id: "CONST-Art3Sec12-789012"

// Input section_id: "Article 2 Section 1"
// Generated entry_id: "CONST-Art2Sec1-456789"
```

#### **Important Notes:**
- **Don't manually set entry_id** - Let the system generate it automatically
- **Unique per entry** - The timestamp ensures uniqueness even for same section
- **Validation required** - Must match the regex pattern for system acceptance
- **Case sensitive** - Section ID extraction preserves original casing

### **Required Fields (Validation Will Fail Without These)**
```javascript
// These fields are REQUIRED and will cause validation errors if missing:
entry_id: string          // Auto-generated, must follow CONST-{SectionID}-{timestamp} format
type: "constitution_provision"  // Must be exactly this string
title: string            // Must be at least 3 characters
jurisdiction: string     // Must be "PH" or valid jurisdiction name
law_family: string       // Must be at least 1 character
canonical_citation: string // Must be at least 1 character
status: string           // Must be one of: "active", "amended", "repealed", "draft", "approved", "published"
effective_date: string   // Must be YYYY-MM-DD format
summary: string          // Must be at least 1 character
text: string            // Must be at least 1 character
source_urls: string[]   // Must have at least 1 valid URL
tags: string[]          // Must have at least 1 tag
last_reviewed: string    // Must be YYYY-MM-DD format
topics: string[]        // Must have at least 1 topic (constitution_provision specific)
```

### **Cross-Field Validation Rules**
- If `status` is "amended", then `amendment_date` is required
- All URLs in `source_urls` must be valid URLs (start with http:// or https://)

### **Jurisdiction Validation**
- Must be "PH" for national constitution
- If other jurisdiction, must be title-cased (e.g., "Quezon City", "Cavite")
- Must match pattern: `/^[A-Za-zÀ-ÿ]+(?:[-' ]+[A-Za-zÀ-ÿ]+)*(?: City| Province)?$/`

---

## 🏷️ Common Topics for Constitution Provisions

### **Bill of Rights Topics:**
- `arrest` - Arrest procedures and rights
- `search` - Search and seizure
- `seizure` - Property seizure
- `privacy` - Privacy rights
- `warrant` - Search/arrest warrants
- `probable_cause` - Probable cause requirement
- `custodial` - Custodial investigation
- `counsel` - Right to counsel
- `silence` - Right to remain silent
- `bail` - Right to bail
- `due_process` - Due process rights
- `equal_protection` - Equal protection clause
- `free_speech` - Freedom of speech
- `free_press` - Freedom of the press
- `assembly` - Right to assembly
- `religion` - Freedom of religion
- `travel` - Right to travel
- `association` - Right to association

### **Other Constitutional Topics:**
- `separation_powers` - Separation of powers
- `judicial_review` - Judicial review
- `executive_power` - Executive powers
- `legislative_power` - Legislative powers
- `local_government` - Local government autonomy
- `social_justice` - Social justice provisions
- `education` - Right to education
- `health` - Right to health
- `labor` - Labor rights
- `environment` - Environmental protection

---

## 📅 Important Dates

### **1987 Constitution:**
- **Effective Date:** `1987-02-02`
- **Ratification:** February 2, 1987
- **Proclamation:** February 11, 1987

### **Historical Context:**
- Replaced the 1973 Constitution
- Drafted by the 1986 Constitutional Commission
- Approved by plebiscite on February 2, 1987

---

## 🔗 Essential Source URLs

### **Primary Sources:**
- `https://www.officialgazette.gov.ph/constitutions/1987-constitution/` - Official Gazette of the Philippines - 1987 Constitution
- `https://www.lawphil.net/consti/cons1987.html` - LawPhil.net - 1987 Constitution Text

### **Additional Resources:**
- `https://www.supremecourt.gov.ph/` - Supreme Court of the Philippines - Court decisions and jurisprudence
- `https://www.chanrobles.com/` - Chan Robles Virtual Law Library - Comprehensive legal database
- `https://www.lawphil.net/` - LawPhil.net - Philippine legal resources and case law

---

## 📝 Writing Guidelines

### **Title Format:**
- Use clear, descriptive titles
- Focus on the specific right or principle
- Examples:
  - ✅ "Protection Against Unreasonable Searches and Seizures"
  - ✅ "Rights of Persons Under Custodial Investigation"
  - ✅ "Right to Bail"
  - ❌ "Article 3 Section 2"
  - ❌ "Constitutional Provision"

### **Summary Guidelines:**
- 1-3 sentences maximum
- Neutral, objective tone
- Focus on the core principle
- Examples:
  - ✅ "Constitutional protection against unreasonable searches and seizures, requiring probable cause and judicial warrant."
  - ✅ "Constitutional rights that apply when a person is under investigation for the commission of an offense, including the right to remain silent and to counsel."

### **Text Guidelines:**
- Use the exact constitutional text
- Maintain original formatting and punctuation
- Include the complete provision
- Do not paraphrase or summarize

### **Tags Guidelines:**
- Use 3-8 relevant tags
- Include both specific and general terms
- Examples: `["search", "seizure", "warrant", "privacy", "probable_cause"]`

### **Citation Guidelines:**
- All citations must be external references
- Provide at least 3 citations for both related_sections and jurisprudence
- Each citation must include:
  - **citation**: Full citation text
  - **url**: Complete URL (no shortcuts)
  - **title**: Document title
  - **note**: Short description (1-2 sentences)
- Use full text for all URLs - no abbreviated links
- Examples:
  - ✅ `"https://www.officialgazette.gov.ph/constitutions/1987-constitution/"`
  - ❌ `"www.officialgazette.gov.ph"` or `"Official Gazette"`

---

## 🎯 Team Assignment

### **Primary Assignee:** Tagarao (P5)
- **Daily Quota:** 3 constitution_provision entries per day
- **Focus Areas:** Rights + Constitution + Policy
- **Backup:** Delos Cientos (P2) for rights-related provisions

---

## 🚀 Quick Start Checklist

### **Before Creating:**
- [ ] Identify the specific constitutional provision
- [ ] Gather the exact constitutional text
- [ ] Find official source URLs
- [ ] Research relevant jurisprudence
- [ ] Identify related constitutional sections

### **During Creation:**
- [ ] Use clear, descriptive title
- [ ] Copy exact constitutional text
- [ ] Write neutral 1-3 sentence summary
- [ ] Add 3-8 relevant tags
- [ ] Include official source URLs
- [ ] Add relevant topics
- [ ] Include related sections
- [ ] Add key jurisprudence

### **Before Publishing:**
- [ ] Verify all required fields are complete
- [ ] Check spelling and grammar
- [ ] Ensure source URLs are valid
- [ ] Confirm constitutional text is accurate
- [ ] Review tags for relevance
- [ ] Validate entry_id format

---

## 💡 Best Practices

### **Content Quality:**
- Always use the exact constitutional text
- Include comprehensive jurisprudence
- Add related constitutional sections
- Use official government sources
- Maintain neutral, objective tone

### **Technical Quality:**
- Follow the exact JSON structure
- Use proper date formats (YYYY-MM-DD)
- Ensure all URLs are valid
- Use consistent naming conventions
- Include all required fields

### **User Experience:**
- Write clear, descriptive titles
- Provide comprehensive summaries
- Use relevant, searchable tags
- Include multiple source URLs
- Add helpful related sections

---

## 🔧 Troubleshooting

### **Common Issues:**
1. **Missing required fields** - Ensure all base fields are included (see Critical Validation Requirements above)
2. **Invalid dates** - Use YYYY-MM-DD format (e.g., "1987-02-02")
3. **Invalid URLs** - Ensure URLs start with http:// or https://
4. **Empty arrays** - Required arrays (source_urls, tags, topics) cannot be empty
5. **Incorrect entry_id** - Follow the CONST-{SectionID}-{6-digit-timestamp} format
6. **Roman numerals** - Use "Article 3 Section 12" instead of "Art. III, Sec. 12"
9. **Jurisprudence format** - Use array of strings, not objects with citation/url/title/note
10. **Related sections and legal_bases format** - Use objects with type: "external", citation, url, title, note

### **Validation Errors:**
- Check browser console for specific error messages
- Verify JSON syntax is correct
- Ensure all required fields are present (see Critical Validation Requirements)
- Confirm all URLs are valid and complete
- Check date formats (YYYY-MM-DD)
- Confirm topics array has at least one item
- Check that jurisprudence is array of strings, not objects
- Verify related_sections and legal_bases use correct object format with type: "external", citation, url, title, note

---

## 🤖 GPT Usage Instructions

### **For AI/GPT Generation:**
When generating constitution provision entries with GPT or similar AI tools, use this exact template:

```json
{
  "entry_id": "CONST-{SectionID}-{6-digit-timestamp}",
  "type": "constitution_provision",
  "title": "Descriptive Title of the Constitutional Right",
  "jurisdiction": "PH",
  "law_family": "1987 Constitution",
  "section_id": "Article X Section Y",
  "canonical_citation": "1987 Constitution, Article X Section Y",
  "status": "active",
  "effective_date": "1987-02-02",
  "summary": "1-3 sentence neutral summary of the constitutional provision",
  "text": "Exact constitutional text without modification",
  "source_urls": [
    "https://www.officialgazette.gov.ph/constitutions/1987-constitution/",
    "https://www.lawphil.net/consti/cons1987.html"
  ],
  "tags": ["relevant", "tags", "for", "search"],
  "last_reviewed": "2024-01-15",
  "visibility": {
    "gli": true,
    "cpa": true
  },
  "topics": ["required", "topics", "array"],
  "jurisprudence": [
    "Case Name, GR Number, Year"
  ],
  "legal_bases": [
    {
      "type": "external",
      "citation": "1987 Constitution, Article X Section Y",
      "url": "https://www.officialgazette.gov.ph/constitutions/1987-constitution/",
      "title": "Document Title",
      "note": "Brief description of legal basis"
    }
  ],
  "related_sections": [
    {
      "type": "external",
      "citation": "1987 Constitution, Article X Section Y",
      "url": "https://www.officialgazette.gov.ph/constitutions/1987-constitution/",
      "title": "Document Title",
      "note": "Brief description of relationship"
    }
  ]
}
```

### **Critical GPT Instructions:**
1. **Always include ALL required fields** - Missing any will cause validation failure
2. **Use exact constitutional text** - Do not paraphrase or summarize
3. **Topics array is REQUIRED** - Must have at least one topic
4. **pack_priority must be number** - Use 1, 2, or 3 (not "1", "2", "3")
5. **Jurisprudence is array of strings** - Not objects with citation/url/title/note
6. **Related sections and legal_bases use type: "external"** - Always use this format with citation, url, title, and note
7. **Entry ID format** - CONST-{SectionID}-{6-digit-timestamp} (auto-generated by system)
8. **Dates must be YYYY-MM-DD** - No other format accepted
9. **URLs must be complete** - Start with http:// or https://
10. **Status must be valid enum** - "active", "amended", "repealed", "draft", "approved", "published"

---

## 📞 Support

For questions or issues with constitution provision entries:
- Contact Tagarao (P5) for content questions
- Refer to the main ENTRY_CREATION_GUIDE.md for general guidance
- Check the browser console for validation errors
- Contact the development team for technical issues

---

*This guide is specifically designed for Constitution Provision entries and is maintained by the Civilify development team.*
