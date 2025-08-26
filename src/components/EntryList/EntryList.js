import React, { useState, useMemo } from 'react';
import { getEntryTypeOptions } from '../../data/entryTypes';
import { getJurisdictionOptions } from '../../data/jurisdictions';
import EntryView from '../EntryView/EntryView';
// import { getAllTags } from '../../data/tags';
import './EntryList.css';

const EntryList = ({ entries, onViewEntry, onEditEntry, onDeleteEntry, searchEntries }) => {
  const [selectedEntry, setSelectedEntry] = useState(null);
  console.log('EntryList received entries:', entries);
  console.log('EntryList entries length:', entries.length);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [customJurisdiction, setCustomJurisdiction] = useState('');
  const [filters, setFilters] = useState({
    type: 'all',
    jurisdiction: 'all',
    status: 'all',
    team_member_id: 'all'
  });

  const entryTypeOptions = getEntryTypeOptions();
  const jurisdictionOptions = getJurisdictionOptions();
  // const allTags = getAllTags();

  const filteredEntries = useMemo(() => {
    const filtered = searchEntries(searchQuery, filters);
    console.log('Filtered entries:', filtered);
    console.log('Filtered entries length:', filtered.length);
    return filtered;
  }, [searchQuery, filters, searchEntries]);

  const handleFilterChange = (filterName, value) => {
    if (filterName === 'jurisdiction') {
      if (value === 'other') {
        setFilters(prev => ({ ...prev, jurisdiction: customJurisdiction }));
      } else {
        setFilters(prev => ({ ...prev, jurisdiction: value }));
        setCustomJurisdiction('');
      }
    } else {
      setFilters(prev => ({ ...prev, [filterName]: value }));
    }
  };

  const clearFilters = () => {
    setFilters({
      type: 'all',
      jurisdiction: 'all',
      status: 'all',
      team_member_id: 'all'
    });
    setSearchQuery('');
    setCustomJurisdiction('');
  };

  const getEntryTypeLabel = (type) => {
    const option = entryTypeOptions.find(opt => opt.value === type);
    return option ? option.label : type;
  };

  const getJurisdictionLabel = (jurisdiction) => {
    const option = jurisdictionOptions.find(opt => opt.value === jurisdiction);
    return option ? option.label : jurisdiction;
  };

  const getTeamMemberName = (teamMemberId) => {
    const teamMembers = {
      1: 'Arda',
      2: 'Delos Cientos',
      3: 'Paden',
      4: 'Sendrijas',
      5: 'Tagarao'
    };
    return teamMembers[teamMemberId] || `Team Member ${teamMemberId}`;
  };

  return (
    <div className="entry-list-container">
      {/* Search and Filters */}
      <div className="search-filters">
        <div className="search-section">
          <input
            type="text"
            placeholder="Search entries by title, ID, content, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button 
            onClick={() => setShowFilters(!showFilters)} 
            className="toggle-filters-btn"
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>

        {showFilters && (
          <>
            <div className="filter-row">
              <div className="filter-group">
                <label>Entry Type</label>
                <select
                  value={filters.type}
                  onChange={(e) => handleFilterChange('type', e.target.value)}
                >
                  <option value="all">All Types</option>
                  {entryTypeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Jurisdiction</label>
                <select
                  value={filters.jurisdiction === 'all' ? 'all' : (filters.jurisdiction === customJurisdiction ? 'other' : filters.jurisdiction)}
                  onChange={(e) => handleFilterChange('jurisdiction', e.target.value)}
                >
                  <option value="all">All Jurisdictions</option>
                  <option value="PH">PH Philippines (PH)</option>
                  <option value="other">Other…</option>
                </select>
                {filters.jurisdiction === customJurisdiction && (
                  <input
                    type="text"
                    placeholder="e.g., Cavite, Quezon City, Baguio"
                    value={customJurisdiction}
                    onChange={(e) => {
                      setCustomJurisdiction(e.target.value);
                      setFilters(prev => ({ ...prev, jurisdiction: e.target.value }));
                    }}
                    className="custom-jurisdiction-input"
                    style={{
                      marginTop: '8px',
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                )}
              </div>

              <div className="filter-group">
                <label>Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="amended">Amended</option>
                  <option value="repealed">Repealed</option>
                  <option value="draft">Draft</option>
                  <option value="approved">Approved</option>
                  <option value="published">Published</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Team Member</label>
                <select
                  value={filters.team_member_id}
                  onChange={(e) => handleFilterChange('team_member_id', e.target.value)}
                >
                  <option value="all">All Team Members</option>
                  <option value="1">Arda</option>
                  <option value="2">Delos Cientos</option>
                  <option value="3">Paden</option>
                  <option value="4">Sendrijas</option>
                  <option value="5">Tagarao</option>
                </select>
              </div>

              <div className="filter-group">
                <button onClick={clearFilters} className="btn-secondary">
                  Clear Filters
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Results Summary */}
      <div className="results-summary">
        <p>
          Showing {filteredEntries.length} of {entries.length} entries
          {searchQuery && ` matching "${searchQuery}"`}
        </p>
      </div>

      {/* Entries List */}
      {filteredEntries.length === 0 ? (
        <div className="no-results">
          <h3>No entries found.</h3>
          <p>Try adjusting your search terms or filters.</p>
        </div>
      ) : (
        <div className="entry-list">
          {filteredEntries.map(entry => (
            <div key={entry.id} className="entry-card">
              <div className="entry-content">
                <div className="entry-main">
                  <div className="entry-title-row">
                    <h3 className="entry-title" onClick={() => setSelectedEntry(entry)}>{entry.title || 'Untitled Entry'}</h3>
                    <span className="entry-type-badge">{getEntryTypeLabel(entry.type)}</span>
                  </div>
                  <div className="entry-subtitle-row">
                    <div className="entry-subtitle">civilify.local/{entry.type ? getEntryTypeLabel(entry.type).toLowerCase().replace(/\s+/g,'-') : 'unknown'}/{entry.entry_id || 'no-id'}</div>
                    
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="entry-tags-text">
                        {entry.tags.slice(0, 3).join(', ')}
                        {entry.tags.length > 3 && ` + ${entry.tags.length - 3} more`}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="entry-actions">
                  <button
                    onClick={() => onEditEntry(entry.id)}
                    className="btn-icon"
                    title="Edit"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => onDeleteEntry(entry.id)}
                    className="btn-icon btn-icon-danger"
                    title="Delete"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3,6 5,6 21,6"/>
                      <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                      <line x1="10" y1="11" x2="10" y2="17"/>
                      <line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Entry Detail View */}
      {selectedEntry && (
        <div className="entry-detail-overlay">
          <EntryView
            entry={selectedEntry}
            onEdit={() => onEditEntry(selectedEntry.id)}
            onDelete={() => {
              onDeleteEntry(selectedEntry.id);
              setSelectedEntry(null);
            }}
          />
          <button 
            onClick={() => setSelectedEntry(null)} 
            className="back-to-list-btn"
          >
            ← Back to List
          </button>
        </div>
      )}
    </div>
  );
};

export default EntryList;
