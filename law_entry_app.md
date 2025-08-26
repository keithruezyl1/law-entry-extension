# Civilify Law Entry App - Complete Documentation

## Overview

The **Civilify Law Entry App** is a React-based web application designed as an extension for the Civilify admin page. It serves as the primary gateway for adding entries into the Civilify Knowledge Base (KB). The app provides a comprehensive, dynamic form system for creating and managing legal knowledge base entries with support for multiple legal document types.

## Technology Stack

- **React 19.1.1** - Main UI framework
- **TypeScript 4.9.5** - Type safety
- **React Hook Form 7.62.0** - Form management
- **Zod 3.23.8** - Schema validation
- **Tailwind CSS 4.1.12** - Styling
- **Radix UI** - Accessible components
- **Lucide React** - Icons

## Core Features

### 1. Multi-Step Form Wizard (5 Steps)
- **Step 1**: Basic Information (type, title, jurisdiction, etc.)
- **Step 2**: Sources & Dates (URLs, effective dates)
- **Step 3**: Content (summary, text, tags)
- **Step 4**: Type-Specific & Relations (dynamic by type + legal bases/related sections)
- **Step 5**: Review & Publish

### 2. Dynamic Form System
- **8 GLI+CPA Entry Types** with specific fields and validation
- **Real-time validation** with immediate feedback
- **Auto-save functionality** every 10 seconds
- **Live preview** of entry data
- **Auto-generation** of entry IDs

### 3. Entry Management
- Create, edit, delete entries
- Search and filter functionality
- Bulk operations (export, import, clear all)
- Offline pack management

## Supported Entry Types (GLI+CPA)

1. **Constitution Provision** - Constitutional rights and principles
2. **Statute Section** - Criminal and civil statutes
3. **City Ordinance Section** - Local government ordinances
4. **Rule of Court** - Court procedural rules
5. **Agency Circular** - Government agency circulars
6. **DOJ Issuance** - Department of Justice issuances
7. **Executive Issuance** - Executive orders and issuances
8. **Rights Advisory** - Legal rights information

Police-mode types (e.g., PNP SOP, Traffic Rule, Incident Checklist) were removed in the GLI+CPA version.

---

## Initial Setup & Daily Plan

This app can be used immediately with local storage. For best results, import a Daily Plan so the dashboard shows the required daily work per person.

### Prerequisites
- Node.js 18+ and npm (or yarn/pnpm)
- Excel file `Civilify_KB30_Schedule_CorePH.xlsx` containing the "Daily Plan" sheet

### Install & Run (Dev)
```bash
git clone <repository-url>
cd law-entry-app
npm install
npm start
```

### Import the Plan and Set Day 1
1. Open the app at `http://localhost:3000`.
2. In the main page header actions, click **Import Plan**.
3. Choose `Civilify_KB30_Schedule_CorePH.xlsx`.
4. A modal appears asking to **Set Day 1** (project start date). Pick the correct date and confirm.
5. The app stores the parsed plan in `localStorage` under `kb_plan_rows` and your Day 1 in `kbprog:day1`.

After this:
- The Team Progress cards show daily quotas by person (Arda, Delos Cientos, Paden, Sendrijas, Tagarao).
- The date beside “Today’s Team Progress” displays `Day N, Month D YYYY` based on Day 1.

### Re-import or Remove the Plan
- Use **Re-import Plan** to load a different Excel file; Day 1 will be requested again.
- Use **Remove Plan** to clear the plan and Day 1 (cards return to placeholders).

### Where the Plan Data Is Used
- Dashboard (P1–P5 cards) shows per-person required counts for the selected day.
- Progress is tracked in `localStorage` with keys `kbprog:<YYYY-MM-DD>:<P#>:<type>`.

---

## Dynamic Form Architecture

### Form State Management
```typescript
const methods = useForm<Entry>({
  defaultValues: { /* type-specific defaults */ },
  mode: 'onChange',
  resolver: zodResolver(EntrySchema),
});
```

