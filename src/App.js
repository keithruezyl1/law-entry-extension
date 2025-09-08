import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate, useLocation } from 'react-router-dom';
import './App.css';
import { useLocalStorage } from './hooks/useLocalStorage';
import EntryForm from './components/kb/EntryForm.tsx'; // new TS + RHF + Zod wizard
import EntryList from './components/EntryList/EntryList';
import EntryView from './components/EntryView/EntryView';
import Login from './components/Login/Login';
import Confetti from './components/Confetti/Confetti';
import Modal from './components/Modal/Modal';
import { loadPlanFromJson, computeDayIndex, rowsForDay, getPlanDate, toISODate } from './lib/plan/planLoader';
import { format } from 'date-fns';
import { setDay1Date } from './lib/plan/progressStore';
import { upsertEntry, deleteEntryVector, clearEntriesVector } from './services/vectorApi';
// import { fetchAllEntriesFromDb } from './services/kbApi';
// Plans API removed: we now load from bundled JSON
import ChatModal from './components/kb/ChatModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { checkAdminAndAlert, isTagarao } from './utils/adminUtils';
import { Toast } from './components/ui/Toast';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/law-entry/:step" element={<DashboardOnlyRoute><LawEntryForm /></DashboardOnlyRoute>} />
          <Route path="/entry/:entryId" element={<ProtectedRoute><EntryDetails /></ProtectedRoute>} />
          <Route path="/entry/:entryId/edit" element={<DashboardOnlyRoute><EntryEdit /></DashboardOnlyRoute>} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

// Root redirect component - redirects to dashboard if logged in, login if not
function RootRedirect() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        navigate('/dashboard');
      } else {
        navigate('/login');
      }
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="App">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }
  return null;
}

// Protected route component
function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="App">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return user ? children : null;
}

