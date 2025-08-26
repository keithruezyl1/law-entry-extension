import React, { useState, useMemo } from 'react';
import { getEntryTypeOptions } from '../../data/entryTypes';
import { getJurisdictionOptions } from '../../data/jurisdictions';
// import { getAllTags } from '../../data/tags';
import './EntryList.css';

const EntryList = ({ entries, onViewEntry, onEditEntry, onDeleteEntry, searchEntries }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [customJurisdiction, setCustomJurisdiction] = useState('');
  const [filters, setFilters] = useState({
    type: 'all',
    jurisdiction: 'all',
    status: 'all',
    team_member_id: 'all',
    offline_pack: undefined
  });

  const entryTypeOptions = getEntryTypeOptions();
  const jurisdictionOptions = getJurisdictionOptions();
  // const allTags = getAllTags();

  const filteredEntries = useMemo(() => {
    return searchEntries(searchQuery, filters);
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
      team_member_id: 'all',
      offline_pack: undefined
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
      1: 'P1 - RPC + Cebu Ordinances',
      2: 'P2 - Rules of Court + DOJ',
      3: 'P3 - PNP SOPs + Incident Checklists',
      4: 'P4 - Traffic/LTO lane',
      5: 'P5 - Rights + Constitution + Policy'
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
            placeholder="Search entries by title, ID, or content..."
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
                  <option value="1">P1 - RPC + Cebu Ordinances</option>
                  <option value="2">P2 - Rules of Court + DOJ</option>
                  <option value="3">P3 - PNP SOPs + Incident Checklists</option>
                  <option value="4">P4 - Traffic/LTO lane</option>
                  <option value="5">P5 - Rights + Constitution + Policy</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Offline Pack</label>
                <select
                  value={filters.offline_pack === undefined ? 'all' : filters.offline_pack.toString()}
                  onChange={(e) => handleFilterChange('offline_pack', e.target.value === 'all' ? undefined : e.target.value === 'true')}
                >
                  <option value="all">All Entries</option>
                  <option value="true">Included in Pack</option>
                  <option value="false">Not in Pack</option>
                </select>
              </div>
            </div>

            <div className="filter-actions">
              <button onClick={clearFilters} className="btn-secondary">
                Clear Filters
              </button>
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
              <div className="entry-header">
                <div className="entry-title-section">
                  <h3 className="entry-title" onClick={() => onViewEntry(entry.id)}>{entry.title}</h3>
                  <div className="entry-url-line">civilify.local/{getEntryTypeLabel(entry.type).toLowerCase().replace(/\s+/g,'-')}/{entry.entry_id}</div>
                </div>
                <div className="entry-badges">
                  <span className="entry-type-badge">{getEntryTypeLabel(entry.type)}</span>
                  {entry.offline && entry.offline.pack_include && (
                    <span className="offline-pack-badge">Offline Pack</span>
                  )}
                </div>
              </div>

              <div className="entry-meta">
                <span><strong>Team:</strong> {getTeamMemberName(entry.team_member_id)}</span>
                <span><strong>Jurisdiction:</strong> {getJurisdictionLabel(entry.jurisdiction)}</span>
                <span><strong>Status:</strong> {entry.status}</span>
                <span><strong>Created:</strong> {new Date(entry.created_at).toLocaleDateString()}</span>
              </div>

              <div className="entry-snippet">
                {entry.summary || 'No summary available.'}
              </div>

              {entry.tags && entry.tags.length > 0 && (
                <div className="entry-tags">
                  {entry.tags.map(tag => (
                    <span key={tag} className="entry-tag">{tag}</span>
                  ))}
                </div>
              )}

              <div className="entry-actions">
                <button
                  onClick={() => onViewEntry(entry.id)}
                  className="btn-secondary"
                >
                  View
                </button>
                <button
                  onClick={() => onEditEntry(entry.id)}
                  className="btn-primary"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDeleteEntry(entry.id)}
                  className="btn-danger"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EntryList;
