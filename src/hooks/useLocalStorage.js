import { useState, useEffect } from 'react';
import { upsertEntry, deleteEntryVector, checkBulkDuplicates } from '../services/vectorApi';
import { fetchAllEntriesFromDb } from '../services/kbApi';

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
      };
      const resp = await upsertEntry(payload);
      if (!resp?.success) throw new Error(resp?.error || 'Upsert failed');

      // Refresh from DB
      const dbEntries = await fetchAllEntriesFromDb();
      if (Array.isArray(dbEntries)) {
        const mapped = dbEntries.map((e) => ({ ...e, id: e.entry_id }));
        setEntries(mapped);
      }

      if (entry.team_member_id) {
        updateTeamProgress(entry.team_member_id, entry.type);
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
      };
      const resp = await upsertEntry(payload);
      if (!resp?.success) throw new Error(resp?.error || 'Upsert failed');
      const dbEntries = await fetchAllEntriesFromDb();
      if (Array.isArray(dbEntries)) {
        const mapped = dbEntries.map((e) => ({ ...e, id: e.entry_id }));
        setEntries(mapped);
      }
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
      const searchTerm = query.toLowerCase().trim();
      filteredEntries = filteredEntries.filter(entry => 
        (entry.title && entry.title.toLowerCase().includes(searchTerm)) ||
        (entry.entry_id && entry.entry_id.toLowerCase().includes(searchTerm)) ||
        (entry.summary && entry.summary.toLowerCase().includes(searchTerm)) ||
        (entry.text && entry.text.toLowerCase().includes(searchTerm)) ||
        (entry.text_raw && entry.text_raw.toLowerCase().includes(searchTerm)) ||
        (entry.law_family && entry.law_family.toLowerCase().includes(searchTerm)) ||
        (entry.tags && entry.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
      );
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

    // Team member filter
    if (filters.team_member_id && filters.team_member_id !== 'all') {
      filteredEntries = filteredEntries.filter(entry => {
        const entryTeamMember = entry.team_member_id;
        const filterTeamMember = filters.team_member_id;
        return entryTeamMember == filterTeamMember; // Use == for type coercion
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

  // Import entries
  const importEntries = async (jsonData) => {
    try {
      const parsed = JSON.parse(jsonData);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      if (!list || list.length === 0) return 0;
      
      // Check for duplicates before importing
      const duplicateCheckPayload = {
        entries: list.map(entry => ({
          title: entry.title,
          canonical_citation: entry.canonical_citation,
          entry_id: entry.entry_id
        })),
        similarity_threshold: 0.8
      };
      
      const duplicateResult = await checkBulkDuplicates(duplicateCheckPayload);
      let duplicates = [];
      let duplicateMap = {};
      
      if (duplicateResult.success && duplicateResult.duplicates) {
        duplicates = duplicateResult.duplicates;
        duplicateMap = duplicateResult.duplicateMap || {};
      }
      
      // Filter out entries that have exact ID matches (these won't be imported anyway)
      const existing = await fetchAllEntriesFromDb();
      const existingIds = new Set((existing || []).map((e) => e.entry_id));
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
      
      // Return success count and duplicates for the caller to handle
      return { successCount, duplicates, duplicateMap };
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
    const today = new Date().toISOString().split('T')[0];
    const key = `${teamMemberId}_${today}`;
    const currentProgress = teamProgress[key] || { total: 0 };
    
    // Get team member quota from entryTypes
    const teamMembers = {
      1: { total: 10, quota: { statute_section: 7, city_ordinance_section: 3 } },
      2: { total: 10, quota: { rule_of_court: 7, doj_issuance: 2, rights_advisory: 1 } },
      3: { total: 10, quota: { pnp_sop: 5, incident_checklist: 3, agency_circular: 2 } },
      4: { total: 10, quota: { traffic_rule: 6, statute_section: 2, agency_circular: 2 } },
      5: { total: 10, quota: { rights_advisory: 4, constitution_provision: 3, doj_issuance: 2, executive_issuance: 1 } }
    };
    
    const memberQuota = teamMembers[teamMemberId];
    if (!memberQuota) return false;
    
    // Check if this entry type will complete the daily quota
    const newTotal = currentProgress.total + 1;
    const newTypeCount = (currentProgress[entryType] || 0) + 1;
    
    // Check if this completes the daily quota
    if (newTotal === memberQuota.total) {
      return true;
    }
    
    // Check if this completes a specific type quota
    if (memberQuota.quota[entryType] && newTypeCount === memberQuota.quota[entryType]) {
      return true;
    }
    
    return false;
  };

  // Reset daily quotas (call this at the start of each day)
  const resetDailyQuotas = () => {
    const today = new Date().toISOString().split('T')[0];
    
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
    getOfflinePackEntries, exportEntries, importEntries, clearAllEntries,
    getStorageStats, getTeamMemberProgress, getAllTeamProgress, resetDailyQuotas,
    updateTeamProgress, decrementTeamProgress, getYesterdayTeamProgress, checkDailyCompletion
  };
};
