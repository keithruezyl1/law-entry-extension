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
section_id?: string      // Article/Section (e.g., "Art. III, Sec. 12", "Art. III, Sec. 2")
canonical_citation: string // Formal cite (e.g., "1987 Constitution, Art. III, Sec. 12")
status: string           // "active" | "amended" | "repealed" (usually "active")
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

### **📱 Offline Pack Settings**
```javascript
offline: {
  pack_include: boolean,    // Include in offline pack (usually true)
  pack_category: "rights",  // Usually "rights" for constitution
  pack_priority: "1"        // "1", "2", or "3" (usually "1" for fundamental rights)
}
```

### **📜 Constitution-Specific Fields**
```javascript
topics: string[]              // Required: constitutional topics/themes
related_sections: string[]    // Optional: related constitutional sections
jurisprudence: string[]       // Optional: key Supreme Court cases
```

---

## 📚 Constitution Provision Examples

### **Example 1: Bill of Rights - Search and Seizure**

```json
{
  "entry_id": "CONST-Art3Sec2-20240115",
  "type": "constitution_provision",
  "title": "Protection Against Unreasonable Searches and Seizures",
  "jurisdiction": "PH",
  "law_family": "1987 Constitution",
  "section_id": "Art. III, Sec. 2",
  "canonical_citation": "1987 Constitution, Art. III, Sec. 2",
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
  "offline": {
    "pack_include": true,
    "pack_category": "rights",
    "pack_priority": "1"
  },
  "topics": ["search", "seizure", "privacy", "warrant", "probable_cause"],
  "related_sections": [
    "1987 Constitution, Art. III, Sec. 3 (Privacy of Communication)",
    "1987 Constitution, Art. III, Sec. 12 (Custodial Investigation)"
  ],
  "jurisprudence": [
    "People v. Marti, GR 81561, 1991",
    "People v. Doria, GR 125299, 1999",
    "People v. Chua Ho San, GR 128222, 2001"
  ]
}
```

### **Example 2: Bill of Rights - Custodial Investigation**

```json
{
  "entry_id": "CONST-Art3Sec12-20240115",
  "type": "constitution_provision",
  "title": "Rights of Persons Under Custodial Investigation",
  "jurisdiction": "PH",
  "law_family": "1987 Constitution",
  "section_id": "Art. III, Sec. 12",
  "canonical_citation": "1987 Constitution, Art. III, Sec. 12",
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
  "offline": {
    "pack_include": true,
    "pack_category": "rights",
    "pack_priority": "1"
  },
  "topics": ["custodial", "investigation", "counsel", "silence", "waiver"],
  "related_sections": [
    "1987 Constitution, Art. III, Sec. 13 (Right to Bail)",
    "1987 Constitution, Art. III, Sec. 14 (Right to Due Process)"
  ],
  "jurisprudence": [
    "People v. Galit, GR 51770, 1982",
    "People v. Andan, GR 116437, 1997",
    "People v. Rapeza, GR 169431, 2006"
  ]
}
```

### **Example 3: Bill of Rights - Right to Bail**

```json
{
  "entry_id": "CONST-Art3Sec13-20240115",
  "type": "constitution_provision",
  "title": "Right to Bail",
  "jurisdiction": "PH",
  "law_family": "1987 Constitution",
  "section_id": "Art. III, Sec. 13",
  "canonical_citation": "1987 Constitution, Art. III, Sec. 13",
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
  "offline": {
    "pack_include": true,
    "pack_category": "rights",
    "pack_priority": "1"
  },
  "topics": ["bail", "release", "capital_offense", "recognizance", "excessive_bail"],
  "related_sections": [
    "1987 Constitution, Art. III, Sec. 12 (Custodial Investigation)",
    "1987 Constitution, Art. III, Sec. 15 (Writ of Habeas Corpus)"
  ],
  "jurisprudence": [
    "People v. Honrada, GR 119123, 1996",
    "People v. Cabral, GR 188329, 2010",
    "People v. Temporada, GR 173473, 2008"
  ]
}
```

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
- `https://www.officialgazette.gov.ph/constitutions/1987-constitution/`
- `https://www.lawphil.net/consti/cons1987.html`

### **Additional Resources:**
- `https://www.supremecourt.gov.ph/` (Supreme Court decisions)
- `https://www.chanrobles.com/` (Legal database)
- `https://www.lawphil.net/` (Philippine legal resources)

---

## 📝 Writing Guidelines

### **Title Format:**
- Use clear, descriptive titles
- Focus on the specific right or principle
- Examples:
  - ✅ "Protection Against Unreasonable Searches and Seizures"
  - ✅ "Rights of Persons Under Custodial Investigation"
  - ✅ "Right to Bail"
  - ❌ "Article III Section 2"
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
1. **Missing required fields** - Ensure all base fields are included
2. **Invalid dates** - Use YYYY-MM-DD format
3. **Invalid URLs** - Ensure URLs start with http:// or https://
4. **Empty arrays** - Required arrays cannot be empty
5. **Incorrect entry_id** - Follow the CONST-Art3Sec12-YYYYMMDD format

### **Validation Errors:**
- Check browser console for specific error messages
- Verify JSON syntax is correct
- Ensure all required fields are present
- Confirm all URLs are valid
- Check date formats

---

## 📞 Support

For questions or issues with constitution provision entries:
- Contact Tagarao (P5) for content questions
- Refer to the main ENTRY_CREATION_GUIDE.md for general guidance
- Check the browser console for validation errors
- Contact the development team for technical issues

---

*This guide is specifically designed for Constitution Provision entries and is maintained by the Civilify development team.*
