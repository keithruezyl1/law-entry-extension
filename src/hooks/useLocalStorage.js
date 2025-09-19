import { useState, useEffect, useMemo } from 'react';
import { upsertEntry, deleteEntryVector } from '../services/vectorApi';
import { fetchAllEntriesFromDb } from '../services/kbApi';
import { updateProgressForEntry } from '../lib/plan/progressStore';
import { toISODate, getPlanDate } from '../lib/plan/planLoader';

const STORAGE_KEY = 'law_entries';
const TEAM_PROGRESS_KEY = 'team_progress';
const DAILY_QUOTAS_KEY = 'daily_quotas';

// Custom hook for managing entries in localStorage
export const useLocalStorage = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Function to clear errors
  const clearError = () => setError(null);
  const [teamProgress, setTeamProgress] = useState({});
  const [dailyQuotas, setDailyQuotas] = useState({});

  // Load entries from localStorage on mount, then refresh from DB (DB-first)
  useEffect(() => {
    try {
      const storedEntries = localStorage.getItem(STORAGE_KEY);
      const storedProgress = localStorage.getItem(TEAM_PROGRESS_KEY);
      const storedQuotas = localStorage.getItem(DAILY_QUOTAS_KEY);
      
      if (storedEntries) {
        const parsedEntries = JSON.parse(storedEntries);
        setEntries(Array.isArray(parsedEntries) ? parsedEntries : []);
      }
      
      if (storedProgress) {
        const parsedProgress = JSON.parse(storedProgress);
        setTeamProgress(parsedProgress);
      }
      
      if (storedQuotas) {
        const parsedQuotas = JSON.parse(storedQuotas);
        setDailyQuotas(parsedQuotas);
      }
    } catch (err) {
      console.error('Error loading data from localStorage:', err);
      // Don't show localStorage errors to users - localStorage is just a cache
      // The real data comes from the database, so this is not a critical error
    } finally {
      setLoading(false);
    }
  }, []);

  // Hydrate from DB after initial mount
  useEffect(() => {
    const refresh = async () => {
      try {
        const dbEntries = await fetchAllEntriesFromDb();
        if (Array.isArray(dbEntries)) {
          const mapped = dbEntries.map((e) => ({
            ...e,
            id: e.entry_id,
          }));
          setEntries(mapped);
        }
      } catch (err) {
        console.warn('DB fetch failed; showing local entries', err);
      }
    };
    refresh();
  }, []);

  // Save entries to localStorage whenever entries change
  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        // Clear any previous localStorage errors when save succeeds
        if (error && error.includes('storage')) {
          setError(null);
        }
      } catch (err) {
        console.error('Error saving entries to localStorage:', err);
        // Don't show localStorage errors to users - these are not critical
        // The entries are still working fine from the database
        // Only log the error for debugging purposes
      }
    }
  }, [entries, loading, error]);

  // Save team progress to localStorage whenever it changes
  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem(TEAM_PROGRESS_KEY, JSON.stringify(teamProgress));
        // Clear any previous localStorage errors when save succeeds
        if (error && error.includes('storage')) {
          setError(null);
        }
      } catch (err) {
        console.error('Error saving team progress to localStorage:', err);
        // Don't show localStorage errors to users - these are not critical
        // Only log the error for debugging purposes
      }
    }
  }, [teamProgress, loading, error]);

  // Save daily quotas to localStorage whenever they change
  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem(DAILY_QUOTAS_KEY, JSON.stringify(dailyQuotas));
        // Clear any previous localStorage errors when save succeeds
        if (error && error.includes('storage')) {
          setError(null);
        }
      } catch (err) {
        console.error('Error saving daily quotas to localStorage:', err);
        // Don't show localStorage errors to users - these are not critical
        // Only log the error for debugging purposes
      }
    }
  }, [dailyQuotas, loading, error]);

  // Check for daily reset at midnight
  useEffect(() => {
    if (!loading) {
      const checkDailyReset = () => {
        const today = new Date().toISOString().split('T')[0];
        const lastReset = dailyQuotas.lastReset;
        
        // If it's a new day and we haven't reset yet
        if (lastReset !== today) {
          console.log('New day detected, resetting daily quotas');
          resetDailyQuotas();
        }
      };

      // Check immediately
      checkDailyReset();

      // Set up interval to check every minute
      const interval = setInterval(checkDailyReset, 60000);

      // Cleanup interval on unmount
      return () => clearInterval(interval);
    }
  }, [loading, dailyQuotas.lastReset]);

  // Add a new entry
  const addEntry = async (entry) => {
    try {
      // Upsert to DB (embedding server)
      if (!entry.entry_id) throw new Error('entry_id is required');
      const payload = {
        entry_id: entry.entry_id,
        type: entry.type,
        title: entry.title,
        canonical_citation: entry.canonical_citation,
        summary: entry.summary,
        text: entry.text,
        tags: entry.tags,
        jurisdiction: entry.jurisdiction,
        law_family: entry.law_family,
        section_id: entry.section_id,
        status: entry.status,
        effective_date: entry.effective_date,
        amendment_date: entry.amendment_date,
        last_reviewed: entry.last_reviewed,
        visibility: entry.visibility,
        source_urls: entry.source_urls,
        elements: entry.elements,
        penalties: entry.penalties,
        defenses: entry.defenses,
        prescriptive_period: entry.prescriptive_period,
        standard_of_proof: entry.standard_of_proof,
        rule_no: entry.rule_no,
        section_no: entry.section_no,
        triggers: entry.triggers,
        time_limits: entry.time_limits,
        required_forms: entry.required_forms,
        circular_no: entry.circular_no,
        applicability: entry.applicability,
        issuance_no: entry.issuance_no,
        instrument_no: entry.instrument_no,
        supersedes: entry.supersedes,
        steps_brief: entry.steps_brief,
        forms_required: entry.forms_required,
        failure_states: entry.failure_states,
        violation_code: entry.violation_code,
        violation_name: entry.violation_name,
        license_action: entry.license_action,
        fine_schedule: entry.fine_schedule,
        apprehension_flow: entry.apprehension_flow,
        incident: entry.incident,
        phases: entry.phases,
        forms: entry.forms,
        handoff: entry.handoff,
        rights_callouts: entry.rights_callouts,
        rights_scope: entry.rights_scope,
        advice_points: entry.advice_points,
        topics: entry.topics,
        jurisprudence: entry.jurisprudence,
        legal_bases: entry.legal_bases,
        related_sections: entry.related_sections,
        created_by: entry.created_by,
        created_by_name: entry.created_by_name,
      };
      const resp = await upsertEntry(payload);
      if (!resp?.success) throw new Error(resp?.error || 'Upsert failed');

      // Refresh from DB for authoritative state
      const dbEntries = await fetchAllEntriesFromDb();
      if (Array.isArray(dbEntries)) {
        const mapped = dbEntries.map((e) => ({ ...e, id: e.entry_id }));
        setEntries(mapped);
        // Clear any previous errors when operation succeeds
        setError(null);
      }

      // Progress increments are keyed by username + date
      const who = String(entry.created_by_username || entry.created_by_name || entry.team_member_id || '').trim();
      if (who) {
        // Use the created_at date for progress tracking
        const entryDate = entry.created_at ? new Date(entry.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        updateProgressForEntry(entryDate, who, entry.type);
      }
      return payload;
    } catch (err) {
      console.error('Error adding entry:', err);
      setError('Failed to add entry');
      throw err;
    }
  };

  // Update an existing entry
  const updateEntry = async (id, updates) => {
    try {
      const existing = entries.find((e) => e.id === id);
      if (!existing) throw new Error('Entry not found');
      const merged = { ...existing, ...updates };
      if (!merged.entry_id) throw new Error('entry_id is required');
      
      // Type-specific field mapping
      const typeSpecificFields = {
        constitution_provision: ['topics', 'related_sections', 'jurisprudence'],
        statute_section: ['elements', 'penalties', 'defenses', 'prescriptive_period', 'standard_of_proof', 'related_sections', 'legal_bases'],
        city_ordinance_section: ['elements', 'penalties', 'defenses', 'related_sections', 'legal_bases'],
        rule_of_court: ['rule_no', 'section_no', 'triggers', 'time_limits', 'required_forms', 'related_sections'],
        agency_circular: ['circular_no', 'section_no', 'applicability', 'legal_bases', 'supersedes'],
        doj_issuance: ['issuance_no', 'applicability', 'legal_bases', 'supersedes'],
        executive_issuance: ['instrument_no', 'applicability', 'legal_bases', 'supersedes'],
        rights_advisory: ['rights_scope', 'advice_points', 'legal_bases', 'related_sections'],
      };

      // Helper function to normalize string fields
      const normalizeStringField = (value) => {
        if (value === null || value === undefined) return '';
        return String(value);
      };

      // Get relevant fields for this entry type
      const relevantFields = typeSpecificFields[merged.type] || [];
      
      // Send complete payload with only relevant type-specific fields
      const payload = {
        entry_id: merged.entry_id,
        type: merged.type,
        title: normalizeStringField(merged.title),
        canonical_citation: normalizeStringField(merged.canonical_citation),
        summary: normalizeStringField(merged.summary),
        text: normalizeStringField(merged.text),
        tags: merged.tags,
        jurisdiction: merged.jurisdiction,
        law_family: normalizeStringField(merged.law_family),
        section_id: normalizeStringField(merged.section_id),
        status: normalizeStringField(merged.status),
        effective_date: merged.effective_date,
        amendment_date: merged.amendment_date,
        last_reviewed: merged.last_reviewed,
        visibility: merged.visibility,
        source_urls: merged.source_urls,
        legal_bases: merged.legal_bases,
        related_sections: merged.related_sections,
      };

      // Only include type-specific fields that are relevant for this entry type
      if (relevantFields.includes('elements')) payload.elements = merged.elements;
      if (relevantFields.includes('penalties')) payload.penalties = merged.penalties;
      if (relevantFields.includes('defenses')) payload.defenses = merged.defenses;
      if (relevantFields.includes('prescriptive_period')) payload.prescriptive_period = merged.prescriptive_period;
      if (relevantFields.includes('standard_of_proof')) payload.standard_of_proof = normalizeStringField(merged.standard_of_proof);
      if (relevantFields.includes('rule_no')) payload.rule_no = normalizeStringField(merged.rule_no);
      if (relevantFields.includes('section_no')) payload.section_no = normalizeStringField(merged.section_no);
      if (relevantFields.includes('triggers')) payload.triggers = merged.triggers;
      if (relevantFields.includes('time_limits')) payload.time_limits = merged.time_limits;
      if (relevantFields.includes('required_forms')) payload.required_forms = merged.required_forms;
      if (relevantFields.includes('circular_no')) payload.circular_no = normalizeStringField(merged.circular_no);
      if (relevantFields.includes('applicability')) payload.applicability = merged.applicability;
      if (relevantFields.includes('issuance_no')) payload.issuance_no = normalizeStringField(merged.issuance_no);
      if (relevantFields.includes('instrument_no')) payload.instrument_no = normalizeStringField(merged.instrument_no);
      if (relevantFields.includes('supersedes')) payload.supersedes = merged.supersedes;
      if (relevantFields.includes('steps_brief')) payload.steps_brief = merged.steps_brief;
      if (relevantFields.includes('forms_required')) payload.forms_required = merged.forms_required;
      if (relevantFields.includes('failure_states')) payload.failure_states = merged.failure_states;
      if (relevantFields.includes('violation_code')) payload.violation_code = normalizeStringField(merged.violation_code);
      if (relevantFields.includes('violation_name')) payload.violation_name = normalizeStringField(merged.violation_name);
      if (relevantFields.includes('license_action')) payload.license_action = normalizeStringField(merged.license_action);
      if (relevantFields.includes('fine_schedule')) payload.fine_schedule = merged.fine_schedule;
      if (relevantFields.includes('apprehension_flow')) payload.apprehension_flow = merged.apprehension_flow;
      if (relevantFields.includes('incident')) payload.incident = normalizeStringField(merged.incident);
      if (relevantFields.includes('phases')) payload.phases = merged.phases;
      if (relevantFields.includes('forms')) payload.forms = merged.forms;
      if (relevantFields.includes('handoff')) payload.handoff = merged.handoff;
      if (relevantFields.includes('rights_callouts')) payload.rights_callouts = merged.rights_callouts;
      if (relevantFields.includes('rights_scope')) payload.rights_scope = normalizeStringField(merged.rights_scope);
      if (relevantFields.includes('advice_points')) payload.advice_points = merged.advice_points;
      if (relevantFields.includes('topics')) payload.topics = merged.topics;
      if (relevantFields.includes('jurisprudence')) payload.jurisprudence = merged.jurisprudence;

      // Debug logging
      console.log('🔧 Update Entry - Type:', merged.type);
      console.log('🔧 Update Entry - Relevant fields:', relevantFields);
      console.log('🔧 Update Entry - Payload keys:', Object.keys(payload));
      console.log('🔧 Update Entry - Has standard_of_proof:', 'standard_of_proof' in payload);

      // Use the proper PUT endpoint for updates
      const response = await fetch(`${process.env.REACT_APP_API_BASE || ''}/api/kb/entries/${merged.entry_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Update failed');
      }

      const result = await response.json();
      if (!result?.success) throw new Error(result?.error || 'Update failed');

      // Refresh entries from database
      const dbEntries = await fetchAllEntriesFromDb();
      if (Array.isArray(dbEntries)) {
        const mapped = dbEntries.map((e) => ({ ...e, id: e.entry_id }));
        setEntries(mapped);
        // Clear any previous errors when operation succeeds
        setError(null);
      }

      console.log('Entry updated successfully:', result);
    } catch (err) {
      console.error('Error updating entry:', err);
      setError('Failed to update entry');
      throw err;
    }
  };

  // Delete an entry
  const deleteEntry = async (id) => {
    try {
      const entryToDelete = entries.find(entry => entry.id === id);
      if (!entryToDelete || !entryToDelete.entry_id) throw new Error('Entry not found');
      await deleteEntryVector(entryToDelete.entry_id);
      const dbEntries = await fetchAllEntriesFromDb();
      if (Array.isArray(dbEntries)) {
        const mapped = dbEntries.map((e) => ({ ...e, id: e.entry_id }));
        setEntries(mapped);
      }
      if (entryToDelete && entryToDelete.team_member_id) {
        decrementTeamProgress(entryToDelete.team_member_id, entryToDelete.type);
      }
    } catch (err) {
      console.error('Error deleting entry:', err);
      setError('Failed to delete entry');
      throw err;
    }
  };

  // Get entry by ID
  const getEntryById = (id) => {
    return entries.find(entry => entry.id === id);
  };

  // Get entry by entry_id
  const getEntryByEntryId = (entryId) => {
    return entries.find(entry => entry.entry_id === entryId);
  };

  // Optimized search entries with memoization
  const searchEntries = useMemo(() => {
    // Create a memoized search function
    const memoizedSearch = (query, filters = {}) => {
    let filteredEntries = [...entries];

    // Text search
    if (query && query.trim()) {
        // Fast normalization - single pass
        const normalize = (text) => {
          if (!text) return '';
          let s = String(text).toLowerCase();
          // Map punctuation variants to words before stripping
          s = s.replace(/[&/]/g, ' and ');
          // Expand common legal abbreviations (with or without dot)
          s = s
            .replace(/\bart\.?\b/g, 'article')
            .replace(/\bart\.\s*/g, 'article ')
            .replace(/\barticulo\b/g, 'article')
            .replace(/\bsec\.?\b/g, 'section')
            .replace(/\bsec\.\s*/g, 'section ')
            .replace(/\bpar\.?\b/g, 'paragraph')
            .replace(/\bsubsec\.?\b/g, 'subsection')
            .replace(/\bsub\.\b/g, 'subsection')
            .replace(/\br\.?a\.?\b/g, 'republic act')
            .replace(/\bra\b/g, 'republic act')
            .replace(/\bno\.?\b/g, 'number');
          // Remove remaining punctuation
          s = s.replace(/[^a-z0-9\s]/g, ' ');
          // Collapse whitespace
          s = s.replace(/\s+/g, ' ').trim();
          // Light plural normalization: singularize simple trailing 's' (avoid 'ss')
          s = s
            .split(' ')
            .map(w => (w.length > 3 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w))
            .join(' ');
          return s;
        };
        
        let searchTerm = normalize(query);
        const searchWords = searchTerm.split(/\s+/).filter(Boolean);
        // Generate simple synonym/variant expansions (non-destructive)
        const removeAntiPrefix = (w) => w.startsWith('anti') && w.length > 4 ? w.replace(/^anti[-\s]?/, '') : w;
        const expandWordVariants = (w) => {
          const variants = new Set([w]);
          // anti- prefix variant: "anti-torture" ~ "torture"
          variants.add(removeAntiPrefix(w));
          // vs/versus normalization to 'v'
          if (w === 'vs' || w === 'vs.' || w === 'versus') variants.add('v');
          if (w === 'v') variants.add('vs');
          return Array.from(variants).filter(Boolean);
        };
        const searchWordVariants = new Set(searchWords.flatMap(expandWordVariants));
        // Generate compact and parenthetical variants for matching
        const compactSearch = searchTerm.replace(/\s+/g, '');
        // Insert parentheses between trailing number-letter patterns for better match to canonical forms
        const parentheticalSearch = searchTerm
          .replace(/\b(\d+)\s*([a-z])\b/g, '$1($2)')
          .replace(/\b(\d+)\s*\(\s*([a-z])\s*\)\b/g, '$1($2)');
        
        // Fast simple fuzzy matching - no complex algorithms
        const simpleFuzzyMatch = (text, query) => {
          if (!text || !query) return false;
          const normalized = normalize(text);
          const compactNormalized = normalized.replace(/\s+/g, '');
          const compactQuery = String(query).replace(/\s+/g, '');
          
          // Exact match
          if (normalized === query) return true;
          
          // Starts with
          if (normalized.startsWith(query)) return true;
          
          // Contains
          if (normalized.includes(query)) return true;

          // Compact contains (treat spaces and parentheses as optional)
          if (compactNormalized.includes(compactQuery)) return true;

          // Special: number-letter adjacency (e.g., "5 a" vs "5a" or "5(a)")
          const numberLetterVariant = query.replace(/\b(\d+)\s*([a-z])\b/g, '$1$2');
          if (normalized.includes(numberLetterVariant) || compactNormalized.includes(numberLetterVariant)) return true;
          
          // Word boundary matching
          const words = normalized.split(/\s+/);
        for (const word of words) {
            if (word.startsWith(query) || query.startsWith(word)) return true;
          }
          
          // Multi-word matching (all words must be found)
          if (searchWords.length > 1) {
            return searchWords.every(word => 
              normalized.includes(word) || 
              words.some(w => w.startsWith(word) || word.startsWith(w))
            );
          }
          
        return false;
      };

        // Fast scoring system - much simpler than the complex fuzzy matching
      const scoredEntries = filteredEntries.map(entry => {
          const combinedTags = Array.isArray(entry.tags) ? entry.tags.join(' ') : '';
          const combinedField = [
            entry.title,
            entry.canonical_citation,
            entry.section_id,
            entry.law_family,
            combinedTags,
            entry.summary
          ].filter(Boolean).join(' ');
          const searchFields = [
          // Hierarchy: title > citation > tags > section > law family > id > others
          { text: entry.title, weight: 12 },
          { text: entry.canonical_citation, weight: 9 },
          { text: entry.section_id, weight: 6 },
          { text: entry.law_family, weight: 5 },
          { text: combinedTags, weight: 4 },
          { text: entry.entry_id, weight: 5 },
          { text: combinedField, weight: 4 },
          { text: entry.summary, weight: 3 },
          { text: entry.effective_date, weight: 3 },
          { text: entry.text, weight: 2 },
          { text: entry.text_raw, weight: 2 }
        ];
        
        let score = 0;
        let hasMatch = false;
        
          for (const { text, weight } of searchFields) {
          if (!text) continue;
          
          const normalizedText = normalize(text);
          const compactText = normalizedText.replace(/\s+/g, '');
          const textWords = normalizedText.split(/\s+/).filter(Boolean);
          const textWordVariants = new Set(textWords.flatMap(expandWordVariants));
          
          // Exact match gets highest score
          if (normalizedText === searchTerm) {
            score += weight * 3;
            hasMatch = true;
          }
          // Starts with gets high score
          else if (normalizedText.startsWith(searchTerm)) {
            score += weight * 2;
            hasMatch = true;
          }
          // Contains gets medium score
          else if (normalizedText.includes(searchTerm)) {
            score += weight;
            hasMatch = true;
          }
          // Token overlap scoring: reward partial multi-word matches
          else {
            // Variant-aware token overlap (handles anti- prefix and vs/versus)
            const matchedWords = Array.from(searchWordVariants).filter(word =>
              Array.from(textWordVariants).some(tw => tw.includes(word) || word.includes(tw))
            );
            if (matchedWords.length >= Math.max(1, Math.ceil(searchWords.length * 0.6))) {
              // Strong partial match (>=60% of query words)
              score += weight * 0.9;
              hasMatch = true;
            } else if (matchedWords.length >= 1) {
              // Weak partial match (at least one query word)
              score += weight * 0.4;
              hasMatch = true;
            }
          }
          // Compact contains: ignore spaces/parentheses differences
          else if (compactText.includes(compactSearch)) {
            score += weight * 0.9;
            hasMatch = true;
          }
          // Parenthetical variant contains: map "5 a" -> "5(a)"
          else if (normalizedText.includes(parentheticalSearch)) {
            score += weight * 0.9;
            hasMatch = true;
          }
            // Simple fuzzy match gets lower score
            else if (simpleFuzzyMatch(text, searchTerm)) {
            score += weight * 0.5;
            hasMatch = true;
          }
        }
        
        return { entry, score, hasMatch };
      });
      
      // Filter and sort by score
      filteredEntries = scoredEntries
        .filter(({ hasMatch }) => hasMatch)
        .sort((a, b) => b.score - a.score)
        .map(({ entry }) => entry);
    }

    // Type filter
    if (filters.type && filters.type !== 'all') {
      filteredEntries = filteredEntries.filter(entry => entry.type === filters.type);
    }

    // Jurisdiction filter
    if (filters.jurisdiction && filters.jurisdiction !== 'all') {
      filteredEntries = filteredEntries.filter(entry => entry.jurisdiction === filters.jurisdiction);
    }

    // Status filter
    if (filters.status && filters.status !== 'all') {
      filteredEntries = filteredEntries.filter(entry => entry.status === filters.status);
    }

      // Verified filter
  if (filters.verified && filters.verified !== 'all') {
    console.log('Verified filter active:', filters.verified);
    filteredEntries = filteredEntries.filter(entry => {
      const isVerified = entry.verified === true;
      
      if (filters.verified === 'yes') {
        return isVerified;
      } else if (filters.verified === 'not_verified') {
        return !isVerified;
      }
      
      return true;
    });
  }

      // Team member filter
  if (filters.team_member_id && filters.team_member_id !== 'all') {
    filteredEntries = filteredEntries.filter(entry => {
      // Primary match: created_by field (1-5)
      const entryCreatedBy = entry.created_by;
      const filterTeamMember = filters.team_member_id;
      
      
      // Match by created_by field (the main field in DB)
      const matchesCreatedBy = String(entryCreatedBy) === String(filterTeamMember);
      
      // Fallback matches for other fields
      const entryTeamMember = entry.team_member_id;
      const entryCreatedByName = entry.created_by_name;
      const entryCreatedByUsername = entry.created_by_username;
      
      const matchesId = String(entryTeamMember) === String(filterTeamMember);
      const matchesName = entryCreatedByName && String(entryCreatedByName).toLowerCase() === String(filterTeamMember).toLowerCase();
      const matchesUsername = entryCreatedByUsername && String(entryCreatedByUsername).toLowerCase() === String(filterTeamMember).toLowerCase();
      
      const isMatch = matchesCreatedBy || matchesId || matchesName || matchesUsername;
      
      return isMatch;
    });
  }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      filteredEntries = filteredEntries.filter(entry => 
        entry.tags && filters.tags.some(tag => entry.tags.includes(tag))
      );
    }

    // Offline pack filter
    if (filters.offline_pack !== undefined) {
      filteredEntries = filteredEntries.filter(entry => 
        entry.offline && entry.offline.pack_include === filters.offline_pack
      );
    }

    return filteredEntries;
  };
    
    return memoizedSearch;
  }, [entries]);

  // Get entries by type
  const getEntriesByType = (type) => {
    return entries.filter(entry => entry.type === type);
  };

  // Get offline pack entries
  const getOfflinePackEntries = () => {
    return entries.filter(entry => entry.offline && entry.offline.pack_include);
  };

  // Export entries
  const exportEntries = () => {
    const dataStr = JSON.stringify(entries, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    // Filename format: KB-existing-entries-<date>.json
    link.download = `KB-existing-entries-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportSingleEntry = (entry) => {
    if (!entry) return;
    const dataStr = JSON.stringify([entry], null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${entry.entry_id}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Import entries
  const importEntries = async (jsonData, userInfo = null) => {
    try {
      const parsed = JSON.parse(jsonData);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      if (!list || list.length === 0) return { success: false, error: 'No entries found in file' };
      
      // For the new workflow, we'll process the first entry and return it for form population
      const entry = list[0];
      if (!entry || !entry.entry_id) {
        return { success: false, error: 'Invalid entry format' };
      }
      
      // Check if entry already exists (optional - don't block import if API fails)
      try {
        const existing = await fetchAllEntriesFromDb();
        const existingIds = new Set((existing || []).map((e) => e.entry_id));
        
        if (existingIds.has(entry.entry_id)) {
          return { success: false, error: `Entry with ID "${entry.entry_id}" already exists` };
        }
      } catch (err) {
        console.warn('Could not check for existing entries, proceeding with import:', err);
        // Continue with import even if duplicate check fails
      }
      
      // Prepare the entry data for form population
      const formData = {
        ...entry,
        // Override with user info for created_by fields
        created_by: userInfo?.personId ? Number(String(userInfo.personId).replace('P','')) : (entry.created_by && entry.created_by !== 0 ? entry.created_by : 5),
        created_by_name: userInfo?.name || userInfo?.username || entry.created_by_name || 'Imported User',
        created_by_username: userInfo?.username,
        // Set verification status for imported entries
        verified: false,
        verified_at: null,
        verified_by: null,
      };
      
      // Clear all existing drafts and replace with imported entry
      try {
        localStorage.removeItem('kb_entry_draft');
        localStorage.removeItem('kb_draft');
        localStorage.removeItem('kb_drafts');
        localStorage.setItem('kb_entry_draft', JSON.stringify(formData));
        console.log('Cleared all existing drafts and set imported entry as new draft');
      } catch (e) {
        console.error('Failed to clear/set draft:', e);
      }
      
      console.log('Import successful, returning form data:', formData);
      return { success: true, data: formData };
    } catch (err) {
      console.error('Error importing entries:', err);
      throw new Error('Failed to import entries');
    }
  };

  // Clear all entries
  const clearAllEntries = () => {
    setEntries([]);
    setTeamProgress({});
    setDailyQuotas({});
  };

  // Get storage statistics
  const getStorageStats = () => {
    const totalEntries = entries.length;
    const offlinePackEntries = getOfflinePackEntries().length;
    const sizeInBytes = new Blob([JSON.stringify(entries)]).size;
    const sizeInKB = Math.round(sizeInBytes / 1024);
    
    // Calculate progress towards 1,500 goal
    const progressPercentage = Math.min((totalEntries / 1500) * 100, 100);
    
    return {
      totalEntries,
      offlinePackEntries,
      sizeInKB,
      progressPercentage,
      remainingEntries: Math.max(0, 1500 - totalEntries)
    };
  };

  // Team progress tracking
  const updateTeamProgress = (teamMemberId, entryType) => {
    const today = new Date().toISOString().split('T')[0];
    const key = `${teamMemberId}_${today}`;
    
    setTeamProgress(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [entryType]: (prev[key]?.[entryType] || 0) + 1,
        total: (prev[key]?.total || 0) + 1
      }
    }));
  };

  const decrementTeamProgress = (teamMemberId, entryType) => {
    const today = new Date().toISOString().split('T')[0];
    const key = `${teamMemberId}_${today}`;
    
    setTeamProgress(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [entryType]: Math.max(0, (prev[key]?.[entryType] || 0) - 1),
        total: Math.max(0, (prev[key]?.total || 0) - 1)
      }
    }));
  };

  // Get team member progress for today
  const getTeamMemberProgress = (teamMemberId) => {
    const today = new Date().toISOString().split('T')[0];
    const key = `${teamMemberId}_${today}`;
    return teamProgress[key] || { total: 0 };
  };

  // Get all team progress for today
  const getAllTeamProgress = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayProgress = {};
    
    for (let i = 1; i <= 5; i++) {
      const key = `${i}_${today}`;
      todayProgress[i] = teamProgress[key] || { total: 0 };
    }
    
    return todayProgress;
  };

  // Get yesterday's team progress
  const getYesterdayTeamProgress = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split('T')[0];
    const yesterdayProgress = {};
    
    for (let i = 1; i <= 5; i++) {
      const key = `${i}_${yesterdayDate}`;
      yesterdayProgress[i] = teamProgress[key] || { total: 0 };
    }
    
    return yesterdayProgress;
  };

  // Check if a team member completed their daily quota
  const checkDailyCompletion = (teamMemberId, entryType) => {
    // Compute plan day key using 8 AM rollover
    const { getPlanDate, toISODate, computeDayIndex, rowsForDay } = require('../lib/plan/planLoader');
    const planDateISO = toISODate(getPlanDate(new Date()));
    const key = `${teamMemberId}_${planDateISO}`;
    const currentProgress = teamProgress[key] || { total: 0 };

    // Determine quotas for this member from the active plan JSON
    const day1FromWindow = (typeof window !== 'undefined' && window.__KB_DAY1__) ? window.__KB_DAY1__ : require('../lib/plan/config').KB_PROJECT_START.toISOString().split('T')[0];
    const dayIndex = computeDayIndex(new Date(), day1FromWindow);
    const planRows = (window.__KB_PLAN__ && Array.isArray(window.__KB_PLAN__)) ? window.__KB_PLAN__ : [];
    const rows = rowsForDay(planRows, dayIndex);
    const personCode = `P${teamMemberId}`;
    const row = rows.find(r => String(r.Person).trim().toUpperCase() === personCode);
    if (!row) return false;
    const quotas = {
      statute_section: Number(row.statute_section || 0),
      rule_of_court: Number(row.rule_of_court || 0),
      rights_advisory: Number(row.rights_advisory || 0),
      constitution_provision: Number(row.constitution_provision || 0),
      agency_circular: Number(row.agency_circular || 0),
      doj_issuance: Number(row.doj_issuance || 0),
      executive_issuance: Number(row.executive_issuance || 0),
      city_ordinance_section: Number(row.city_ordinance_section || 0)
    };
    const totalQuota = Object.values(quotas).reduce((s, n) => s + (Number(n) || 0), 0);

    const newTotal = (currentProgress.total || 0) + 1;
    const newTypeCount = (currentProgress[entryType] || 0) + 1;
    if (newTotal === totalQuota) return true;
    if (quotas[entryType] && newTypeCount === quotas[entryType]) return true;
    return false;
  };

  // Reset daily quotas (call this at the start of each day)
  const resetDailyQuotas = () => {
    // Use 8 AM boundary for plan date calculation
    const { getPlanDate, toISODate } = require('../lib/plan/planLoader');
    const today = toISODate(getPlanDate(new Date()));
    
    // Update the last reset date
    setDailyQuotas(prev => ({
      ...prev,
      lastReset: today
    }));

    // Clear any old team progress data (older than 7 days to keep some history)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoffDate = sevenDaysAgo.toISOString().split('T')[0];

    setTeamProgress(prev => {
      const cleanedProgress = {};
      Object.keys(prev).forEach(key => {
        const datePart = key.split('_')[1]; // Extract date from key like "1_2025-08-17"
        if (datePart >= cutoffDate) {
          cleanedProgress[key] = prev[key];
        }
      });
      return cleanedProgress;
    });

    console.log('Daily quotas reset for', today);
  };

  return {
    entries, loading, error, clearError, addEntry, updateEntry, deleteEntry,
    getEntryById, getEntryByEntryId, searchEntries, getEntriesByType,
    getOfflinePackEntries, exportEntries, exportSingleEntry, importEntries, clearAllEntries,
    getStorageStats, getTeamMemberProgress, getAllTeamProgress, resetDailyQuotas,
    updateTeamProgress, decrementTeamProgress, getYesterdayTeamProgress, checkDailyCompletion
  };
};
