import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import './App.css';
import { useLocalStorage } from './hooks/useLocalStorage';
import { getAllTeamMembers } from './data/entryTypes';
import EntryForm from './components/kb/EntryForm.tsx'; // new TS + RHF + Zod wizard
import EntryList from './components/EntryList/EntryList';
import EntryView from './components/EntryView/EntryView';
import Login from './components/Login/Login';
import Confetti from './components/Confetti/Confetti';
import Modal from './components/Modal/Modal';
import { parseWorkbook, computeDayIndex, rowsForDay, toISODate } from './lib/plan/planLoader';
import { format } from 'date-fns';
import { getDay1Date, setDay1Date } from './lib/plan/progressStore';
import { upsertEntry, deleteEntryVector, clearEntriesVector } from './services/vectorApi';
import { fetchAllEntriesFromDb } from './services/kbApi';
import ChatModal from './components/kb/ChatModal';
import { DuplicateModal } from './components/kb/DuplicateModal';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/law-entry/:step" element={<LawEntryForm />} />
        <Route path="/entry/:entryId" element={<EntryDetails />} />
        <Route path="/entry/:entryId/edit" element={<EntryEdit />} />
        <Route path="*" element={<Login />} />
      </Routes>
    </Router>
  );
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
  
  const [currentView, setCurrentView] = useState(initialView);
  const [selectedEntryId, setSelectedEntryId] = useState(initialEntryId);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearModalStep, setClearModalStep] = useState(1);
  const [clearOption, setClearOption] = useState(null);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeDraft, setResumeDraft] = useState(null);
  const [headerOpacity, setHeaderOpacity] = useState(1);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planModalStep, setPlanModalStep] = useState(1);
  const [selectedDay1Date, setSelectedDay1Date] = useState('');
  const [planData, setPlanData] = useState(() => {
    try {
      const raw = localStorage.getItem('kb_plan_rows');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return null;
  });
  const [day1Date, setDay1DateState] = useState(getDay1Date());
  const [showChat, setShowChat] = useState(false);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateEntries, setDuplicateEntries] = useState([]);
  const [duplicateModalTitle, setDuplicateModalTitle] = useState('Duplicates Found');
  const [duplicateModalSubtitle, setDuplicateModalSubtitle] = useState('');
  const [duplicateModalButtonText, setDuplicateModalButtonText] = useState('I understand');

  const hasPlan = (() => {
    const d1 = day1Date || getDay1Date();
    let rows = planData;
    if (!rows) {
      try {
        const raw = localStorage.getItem('kb_plan_rows');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) rows = parsed;
        }
      } catch (_) {}
    }
    return !!d1 && Array.isArray(rows) && rows.length > 0;
  })();

  // Guard: prevent opening the form route when no plan is imported
  useEffect(() => {
    if (currentView === 'form' && !hasPlan) {
      alert('Please import a plan first before creating entries.');
      navigate('/dashboard');
    }
  }, [currentView, hasPlan, navigate]);
  
  // Load persisted plan rows on mount (in case state initializer missed it)
  useEffect(() => {
    try {
      if (!planData) {
        const raw = localStorage.getItem('kb_plan_rows');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) setPlanData(parsed);
        }
      }
    } catch (_) {}
  }, [planData]);

  // Optional: On dashboard load, hydrate local entries from DB (one-way sync-in)
  useEffect(() => {
    const loadFromDb = async () => {
      if (currentView !== 'list') return;
      try {
        const dbEntries = await fetchAllEntriesFromDb();
        if (Array.isArray(dbEntries) && dbEntries.length > 0) {
          // Map DB shape to app shape (add synthetic id if missing)
          const mapped = dbEntries.map((e) => ({
            ...e,
            id: e.entry_id,
            created_at: e.created_at || new Date().toISOString(),
            updated_at: e.updated_at || new Date().toISOString(),
          }));
          // Merge: prefer local entries with same entry_id
          const existingByEntryId = new Map(entries.map((x) => [x.entry_id, x]));
          const merged = mapped.reduce((acc, m) => {
            if (!existingByEntryId.has(m.entry_id)) acc.push(m);
            return acc;
          }, [...entries]);
          if (merged.length !== entries.length) {
            // naive set via importEntries pathway
            try {
              localStorage.setItem('law_entries', JSON.stringify(merged));
            } catch {}
          }
        }
      } catch {}
    };
    loadFromDb();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

  // Redirect to login if on root path (this is now handled by the router)
  // The login component will handle redirecting to dashboard after authentication
  
  const {
    entries,
    loading,
    error,
    addEntry,
    updateEntry,
    deleteEntry,
    getEntryById,
    searchEntries,
    exportEntries,
    importEntries,
    clearAllEntries,
    getStorageStats,
    getAllTeamProgress,
    getYesterdayTeamProgress,
    checkDailyCompletion
  } = useLocalStorage();

  // Handle initial entry loading for view/edit
  useEffect(() => {
    if (initialEntryId && (currentView === 'view' || isEditing) && !loading) {
      console.log('Looking for entry with ID:', initialEntryId);
      console.log('Current entries:', entries);
      console.log('Entries length:', entries.length);
      console.log('Loading state:', loading);
      
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
  const teamMembers = getAllTeamMembers();

  // Debug: Log entries state
  console.log('Current entries in App.js:', entries);
  console.log('Entries length:', entries.length);

  // Team member names mapping for P1-P5 format
  const teamMemberNames = {
    'P1': 'Arda',
    'P2': 'Delos Cientos', 
    'P3': 'Paden',
    'P4': 'Sendrijas',
    'P5': 'Tagarao'
  };

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
  const getYesterdayStatus = () => {
    const incompleteMembers = [];
    let allCompleted = true;
    let someCompleted = false;
    
    for (let i = 1; i <= 5; i++) {
      const yesterdayTotal = yesterdayProgress[i]?.total || 0;
      const todayTotal = teamProgress[i]?.total || 0;
      
      // Calculate total progress including today's carryover
      const totalProgress = yesterdayTotal + todayTotal;
      
      if (totalProgress < 10) {
        allCompleted = false;
        const memberName = teamMembers.find(m => m.id === i)?.name || `P${i}`;
        incompleteMembers.push(memberName);
      } else {
        someCompleted = true;
      }
    }
    
    if (allCompleted) {
      return { 
        text: "ALL COMPLETED", 
        completed: true, 
        status: 'completed' // green
      };
    } else if (someCompleted) {
      return { 
        text: `INCOMPLETE ENTRIES: ${incompleteMembers.join(', ')}`, 
        completed: false, 
        status: 'partial' // orange
      };
    } else {
      return { 
        text: `INCOMPLETE ENTRIES: ${incompleteMembers.join(', ')}`, 
        completed: false, 
        status: 'incomplete' // red
      };
    }
  };

  const handleCreateNew = () => {
    if (!hasPlan) {
      alert('Please import a plan first before creating entries. Use "Import Plan".');
      return;
    }
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
    navigate('/law-entry/1');
  };

  const handleResumeYes = () => {
    setEditingEntry(resumeDraft || null);
    setShowResumeModal(false);
    navigate('/law-entry/1');
  };

  const handleResumeNo = () => {
    try { localStorage.removeItem('kb_entry_draft'); } catch (_) {}
    setResumeDraft(null);
    setShowResumeModal(false);
    setEditingEntry(null);
    navigate('/law-entry/1');
  };

  const handleEditEntry = (entryId) => {
    console.log('handleEditEntry called with entryId:', entryId);
    console.log('Entry type:', typeof entryId);
    navigate(`/entry/${entryId}/edit`);
  };

  const handleViewEntry = (entryId) => {
    navigate(`/entry/${entryId}`);
  };

  const handleSaveEntry = (entryData) => {
    try {
      if (editingEntry) {
        updateEntry(editingEntry.id, entryData);
        console.log('Entry updated:', entryData);
        // Fire-and-forget vector upsert to keep RAG index in sync
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
            };
            upsertEntry(payload).then((resp) => {
              if (!resp?.success) console.warn('Vector upsert failed:', resp?.error);
            }).catch((e) => console.warn('Vector upsert error:', e));
          }
        } catch (e) {
          console.warn('Vector upsert error:', e);
        }
      } else {
        // Check if this entry will complete a daily quota
        if (entryData.team_member_id && entryData.type) {
          const willComplete = checkDailyCompletion(entryData.team_member_id, entryData.type);
          if (willComplete) {
            setShowConfetti(true);
          }
        }
        const newEntry = addEntry(entryData);
        console.log('New entry created and saved to localStorage:', newEntry);
        console.log('Total entries in localStorage:', entries.length + 1);
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
            };
            upsertEntry(payload).then((resp) => {
              if (!resp?.success) console.warn('Vector upsert failed:', resp?.error);
            }).catch((e) => console.warn('Vector upsert error:', e));
          }
        } catch (e) {
          console.warn('Vector upsert error:', e);
        }
        alert(`Entry "${entryData.title}" has been successfully saved to localStorage!`);
      }
      try { localStorage.removeItem('kb_entry_draft'); } catch (_) {}
      setEditingEntry(null);
    } catch (err) {
      console.error('Error saving entry:', err);
      alert('Failed to save entry. Please try again.');
    }
  };

  const handleDeleteEntry = (entryId) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      try {
        deleteEntry(entryId);
        if (currentView === 'view' && selectedEntryId === entryId) {
          navigate('/dashboard');
          setSelectedEntryId(null);
        }
        // Fire-and-forget vector delete
        if (entryId) {
          deleteEntryVector(entryId).catch((e) => console.warn('Vector delete error:', e));
        }
      } catch (err) {
        console.error('Error deleting entry:', err);
        alert('Failed to delete entry. Please try again.');
      }
    }
  };

  const handleExport = () => {
    try {
      exportEntries();
    } catch (err) {
      console.error('Error exporting entries:', err);
      alert('Failed to export entries. Please try again.');
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const result = await importEntries(e.target.result);
          const { successCount, duplicates } = result;
          
          if (duplicates && duplicates.length > 0) {
            // Show duplicate modal
            setDuplicateEntries(duplicates);
            setDuplicateModalTitle('Duplicates Found');
            setDuplicateModalSubtitle('These entries already exist:');
            setDuplicateModalButtonText('I understand');
            setDuplicateModalOpen(true);
          }
          
          alert(`Successfully imported ${successCount} entries.`);
        } catch (err) {
          console.error('Error importing entries:', err);
          alert('Failed to import entries. Please check the file format.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleClearAll = () => {
    setShowClearModal(true);
    setClearModalStep(1);
    setClearOption(null);
  };

  const handleGoBack = () => {
    navigate('/login');
  };

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

  const handleImportPlan = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseWorkbook(buf);
      setPlanData(parsed);
      setShowPlanModal(true);
      setPlanModalStep(1);
    } catch (e) {
      alert('Failed to parse Excel file. Please check the file format.');
    }
  };

  const handleDay1Confirm = () => {
    if (!selectedDay1Date) {
      alert('Please select a Day 1 date.');
      return;
    }
    setPlanModalStep(2);
  };

  const handlePlanFinalConfirm = () => {
    if (day1Date && !window.confirm('Reimporting a new plan will reset all progress. Are you sure?')) {
      return;
    }
    
    setDay1Date(selectedDay1Date);
    setDay1DateState(selectedDay1Date);
    // Persist plan rows so they survive refreshes
    try {
      if (planData) localStorage.setItem('kb_plan_rows', JSON.stringify(planData));
    } catch (_) {}
    setShowPlanModal(false);
    setPlanModalStep(1);
    setSelectedDay1Date('');
  };

  const handlePlanCancel = () => {
    setShowPlanModal(false);
    setPlanModalStep(1);
    setSelectedDay1Date('');
    setPlanData(null);
  };

  const handleRemovePlan = () => {
    if (!window.confirm('Remove the imported plan and Day 1 setting? This will not delete your saved entries.')) return;
    try {
      localStorage.removeItem('kb_plan_rows');
    } catch (_) {}
    try {
      // also clear saved Day 1
      localStorage.removeItem('kbprog:day1');
    } catch (_) {}
    setPlanData(null);
    setDay1DateState(null);
  };

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
      {currentView !== 'form' && (
      <header className="App-header" style={{ 
        background: `linear-gradient(135deg, rgba(255, 140, 66, ${headerOpacity}) 0%, rgba(255, 107, 53, ${headerOpacity}) 100%)`
      }}>
        <div className="header-left">
          <h1>Civilify Law Entry</h1>
          <span className="header-entries-count">{stats.totalEntries} entries</span>
        </div>
        <button onClick={handleGoBack} className="logout-btn">
          Logout
        </button>
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
          <h3>Today's Team Progress {day1Date && Array.isArray(planData) && planData.length > 0 && (
            <span style={{ color: '#6b7280', fontWeight: 500, marginLeft: '8px' }}>{`Day ${computeDayIndex(new Date(), day1Date)}, ${format(new Date(), 'MMMM d yyyy')}`}</span>
          )}</h3>
          <div className="yesterday-status">
            <div className="status-indicator">
              <div className={`status-circle ${getYesterdayStatus().status}`}></div>
              <strong>Yesterday </strong> {getYesterdayStatus().text}
            </div>
          </div>
        </div>
        <div className="team-members-grid">
          {teamMembers.map(member => {
            const personId = member.id;
            const personName = member.name; // Use actual name from data
            
            // Check if plan is imported
            const _hasPlan = !!day1Date && Array.isArray(planData) && planData.length > 0;
            
            if (!_hasPlan) {
              // Show empty card when no plan is imported
              return (
                <div key={personId} className="team-member-card">
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
            let currentDayReqs = member.dailyQuota;
            const today = new Date();
            const dayIndex = computeDayIndex(today, day1Date);
            const dayRows = rowsForDay(planData, dayIndex);
            const personRow = dayRows.find((r) => String(r.Person).trim() === `P${personId}`);
            
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
            }
            
            const totalReq = Object.values(currentDayReqs).reduce((sum, quota) => sum + quota, 0);
            const totalDone = teamProgress[personId]?.total || 0;
            
            return (
              <div key={personId} className="team-member-card">
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
                  {Object.entries(currentDayReqs).filter(([, quota]) => quota > 0).map(([type, quota]) => (
                    <span key={type} className="quota-item">
                      {type}: {teamProgress[personId]?.[type] || 0}/{quota}
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
          <label className="btn-secondary" style={{ whiteSpace: 'nowrap' }}>
            Import Entries
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImport} 
              style={{ display: 'none' }}
            />
          </label>
          <label className="btn-secondary" style={{ whiteSpace: 'nowrap' }}>
            {day1Date && planData ? 'Re-import Plan' : 'Import Plan'}
            <input 
              type="file" 
              accept=".xlsx" 
              onChange={handleImportPlan} 
              style={{ display: 'none' }}
            />
          </label>
          {day1Date && planData && (
            <button onClick={handleRemovePlan} className="btn-secondary" style={{ whiteSpace: 'nowrap' }}>
              Remove Plan
            </button>
          )}
          <button onClick={handleClearAll} className="btn-danger" style={{ whiteSpace: 'nowrap' }}>
            Clear All
          </button>
        </div>
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
            />
          </>
        )}

        {currentView === 'view' && selectedEntryId && (
          <EntryView
            entry={getEntryById(selectedEntryId)}
            onEdit={() => handleEditEntry(selectedEntryId)}
            onDelete={() => handleDeleteEntry(selectedEntryId)}
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
            className="modal-button"
            onClick={handleResumeYes}
          >
            Yes
          </button>
          <button
            className="modal-button cancel"
            onClick={handleResumeNo}
          >
            No, create new entry
          </button>
        </div>
      </Modal>

      {/* Plan Import Modal */}
      <Modal
        isOpen={showPlanModal}
        onClose={handlePlanCancel}
        title={planModalStep === 1 ? "Set Day 1 Date" : "Confirm Plan Import"}
        subtitle={planModalStep === 1 ? "Select the date when your project starts:" : "Reimporting a new plan will reset all progress. Are you sure?"}
      >
        {planModalStep === 1 ? (
          <div className="modal-content">
            <input
              type="date"
              className="border rounded-lg px-3 py-2 w-full mb-4"
              value={selectedDay1Date}
              onChange={(e) => setSelectedDay1Date(e.target.value)}
            />
            <div className="modal-buttons">
              <button className="modal-button" onClick={handleDay1Confirm}>
                Continue
              </button>
              <button className="modal-button cancel" onClick={handlePlanCancel}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="modal-buttons">
            <button className="modal-button" onClick={handlePlanFinalConfirm}>
              Yes, Import Plan
            </button>
            <button className="modal-button cancel" onClick={handlePlanCancel}>
              Cancel
            </button>
          </div>
        )}
      </Modal>

      {/* Chat Modal (RAG) */}
      <ChatModal isOpen={showChat} onClose={() => setShowChat(false)} />
      
      {/* Duplicate Modal */}
      <DuplicateModal
        isOpen={duplicateModalOpen}
        onClose={() => setDuplicateModalOpen(false)}
        duplicates={duplicateEntries}
        title={duplicateModalTitle}
        subtitle={duplicateModalSubtitle}
        buttonText={duplicateModalButtonText}
        showSimilarity={true}
      />
    </div>
  );
}

export default App;