// Dashboard-only route component - ensures users can only access forms from dashboard
function DashboardOnlyRoute({ children }) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        navigate('/login');
      } else {
        // Check if user came from dashboard by checking session storage
        const cameFromDashboard = sessionStorage.getItem('cameFromDashboard');
        if (!cameFromDashboard) {
          console.log('User did not come from dashboard, redirecting to dashboard');
          navigate('/dashboard');
        }
      }
    }
  }, [user, isLoading, navigate, location]);

  if (isLoading) {
    return (
      <div className="App">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return user ? children : null;
}

// Dashboard Component - Main list view
function Dashboard() {
  return <AppContent currentView="list" />;
}

// Law Entry Form Component
function LawEntryForm() {
  const { step } = useParams();
  return <AppContent currentView="form" formStep={parseInt(step) || 1} />;
}

// Entry Details Component
function EntryDetails() {
  const { entryId } = useParams();
  return <AppContent currentView="view" selectedEntryId={entryId} />;
}

// Entry Edit Component
function EntryEdit() {
  const { entryId } = useParams();
  return <AppContent currentView="form" isEditing={true} selectedEntryId={entryId} />;
}

function AppContent({ currentView: initialView = 'list', isEditing = false, formStep = 1, selectedEntryId: initialEntryId = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  
  const [currentView] = useState(initialView);
  const [selectedEntryId, setSelectedEntryId] = useState(initialEntryId);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearModalStep, setClearModalStep] = useState(1);
  const [clearOption, setClearOption] = useState(null);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeDraft, setResumeDraft] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);
  const [incompleteEntries, setIncompleteEntries] = useState([]);
  const [yesterdayMode, setYesterdayMode] = useState(false);
  const [headerOpacity, setHeaderOpacity] = useState(1);
  const [planData, setPlanData] = useState(null);
  const [day1Date, setDay1DateState] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [planLoading, setPlanLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showIncompleteEntriesModal, setShowIncompleteEntriesModal] = useState(false);
  const [pendingEntryForModal, setPendingEntryForModal] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [now, setNow] = useState(new Date());
  const [showCreationToast, setShowCreationToast] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('app_theme');
      return saved === 'dark';
    } catch (_) { return false; }
  });

  // Show creation toast when session flag is set AND we're on dashboard
  useEffect(() => {
    try {
      const flag = sessionStorage.getItem('entryCreated');
      if (flag && location.pathname === '/dashboard') {
        setShowCreationToast(true);
        
        // Additional safety: Clear any remaining drafts when toast appears
        try {
          localStorage.removeItem('kb_entry_draft');
          localStorage.removeItem('kb_draft');
          localStorage.removeItem('kb_drafts');
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('kb_entry_') || 
                key.startsWith('entry_draft_') || 
                key.startsWith('kb_draft') ||
                key.includes('draft') ||
                key.includes('autosave')) {
              localStorage.removeItem(key);
            }
          });
          console.log('Additional draft clearing on toast appearance');
        } catch (e) {
          console.warn('Failed to clear drafts on toast appearance:', e);
        }
        
        const timer = setTimeout(() => {
          setShowCreationToast(false);
        }, 2000);
        sessionStorage.removeItem('entryCreated');
        return () => clearTimeout(timer);
      }
    } catch {}
  }, [location.pathname]);

  // Load plan from bundled JSON on mount
  useEffect(() => {
    const init = async () => {
      try {
        setPlanLoading(true);
        const rows = await loadPlanFromJson('/Civilify_KB30_Schedule_CorePH.json');
        setPlanData(rows);
        // Day 1 fixed to 2025-09-04
        const day1 = '2025-09-04';
        setDay1Date(day1);
        setDay1DateState(day1);
        try { window.__KB_PLAN__ = rows; window.__KB_DAY1__ = day1; } catch (_) {}
      } catch (err) {
        console.error('Failed to load plan JSON:', err);
        setPlanData([]);
        setDay1DateState('2025-09-04');
        try { window.__KB_PLAN__ = []; window.__KB_DAY1__ = '2025-09-04'; } catch (_) {}
      } finally {
        setPlanLoading(false);
      }
    };
    init();
  }, []);

  // Live clock (updates every second)
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Apply theme class to root element
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark-mode');
    } else {
      root.classList.remove('dark-mode');
    }
    try { localStorage.setItem('app_theme', isDarkMode ? 'dark' : 'light'); } catch (_) {}
  }, [isDarkMode]);

  // React to verification refresh or progress changes (trigger re-render)
  useEffect(() => {
    const forceRerender = () => setHeaderOpacity((v) => v);
    window.addEventListener('refresh-entries', forceRerender);
    window.addEventListener('refresh-progress', forceRerender);
    return () => {
      window.removeEventListener('refresh-entries', forceRerender);
      window.removeEventListener('refresh-progress', forceRerender);
    };
  }, []);

  const planRows = (() => {
    if (Array.isArray(planData)) return planData;
    if (planData && Array.isArray(planData.rows)) return planData.rows;
    if (planData && Array.isArray(planData.data)) return planData.data;
    return [];
  })();

  // Get entries from useLocalStorage hook
  const { entries, loading, error, addEntry, updateEntry, deleteEntry, getEntryById, getEntryByEntryId, searchEntries, exportEntries, importEntries, clearAllEntries, getStorageStats, getAllTeamProgress, getYesterdayTeamProgress, updateProgressForEntry, checkDailyCompletion } = useLocalStorage();

  // Function to check incomplete entries from yesterday
  const checkIncompleteEntries = useCallback(() => {
    if (!planRows || !day1Date) return;
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDayIndex = computeDayIndex(yesterday, day1Date);
    const yesterdayRows = rowsForDay(planRows, yesterdayDayIndex);
    
    const incomplete = [];
    const teamMemberNames = { 1: 'Arda', 2: 'Delos Cientos', 3: 'Paden', 4: 'Sendrijas', 5: 'Tagarao' };
    
    yesterdayRows.forEach(row => {
      const personId = parseInt(row.Person.replace('P', ''));
      const personName = teamMemberNames[personId];
      if (!personName) return;
      
      // Get yesterday's entries for this person
      const yesterdayISO = toISODate(getPlanDate(yesterday));
      const personEntries = entries.filter(entry => 
        entry.created_by === personId && 
        toISODate(getPlanDate(new Date(entry.created_at))) === yesterdayISO
      );
      
      // Count entries by type
      const doneByType = {};
      personEntries.forEach(entry => {
        doneByType[entry.type] = (doneByType[entry.type] || 0) + 1;
      });
      
      // Check if any quota is incomplete
      const totalReq = row.Total || 0;
      const totalDone = Object.values(doneByType).reduce((sum, count) => sum + count, 0);
      
      if (totalDone < totalReq) {
        const incompleteEntry = {
          personId,
          personName,
          totalDone,
          totalReq,
          quotas: {
            constitution_provision: row.constitution_provision || 0,
            statute_section: row.statute_section || 0,
            rule_of_court: row.rule_of_court || 0,
            agency_circular: row.agency_circular || 0,
            doj_issuance: row.doj_issuance || 0,
            executive_issuance: row.executive_issuance || 0,
            rights_advisory: row.rights_advisory || 0,
            city_ordinance_section: row.city_ordinance_section || 0
          },
          doneByType
        };
        incomplete.push(incompleteEntry);
        console.log(`Found incomplete entry for ${personName} (P${personId}): ${totalDone}/${totalReq}`, incompleteEntry);
      }
    });
    
    setIncompleteEntries(incomplete);
    
    // Store in sessionStorage for use in EntryForm
    try {
      sessionStorage.setItem('incompleteEntries', JSON.stringify(incomplete));
      console.log('Stored incomplete entries in sessionStorage:', incomplete);
    } catch (e) {
      console.error('Failed to store incomplete entries in sessionStorage:', e);
    }
  }, [planRows, day1Date, entries, now]);

  // Check incomplete entries when data changes
  useEffect(() => {
    checkIncompleteEntries();
  }, [checkIncompleteEntries]);

  const hasPlan = true; // Always treat plan as present since it's bundled

  // Guard: prevent opening the form route when plan failed to load
  useEffect(() => {
    if (currentView !== 'form') return;
    // Wait until plan loading completes to avoid false negatives on first mount
    if (planLoading) return;
    // no-op; plan is always bundled
  }, [currentView, hasPlan, navigate, planLoading]);
  
  

  // Redirect to login if on root path (this is now handled by the router)
  // The login component will handle redirecting to dashboard after authentication
  
  // const {
  //   entries,
  //   loading,
  //   error,
  //   addEntry,
  //   updateEntry,
  //   deleteEntry,
  //   getEntryById,
  //   searchEntries,
  //   exportEntries,
  //   importEntries,
  //   clearAllEntries,
  //   getStorageStats,
  //   getAllTeamProgress,
  //   getYesterdayTeamProgress,
  //   checkDailyCompletion
  // } = useLocalStorage();

  // Handle initial entry loading for view/edit
  useEffect(() => {
    if (initialEntryId && (currentView === 'view' || isEditing) && !loading) {
      
      const entry = getEntryById(initialEntryId);
      console.log('Found entry:', entry);
      
      if (entry) {
        if (isEditing) {
          console.log('Setting editing entry:', entry);
          setEditingEntry(entry);
        }
        setSelectedEntryId(initialEntryId);
      } else {
        // Entry not found, redirect to dashboard
        console.log('Entry not found, redirecting to dashboard');
        navigate('/dashboard');
      }
    }
  }, [initialEntryId, currentView, isEditing, getEntryById, navigate, entries, loading]);

  const stats = getStorageStats();
  const teamProgress = getAllTeamProgress();
  const yesterdayProgress = getYesterdayTeamProgress();
  
  // Use database team members instead of hardcoded data
  const [dbTeamMembers, setDbTeamMembers] = useState([]);
  
  // Fetch team members from database
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) return;
        
        const ORIGIN_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:4000';
        const API_BASE = ORIGIN_BASE.endsWith('/api') ? ORIGIN_BASE : `${ORIGIN_BASE}/api`;
        const response = await fetch(`${API_BASE}/auth/team-members`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setDbTeamMembers(data.team_members);
        }
      } catch (error) {
        console.error('Error fetching team members:', error);
        // Fallback to hardcoded data if API fails
        setDbTeamMembers([
          { id: 1, name: 'Arda', person_id: 'P1' },
          { id: 2, name: 'Delos Cientos', person_id: 'P2' },
          { id: 3, name: 'Paden', person_id: 'P3' },
          { id: 4, name: 'Sendrijas', person_id: 'P4' },
          { id: 5, name: 'Tagarao', person_id: 'P5' }
        ]);
      }
    };
    
    fetchTeamMembers();
  }, []);


  // Team member names from database - use the same data as dbTeamMembers
  const teamMemberNames = useMemo(() => {
    const names = {};
    dbTeamMembers.forEach(member => {
      names[member.id] = member.name;
    });
    console.log('Team member names created:', names);
    console.log('dbTeamMembers:', dbTeamMembers);
    return names;
  }, [dbTeamMembers]);

  // Handle scroll for header background opacity
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const opacity = scrollTop > 0 ? 0.7 : 1;
      setHeaderOpacity(opacity);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Check yesterday's completion status with carryover logic
  // const getYesterdayStatus = () => {
  //   const incompleteMembers = [];
  //   let allCompleted = true;
  //   let someCompleted = false;
    
  //   for (let i = 1; i <= 5; i++) {
  //     const yesterdayTotal = yesterdayProgress[i]?.total || 0;
  //     const todayTotal = teamProgress[i]?.total || 0;
      
  //     // Calculate total progress including today's carryover
  //     const totalProgress = yesterdayTotal + todayTotal;
      
  //     if (totalProgress < 10) {
  //       allCompleted = false;
  //       const memberName = dbTeamMembers.find(m => m.id === i)?.name || `P${i}`;
  //       incompleteMembers.push(memberName);
  //     } else {
  //       someCompleted = true;
  //     }
  //   }
    
  //   if (allCompleted) {
  //     return { 
  //       text: "ALL COMPLETED", 
  //       completed: true, 
  //       status: 'completed' // green
  //     };
  //   } else if (someCompleted) {
  //     return { 
  //       text: `INCOMPLETE ENTRIES: ${incompleteMembers.join(', ')}`, 
  //       completed: false, 
  //       status: 'partial' // orange
  //     };
  //   } else {
  //     return { 
  //       text: `INCOMPLETE ENTRIES: ${incompleteMembers.join(', ')}`, 
  //       completed: false, 
  //       status: 'incomplete' // red
  //     };
  //   }
  // };

  const handleCreateNew = async () => {
    if (!hasPlan) return alert('Plan not loaded.');
    
    // Check if current user has incomplete entries from yesterday
    const currentUserIncomplete = incompleteEntries.find(incomplete => 
      incomplete.personName === user?.name
    );
    
    // Always navigate to form - modal will be shown during form submission if needed
    setYesterdayMode(false);
    sessionStorage.removeItem('yesterdayMode');
    sessionStorage.removeItem('yesterdayQuotas');
    
    try {
      const raw = localStorage.getItem('kb_entry_draft');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
            // Always ask user whether to resume or start new when a draft exists
            setResumeDraft(parsed);
            setShowResumeModal(true);
            return;
          }
        } catch (_) {
          // ignore parse errors and proceed to fresh form
        }
      }
    } catch (_) {}
    setEditingEntry(null);
    // Set session storage to indicate user came from dashboard
    sessionStorage.setItem('cameFromDashboard', 'true');
    navigate('/law-entry/1');
  };

  const handleResumeYes = () => {
    setEditingEntry(resumeDraft || null);
    setShowResumeModal(false);
    // Set session storage to indicate user came from dashboard
    sessionStorage.setItem('cameFromDashboard', 'true');
    navigate('/law-entry/1');
  };

  const handleResumeNo = () => {
    try { localStorage.removeItem('kb_entry_draft'); } catch (_) {}
    setResumeDraft(null);
    setShowResumeModal(false);
    setEditingEntry(null);
    // Set session storage to indicate user came from dashboard
    sessionStorage.setItem('cameFromDashboard', 'true');
    navigate('/law-entry/1');
  };

  const handleEditEntry = (entryId) => {
    console.log('handleEditEntry called with entryId:', entryId);
    console.log('Entry type:', typeof entryId);
    
    // Find the entry to edit
    const entryToEdit = entries.find(entry => entry.id === entryId || entry.entry_id === entryId);
    if (entryToEdit) {
      setEditingEntry(entryToEdit);
      // Set session storage to indicate user came from dashboard
      sessionStorage.setItem('cameFromDashboard', 'true');
      // Route to dedicated edit URL so edit mode is activated and drafts do not load
      navigate(`/entry/${entryId}/edit?step=1`);
    } else {
      console.error('Entry not found for editing:', entryId);
      alert('Entry not found for editing');
    }
  };

  const handleViewEntry = (entryId) => {
    navigate(`/entry/${entryId}`);
  };

  const handleSaveEntry = async (entryData) => {
    try {
      // Check if we're in yesterday mode OR if user has incomplete entries
      const isYesterdayMode = sessionStorage.getItem('yesterdayMode') === 'true';
      const incompleteEntries = JSON.parse(sessionStorage.getItem('incompleteEntries') || '[]');
      const userHasIncompleteEntries = incompleteEntries.some((entry) => 
        entry.personId === user?.personId || 
        entry.personName === user?.name
      );
      
      if (isYesterdayMode || userHasIncompleteEntries) {
        // Set created_at to yesterday's date for yesterday mode entries or incomplete entries
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        entryData.created_at = yesterday.toISOString();
        console.log('Yesterday mode or incomplete entries: Setting created_at to', entryData.created_at);
      }
      
      if (editingEntry) {
        await updateEntry(editingEntry.id, entryData);
        console.log('Entry updated:', entryData);
        
        // Clear editing state after successful update
        setEditingEntry(null);
        
        // Note: Vector embeddings are automatically updated by the backend PUT endpoint
        // No need for additional upsertEntry call which was causing duplication
      } else {
        // Check if this entry will complete a daily quota
        if (entryData.team_member_id && entryData.type) {
          const willComplete = checkDailyCompletion(entryData.team_member_id, entryData.type);
          if (willComplete) {
            setShowConfetti(true);
          }
        }
        const newEntry = await addEntry(entryData);
        
        // Set session flag for success toast on dashboard (instead of showing modal)
        try { sessionStorage.setItem('entryCreated', '1'); } catch {}
        
        // Clear ALL localStorage drafts/autosaves for create entry
        try {
          // Clear specific known draft keys
          localStorage.removeItem('kb_entry_draft');
          localStorage.removeItem('kb_draft');
          localStorage.removeItem('kb_drafts');
          
          // Clear any other draft-related keys with comprehensive patterns
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('kb_entry_') || 
                key.startsWith('entry_draft_') || 
                key.startsWith('kb_draft') ||
                key.includes('draft') ||
                key.includes('autosave')) {
              localStorage.removeItem(key);
            }
          });
          console.log('Cleared all entry drafts and autosaves from localStorage');
        } catch (e) {
          console.warn('Failed to clear localStorage drafts:', e);
        }
        // Fire-and-forget vector upsert (does not block UX)
        try {
          if (!entryData.entry_id) {
            console.warn('Skipping vector upsert: missing entry_id. Ensure Law Family/Section are set to generate ID.');
          } else {
            const payload = {
              entry_id: entryData.entry_id,
              type: entryData.type,
              title: entryData.title,
              canonical_citation: entryData.canonical_citation,
              summary: entryData.summary,
              text: entryData.text,
              tags: entryData.tags,
              jurisdiction: entryData.jurisdiction,
              law_family: entryData.law_family,
              section_id: entryData.section_id,
              status: entryData.status,
              effective_date: entryData.effective_date,
              amendment_date: entryData.amendment_date,
              last_reviewed: entryData.last_reviewed,
              visibility: entryData.visibility,
              source_urls: entryData.source_urls,
              elements: entryData.elements,
              penalties: entryData.penalties,
              defenses: entryData.defenses,
              prescriptive_period: entryData.prescriptive_period,
              standard_of_proof: entryData.standard_of_proof,
              rule_no: entryData.rule_no,
              section_no: entryData.section_no,
              triggers: entryData.triggers,
              time_limits: entryData.time_limits,
              required_forms: entryData.required_forms,
              circular_no: entryData.circular_no,
              applicability: entryData.applicability,
              issuance_no: entryData.issuance_no,
              instrument_no: entryData.instrument_no,
              supersedes: entryData.supersedes,
              steps_brief: entryData.steps_brief,
              forms_required: entryData.forms_required,
              failure_states: entryData.failure_states,
              violation_code: entryData.violation_code,
              violation_name: entryData.violation_name,
              license_action: entryData.license_action,
              fine_schedule: entryData.fine_schedule,
              apprehension_flow: entryData.apprehension_flow,
              incident: entryData.incident,
              phases: entryData.phases,
              forms: entryData.forms,
              handoff: entryData.handoff,
              rights_callouts: entryData.rights_callouts,
              rights_scope: entryData.rights_scope,
              advice_points: entryData.advice_points,
              topics: entryData.topics,
              jurisprudence: entryData.jurisprudence,
              legal_bases: entryData.legal_bases,
              related_sections: entryData.related_sections,
            };
            upsertEntry(payload).then((resp) => {
              if (!resp?.success) console.warn('Vector upsert failed:', resp?.error);
            }).catch((e) => console.warn('Vector upsert error:', e));
          }
        } catch (e) {
          console.warn('Vector upsert error:', e);
        }
        alert(`Entry "${entryData.title}" has been saved to the database and indexed.`);
      }
      try { localStorage.removeItem('kb_entry_draft'); } catch (_) {}
      setEditingEntry(null);
    } catch (err) {
      console.error('Error saving entry:', err);
      const msg = (err && err.message) ? String(err.message) : 'Please try again.';
      alert(`Failed to save entry: ${msg}`);
    }
  };

  const handleDeleteEntry = (entryId) => {
    const entry = entries.find(e => e.id === entryId);
    setEntryToDelete(entry);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!entryToDelete) return;
    
    try {
      // 1) Gather inbound references (entries that cite this entry internally)
      const inbound = entries.filter(e => {
        const lb = Array.isArray(e.legal_bases) ? e.legal_bases : [];
        const rs = Array.isArray(e.related_sections) ? e.related_sections : [];
        const citesInLB = lb.some((x) => x && (x.entry_id === entryToDelete.entry_id || x.entry_id === entryToDelete.id));
        const citesInRS = rs.some((x) => x && (x.entry_id === entryToDelete.entry_id || x.entry_id === entryToDelete.id));
        return citesInLB || citesInRS;
      });

      // 2) If there are inbound references, warn the user with a detailed prompt
      if (inbound.length > 0) {
        const list = inbound.map(e => `• ${e.title} (${e.entry_id || e.id})`).join('\n');
        const confirmed = window.confirm(
          `This entry is cited internally by ${inbound.length} other entries.\n\n${list}\n\nProceed with deletion? Those references will be removed automatically.`
        );
        if (!confirmed) {
          return;
        }
      }

      // 3) Delete the target entry
      await deleteEntry(entryToDelete.id);

      // 4) Auto-remove dangling internal references from inbound entries
      for (const e of inbound) {
        const lb = Array.isArray(e.legal_bases) ? e.legal_bases : [];
        const rs = Array.isArray(e.related_sections) ? e.related_sections : [];
        const filteredLB = lb.filter((x) => x && (x.entry_id !== entryToDelete.entry_id && x.entry_id !== entryToDelete.id));
        const filteredRS = rs.filter((x) => x && (x.entry_id !== entryToDelete.entry_id && x.entry_id !== entryToDelete.id));
        if (filteredLB.length !== lb.length || filteredRS.length !== rs.length) {
          try {
            await updateEntry(e.id, { legal_bases: filteredLB, related_sections: filteredRS });
          } catch (err) {
            console.warn('Failed to clean references for', e.id, err);
          }
        }
      }

      if (currentView === 'view' && selectedEntryId === entryToDelete.id) {
        navigate('/dashboard');
        setSelectedEntryId(null);
      }
      // Fire-and-forget vector delete
      if (entryToDelete.id) {
        deleteEntryVector(entryToDelete.id).catch((e) => console.warn('Vector delete error:', e));
      }
      setShowDeleteModal(false);
      setEntryToDelete(null);
    } catch (err) {
      console.error('Error deleting entry:', err);
      alert('Failed to delete entry. Please try again.');
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setEntryToDelete(null);
  };

  const handleExport = () => {
    try {
      exportEntries();
    } catch (err) {
      console.error('Error exporting entries:', err);
      alert('Failed to export entries. Please try again.');
    }
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedCount = importEntries(e.target.result);
          alert(`Successfully imported ${importedCount} entries.`);
        } catch (err) {
          console.error('Error importing entries:', err);
          alert('Failed to import entries. Please check the file format.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleClearAll = () => {
    // Security check: Only Tagarao can clear all entries
    if (!checkAdminAndAlert(user, 'clear all entries')) {
      return;
    }
    setShowClearModal(true);
    setClearModalStep(1);
    setClearOption(null);
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const handleLogoutConfirm = () => {
    logout();
    navigate('/login');
    setShowLogoutModal(false);
  };

  const handleLogoutCancel = () => {
    setShowLogoutModal(false);
  };

  const handleIncompleteEntriesModalOK = () => {
    if (pendingEntryForModal) {
      // Set the entry's created_at to yesterday with the same time
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      pendingEntryForModal.created_at = yesterday.toISOString();
      
      console.log('Setting created_at to yesterday:', {
        originalDate: now.toISOString(),
        yesterdayDate: yesterday.toISOString(),
        entryTitle: pendingEntryForModal.title,
        entryType: pendingEntryForModal.type
      });
      
      // Save the entry with yesterday's date
      addEntry(pendingEntryForModal);
      
      // Show success popup
      setShowSuccessModal(true);
      
      // Clear the pending entry and close modal
      setPendingEntryForModal(null);
      setShowIncompleteEntriesModal(false);
      
      // Navigate back to dashboard after a short delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 100);
    }
  };

  const handleIncompleteEntriesModalCancel = () => {
    // Clear the pending entry and close modal without saving
    setPendingEntryForModal(null);
    setShowIncompleteEntriesModal(false);
  };

  const showIncompleteEntriesModalWithEntry = (entryData) => {
    setPendingEntryForModal(entryData);
    setShowIncompleteEntriesModal(true);
  };

  // Auto-close success modal after 2 seconds
  useEffect(() => {
    if (showSuccessModal) {
      const timer = setTimeout(() => {
        setShowSuccessModal(false);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [showSuccessModal]);

  const handleClearOptionSelect = (option) => {
    setClearOption(option);
    setClearModalStep(2);
  };

  const handleClearConfirm = () => {
    try {
      if (clearOption === 'all') {
        clearEntriesVector().then(async (resp) => {
          if (!resp?.success) console.warn('Vector clear all failed:', resp?.error);
          clearAllEntries();
          // Refresh from DB
          try { localStorage.setItem('law_entries', JSON.stringify([])); } catch {}
          alert('All entries have been cleared from the database.');
        });
      } else {
        const today = new Date().toISOString().split('T')[0];
        clearEntriesVector(today).then(async (resp) => {
          if (!resp?.success) console.warn('Vector clear today failed:', resp?.error);
          // Update UI list to remove todays
          const remaining = entries.filter(entry => {
            const entryDate = new Date(entry.created_at).toISOString().split('T')[0];
            return entryDate !== today;
          });
          try { localStorage.setItem('law_entries', JSON.stringify(remaining)); } catch {}
          alert('Today\'s entries have been cleared from the database.');
        });
      }
      setShowClearModal(false);
      setClearModalStep(1);
      setClearOption(null);
    } catch (err) {
      console.error('Error clearing entries:', err);
      alert('Error clearing entries. Please try again.');
    }
  };

  const handleClearCancel = () => {
    setShowClearModal(false);
    setClearModalStep(1);
    setClearOption(null);
  };

  // Plan import removed

  // Plan import removed

  // Plan import removed

  // Plan import removed

  // Plan import removed

  const handleBackToList = () => {
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="App">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      {/* Creation success toast */}
      <Toast
        isOpen={showCreationToast}
        onClose={() => setShowCreationToast(false)}
        title="Entry Created"
        type="success"
        position="top-right"
        duration={2000}
      >
        <div>Successfully created entry.</div>
      </Toast>

      {currentView !== 'form' && (
      <header className="App-header" style={{ 
        background: isDarkMode
          ? `linear-gradient(135deg, rgba(178, 84, 34, ${headerOpacity}) 0%, rgba(153, 61, 28, ${headerOpacity}) 100%)`
          : `linear-gradient(135deg, rgba(255, 140, 66, ${headerOpacity}) 0%, rgba(255, 107, 53, ${headerOpacity}) 100%)`
      }}>
        <div className="header-left">
          <h1>Civilify Law Entry</h1>
          <span className="header-entries-count">{stats.totalEntries} entries</span>
        </div>
        <div className="header-actions">
          <button
            aria-label="Toggle theme"
            className={`theme-toggle ${isDarkMode ? 'theme-toggle--dark' : 'theme-toggle--light'}`}
            onClick={() => setIsDarkMode(v => !v)}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? (
              // Half moon icon
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"/>
              </svg>
            ) : (
              // Sun icon
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M6.76 4.84l-1.8-1.79L3.17 4.84l1.79 1.79 1.8-1.79zM1 13h3v-2H1v2zm10 10h2v-3h-2v3zm7.03-3.34l1.79 1.79 1.79-1.79-1.79-1.79-1.79 1.79zM20 11v2h3v-2h-3zm-2.76-6.16l1.8-1.79-1.79-1.79-1.79 1.79 1.78 1.79zM12 4a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12zM4.34 17.66l-1.79 1.79 1.79 1.79 1.79-1.79-1.79-1.79z"/>
              </svg>
            )}
          </button>
          <button onClick={handleLogout} className="logout-btn">
            Logout ({user?.name})
          </button>
        </div>
      </header>
      )}

      {currentView !== 'form' && (
      <div className="progress-bar-container">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${stats.progressPercentage}%` }}
          ></div>
        </div>
        <div className="progress-stats">
          <span>{stats.totalEntries} / 1,500 entries</span>
          <span>{stats.progressPercentage.toFixed(1)}% complete</span>
          <span>{stats.remainingEntries} remaining</span>
        </div>
      </div>
      )}

      {currentView !== 'form' && (
      <div className="team-progress">
        <div className="team-progress-header">
          <h3>Today's Team Progress {(
            <span style={{ color: '#6b7280', fontWeight: 500, marginLeft: '8px' }}>
              {`Day ${computeDayIndex(now, day1Date)}, ${format(now, 'MMMM d, yyyy')} ${format(now, 'hh:mm:ss a')}`}
            </span>
          )}</h3>
        </div>
        <div className="team-members-grid">
          {dbTeamMembers.map(member => {
            const personKey = (member.name || member.username || member.id);
            const personName = member.name || member.username || member.id; // display label
            const nameToPlanCode = { 'Arda': 'P1', 'Delos Cientos': 'P2', 'Paden': 'P3', 'Sendrijas': 'P4', 'Tagarao': 'P5' };
            const personPlanCode = nameToPlanCode[personName] || nameToPlanCode[personKey] || personKey;
            
            // Plan is bundled; always available
            const _hasPlan = true;
            
            if (!_hasPlan) {
              // Show empty card when no plan is imported
              return (
                <div key={personKey} className="team-member-card">
                  <h4>{personName}</h4>
                  <div className="member-progress">
                    <span className="progress-count">0 / 0</span>
                    <div className="member-progress-bar">
                      <div className="member-progress-fill" style={{ width: '0%' }}></div>
                    </div>
                  </div>
                  <div className="member-breakdown">
                    <span className="quota-item" style={{ fontStyle: 'italic', color: '#666' }}>
                      Import plan to start
                    </span>
                  </div>
                </div>
              );
            }
            
            // Get current day's requirements if plan is loaded
            let currentDayReqs = {
              statute_section: 0,
              rule_of_court: 0,
              rights_advisory: 0,
              constitution_provision: 0,
              agency_circular: 0,
              doj_issuance: 0,
              executive_issuance: 0,
              city_ordinance_section: 0,
              ...(member?.dailyQuota || {}),
            };
            const today = new Date();
            const currentDayIndex = computeDayIndex(today, day1Date);
            const dayRows = rowsForDay(planRows, currentDayIndex);
            // Match using plan codes P1..P5
            const personRow = dayRows.find((r) => String(r.Person || '').trim().toUpperCase() === String(personPlanCode).trim().toUpperCase());
            
            
            if (personRow) {
              currentDayReqs = {
                statute_section: Number(personRow.statute_section || 0),
                rule_of_court: Number(personRow.rule_of_court || 0),
                rights_advisory: Number(personRow.rights_advisory || 0),
                constitution_provision: Number(personRow.constitution_provision || 0),
                agency_circular: Number(personRow.agency_circular || 0),
                doj_issuance: Number(personRow.doj_issuance || 0),
                executive_issuance: Number(personRow.executive_issuance || 0),
                city_ordinance_section: Number(personRow.city_ordinance_section || 0)
              };
            } else if (personName === 'Delos Cientos') {
              console.warn('No personRow found for Delos Cientos on day', currentDayIndex);
            }
            
            // Calculate cumulative quotas with proper carryover logic
            const { getCumulativeCount } = require('./lib/plan/progressStore');
            const { getPlanDate, toISODate } = require('./lib/plan/planLoader');
            const todayISO = toISODate(getPlanDate(new Date()));
            
            // Get time window bounds first
            const { start, end } = require('./lib/plan/planLoader').getPlanWindowBounds(new Date());
            
            // Start with current day's requirements
            const cumulativeReqs = { ...currentDayReqs };
            
            // Always apply carryover logic since we're always viewing current day
            const isViewingCurrentDay = true;
            
            // Count entries based on what day we're viewing
            const allPreviousEntries = {};
            const todayEntries = {};
            
            
            
            (entries || []).forEach((e) => {
              const created = e.created_at ? new Date(e.created_at) : null;
              if (!created) return;
              
              // SECURITY: Only count entries based on their CREATION date, not update date
              // This prevents quota manipulation through entry updates
              // The created_at field is immutable and represents when the entry was first created
              
              // Check multiple fields to match the user
              const matchesUser = (
                (e.created_by && String(e.created_by) === String(member.id)) ||
                (e.team_member_id && String(e.team_member_id) === String(member.id)) ||
                (e.created_by_name && String(e.created_by_name).toLowerCase() === String(personName).toLowerCase()) ||
                (e.created_by_username && String(e.created_by_username).toLowerCase() === String(personName).toLowerCase())
              );
              
              
              if (matchesUser) {
                // Determine which plan day this entry belongs to based on CREATION date only
                const entryDayIndex = computeDayIndex(created, day1Date);
                
                
                // Count entries based on their CREATION day only
                // Updates to entries do NOT affect progress calculation
                if (entryDayIndex < currentDayIndex) {
                  allPreviousEntries[e.type] = (allPreviousEntries[e.type] || 0) + 1;
                } else if (entryDayIndex === currentDayIndex) {
                  todayEntries[e.type] = (todayEntries[e.type] || 0) + 1;
                }
              }
            });
            
            // Calculate the actual quota for the most recent previous day (base + cumulative missing)
            const mostRecentPrevDay = currentDayIndex - 1;
            if (mostRecentPrevDay >= 1) {
              // Get the base quota for the most recent previous day
              const prevDayRows = rowsForDay(planRows, mostRecentPrevDay);
              const prevPersonRow = prevDayRows.find((r) => String(r.Person || '').trim().toUpperCase() === String(personPlanCode).trim().toUpperCase());
              
              if (prevPersonRow) {
                let prevDayActualQuota = {
                  statute_section: Number(prevPersonRow.statute_section || 0),
                  rule_of_court: Number(prevPersonRow.rule_of_court || 0),
                  rights_advisory: Number(prevPersonRow.rights_advisory || 0),
                  constitution_provision: Number(prevPersonRow.constitution_provision || 0),
                  agency_circular: Number(prevPersonRow.agency_circular || 0),
                  doj_issuance: Number(prevPersonRow.doj_issuance || 0),
                  executive_issuance: Number(prevPersonRow.executive_issuance || 0),
                  city_ordinance_section: Number(prevPersonRow.city_ordinance_section || 0)
                };

                // Add missing quotas from all days before the most recent previous day
                for (let prevDay = 1; prevDay < mostRecentPrevDay; prevDay++) {
              const prevDayRows = rowsForDay(planRows, prevDay);
              const prevPersonRow = prevDayRows.find((r) => String(r.Person || '').trim().toUpperCase() === String(personPlanCode).trim().toUpperCase());
              
              if (prevPersonRow) {
                const prevDayReqs = {
                  statute_section: Number(prevPersonRow.statute_section || 0),
                  rule_of_court: Number(prevPersonRow.rule_of_court || 0),
                  rights_advisory: Number(prevPersonRow.rights_advisory || 0),
                  constitution_provision: Number(prevPersonRow.constitution_provision || 0),
                  agency_circular: Number(prevPersonRow.agency_circular || 0),
                  doj_issuance: Number(prevPersonRow.doj_issuance || 0),
                  executive_issuance: Number(prevPersonRow.executive_issuance || 0),
                  city_ordinance_section: Number(prevPersonRow.city_ordinance_section || 0)
                };
                
                    // Count entries for this previous day (based on CREATION date only)
                    const prevDayEntries = {};
                    (entries || []).forEach((e) => {
                      const created = e.created_at ? new Date(e.created_at) : null;
                      if (!created) return;

                      const matchesUser = (
                        (e.created_by && String(e.created_by) === String(member.id)) ||
                        (e.team_member_id && String(e.team_member_id) === String(member.id)) ||
                        (e.created_by_name && String(e.created_by_name).toLowerCase() === String(personName).toLowerCase()) ||
                        (e.created_by_username && String(e.created_by_username).toLowerCase() === String(personName).toLowerCase())
                      );

                      if (matchesUser) {
                        const entryDayIndex = computeDayIndex(created, day1Date);
                        if (entryDayIndex === prevDay) {
                          prevDayEntries[e.type] = (prevDayEntries[e.type] || 0) + 1;
                        }
                      }
                    });

                    // Add missing quotas and subtract excess entries from this previous day
                    Object.keys(prevDayReqs).forEach(type => {
                      const prevQuota = prevDayReqs[type] || 0;
                      const prevCompleted = prevDayEntries[type] || 0;
                      
                  if (prevQuota > 0) {
                        const missing = Math.max(0, prevQuota - prevCompleted);
                        prevDayActualQuota[type] = (prevDayActualQuota[type] || 0) + missing;
                        
                        // If there were excess entries, subtract them from the actual quota
                        if (prevCompleted > prevQuota) {
                          const excess = prevCompleted - prevQuota;
                          prevDayActualQuota[type] = Math.max(0, prevDayActualQuota[type] - excess);
                        }
                      } else if (prevCompleted > 0) {
                        // This entry type had no quota in previous day but entries were made
                        // These excess entries should reduce the actual quota if this type is in today's quota
                        if (prevDayActualQuota[type] && prevDayActualQuota[type] > 0) {
                          prevDayActualQuota[type] = Math.max(0, prevDayActualQuota[type] - prevCompleted);
                }
              }
            });
                  }
                }
            
                // Count entries for the most recent previous day (based on CREATION date only)
                const prevDayEntries = {};
            (entries || []).forEach((e) => {
              const created = e.created_at ? new Date(e.created_at) : null;
              if (!created) return;
              
              const matchesUser = (
                (e.created_by && String(e.created_by) === String(member.id)) ||
                (e.team_member_id && String(e.team_member_id) === String(member.id)) ||
                (e.created_by_name && String(e.created_by_name).toLowerCase() === String(personName).toLowerCase()) ||
                (e.created_by_username && String(e.created_by_username).toLowerCase() === String(personName).toLowerCase())
              );
              
              if (matchesUser) {
                const entryDayIndex = computeDayIndex(created, day1Date);
                    if (entryDayIndex === mostRecentPrevDay) {
                      prevDayEntries[e.type] = (prevDayEntries[e.type] || 0) + 1;
                    }
                  }
                });

                // Calculate missing from the most recent previous day using the actual quota
                Object.keys(prevDayActualQuota).forEach(type => {
                  const prevQuota = prevDayActualQuota[type] || 0;
                  const prevCompleted = prevDayEntries[type] || 0;
                  
                  if (prevQuota > 0) {
                    const missing = Math.max(0, prevQuota - prevCompleted);
                    if (missing > 0) {
                      cumulativeReqs[type] = (cumulativeReqs[type] || 0) + missing;
                }
              }
            });
              }
            }
            
            // Store original quotas before carryover adjustments for display purposes
            const originalQuotas = { ...cumulativeReqs };
            console.log('DEBUG: Original quotas before carryover:', originalQuotas);
            
            // Subtract excess entries from previous days from current day's quota
            Object.keys(allPreviousEntries).forEach(type => {
              if (cumulativeReqs[type] && cumulativeReqs[type] > 0) {
                // This entry type is in today's quota
                const previousEntries = allPreviousEntries[type] || 0;
                
                // Calculate how many days of quota these previous entries should cover
                // For each previous day, check if this entry type was part of the quota
                let totalPreviousQuota = 0;
                for (let prevDay = 1; prevDay < currentDayIndex; prevDay++) {
                  const prevDayRows = rowsForDay(planRows, prevDay);
                  const prevPersonRow = prevDayRows.find((r) => String(r.Person || '').trim().toUpperCase() === String(personPlanCode).trim().toUpperCase());
                  
                  if (prevPersonRow) {
                    const prevDayQuota = Number(prevPersonRow[type] || 0);
                    totalPreviousQuota += prevDayQuota;
                  }
                }
                
                // If previous entries exceed the total previous quota, subtract the excess from today's quota
                if (previousEntries > totalPreviousQuota) {
                  const excess = previousEntries - totalPreviousQuota;
                  const oldQuota = cumulativeReqs[type];
                  cumulativeReqs[type] = Math.max(0, cumulativeReqs[type] - excess);
                  console.log(`DEBUG: Carryover for ${type} - previousEntries: ${previousEntries}, totalPreviousQuota: ${totalPreviousQuota}, excess: ${excess}, oldQuota: ${oldQuota}, newQuota: ${cumulativeReqs[type]}`);
                }
              }
            });
            
            // Don't add extra quota types - only carry over missing amounts from existing quota types
            
            const totalReq = Object.values(cumulativeReqs).reduce((sum, quota) => sum + (Number(quota) || 0), 0);
            
            
            // Calculate progress counts for each quota type
            const flexibleCounts = {};
            const carryoverEntries = {};
            
            // Initialize counts for all quota types
            Object.keys(cumulativeReqs).forEach(type => {
              flexibleCounts[type] = 0;
            });
            
            // Count entries that match quota types
            console.log('DEBUG: todayEntries:', todayEntries);
            console.log('DEBUG: cumulativeReqs after carryover:', cumulativeReqs);
            
            // First, handle entry types that have entries today
            Object.keys(todayEntries).forEach(type => {
              const originalQuota = originalQuotas[type];
              
              if (originalQuota && originalQuota > 0) {
                // This entry type was in today's original quota
                if (cumulativeReqs[type] === 0) {
                  // Adjusted quota is 0, meaning we completed the quota via carryover
                  flexibleCounts[type] = originalQuota;
                  console.log(`DEBUG: ${type} - originalQuota: ${originalQuota}, cumulativeReqs: ${cumulativeReqs[type]}, todayEntries: ${todayEntries[type]}, setting flexibleCounts to: ${originalQuota}`);
                } else {
                  // Show progress against the original quota
                  flexibleCounts[type] = Math.min(todayEntries[type], originalQuota);
                  console.log(`DEBUG: ${type} - originalQuota: ${originalQuota}, cumulativeReqs: ${cumulativeReqs[type]}, todayEntries: ${todayEntries[type]}, setting flexibleCounts to: ${Math.min(todayEntries[type], originalQuota)}`);
                }
              } else {
                // This entry type is not in today's quota - it's carryover (yellow pill)
                carryoverEntries[type] = todayEntries[type];
                console.log(`DEBUG: ${type} - not in today's quota, adding to carryover: ${todayEntries[type]}`);
              }
            });
            
            // Then, handle entry types that were in original quota but have no entries today (satisfied via carryover)
            Object.keys(originalQuotas).forEach(type => {
              const originalQuota = originalQuotas[type];
              if (originalQuota && originalQuota > 0 && !todayEntries[type]) {
                // This entry type was in today's original quota but has no entries today
                if (cumulativeReqs[type] === 0) {
                  // Adjusted quota is 0, meaning we completed the quota via carryover
                  flexibleCounts[type] = originalQuota;
                  console.log(`DEBUG: ${type} - no entries today, but quota satisfied via carryover, setting flexibleCounts to: ${originalQuota}`);
                } else {
                  // Show 0 progress against the original quota
                  flexibleCounts[type] = 0;
                  console.log(`DEBUG: ${type} - no entries today, showing 0 progress`);
                }
              }
            });
            
            // Add previous day entries that are NOT part of today's quota to carryover display
            Object.keys(allPreviousEntries).forEach(type => {
              if (!cumulativeReqs[type] || cumulativeReqs[type] === 0) {
                // Only add to carryover if this entry type was never part of today's quota
                // If it was part of today's quota but satisfied via carryover, don't show as carryover
                if (!originalQuotas[type] || originalQuotas[type] === 0) {
                  // This entry type from previous days is not in today's quota - it's carryover (yellow pill)
                  carryoverEntries[type] = (carryoverEntries[type] || 0) + allPreviousEntries[type];
                }
              }
            });
            
            const totalDone = Object.values(flexibleCounts).reduce((s, n) => s + (Number(n) || 0), 0);
            
            
            // Check if this user has incomplete entries from yesterday
            const userHasIncompleteEntries = incompleteEntries.some((incomplete) => 
              incomplete.personId === member.id || 
              incomplete.personName === personName
            );
            
            // Calculate detailed breakdown for hover popup
            
            return (
              <div key={personKey} className="team-member-card">
                <h4>{personName}</h4>
                <div className="member-progress">
                  <span className="progress-count">{totalDone} / {totalReq}</span>
                  <div className="member-progress-bar">
                    <div 
                      className="member-progress-fill" 
                      style={{ width: `${Math.min((totalDone / Math.max(1, totalReq)) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="member-breakdown">
                  {/* Show quota types */}
                  {Object.entries(originalQuotas).filter(([, quota]) => Number(quota) > 0).map(([type, quota]) => {
                    const currentCount = flexibleCounts[type] || 0;
                    const isCompleted = currentCount >= quota;
                    
                    return (
                      <span key={type} className={`quota-item ${isCompleted ? 'completed' : 'pending'}`} style={{
                        display: 'inline-block',
                        background: isCompleted ? '#dcfce7' : '#eef2ff', // Light green if completed, light blue if not
                        color: isCompleted ? '#166534' : '#3730a3', // Green text if completed, blue if not
                        borderRadius: 9999,
                        padding: '2px 8px',
                        marginRight: 6,
                        marginBottom: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        border: isCompleted ? '1px solid #16a34a' : '1px solid #3b82f6' // Green border if completed, blue border if not
                      }}>
                        {type}: {currentCount}/{quota}
                      </span>
                    );
                  })}
                  
                  {/* Show carryover entries with yellow background */}
                  {Object.entries(carryoverEntries).filter(([, count]) => count > 0).map(([type, count]) => (
                    <span key={`carryover-${type}`} className="carryover-item" style={{
                      display: 'inline-block',
                      background: '#fef3c7', // Yellow background
                      color: '#1e40af', // Blue text
                      borderRadius: 9999,
                      padding: '2px 8px',
                      marginRight: 6,
                      marginBottom: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      border: '1px solid #f59e0b' // Yellow border
                    }}>
                      {type}: {count}/-
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {currentView !== 'form' && (
      <nav className="App-nav">
        <div className="nav-left">
          <button 
            onClick={handleCreateNew} 
            className="btn-primary"
            disabled={currentView === 'form' || !hasPlan}
          >
            Create New Entry
          </button>
        </div>
        
         <div className="nav-right">
           <button onClick={() => setShowChat(true)} className="btn-secondary" style={{ whiteSpace: 'nowrap' }}>
             Ask Villy (RAG)
           </button>
           <button onClick={handleExport} className="btn-secondary" style={{ whiteSpace: 'nowrap' }}>
             Export Entries
           </button>
           {/* For P5: Import Entries and Clear All Entries in nav-right (Row 2) */}
           {isTagarao(user) && (
             <>
               <label className="btn-secondary" style={{ whiteSpace: 'nowrap' }}>
                 Import Entries
                 <input 
                   type="file" 
                   accept=".json" 
                   onChange={handleImport} 
                   style={{ display: 'none' }}
                 />
               </label>
               <button onClick={handleClearAll} className="btn-danger" style={{ whiteSpace: 'nowrap' }}>
                 Clear All Entries
               </button>
             </>
           )}
         </div>
        
         {/* P1-P4 users: Expanded Import Entries button in mobile (Row 3) */}
         {!isTagarao(user) && (
           <div className="nav-import-expanded">
             <label className="btn-secondary btn-import-expanded">
               Import Entries
               <input 
                 type="file" 
                 accept=".json" 
                 onChange={handleImport} 
                 style={{ display: 'none' }}
               />
             </label>
           </div>
         )}
      </nav>
      )}

      <main className="App-main">
        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {currentView === 'list' && (
                  <EntryList
          entries={entries}
          onViewEntry={handleViewEntry}
          onEditEntry={handleEditEntry}
          onDeleteEntry={handleDeleteEntry}
          searchEntries={searchEntries}
          teamMemberNames={teamMemberNames}
        />
        )}

        {currentView === 'form' && (
          <>
            {console.log('Rendering EntryForm with editingEntry:', editingEntry)}
            <EntryForm
              entry={editingEntry}
              existingEntries={entries}
              onSave={handleSaveEntry}
              onCancel={handleBackToList}
              onShowIncompleteEntriesModal={showIncompleteEntriesModalWithEntry}
            />
          </>
        )}

        {currentView === 'view' && selectedEntryId && (
          <EntryView
            entry={getEntryById(selectedEntryId)}
            onEdit={() => handleEditEntry(selectedEntryId)}
            onDelete={() => handleDeleteEntry(selectedEntryId)}
            teamMemberNames={teamMemberNames}
          />
        )}
      </main>


      
      {/* Confetti Effect */}
      <Confetti 
        show={showConfetti} 
        onComplete={() => setShowConfetti(false)} 
      />
      
      {/* Clear Modal */}
      <Modal 
        isOpen={showClearModal} 
        onClose={handleClearCancel}
        title={clearModalStep === 1 ? "Choose clear option" : 
               clearOption === 'all' ? "You are deleting all law entries IN THE ENTIRE DATABASE." :
               "You are deleting all law entries for TODAY."}
        subtitle={clearModalStep === 2 ? "Would you like to continue?" : null}
      >
        {clearModalStep === 1 ? (
          <div className="modal-options">
            <button 
              className="modal-option" 
              onClick={() => handleClearOptionSelect('today')}
            >
              Today
            </button>
            <button 
              className="modal-option" 
              onClick={() => handleClearOptionSelect('all')}
            >
              All
            </button>
            <button 
              className="modal-option cancel" 
              onClick={handleClearCancel}
            >
              Go Back
            </button>
          </div>
        ) : (
          <div className="modal-buttons">
            <button 
              className="modal-button danger" 
              onClick={handleClearConfirm}
            >
              Yes
            </button>
            <button 
              className="modal-button cancel" 
              onClick={handleClearCancel}
            >
              No
            </button>
          </div>
        )}
      </Modal>

      {/* Resume Draft Modal */}
      <Modal
        isOpen={showResumeModal}
        onClose={() => setShowResumeModal(false)}
        title={"Previous Session Found"}
        subtitle={"Would you like to continue inputting?"}
      >
        <div className="modal-buttons">
          <button
            className="modal-button orange-outline"
            onClick={handleResumeYes}
          >
            Yes, continue inputting
          </button>
          <button
            className="modal-button cancel"
            onClick={handleResumeNo}
          >
            No, create new entry
          </button>
        </div>
      </Modal>

      {/* Plan Import Modal removed */}

      {/* Logout Confirmation Modal */}
      <Modal
        isOpen={showLogoutModal}
        onClose={handleLogoutCancel}
        title="Confirm Logout"
        subtitle="Are you sure you want to logout?"
      >
        <div className="modal-buttons">
          <button
            className="modal-button logout"
            onClick={handleLogoutConfirm}
          >
            Yes, Logout
          </button>
          <button
            className="modal-button cancel"
            onClick={handleLogoutCancel}
          >
            Cancel
          </button>
        </div>
      </Modal>

      {/* Incomplete Entries Modal */}
      <Modal
        isOpen={showIncompleteEntriesModal}
        onClose={handleIncompleteEntriesModalCancel}
        title="You have unfinished quotas from yesterday"
        subtitle={pendingEntryForModal ? `"${pendingEntryForModal.title}" (${pendingEntryForModal.type}) will be credited to missing progress` : "New entry will be credited to missing progress"}
      >
        <div className="modal-buttons">
          <button
            className="modal-button orange"
            onClick={handleIncompleteEntriesModalOK}
          >
            I understand
          </button>
          <button
            className="modal-button orange-outline"
            onClick={handleIncompleteEntriesModalCancel}
          >
            Cancel
          </button>
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => {}} // Prevent closing until auto-close
        title="Entry Created Successfully!"
        subtitle={pendingEntryForModal ? 
          (pendingEntryForModal.created_at && new Date(pendingEntryForModal.created_at).getDate() !== new Date().getDate() ? 
            `"${pendingEntryForModal.title}" has been saved and credited to yesterday's progress.` : 
            `"${pendingEntryForModal.title}" has been saved successfully.`) : 
          "Entry has been saved successfully."}
      >
        <div className="modal-buttons">
          <button
            className="modal-button orange"
            disabled
            style={{ opacity: 0.6, cursor: 'not-allowed' }}
          >
            Auto-closing in 2 seconds...
          </button>
        </div>
      </Modal>

      {/* Delete Entry Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={handleDeleteCancel}
        title="Delete Entry"
        subtitle={entryToDelete ? `Are you sure you want to delete "${entryToDelete.title}"?` : "Are you sure you want to delete this entry?"}
      >
        <div className="modal-buttons">
          <button
            className="modal-button danger"
            onClick={handleDeleteConfirm}
          >
            Yes, Delete
          </button>
          <button
            className="modal-button cancel"
            onClick={handleDeleteCancel}
          >
            Cancel
          </button>
        </div>
      </Modal>

      {/* Chat Modal (RAG) */}
      <ChatModal isOpen={showChat} onClose={() => setShowChat(false)} />
    </div>
  );
}

export default App;

