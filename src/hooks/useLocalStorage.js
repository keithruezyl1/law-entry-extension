import { useState, useEffect } from 'react';
import { upsertEntry, deleteEntryVector } from '../services/vectorApi';
import { fetchAllEntriesFromDb } from '../services/kbApi';
import { updateProgressForEntry } from '../lib/plan/progressStore';

const STORAGE_KEY = 'law_entries';
const TEAM_PROGRESS_KEY = 'team_progress';
const DAILY_QUOTAS_KEY = 'daily_quotas';

// Custom hook for managing entries in localStorage
export const useLocalStorage = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
      setError('Failed to load data from storage');
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
      } catch (err) {
        console.error('Error saving entries to localStorage:', err);
        setError('Failed to save entries to storage');
      }
    }
  }, [entries, loading]);

  // Save team progress to localStorage whenever it changes
  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem(TEAM_PROGRESS_KEY, JSON.stringify(teamProgress));
      } catch (err) {
        console.error('Error saving team progress to localStorage:', err);
        setError('Failed to save team progress to storage');
      }
    }
  }, [teamProgress, loading]);

  // Save daily quotas to localStorage whenever they change
  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem(DAILY_QUOTAS_KEY, JSON.stringify(dailyQuotas));
      } catch (err) {
        console.error('Error saving daily quotas to localStorage:', err);
        setError('Failed to save daily quotas to storage');
      }
    }
  }, [dailyQuotas, loading]);

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
      
      // Send complete payload with all type-specific fields
      const payload = {
        entry_id: merged.entry_id,
        type: merged.type,
        title: merged.title,
        canonical_citation: merged.canonical_citation,
        summary: merged.summary,
        text: merged.text,
        tags: merged.tags,
        jurisdiction: merged.jurisdiction,
        law_family: merged.law_family,
        section_id: merged.section_id,
        status: merged.status,
        effective_date: merged.effective_date,
        amendment_date: merged.amendment_date,
        last_reviewed: merged.last_reviewed,
        visibility: merged.visibility,
        source_urls: merged.source_urls,
        elements: merged.elements,
        penalties: merged.penalties,
        defenses: merged.defenses,
        prescriptive_period: merged.prescriptive_period,
        standard_of_proof: merged.standard_of_proof,
        rule_no: merged.rule_no,
        section_no: merged.section_no,
        triggers: merged.triggers,
        time_limits: merged.time_limits,
        required_forms: merged.required_forms,
        circular_no: merged.circular_no,
        applicability: merged.applicability,
        issuance_no: merged.issuance_no,
        instrument_no: merged.instrument_no,
        supersedes: merged.supersedes,
        steps_brief: merged.steps_brief,
        forms_required: merged.forms_required,
        failure_states: merged.failure_states,
        violation_code: merged.violation_code,
        violation_name: merged.violation_name,
        license_action: merged.license_action,
        fine_schedule: merged.fine_schedule,
        apprehension_flow: merged.apprehension_flow,
        incident: merged.incident,
        phases: merged.phases,
        forms: merged.forms,
        handoff: merged.handoff,
        rights_callouts: merged.rights_callouts,
        rights_scope: merged.rights_scope,
        advice_points: merged.advice_points,
        topics: merged.topics,
        jurisprudence: merged.jurisprudence,
        legal_bases: merged.legal_bases,
        related_sections: merged.related_sections,
      };

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

  // Search entries
  const searchEntries = (query, filters = {}) => {
    let filteredEntries = [...entries];

    // Text search
    if (query && query.trim()) {
      const normalize = (text) => String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const compact = (text) => normalize(text).replace(/\s+/g, '');
      const searchTermRaw = normalize(query);
      const searchTerm = searchTermRaw; // normalized already

      // Basic fuzzy helpers (token-level Damerau-Levenshtein with small threshold)
      const tokenize = (s) => s.split(/\s+/).filter(Boolean);
      const dlDistance = (a, b) => {
        const al = a.length, bl = b.length;
        if (!al) return bl; if (!bl) return al;
        const dp = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));
        for (let i = 0; i <= al; i++) dp[i][0] = i;
        for (let j = 0; j <= bl; j++) dp[0][j] = j;
        for (let i = 1; i <= al; i++) {
          for (let j = 1; j <= bl; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
              dp[i - 1][j] + 1,
              dp[i][j - 1] + 1,
              dp[i - 1][j - 1] + cost
            );
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
              dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost);
            }
          }
        }
        return dp[al][bl];
      };
      // Roman numeral conversion functions
      const romanToNumber = (roman) => {
        const romanMap = {
          'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000,
          'i': 1, 'v': 5, 'x': 10, 'l': 50, 'c': 100, 'd': 500, 'm': 1000
        };
        let result = 0;
        for (let i = 0; i < roman.length; i++) {
          const current = romanMap[roman[i]];
          const next = romanMap[roman[i + 1]];
          if (next && current < next) {
            result -= current;
          } else {
            result += current;
          }
        }
        return result;
      };

      const numberToRoman = (num) => {
        const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
        const symbols = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
        let result = '';
        for (let i = 0; i < values.length; i++) {
          while (num >= values[i]) {
            result += symbols[i];
            num -= values[i];
          }
        }
        return result;
      };

      const createVariations = (term) => {
        const variations = new Set([term]);
        // plural/singular swap
        if (term.endsWith('s') && term.length > 3) variations.add(term.slice(0, -1));
        else if (term.length > 2) variations.add(term + 's');
        
        // Roman numeral conversions
        const romanMatch = term.match(/^([IVXLC]+)$/i);
        if (romanMatch) {
          const roman = romanMatch[1].toUpperCase();
          const number = romanToNumber(roman);
          if (number > 0 && number <= 100) { // reasonable range for legal documents
            variations.add(number.toString());
            variations.add(numberToRoman(number));
          }
        }
        
        // Number to Roman conversion
        const numberMatch = term.match(/^(\d+)$/);
        if (numberMatch) {
          const num = parseInt(numberMatch[1]);
          if (num > 0 && num <= 100) { // reasonable range for legal documents
            variations.add(numberToRoman(num));
          }
        }
        
        // Common legal term variations and typos
        const map = {
          right: ['rights'], rights: ['right'],
          information: ['info'], info: ['information'],
          section: ['sec', 'sections'], sec: ['section', 'sections'], sections: ['section', 'sec'],
          article: ['art', 'articles'], art: ['article', 'articles'], articles: ['article', 'art'],
          constitution: ['const', 'constitutional'], const: ['constitution', 'constitutional'],
          family: ['families'], families: ['family'],
          law: ['laws'], laws: ['law'],
          criminal: ['criminals'], criminals: ['criminal'],
          prosecution: ['prosecutions'], prosecutions: ['prosecution'],
          accused: ['accuseds'], accuseds: ['accused'],
          protection: ['protections'], protections: ['protection'],
          child: ['children'], children: ['child'],
          abuse: ['abuses'], abuses: ['abuse'],
          sexual: ['sexuals'], sexuals: ['sexual'],
          prostitution: ['prostitutions'], prostitutions: ['prostitution'],
          environmental: ['environment'], environment: ['environmental'],
          police: ['policing'], policing: ['police'],
          mandate: ['mandates'], mandates: ['mandate'],
          anti: ['against'], against: ['anti'],
          dumping: ['dumps'], dumps: ['dumping'],
          measure: ['measures'], measures: ['measure'],
          ordinance: ['ordinances'], ordinances: ['ordinance'],
          city: ['cities'], cities: ['city'],
          manila: ['manila'], // common misspelling
          philippines: ['philippine'], philippine: ['philippines'],
          // Common typos
          lwa: ['law'], // typo for "law"
          familes: ['families'], // typo for "families"
          constutition: ['constitution'], // typo for "constitution"
          crimnal: ['criminal'], // typo for "criminal"
          procecution: ['prosecution'], // typo for "prosecution"
          acused: ['accused'], // typo for "accused"
          protetion: ['protection'], // typo for "protection"
          enviornmental: ['environmental'], // typo for "environmental"
          ordiance: ['ordinance'], // typo for "ordinance"
          manila: ['manila'], // common misspelling
          phillipines: ['philippines'] // typo for "philippines"
        };
        if (map[term]) map[term].forEach(v => variations.add(v));
        return Array.from(variations);
      };
      const fuzzyMatch = (q, hRaw) => {
        if (!q) return true; if (!hRaw) return false;
        const h = normalize(hRaw);
        const hCompact = compact(hRaw);
        
        // Direct substring match
        if (h.includes(q)) return true;
        
        // Word boundary matching for better partial matches
        const words = h.split(/\s+/);
        for (const word of words) {
          if (word.startsWith(q) || q.startsWith(word)) return true;
        }
        
        const qt = tokenize(q);
        const ht = tokenize(h);
        
        // Check if all query terms have matches (AND logic)
        const allTermsMatch = qt.every(qs => {
          const vars = createVariations(qs);
          return vars.some(v => {
            // Direct word match
            if (ht.includes(v)) return true;
            // Substring match
            if (h.includes(v) || hCompact.includes(v.replace(/\s+/g, ''))) return true;
            // Fuzzy match with edit distance
          for (const hs of ht) {
              const d = dlDistance(v, hs);
              if ((v.length <= 4 && d <= 1) || (v.length > 4 && d <= 2)) {
              return true;
          }
        }
        return false;
          });
        });
        
        return allTermsMatch;
      };

      // Score entries for better ranking
      const scoredEntries = filteredEntries.map(entry => {
        const haystacks = [
          { text: entry.title, weight: 10 },
          { text: entry.entry_id, weight: 8 },
          { text: entry.law_family, weight: 6 },
          { text: entry.canonical_citation, weight: 6 },
          { text: entry.section_id, weight: 5 },
          { text: entry.summary, weight: 4 },
          { text: entry.text, weight: 2 },
          { text: entry.text_raw, weight: 2 },
          { text: entry.effective_date, weight: 3 },
          { text: Array.isArray(entry.tags) ? entry.tags.join(' ') : '', weight: 5 }
        ];
        
        let score = 0;
        let hasMatch = false;
        
        for (const { text, weight } of haystacks) {
          if (!text) continue;
          
          const normalizedText = normalize(text);
          const compactText = compact(text);
          
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
          // Fuzzy match gets lower score
          else if (fuzzyMatch(searchTerm, text)) {
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
    console.log('Filtered entries after verified filter:', filteredEntries.length);
  }

      // Team member filter
  if (filters.team_member_id && filters.team_member_id !== 'all') {
    console.log('Team member filter active:', filters.team_member_id);
    console.log('Available entries with created_by:', filteredEntries.map(e => ({ 
      id: e.entry_id, 
      created_by: e.created_by,
      created_by_type: typeof e.created_by,
      team_member_id: e.team_member_id,
      created_by_name: e.created_by_name,
      created_by_username: e.created_by_username
    })));
    console.log('Filter team member type:', typeof filters.team_member_id);
    filteredEntries = filteredEntries.filter(entry => {
      // Primary match: created_by field (1-5)
      const entryCreatedBy = entry.created_by;
      const filterTeamMember = filters.team_member_id;
      
      console.log('Comparing:', { 
        entryCreatedBy, 
        filterTeamMember, 
        entryType: typeof entryCreatedBy, 
        filterType: typeof filterTeamMember
      });
      
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
      console.log('Match results:', { matchesCreatedBy, matchesId, matchesName, matchesUsername, isMatch });
      
      return isMatch;
    });
    console.log('Filtered entries after team member filter:', filteredEntries.length);
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
    link.download = `law_entries_${new Date().toISOString().split('T')[0]}.json`;
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
  const importEntries = async (jsonData) => {
    try {
      const parsed = JSON.parse(jsonData);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      if (!list || list.length === 0) return 0;
      // Fetch existing entry_ids to avoid overwriting
      const existing = await fetchAllEntriesFromDb();
      const existingIds = new Set((existing || []).map((e) => e.entry_id));
      // Only add entries that do not yet exist in DB
      const toAdd = list.filter((e) => e && e.entry_id && !existingIds.has(e.entry_id));
      if (toAdd.length === 0) {
        // Nothing to add; refresh UI and exit
        const dbEntries = await fetchAllEntriesFromDb();
        if (Array.isArray(dbEntries)) {
          const mapped = dbEntries.map((e) => ({ ...e, id: e.entry_id }));
          setEntries(mapped);
        }
        return 0;
      }
      const upserts = toAdd.map((entry) => {
        try {
          if (!entry || !entry.entry_id) return Promise.resolve({ success: false, error: 'missing entry_id' });
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
            status: entry.status || 'active',
            effective_date: entry.effective_date,
            amendment_date: entry.amendment_date,
            source_urls: entry.source_urls,
            last_reviewed: entry.last_reviewed || new Date().toISOString().split('T')[0],
            visibility: entry.visibility || { gli: true, cpa: false },
            offline: entry.offline || { pack_include: false },
            // Type-specific fields
            ...(entry.type === 'statute_section' && {
              elements: entry.elements,
              penalties: entry.penalties,
              defenses: entry.defenses,
              prescriptive_period: entry.prescriptive_period,
              standard_of_proof: entry.standard_of_proof,
              related_sections: entry.related_sections,
              legal_bases: entry.legal_bases
            }),
            ...(entry.type === 'rule_of_court' && {
              rule_no: entry.rule_no,
              section_no: entry.section_no,
              triggers: entry.triggers,
              time_limits: entry.time_limits,
              required_forms: entry.required_forms,
              related_sections: entry.related_sections
            }),
            ...(entry.type === 'rights_advisory' && {
              rights_scope: entry.rights_scope,
              advice_points: entry.advice_points,
              legal_bases: entry.legal_bases,
              related_sections: entry.related_sections
            }),
            ...(entry.type === 'pnp_sop' && {
              steps_brief: entry.steps_brief,
              forms_required: entry.forms_required,
              failure_states: entry.failure_states,
              legal_bases: entry.legal_bases
            }),
            ...(entry.type === 'incident_checklist' && {
              incident: entry.incident,
              phases: entry.phases,
              forms: entry.forms,
              handoff: entry.handoff,
              rights_callouts: entry.rights_callouts
            }),
            ...(entry.type === 'agency_circular' && {
              circular_no: entry.circular_no,
              section_no: entry.section_no,
              applicability: entry.applicability,
              legal_bases: entry.legal_bases,
              supersedes: entry.supersedes
            }),
            ...(entry.type === 'doj_issuance' && {
              issuance_no: entry.issuance_no,
              applicability: entry.applicability,
              legal_bases: entry.legal_bases,
              supersedes: entry.supersedes
            }),
            ...(entry.type === 'executive_issuance' && {
              instrument_no: entry.instrument_no,
              applicability: entry.applicability,
              legal_bases: entry.legal_bases,
              supersedes: entry.supersedes
            }),
            ...(entry.type === 'city_ordinance_section' && {
              elements: entry.elements,
              penalties: entry.penalties,
              defenses: entry.defenses,
              related_sections: entry.related_sections,
              legal_bases: entry.legal_bases
            }),
            ...(entry.type === 'constitution_provision' && {
              topics: entry.topics,
              related_sections: entry.related_sections,
              jurisprudence: entry.jurisprudence
            })
          };
          return upsertEntry(payload);
        } catch (e) {
          return Promise.resolve({ success: false, error: String(e?.message || e) });
        }
      });
      const results = await Promise.allSettled(upserts);
      const successCount = results.reduce((n, r) => n + ((r.status === 'fulfilled' && r.value?.success) ? 1 : 0), 0);
      // Refresh from DB after import
      const dbEntries = await fetchAllEntriesFromDb();
      if (Array.isArray(dbEntries)) {
        const mapped = dbEntries.map((e) => ({ ...e, id: e.entry_id }));
        setEntries(mapped);
      }
      return successCount;
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
    entries, loading, error, addEntry, updateEntry, deleteEntry,
    getEntryById, getEntryByEntryId, searchEntries, getEntriesByType,
    getOfflinePackEntries, exportEntries, exportSingleEntry, importEntries, clearAllEntries,
    getStorageStats, getTeamMemberProgress, getAllTeamProgress, resetDailyQuotas,
    updateTeamProgress, decrementTeamProgress, getYesterdayTeamProgress, checkDailyCompletion
  };
};
