import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useFieldArray, UseFormRegister, Control, useWatch } from 'react-hook-form';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Trash2, Plus, Search, ArrowLeft, X } from 'lucide-react';
import { fetchEntryById, fetchAllEntriesFromDb } from '../../../services/kbApi';
import { semanticSearch } from '../../../services/vectorApi';
import { Toast } from '../../ui/Toast';

type EntryLite = { id?: string; entry_id: string; title: string; type?: string; canonical_citation?: string };

interface LegalBasisPickerProps {
  name: string; // e.g., 'legal_bases' or 'phases.0.steps.1.legal_bases'
  control: Control<any>;
  register: UseFormRegister<any>;
  existingEntries?: EntryLite[];
}

export function LegalBasisPicker({ name, control, register, existingEntries = [], onActivate }: LegalBasisPickerProps & { onActivate?: () => void }) {
  // RHF context helpers will be provided via register/controls in parent
  const { fields, append, remove, update } = useFieldArray({ name, control });
  const [tab, setTab] = useState<'internal' | 'external'>('internal');
  const [query, setQuery] = useState('');
  const items = (useWatch({ control, name }) as any[]) || [];
  const [allEntries, setAllEntries] = useState<EntryLite[] | null>(null);
  const internalCount = useMemo(() => (items || []).filter((it: any) => it && it.type !== 'external').length, [items]);
  const externalCount = useMemo(() => (items || []).filter((it: any) => it && it.type === 'external').length, [items]);
  const [externalToast, setExternalToast] = useState<{
    open: boolean;
    index: number | null;
    matches: EntryLite[];
  }>({ open: false, index: null, matches: [] });
  const [inlineMatches, setInlineMatches] = useState<Record<number, EntryLite[]>>({});
  const suppressDetectForExternal = useRef<Set<number>>(new Set());
  const detectTimersRef = useRef<Record<number, number | undefined>>({});
  const searchCache = useRef<Map<string, EntryLite[]>>(new Map());
  const persistRemoval = (item: any) => {
    try {
      const key = String(item?.entry_id || item?.citation || item?.title || item?.url || JSON.stringify(item)).toLowerCase();
      const raw = localStorage.getItem('kb_deleted_relations');
      const tombstones = Array.isArray(raw ? JSON.parse(raw) : []) ? JSON.parse(raw || '[]') : [];
      tombstones.push({ scope: name, key });
      localStorage.setItem('kb_deleted_relations', JSON.stringify(tombstones.slice(-200)));
      // Only log in development mode to reduce console spam
      if (process.env.NODE_ENV === 'development') {
        console.log('🗑️ Tombstoned deletion:', { scope: name, key, item: { citation: item?.citation, title: item?.title } });
      }
    } catch (e) {
      console.error('Failed to persist removal:', e);
    }
  };
  
  // Internal citation states
  const [showInternalSearch, setShowInternalSearch] = useState(internalCount === 0);
  const [showAddInternalButton, setShowAddInternalButton] = useState(false);
  
  // Update states when counts change
  useEffect(() => {
    if (internalCount === 0) {
      setShowInternalSearch(true);
      setShowAddInternalButton(false);
    } else {
      setShowInternalSearch(false);
      setShowAddInternalButton(true);
    }
  }, [internalCount]);

  // Load full entries from DB once (to enable searching by tags/law_family/citation)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchAllEntriesFromDb();
        if (!cancelled && Array.isArray(rows) && rows.length) {
          const mapped: EntryLite[] = rows.map((r: any) => ({
            id: r.id,
            entry_id: r.entry_id,
            title: r.title || '',
            type: r.type,
            canonical_citation: r.canonical_citation || ''
          }));
          setAllEntries(mapped);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);


  // Enhanced search function that handles pluralization, word variations, and minor typos
  const normalizeSearchText = (text: string): string => {
    let normalized = String(text || '')
      .toLowerCase()
      // Normalize legal abbreviations before removing punctuation
      .replace(/\b(rule|roc)\s*(\d+)\b/g, 'rule $2')
      .replace(/\b(section|sec\.?)\s*(\d+)\b/g, 'section $2')
      .replace(/\b(article|art\.?)\s*(\d+)\b/g, 'article $2')
      .replace(/\b(republic act|ra)\s*(\d+)\b/g, 'republic act $2')
      .replace(/\b(presidential decree|pd)\s*(\d+)\b/g, 'presidential decree $2')
      .replace(/\b(executive order|eo)\s*(\d+)\b/g, 'executive order $2')
      .replace(/\b(memorandum circular|mc)\s*(\d+)\b/g, 'memorandum circular $2')
      .replace(/\b(department order|do)\s*(\d+)\b/g, 'department order $2')
      .replace(/\b(administrative order|ao)\s*(\d+)\b/g, 'administrative order $2')
      .replace(/\b(commonwealth act|ca)\s*(\d+)\b/g, 'commonwealth act $2')
      .replace(/\b(batas pambansa|bp)\s*(\d+)\b/g, 'batas pambansa $2')
      // Handle common word variations for better title matching
      .replace(/\b(physical\s+)?injuries?\b/g, 'injuries')
      .replace(/\b(slight\s+)?injuries?\b/g, 'slight injuries')
      .replace(/\b(serious\s+)?injuries?\b/g, 'serious injuries')
      .replace(/\b(less\s+serious\s+)?injuries?\b/g, 'less serious injuries')
      .replace(/\b(grave\s+)?injuries?\b/g, 'grave injuries')
      .replace(/\b(homicide|murder)\b/g, 'homicide')
      .replace(/\b(theft|robbery)\b/g, 'theft')
      .replace(/\b(assault|battery)\b/g, 'assault')
      // Remove punctuation
      .replace(/[^a-z0-9\s]/g, ' ')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
    
    return normalized;
  };

  const getSearchTerms = (query: string): string[] => {
    const normalized = normalizeSearchText(query);
    return normalized.split(' ').filter(term => term.length > 0);
  };

  // Roman numeral conversion functions
  const romanToNumber = (roman: string): number => {
    const romanMap: Record<string, number> = {
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

  const numberToRoman = (num: number): string => {
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

  const createSearchVariations = (term: string): string[] => {
    const variations = new Set([term]);
    
    // Handle pluralization
    if (term.endsWith('s') && term.length > 3) {
      variations.add(term.slice(0, -1)); // Remove 's' for singular
    } else {
      variations.add(term + 's'); // Add 's' for plural
    }
    
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
    
    // Handle common word variations and typos (same as dashboard search)
    const wordMap: Record<string, string[]> = {
      'right': ['rights'], 'rights': ['right'],
      'information': ['info'], 'info': ['information'],
      'section': ['sec', 'sections'], 'sec': ['section', 'sections'], 'sections': ['section', 'sec'],
      'article': ['art', 'articles'], 'art': ['article', 'articles'], 'articles': ['article', 'art'],
      'constitution': ['const', 'constitutional'], 'const': ['constitution', 'constitutional'],
      'family': ['families'], 'families': ['family'],
      'law': ['laws'], 'laws': ['law'],
      'criminal': ['criminals'], 'criminals': ['criminal'],
      'prosecution': ['prosecutions'], 'prosecutions': ['prosecution'],
      'accused': ['accuseds'], 'accuseds': ['accused'],
      'protection': ['protections'], 'protections': ['protection'],
      'child': ['children'], 'children': ['child'],
      'abuse': ['abuses'], 'abuses': ['abuse'],
      'sexual': ['sexuals'], 'sexuals': ['sexual'],
      'prostitution': ['prostitutions'], 'prostitutions': ['prostitution'],
      'environmental': ['environment'], 'environment': ['environmental'],
      'police': ['policing'], 'policing': ['police'],
      'mandate': ['mandates'], 'mandates': ['mandate'],
      'anti': ['against'], 'against': ['anti'],
      'dumping': ['dumps'], 'dumps': ['dumping'],
      'measure': ['measures'], 'measures': ['measure'],
      'ordinance': ['ordinances'], 'ordinances': ['ordinance'],
      'city': ['cities'], 'cities': ['city'],
      'manila': ['manila'],
      'philippines': ['philippine'], 'philippine': ['philippines'],
      'amendment': ['amend', 'amendments'], 'amend': ['amendment', 'amendments'], 'amendments': ['amendment', 'amend'],
      // Common typos
      'lwa': ['law'], 'familes': ['families'], 'constutition': ['constitution'],
      'crimnal': ['criminal'], 'procecution': ['prosecution'], 'acused': ['accused'],
      'protetion': ['protection'], 'enviornmental': ['environmental'], 'ordiance': ['ordinance'],
      'phillipines': ['philippines']
    };
    
    if (wordMap[term]) {
      wordMap[term].forEach(variation => variations.add(variation));
    }
    
    return Array.from(variations);
  };

  // Levenshtein distance for small typo tolerance
  const editDistance = (a: string, b: string): number => {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  };

  const calculateMatchScore = (entry: EntryLite, searchTerms: string[]): number => {
    // In-memory entries from DB may include additional fields when used directly; attempt to include likely properties
    const anyEntry: any = entry as any;
    const tagsJoined = Array.isArray(anyEntry.tags) ? anyEntry.tags.join(' ') : '';
    const lawFamily = anyEntry.law_family || '';
    const citation = anyEntry.canonical_citation || '';
    
    const searchableFields = [
      { text: entry.title, weight: 10 },
      { text: entry.entry_id, weight: 8 },
      { text: lawFamily, weight: 6 },
      { text: citation, weight: 6 },
      { text: tagsJoined, weight: 5 },
      // Add more fields to increase match chances
      { text: anyEntry.summary, weight: 4 },
      { text: anyEntry.text, weight: 2 },
      { text: anyEntry.section_id, weight: 3 },
      { text: anyEntry.type, weight: 2 }
    ];
    
    let totalScore = 0;
    let matchedTerms = 0;
    const exactQuery = normalizeSearchText(query);
    
    for (const term of searchTerms) {
      const variations = createSearchVariations(term);
      let termMatched = false;
      let termScore = 0;
      
      for (const { text, weight } of searchableFields) {
        if (!text) continue;
        
        const normalizedText = normalizeSearchText(text);
        
        // Exact match gets highest score
        if (normalizedText === exactQuery) {
          termScore = Math.max(termScore, weight * 3);
          termMatched = true;
        }
        // Starts with gets high score
        else if (normalizedText.startsWith(exactQuery)) {
          termScore = Math.max(termScore, weight * 2);
          termMatched = true;
        }
        // Contains gets medium score
        else if (normalizedText.includes(exactQuery)) {
          termScore = Math.max(termScore, weight);
          termMatched = true;
        }
        // Individual term matching
        else {
          for (const variation of variations) {
            if (normalizedText === variation) {
              termScore = Math.max(termScore, weight * 2);
              termMatched = true;
            } else if (normalizedText.startsWith(variation)) {
              termScore = Math.max(termScore, weight * 1.5);
              termMatched = true;
            } else if (normalizedText.includes(variation)) {
              termScore = Math.max(termScore, weight);
              termMatched = true;
            } else {
              // Fuzzy match with edit distance
              const words = normalizedText.split(' ');
              for (const w of words) {
                const dist = editDistance(variation, w);
                const allowed = variation.length <= 5 ? 1 : 2;
                if (dist <= allowed) {
                  termScore = Math.max(termScore, weight * 0.5);
                  termMatched = true;
                  break;
                }
              }
            }
            if (termMatched) break;
          }
        }
        if (termMatched) break;
      }
      
      if (termMatched) {
        totalScore += termScore;
        matchedTerms++;
      }
    }
    
    // Return 0 if not all terms matched
    return matchedTerms === searchTerms.length ? totalScore : 0;
  };

  const options = useMemo(() => {
    const q = (query || '').trim();
    if (!q) return [];
    
    const searchTerms = getSearchTerms(q);
    if (searchTerms.length === 0) return [];
    
    const pool = (allEntries && allEntries.length ? allEntries : existingEntries);
    const scoredEntries = pool
      .map(entry => ({
        entry,
        score: calculateMatchScore(entry, searchTerms)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    
    return scoredEntries.map(item => item.entry);
  }, [existingEntries, allEntries, query]);

  // Build a search query from an external citation row
  const buildExternalQuery = (ext: any): string => {
    // Prioritize citation and title over URL for better matching
    const citation = ext?.citation || '';
    const title = ext?.title || '';
    const url = ext?.url || '';
    
    // Build query with priority: citation first, then title, then URL
    const parts = [];
    if (citation) parts.push(citation);
    if (title) parts.push(title);
    if (url) parts.push(url);
    
    return parts.join(' ').slice(0, 400);
  };

  const findSimilarEntriesForExternal = async (ext: any): Promise<EntryLite[]> => {
    const q = buildExternalQuery(ext).trim();
    if (!q) return [];
    
    // Create a more specific cache key that includes the citation and title
    const cacheKey = `${ext?.citation || ''}-${ext?.title || ''}-${ext?.url || ''}`.toLowerCase();
    if (searchCache.current.has(cacheKey)) {
      return searchCache.current.get(cacheKey)!;
    }
    
    const searchTerms = getSearchTerms(q);
    if (searchTerms.length === 0) return [];
    const pool = (allEntries && allEntries.length ? allEntries : existingEntries);
    const exactCitation = normalizeSearchText(String(ext?.citation || ''));
    const exactTitle = normalizeSearchText(String(ext?.title || ''));

    // Run local and semantic search in parallel for better performance
    const [localScored, semanticScored] = await Promise.all([
      // Local scoring (synchronous) with early termination for high-confidence matches
      Promise.resolve((() => {
        const results: { entry: any; score: number }[] = [];
        let highConfidenceCount = 0;
        
        for (const entry of pool) {
          const base = calculateMatchScore(entry, searchTerms);
          // Strong exact/near-exact boosts
          const entryTitle = normalizeSearchText(entry.title || '');
          const entryCite = normalizeSearchText(entry.canonical_citation || '');
          let boost = 0;
          
          // CITATION MATCHES (HIGHEST PRIORITY)
          if (exactCitation) {
            // Exact citation match gets highest priority
            if (entryCite === exactCitation) boost += 25;
            if (entryTitle === exactCitation) boost += 20;
            
            // Citation starts-with matches
            if (entryCite.startsWith(exactCitation)) boost += 15;
            if (entryTitle.startsWith(exactCitation)) boost += 12;
            
            // Citation contains matches
            if (entryCite.includes(exactCitation)) boost += 10;
            if (entryTitle.includes(exactCitation)) boost += 8;
          }
          
          // TITLE MATCHES (SECOND PRIORITY)
          if (exactTitle) {
            // Exact title match gets high priority
            if (entryTitle === exactTitle) boost += 18;
            if (entryCite === exactTitle) boost += 15;
            
            // Title starts-with matches
            if (entryTitle.startsWith(exactTitle)) boost += 12;
            if (entryCite.startsWith(exactTitle)) boost += 10;
            
            // Title contains matches
            if (entryTitle.includes(exactTitle)) boost += 8;
            if (entryCite.includes(exactTitle)) boost += 6;
            
            // Fuzzy title matching for slight variations
            if (exactTitle.length > 5) {
              const titleWords = exactTitle.split(' ');
              const entryTitleWords = entryTitle.split(' ');
              let matchingWords = 0;
              
              for (const word of titleWords) {
                if (entryTitleWords.some(ew => ew === word || ew.startsWith(word) || word.startsWith(ew))) {
                  matchingWords++;
                }
              }
              
              // If most words match, give a boost
              if (matchingWords >= Math.ceil(titleWords.length * 0.7)) {
                boost += 5 + (matchingWords / titleWords.length) * 5;
              }
            }
          }
          
          const finalScore = base + boost;
          
          // Special case: exact title matches should always be included
          const isExactTitleMatch = exactTitle && entryTitle && entryTitle === exactTitle;
          
          if (finalScore >= 8 || isExactTitleMatch) { // Lowered threshold and added exact match override
            results.push({ entry, score: finalScore });
            // Early termination: if we have 2+ high-confidence matches (score >= 25), stop searching
            if (finalScore >= 25) {
              highConfidenceCount++;
              if (highConfidenceCount >= 2) break;
            }
          }
          
          // Debug logging for "Intervention" matches
          if (process.env.NODE_ENV === 'development' && 
              (exactTitle?.toLowerCase().includes('intervention') || 
               entryTitle?.toLowerCase().includes('intervention'))) {
            console.log('🔍 Intervention match debug:', {
              externalTitle: exactTitle,
              externalCitation: exactCitation,
              entryTitle: entryTitle,
              entryCitation: entryCite,
              baseScore: base,
              boost: boost,
              finalScore: finalScore,
              isExactTitleMatch: isExactTitleMatch,
              threshold: 8,
              passed: finalScore >= 8 || isExactTitleMatch
            });
          }
        }
        return results;
      })()),
      
      // Semantic scoring via API (asynchronous) - reduced influence
      (async () => {
        try {
          // Only use semantic search for exact citation/title matches to avoid irrelevant results
          const semanticQuery = exactCitation || exactTitle;
          if (!semanticQuery) return []; // Skip semantic search if no exact citation/title
          
          const resp = await semanticSearch(semanticQuery, 2); // Reduced limit to avoid noise
          if (resp?.success && Array.isArray(resp.results)) {
            return resp.results.map((r: any) => {
              let semanticScore = Number(r.similarity || r.score || 0) * 100;
              
              // Only boost if it's an exact match - semantic search is unreliable for variations
              const rTitle = normalizeSearchText(r.title || '');
              const rCite = normalizeSearchText(r.canonical_citation || '');
              
              if (exactCitation && (rCite === exactCitation || rTitle === exactCitation)) {
                semanticScore += 25; // Higher boost for exact citation matches
              } else if (exactTitle && (rTitle === exactTitle || rCite === exactTitle)) {
                semanticScore += 20; // Higher boost for exact title matches
              } else {
                // Reduce semantic score for non-exact matches to avoid irrelevant suggestions
                semanticScore *= 0.5;
              }
              
              return { entry: r, score: semanticScore };
            });
          }
          return [];
        } catch {
          // If semantic search fails, return empty array - local search will handle it
          return [];
        }
      })()
    ]);

    // Merge and rank by score, prefer entries with exact boosts
    // Merge while tracking both local and semantic scores
    const merged = {} as Record<string, { entry: any; local: number; semantic: number }>;
    for (const it of localScored) {
      const id = it.entry.entry_id || it.entry.id || it.entry.title;
      const prev = merged[id] || { entry: it.entry, local: 0, semantic: 0 };
      merged[id] = { entry: it.entry, local: Math.max(prev.local, it.score), semantic: prev.semantic };
    }
    for (const it of semanticScored) {
      const id = it.entry.entry_id || it.entry.id || it.entry.title;
      const prev = merged[id] || { entry: it.entry, local: 0, semantic: 0 };
      merged[id] = { entry: it.entry, local: prev.local, semantic: Math.max(prev.semantic, it.score) };
    }

    // Helper token/overlap utilities for high-confidence gating
    const tokenize = (s: string) => String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    const overlap = (a: string, b: string) => {
      const A = new Set(tokenize(a));
      const B = new Set(tokenize(b));
      if (A.size === 0 || B.size === 0) return 0;
      let inter = 0;
      A.forEach(w => { if (B.has(w)) inter++; });
      return inter / Math.min(A.size, B.size);
    };

    // Balanced thresholds to avoid irrelevant suggestions but still find relevant ones
    const SEM_THRESHOLD = 50; // semantic must be high to matter
    const LOC_THRESHOLD = 10; // require decent local evidence
    const prelim = Object.values(merged)
      .filter(m => {
        const hasStrongLocal = m.local >= LOC_THRESHOLD;
        const hasHighSemantic = m.semantic >= SEM_THRESHOLD;
        return hasStrongLocal || (hasHighSemantic && m.local >= 8);
      })
      .map(m => m.entry as EntryLite);

    // FINAL high-confidence filter: only keep items with exact/near-exact title/citation
    const results = prelim.filter((r) => {
      const rTitle = normalizeSearchText(r.title || '');
      const rCite = normalizeSearchText(r.canonical_citation || '');

      // Exact equality on citation or title
      const exact = (exactCitation && (rCite === exactCitation || rTitle === exactCitation)) ||
                    (exactTitle && (rTitle === exactTitle || rCite === exactTitle));

      if (exact) return true;

      // Otherwise require strong corroboration: high title overlap + some citation token agreement
      if (!exactTitle) return false; // without a title, don't allow fuzzy

      const titleOverlap = overlap(rTitle, exactTitle);
      if (titleOverlap < 0.7) return false;

      // Citation corroboration: any shared numeric token or starts-with/contains match
      const numericTokens = (exactCitation || '')
        .split(/[^0-9]+/)
        .filter(t => t.length > 0);
      const hasNumericCorroboration = numericTokens.some(t => rCite.includes(t) || rTitle.includes(t));

      const citeWeakMatch = !!exactCitation && (rCite.startsWith(exactCitation) || rCite.includes(exactCitation));

      return hasNumericCorroboration || citeWeakMatch;
    })
    .slice(0, 3);
    
    // Cache results for future use (limit cache size to prevent memory issues)
    if (searchCache.current.size > 50) {
      const firstKey = searchCache.current.keys().next().value;
      if (firstKey) {
        searchCache.current.delete(firstKey);
      }
    }
    searchCache.current.set(cacheKey, results);
    
    // Debug logging to help understand search results
    if (results.length > 0) {
      console.log(`🔍 Search for "${q}" found ${results.length} matches:`, results.map(r => {
        const entryId = r.entry_id || r.id || r.title;
        const localScore = merged[entryId]?.local || 0;
        const semanticScore = merged[entryId]?.semantic || 0;
        return {
          title: r.title,
          citation: r.canonical_citation,
          localScore,
          semanticScore,
          totalScore: localScore + semanticScore,
          entryId
        };
      }));
    } else {
      console.log(`🔍 No matches found for "${q}" - exactCitation: "${exactCitation}", exactTitle: "${exactTitle}"`);
    }
    
    return results;
  };

  const handleDetectExternalMatches = useCallback(async (idx: number) => {
    const ext = items?.[idx];
    if (!ext || ext.type !== 'external') return;
    if (suppressDetectForExternal.current.has(idx)) return;
    const matches = await findSimilarEntriesForExternal(ext);
    
    // Always log for debugging the Intervention issue
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 External citation matching for "${ext.title || ext.citation}":`, {
        external: ext,
        matches: matches.length,
        matchDetails: matches.map(m => ({ title: m.title, entry_id: m.entry_id, citation: m.canonical_citation }))
      });
    }
    
    // quiet by default; enable by kb_debug=1 in storage
    try { if (localStorage.getItem('kb_debug') === '1' || sessionStorage.getItem('kb_debug') === '1') {
      console.log(`🔍 External citation matching for "${ext.title || ext.citation}":`, {
        external: ext,
        matches: matches.length,
        matchDetails: matches.map(m => ({ title: m.title, entry_id: m.entry_id, citation: m.canonical_citation }))
      });
    } } catch {}
    setInlineMatches(prev => ({ ...prev, [idx]: matches }));
    
    // Set flag to indicate this external citation has internal suggestions
    if (matches.length > 0) {
      try { if (localStorage.getItem('kb_debug') === '1' || sessionStorage.getItem('kb_debug') === '1') console.log(`🔍 Setting _hasInternalSuggestion=true for external citation at index ${idx}:`, ext.title || ext.citation); } catch {}
      // Use setTimeout to make update non-blocking and prevent flickering
      setTimeout(() => update(idx, { ...ext, _hasInternalSuggestion: true }), 0);
      try {
        // Surface a global hint so the create form can gate submission even if
        // this specific row hasn't been re-rendered yet
        sessionStorage.setItem('hasInternalSuggestion', 'true');
      } catch {}
    } else {
      try { if (localStorage.getItem('kb_debug') === '1' || sessionStorage.getItem('kb_debug') === '1') console.log(`🔍 Setting _hasInternalSuggestion=false for external citation at index ${idx}:`, ext.title || ext.citation); } catch {}
      // Use setTimeout to make update non-blocking and prevent flickering
      setTimeout(() => update(idx, { ...ext, _hasInternalSuggestion: false }), 0);
    }
    // keep toast optional off by default
  }, [items, update]);

  const clearInlineIfEmpty = (idx: number) => {
    const ext = items?.[idx];
    const c = String(ext?.citation || '').trim();
    const u = String(ext?.url || '').trim();
    const t = String(ext?.title || '').trim();
    if (!c && !u && !t) {
      setInlineMatches(prev => {
        if (!prev[idx]) return prev;
        const next = { ...prev } as Record<number, EntryLite[]>;
        delete next[idx];
        return next;
      });
    }
  };

  const handleDetectExternalMatchesDebounced = useCallback((idx: number) => {
    const existing = detectTimersRef.current[idx];
    if (existing) {
      window.clearTimeout(existing);
    }
    const timer = window.setTimeout(() => handleDetectExternalMatches(idx), 300);
    detectTimersRef.current[idx] = timer as unknown as number;
  }, [handleDetectExternalMatches]);

  // Auto-detect internal citations when external citations are loaded (e.g., after import)
  useEffect(() => {
    if (!allEntries || allEntries.length === 0) return;
    
    // Check if we have external citations that haven't been processed yet
    const externalCitations = items.filter((item: any, index: number) => 
      item && item.type === 'external' && 
      (item.citation || item.title || item.url) &&
      !inlineMatches[index] // Only process if not already processed
    );
    
    if (externalCitations.length > 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 Auto-detecting internal citations for ${externalCitations.length} external citations after import/load`);
      }
      
      // Trigger detection for each external citation with a delay to prevent flickering
      externalCitations.forEach((item: any, index: number) => {
        const actualIndex = items.findIndex((i: any) => i === item);
        if (actualIndex !== -1) {
          // Use a longer delay to ensure form is stable
          setTimeout(() => {
            handleDetectExternalMatchesDebounced(actualIndex);
          }, 1000);
        }
      });
    }
  }, [allEntries, items, inlineMatches, handleDetectExternalMatchesDebounced]); // Run when allEntries loads or items change

  const convertExternalToInternal = async (extIndex: number, chosen: EntryLite) => {
    try {
      const full = await fetchEntryById(chosen.entry_id);
      const firstUrl = Array.isArray(full?.source_urls) && full.source_urls.length > 0 ? full.source_urls[0] : '';
      const newInternal = {
        type: 'internal',
        entry_id: chosen.entry_id,
        url: firstUrl || '',
        title: full?.title || chosen.title,
        note: full?.summary || ''
      } as any;
      update(extIndex, newInternal);
    } finally {
      setExternalToast({ open: false, index: null, matches: [] });
    }
  };

  return (
    <>
      <div className="space-y-4">
      {/* Picker tabs on top */}
      <div className="flex gap-3 kb-toggle-row">
        <Button
          type="button"
          variant={tab === 'internal' ? 'default' : 'outline'}
          onClick={() => { setTab('internal'); onActivate?.(); }}
          className={`h-11 px-7 rounded-xl min-w-[120px] ${tab === 'internal' ? '' : 'kb-btn-outline'}`}
        >
          Internal
        </Button>
        <Button
          type="button"
          variant={tab === 'external' ? 'default' : 'outline'}
          onClick={() => { setTab('external'); onActivate?.(); }}
          className={`h-11 px-7 rounded-xl min-w-[120px] ${tab === 'external' ? '' : 'kb-btn-outline'}`}
        >
          External
        </Button>
      </div>

      {tab === 'internal' ? (
        <div className="space-y-4">
          {/* Show existing internal citations */}
          {fields.map((f, i) => {
            if (items?.[i]?.type === 'external') return null;
            
            const internalFields = fields.filter((_, idx) => items?.[idx]?.type !== 'external');
            const isLastInternal = f.id === internalFields[internalFields.length - 1]?.id;
            const internalIndex = Math.max(1, internalFields.findIndex((row) => row.id === f.id) + 1);
            
            return (
              <div key={f.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="kb-form-subtitle text-sm font-medium">Internal Citation #{internalIndex}</div>
                </div>
                <input type="hidden" value="internal" {...register(`${name}.${i}.type` as const)} />
                
                <div className="grid gap-3">
                  <div>
                    <label className="kb-form-label">Entry ID (internal)</label>
                    <Input
                      className="kb-form-input"
                      placeholder="e.g., ROC-113-5 or RPC-308"
                      {...register(`${name}.${i}.entry_id` as const, { required: 'Entry ID is required' })}
                    />
                  </div>
                  <div>
                    <label className="kb-form-label">URL</label>
                    <Input
                      className="kb-form-input"
                      placeholder="https://…"
                      {...register(`${name}.${i}.url` as const, { required: 'URL is required' })}
                    />
                  </div>
                  <div>
                    <label className="kb-form-label">Title</label>
                    <Input
                      className="kb-form-input"
                      placeholder="e.g., Arrest, Search, Bail"
                      {...register(`${name}.${i}.title` as const)}
                    />
                  </div>
                  <div>
                    <label className="kb-form-label">Note</label>
                    <Input
                      className="kb-form-input"
                      placeholder="short note or descriptor"
                      {...register(`${name}.${i}.note` as const)}
                    />
                  </div>
                </div>

                {/* Action buttons for internal citations */}
                <div className="flex items-center gap-3 mt-2 mb-6">
                  {isLastInternal && showAddInternalButton && (
                    <Button
                      type="button"
                      variant="success"
                      onClick={() => { 
                        setShowAddInternalButton(false);
                        setShowInternalSearch(true);
                      }}
                      className="h-11 rounded-xl flex-1 mb-2"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add internal citation
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="delete"
                    onClick={() => { try { persistRemoval(items?.[i]); } catch {}; remove(i); }}
                    className={`h-11 rounded-xl ${isLastInternal && (showAddInternalButton || showInternalSearch) ? 'flex-1 mb-2' : 'flex-1 mb-2'}`}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="ml-2">Delete</span>
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Search interface for adding new internal citations */}
          {showInternalSearch && (
            <div className="space-y-3 mt-4">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="kb-form-input kb-input-search"
                    placeholder="Search by entry_id or title…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                {internalCount > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowInternalSearch(false);
                      setShowAddInternalButton(true);
                      setQuery('');
                    }}
                    className="h-11 w-11 rounded-xl p-0 flex items-center justify-center"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              {query.trim().length > 0 && (
                <div className="rounded-xl max-h-56 overflow-auto bg-white shadow-sm border">
                  {options.length === 0 && (
                    <div className="p-4 mt-2 text-sm text-muted-foreground text-center">
                      No exact matches for "{query}"
                    </div>
                  )}
                  {options.map((o) => (
                    <button
                      type="button"
                      key={o.entry_id}
                      className="w-full text-left p-4 hover:bg-orange-50 active:bg-orange-100 transition-colors border-b last:border-b-0"
                      onClick={async () => {
                        try {
                          const full = await fetchEntryById(o.entry_id);
                          const firstUrl = Array.isArray(full?.source_urls) && full.source_urls.length > 0 ? full.source_urls[0] : '';
                          append({ type: 'internal', entry_id: o.entry_id, url: firstUrl || '', title: full?.title || o.title, note: full?.summary || '' });
                        } catch {
                          append({ type: 'internal', entry_id: o.entry_id, url: '', title: o.title, note: '' });
                        }
                        setQuery('');
                        setShowInternalSearch(false);
                        setShowAddInternalButton(true);
                      }}
                    >
                      <div className="pl-3">
                        <div className="font-medium text-sm mb-0.5">{o.title}</div>
                        <div className="text-xs text-muted-foreground mb-0.5">{o.entry_id}</div>
                        {o.canonical_citation && (
                          <div className="text-xs text-muted-foreground mb-0.5">{o.canonical_citation}</div>
                        )}
                      </div>
                    </button>
                  ))}
                  {options.length > 0 && (
                    <div className="px-4 py-2 text-xs text-muted-foreground border-t bg-gray-50">
                      Showing {options.length} entries that might be a match
                    </div>
                  )}
                </div>
              )}
              
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Show existing external citations */}
          {fields.map((f, i) => {
            if (items?.[i]?.type !== 'external') return null;
            
            const externalFields = fields.filter((_, idx) => items?.[idx]?.type === 'external');
            const isLastExternal = f.id === externalFields[externalFields.length - 1]?.id;
            const externalIndex = Math.max(1, externalFields.findIndex((row) => row.id === f.id) + 1);
            
            return (
              <div key={f.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="kb-form-subtitle text-sm font-medium">External Citation #{externalIndex}</div>
                  {!!inlineMatches[i]?.length && (
                    <button
                      type="button"
                      className="kb-internal-match-btn text-xs rounded-md border border-yellow-400 bg-yellow-100 text-gray-800 dark:bg-yellow-200 dark:text-white px-3 py-1.5 hover:bg-yellow-200 hover:border-yellow-500 dark:hover:bg-yellow-300"
                      onClick={() => { const pick = inlineMatches[i][0]; if (pick) void convertExternalToInternal(i, pick); }}
                      title={`Internal match:\n${inlineMatches[i][0]?.title || inlineMatches[i][0]?.entry_id || ''}\n${inlineMatches[i][0]?.canonical_citation || ''}`}
                      aria-label={`Convert to internal: ${inlineMatches[i][0]?.title || inlineMatches[i][0]?.entry_id || ''}`}
                    >
                      This law might be in the KB. Add as Internal instead?
                    </button>
                  )}
                </div>
                <input type="hidden" value="external" {...register(`${name}.${i}.type` as const)} />
                
                <div className="grid gap-3">
                  <div>
                    <label className="kb-form-label">Citation (external)</label>
                    <Input
                      className="kb-form-input"
                      placeholder="e.g., People v. Doria, G.R. No. …"
                      {...register(`${name}.${i}.citation` as const, { 
                        required: 'Citation is required', 
                        onBlur: () => void handleDetectExternalMatches(i)
                      })}
                    />
                  </div>
                  <div>
                    <label className="kb-form-label">URL</label>
                    <Input
                      className="kb-form-input"
                      placeholder="https://…"
                      {...register(`${name}.${i}.url` as const, { 
                        required: 'URL is required', 
                        onBlur: () => void handleDetectExternalMatches(i)
                      })}
                    />
                  </div>
                  <div>
                    <label className="kb-form-label">Title</label>
                    <Input
                      className="kb-form-input"
                      placeholder="e.g., Arrest, Search, Bail"
                      {...register(`${name}.${i}.title` as const, { 
                        onBlur: () => void handleDetectExternalMatches(i)
                      })}
                    />
                  </div>
                  <div>
                    <label className="kb-form-label">Note</label>
                    <Input
                      className="kb-form-input"
                      placeholder="short note or descriptor"
                      {...register(`${name}.${i}.note` as const)}
                    />
                  </div>
                </div>

                {/* Action buttons for external citations */}
                <div className="flex items-center gap-3 mt-2 mb-6">
                  {isLastExternal && (
                    <Button
                      type="button"
                      variant="success"
                      onClick={() => { 
                        append({ type: 'external', citation: '', url: '', title: '', note: '' });
                      }}
                      className="h-11 rounded-xl flex-1 mb-2"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add external citation
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="delete"
                    onClick={() => { setInlineMatches(prev => { const next = { ...prev }; delete next[i]; return next; }); try { persistRemoval(items?.[i]); } catch {}; remove(i); }}
                    className={`h-11 rounded-xl ${externalCount > 1 ? 'flex-1 mb-2' : 'w-11 mb-2'}`}
                  >
                    <Trash2 className="h-4 w-4" />
                    {externalCount > 1 && <span className="ml-2">Delete</span>}
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Show Add external citation button when no external citations exist */}
          {externalCount === 0 && (
            <Button
              type="button"
              variant="success"
              onClick={() => { 
                append({ type: 'external', citation: '', url: '', title: '', note: '' });
              }}
              className="w-full h-11 rounded-xl mt-4"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add external citation
            </Button>
          )}
        </div>
      )}
      </div>
      {/* External-to-internal matches toast */}
      <Toast
        isOpen={externalToast.open}
        onClose={() => setExternalToast({ open: false, index: null, matches: [] })}
        title={((): string => {
          const isRelated = String(name || '').includes('related_sections');
          const base = isRelated ? 'Detected internal citation for Related Sections' : 'Detected internal citation for Legal Bases';
          return externalToast.matches.length > 1 ? `${base} (${externalToast.matches.length})` : base;
        })()}
        type="warning"
        position="top-right"
      >
        <div className="space-y-3">
          {externalToast.matches.map((m, idx) => (
            <div key={`${m.entry_id}-${idx}`} className="border rounded-lg p-3">
              <div className="text-sm font-medium">{m.title}</div>
              <div className="text-xs text-muted-foreground">{m.entry_id}{m.canonical_citation ? ` • ${m.canonical_citation}` : ''}</div>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant="default"
                  onClick={() => {
                    if (externalToast.index != null) {
                      void convertExternalToInternal(externalToast.index, m);
                    }
                  }}
                  className="h-9 inline-flex items-center gap-2 pr-2"
                >
                  <span>Add as Internal Instead</span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setExternalToast({ open: false, index: null, matches: [] });
                    }}
                    className="ml-2 pl-2 border-l border-white/30 text-white/90 hover:text-white cursor-pointer"
                    aria-label="Close"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setExternalToast(prev => {
                      const remaining = prev.matches.filter((_, j) => j !== idx);
                      return { ...prev, matches: remaining, open: remaining.length > 0 };
                    });
                  }}
                  className="h-9"
                >
                  No
                </Button>
              </div>
            </div>
          ))}
          {externalToast.index != null && (
            <div className="pt-2 border-t mt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  suppressDetectForExternal.current.add(externalToast.index as number);
                  setExternalToast({ open: false, index: null, matches: [] });
                }}
                className="h-8 text-xs"
              >
                Don’t suggest again for this citation
              </Button>
            </div>
          )}
        </div>
      </Toast>
    </>
  );
}