### Type-Specific Rendering
```typescript
{type === 'statute_section' && <StatuteSectionForm />}
{type === 'rule_of_court' && <RuleOfCourtForm />}
{type === 'traffic_rule' && <TrafficRuleForm />}
// ... other types
```

### Auto-Generation Features
- **Entry ID**: Generated from type, law family, and section ID
- **Auto-save**: Periodic saving to localStorage
- **Draft recovery**: Automatic draft loading on form open

## Component Structure

### Main Components
- **App.js** - Main application container
- **EntryForm.tsx** - Multi-step form wizard
- **EntryStepper.tsx** - Progress indicator
- **EntryPreview.tsx** - Live preview component
- **EntryList.js** - Entry listing and filtering

### Type-Specific Components
- **StatuteSectionForm.tsx** - Statute-specific fields
- **RuleOfCourtForm.tsx** - Court rule fields
- **TrafficRuleForm.tsx** - Traffic violation fields
- **IncidentChecklistForm.tsx** - Incident procedure fields
- **RightsAdvisoryForm.tsx** - Rights information fields

### Utility Components
- **UrlArray** - Dynamic URL input with chips
- **TagArray** - Dynamic tag input with chips
- **LegalBasisPicker** - Legal reference management
- **Modal** - Popup dialogs

## Data Flow & State Management

### Local Storage Hook (`useLocalStorage.js`)
```typescript
export const useLocalStorage = () => {
  const [entries, setEntries] = useState([]);
  
  const addEntry = (entry) => { /* implementation */ };
  const updateEntry = (entryId, updates) => { /* implementation */ };
  const deleteEntry = (entryId) => { /* implementation */ };
  const searchEntries = (query, filters) => { /* implementation */ };
  
  return { entries, addEntry, updateEntry, deleteEntry, searchEntries };
};
```

### Form Data Flow
```
User Input → React Hook Form → Validation → State Update → UI Re-render
```

### Auto-Save Flow
```
Form Changes → Debounced Save → Local Storage → Success Notification
```

## Schema Validation System

### Base Schema (`BaseEntry`)
All entry types extend from a base schema with common fields:
- type, entry_id, title, jurisdiction, law_family
- section_id, canonical_citation, status
- effective_date, amendment_date, summary, text
- source_urls, tags, last_reviewed
- visibility settings, offline pack settings

### Type-Specific Extensions
Each entry type extends the base schema with specific fields:

```typescript
export const StatuteSection = BaseEntry.extend({
  type: z.literal("statute_section"),
  elements: z.array(z.string()).default([]),
  penalties: z.array(z.string()).default([]),
  defenses: z.array(z.string()).default([]).optional(),
  prescriptive_period: z.object({ 
    value: z.number().positive(), 
    unit: z.enum(["days", "months", "years"]) 
  }).optional(),
  standard_of_proof: z.string().optional(),
  related_sections: z.array(EntryRef).default([]),
  legal_bases: z.array(LegalBasis).default([]),
});
```

## Styling System

### Design Tokens
```css
:root {
  --space-xs: 4px;   --space-sm: 8px;   --space-md: 16px;
  --space-lg: 24px;  --space-xl: 32px;  --radius: 12px;
  --primary: #f97316; /* Orange */
  --background: #ffffff; --border: #e5e7eb;
}
```

### Component Classes
- **kb-form** - Main form container
- **kb-form-container** - Form layout wrapper
- **kb-form-layout** - Grid layout (sidebar + content)
- **kb-form-content** - Form and preview columns
- **kb-form-input/select** - Form field styling
- **kb-action-bar** - Sticky footer with buttons

### Responsive Design
- Mobile-first approach
- Sidebar collapses to dropdown on small screens
- Form stacks vertically on mobile

## Advanced Features

### 1. Dynamic Jurisdiction Selection
- Default: "PH Philippines (PH)"
- "Other" option transforms into search input
- Custom jurisdiction support with validation

