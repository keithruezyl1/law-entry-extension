import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import './App.css';
import { useLocalStorage } from './hooks/useLocalStorage';
import { getAllTeamMembers } from './data/entryTypes';
import EntryForm from './components/kb/EntryForm.tsx'; // new TS + RHF + Zod wizard
import EntryList from './components/EntryList/EntryList';
import EntryView from './components/EntryView/EntryView';
import Confetti from './components/Confetti/Confetti';
import Modal from './components/Modal/Modal';
import { upsertEntry } from './services/vectorApi';

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

function AppContent() {
  const [currentView, setCurrentView] = useState('list'); // 'list', 'form', 'view'
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearModalStep, setClearModalStep] = useState(1);
  const [clearOption, setClearOption] = useState(null);
  const [headerOpacity, setHeaderOpacity] = useState(1);
  
  const location = useLocation();
  
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

  const stats = getStorageStats();
  const teamProgress = getAllTeamProgress();
  const yesterdayProgress = getYesterdayTeamProgress();
  const teamMembers = getAllTeamMembers();

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

  // Check yesterday's completion status
  const getYesterdayStatus = () => {
    const incompleteMembers = [];
    let allCompleted = true;
    
    for (let i = 1; i <= 5; i++) {
      const progress = yesterdayProgress[i]?.total || 0;
      if (progress < 10) {
        allCompleted = false;
        incompleteMembers.push(`P${i}`);
      }
    }
    
    if (allCompleted) {
      return { text: "ALL COMPLETED", completed: true };
    } else {
      return { text: `INCOMPLETE ENTRIES: ${incompleteMembers.join(', ')}`, completed: false };
    }
  };

  const handleCreateNew = () => {
    setEditingEntry(null);
    setCurrentView('form');
  };

  const handleEditEntry = (entryId) => {
    const entry = getEntryById(entryId);
    setEditingEntry(entry);
    setCurrentView('form');
  };

  const handleViewEntry = (entryId) => {
    setSelectedEntryId(entryId);
    setCurrentView('view');
  };

  const handleSaveEntry = async (entryData) => {
    try {
      if (editingEntry) {
        updateEntry(editingEntry.id, entryData);
        console.log('Entry updated:', entryData);
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
        // Fire-and-forget vector upsert (no hard failure for UX)
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
            const resp = await upsertEntry(payload);
            if (!resp.success) {
              console.warn('Vector upsert failed:', resp.error);
            }
          }
        } catch (e) {
          console.warn('Vector upsert error:', e);
        }
        alert(`Entry "${entryData.title}" has been successfully saved to localStorage!`);
      }
      setCurrentView('list');
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
          setCurrentView('list');
          setSelectedEntryId(null);
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
    setShowClearModal(true);
    setClearModalStep(1);
    setClearOption(null);
  };

  const handleGoBack = () => {
    if (currentView === 'list') {
      // If already on list view, could go to a previous page or show a menu
      alert('Go back functionality would be implemented here');
    } else {
      // Go back to list view
      setCurrentView('list');
      setSelectedEntryId(null);
      setEditingEntry(null);
    }
  };

  const handleClearOptionSelect = (option) => {
    setClearOption(option);
    setClearModalStep(2);
  };

  const handleClearConfirm = () => {
    try {
      if (clearOption === 'all') {
        clearAllEntries();
        alert('All entries have been cleared from the database.');
      } else {
        const today = new Date().toISOString().split('T')[0];
        const todayEntries = entries.filter(entry => {
          const entryDate = new Date(entry.created_at).toISOString().split('T')[0];
          return entryDate === today;
        });
        todayEntries.forEach(entry => { deleteEntry(entry.id); });
        alert(`${todayEntries.length} entries from today have been cleared.`);
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

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedEntryId(null);
    setEditingEntry(null);
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
        <button onClick={handleGoBack} className="go-back-btn">
          Go Back
        </button>
        <div className="header-content">
          <h1>Civilify Law Entry</h1>
          <div className="header-stats">
            <span>{stats.totalEntries} entries</span>
            <span>{stats.offlinePackEntries} in offline pack</span>
          </div>
        </div>
        <div></div> {/* Empty div for flex spacing */}
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
          <h3>Today's Team Progress</h3>
          <div className="yesterday-status">
            <div className="status-indicator">
              <div className={`status-circle ${getYesterdayStatus().completed ? 'completed' : 'incomplete'}`}></div>
              <strong>Yesterday:</strong> {getYesterdayStatus().text}
            </div>
          </div>
        </div>
        <div className="team-members-grid">
          {teamMembers.map(member => (
            <div key={member.id} className="team-member-card">
              <h4>{member.name}</h4>
              <p>{member.description}</p>
              <div className="member-progress">
                <span className="progress-count">{teamProgress[member.id]?.total || 0} / 10</span>
                <div className="member-progress-bar">
                  <div 
                    className="member-progress-fill" 
                    style={{ width: `${Math.min(((teamProgress[member.id]?.total || 0) / 10) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
              <div className="member-breakdown">
                {Object.entries(member.dailyQuota).map(([type, quota]) => (
                  <span key={type} className="quota-item">
                    {type}: {teamProgress[member.id]?.[type] || 0}/{quota}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {currentView !== 'form' && (
      <nav className="App-nav">
        <div className="nav-left">
          <button 
            onClick={handleCreateNew} 
            className="btn-primary"
            disabled={currentView === 'form'}
          >
            Create New Entry
          </button>
        </div>
        

        
        <div className="nav-right">
          <button onClick={handleExport} className="btn-secondary">
            Export
          </button>
          <label className="btn-secondary">
            Import
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImport} 
              style={{ display: 'none' }}
            />
          </label>
          <button onClick={handleClearAll} className="btn-danger">
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
          <EntryForm
            entry={editingEntry}
            existingEntries={entries}
            onSave={handleSaveEntry}
            onCancel={handleBackToList}
          />
        )}

        {currentView === 'view' && selectedEntryId && (
          <EntryView
            entry={getEntryById(selectedEntryId)}
            onEdit={() => handleEditEntry(selectedEntryId)}
            onDelete={() => handleDeleteEntry(selectedEntryId)}
            onBack={handleBackToList}
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
    </div>
  );
}

export default App;