### 2. Dynamic Array Fields
- **URLs**: Single input, add on Enter/Space, chip preview
- **Tags**: Same behavior as URLs
- **Hover effects**: Darken background, blur text, show remove button

### 3. Search & Filtering
- **Text search**: Title, ID, content
- **Type filter**: All 11 entry types
- **Jurisdiction filter**: PH + custom jurisdictions
- **Status filter**: Active, Amended, Repealed, Draft, Approved, Published
- **Team member filter**: P1-P5 team assignments
- **Offline pack filter**: Included/Not included

### 4. Auto-Save & Draft Management
- **Periodic auto-save**: Every 10 seconds
- **Manual save**: "Save Draft" button
- **Draft recovery**: Automatic on form open
- **Success notification**: Modal popup for 1.5 seconds

## Form Validation Rules

### Required Fields
- **Title**: Minimum 3 characters
- **Jurisdiction**: "PH" or valid custom jurisdiction
- **Law Family**: Required for all entries
- **Canonical Citation**: Required for all entries
- **Status**: Must be defined status value
- **Summary**: Required for all entries
- **Text**: Required for all entries
- **Source URLs**: At least one required

### Type-Specific Validation
- **Statute Section**: Elements and penalties required
- **Rule of Court**: Rule number and section number required
- **Traffic Rule**: Violation code and name required
- **Incident Checklist**: At least one phase required
- **Rights Advisory**: At least one advice point required

## Local Storage & Persistence

### Storage Keys
- `kb_entries` - Main entry data
- `kb_team_progress` - Team progress tracking
- `kb_daily_quotas` - Daily quota management
- `kb_entry_draft` - Current form draft

### Data Operations
- **Export**: Download all entries as JSON
- **Import**: Upload JSON file to add entries
- **Clear All**: Remove all entries with confirmation
- **Auto-save**: Periodic saving of form state

## Usage Guide

### Creating a New Entry
1. Click "New Entry" button
2. Complete 6-step form wizard:
   - **Step 1**: Basic information (type, title, jurisdiction)
   - **Step 2**: Sources and dates (URLs, effective dates)
   - **Step 3**: Content (summary, text, tags)
   - **Step 4**: Type-specific fields (dynamic based on type)
   - **Step 5**: Visibility and offline settings
   - **Step 6**: Review and publish
3. Click "Create Entry" to save

### Managing Entries
- **View**: Click "View" to see entry details
- **Edit**: Click "Edit" to modify existing entry
- **Delete**: Click "Delete" with confirmation
- **Search**: Use search bar and filters
- **Export/Import**: Bulk operations for data management

### Advanced Features
- **Auto-save**: Form saves automatically every 10 seconds
- **Draft saving**: Manual save with "Save Draft" button
- **Live preview**: Real-time preview of entry data
- **Dynamic fields**: Type-specific form fields
- **Validation**: Real-time validation with error messages

## Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
git clone <repository-url>
cd law-entry-app
npm install
npm start
```

---

## Backend Integration Guide

The app ships in a local-storage mode by default. To connect it to a real backend, wire the following integration points.

### Auth & Login
- Add a login screen (OIDC/JWT or session cookie) and expose the current user via a React context (e.g., `AuthContext`).
- The wizard Step 1 shows a read‑only “Entering as” field. Bind this to the logged-in user (e.g., Tagarao for P5). Until auth is wired, this shows a placeholder "MEMBER".

Recommended properties for the `AuthContext`:
```ts
type AuthUser = {
  id: string;
  name: string;   // e.g., "Tagarao"
  personId?: 'P1'|'P2'|'P3'|'P4'|'P5';
  roles: string[];
};
```

### Entry CRUD API
Implement these endpoints and swap the local-storage methods in `useLocalStorage` with real HTTP calls. A thin API layer is recommended (e.g., `/src/services/kbApi.ts`).

Expected endpoints (REST):
- `POST /api/entries` — create
- `GET /api/entries/:id` — read
- `PUT /api/entries/:id` — update
- `DELETE /api/entries/:id` — delete
- `GET /api/entries/search?q=...&filters=...` — search

Validation should run server-side using the same schema rules (zod or your server’s validator). Return structured errors that can be surfaced inline.

### Plan & Progress API (Optional)
If you want shared progress across browsers/users:
- Upload and parse the Excel plan on the server; return normalized JSON.
- Store/retrieve plan by date via `GET /api/plan?date=YYYY-MM-DD`.
- Persist counts per day/person/type via `POST /api/progress` and `GET /api/progress?date=...`.

### Environment Configuration
Use `.env` files to set API roots and feature flags.
```
REACT_APP_API_BASE=https://civilify.example.com
REACT_APP_AUTH_PROVIDER=keycloak
REACT_APP_FEATURE_DASHBOARD=true
```

---

## Using the Wizard (Authoring Workflow)

1) Open the app and click **Create New Entry**.

2) Complete Steps 1–5. Notes:
- Step 1: Type, Title, Jurisdiction. “Entering as” shows the logged-in member when connected to auth.
- Step 2: Provide at least one Source URL.
- Step 3: Summary and Legal Text with Tags.
- Step 4: Type-specific fields + Relations block.
  - For **Rights Advisory**, at least one Legal Basis is required (internal or external). The Next button stays disabled until provided.
  - For other types, Relations are optional. A tip hints that linking sources improves citations.
- Step 5: Review & Publish. Create or update the entry.

3) Drafts & Autosave
- Drafts save to `localStorage` every 5s. If you return later, the app asks to resume.
- Cancel shows a confirm dialog and clears the draft.

---

## Troubleshooting & Tips

- “Plan not loaded”: Use Import Plan and pick the Excel file; set Day 1. If you still don’t see quotas, clear site data then re-import.
- “Next disabled on Step 4”: This happens when Rights Advisory has no legal_bases. Add one Internal/External citation to proceed.
- “Buttons wrap to two lines”: The primary nav buttons use `white-space: nowrap`. Ensure custom CSS doesn’t override.
- “Auth context not available”: Render the app within your `AuthProvider` and pass user details; bind Step 1 “Entering as”.

---

## Migration Notes (GLI+CPA)
- Removed police-specific types and screens; schemas trimmed to eight GLI+CPA types.
- Wizard reduced to five steps; Relations integrated into Step 4.
- Dashboard shows GLI+CPA quotas only.


### Available Scripts
- `npm start` - Start development server
- `npm build` - Build for production
- `npm test` - Run tests
- `npm eject` - Eject from Create React App

## API Integration Points

The app is designed for easy API integration:

### Entry CRUD Operations
```typescript
const api = {
  createEntry: async (entryData) => { /* POST /api/entries */ },
  updateEntry: async (entryId, updates) => { /* PUT /api/entries/:id */ },
  deleteEntry: async (entryId) => { /* DELETE /api/entries/:id */ },
  searchEntries: async (query, filters) => { /* GET /api/entries/search */ }
};
```

### Validation Integration
```typescript
const validateEntry = async (entryData) => {
  /* POST /api/entries/validate */
};
```

## Best Practices

### Entry Creation
- Use descriptive titles that clearly identify legal provisions
- Provide complete citations in canonical format
- Include multiple source URLs for verification
- Write comprehensive summaries explaining key points
- Add relevant tags for better searchability

### Content Quality
- Verify legal text against official sources
- Ensure accuracy of all legal information
- Update status when laws are amended or repealed
- Review entries regularly for currency

### Organization
- Use consistent naming conventions
- Apply appropriate tags for categorization
- Set correct visibility settings for team access
- Include in offline packs for field use

## Conclusion

The Civilify Law Entry App provides a comprehensive, user-friendly interface for managing legal knowledge base entries. Its dynamic form system adapts to different legal document types, while robust validation and auto-save features ensure data quality and user experience.

The app is designed to scale from local storage to full API integration, making it suitable for both development and production environments. The modular component architecture makes it easy to maintain and extend.

For questions or support, please refer to the development team or consult the inline code documentation.
