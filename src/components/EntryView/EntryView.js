import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getEntryType } from '../../data/entryTypes';
import { getJurisdiction } from '../../data/jurisdictions';
// import { getTagByValue } from '../../data/tags';
import './EntryView.css';
import { fetchEntryById } from '../../services/kbApi';

const EntryView = ({ entry, onEdit, onDelete, teamMemberNames = {} }) => {
  const navigate = useNavigate();
  if (!entry) {
    return (
      <div className="no-entry">
        <h3>Entry not found</h3>
        <p>The requested entry could not be found.</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary">
          Back to List
        </button>
      </div>
    );
  }

  const entryType = getEntryType(entry.type);
  const jurisdiction = getJurisdiction(entry.jurisdiction);

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return 'Not specified';
    return new Date(dateTimeString).toLocaleString();
  };

  const renderArrayField = (fieldName, items, label) => {
    console.log(`Rendering ${fieldName}:`, items);
    if (!items || items.length === 0) return null;
    
    return (
      <div className="field-group">
        <h4>{label}</h4>
        <ul className="array-list">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>
    );
  };

  const renderLegalBases = (legalBases) => {
    if (!legalBases || legalBases.length === 0) return null;
    
    return (
      <div className="field-group">
        <h4>Legal Bases</h4>
        <div className="legal-bases-list">
          {legalBases.map((basis, index) => (
            <div key={index} className="legal-basis-item">
              <span className="basis-type">{basis.type}</span>
              <span className="basis-content">
                {basis.type === 'internal' ? (
                  <button
                    className="link-button"
                    onClick={async () => {
                      const entryId = basis.entry_id;
                      if (!entryId) return;
                      const target = await fetchEntryById(entryId);
                      if (target) {
                        window.dispatchEvent(new CustomEvent('open-entry-detail', { detail: { entry: { ...target, id: target.entry_id } } }));
                      }
                    }}
                  >
                    {basis.title ? `${basis.title} (${basis.entry_id})` : basis.entry_id}
                  </button>
                ) : (
                  basis.citation
                )}
              </span>
              {basis.topic && <span className="basis-topic">({basis.topic})</span>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFineSchedule = (fineSchedule) => {
    if (!fineSchedule || fineSchedule.length === 0) return null;
    
    return (
      <div className="field-group">
        <h4>Fine Schedule</h4>
        <div className="fine-schedule">
          <table>
            <thead>
              <tr>
                <th>Offense #</th>
                <th>Amount</th>
                <th>Currency</th>
              </tr>
            </thead>
            <tbody>
              {fineSchedule.map((fine, index) => (
                <tr key={index}>
                  <td>{fine.offense_no}</td>
                  <td>{fine.amount}</td>
                  <td>{fine.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderPhases = (phases) => {
    if (!phases || phases.length === 0) return null;
    
    return (
      <div className="field-group">
        <h4>Phases</h4>
        <div className="phases-list">
          {phases.map((phase, phaseIndex) => (
            <div key={phaseIndex} className="phase-item">
              <h5>{phase.name}</h5>
              {phase.steps && phase.steps.length > 0 && (
                <ol className="steps-list">
                  {phase.steps.map((step, stepIndex) => (
                    <li key={stepIndex} className="step-item">
                      <div className="step-text">{step.text}</div>
                      {step.condition && <div className="step-condition">Condition: {step.condition}</div>}
                      {step.deadline && <div className="step-deadline">Deadline: {step.deadline}</div>}
                      {step.evidence_required && step.evidence_required.length > 0 && (
                        <div className="step-evidence">
                          Evidence: {step.evidence_required.join(', ')}
                        </div>
                      )}
                      {step.failure_state && <div className="step-failure">Failure: {step.failure_state}</div>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTypeSpecificFields = () => {
    if (!entry.type) return null;

    // Helper function to render a field with proper alignment
    const renderField = (label, value, type = 'text') => {
      let displayValue = 'Empty';
      
      if (value !== null && value !== undefined && value !== '') {
        if (type === 'array' && Array.isArray(value)) {
          displayValue = value.length > 0 ? value.join(', ') : 'Empty';
        } else if (type === 'object' && typeof value === 'object') {
          displayValue = JSON.stringify(value, null, 2);
        } else if (type === 'date' && value) {
          displayValue = formatDate(value);
        } else {
          displayValue = String(value);
        }
      }
      
      return (
        <div className="info-item" key={label}>
          <span className="label">{label}:</span>
          <span className="value">{displayValue}</span>
        </div>
      );
    };

    // Helper function to render array fields with proper structure
    const renderArrayFieldStructured = (fieldName, items, label, itemRenderer = null) => {
      return (
        <div className="field-group" key={fieldName}>
          <h4 className="field-group-title">{label}</h4>
          <div className="field-group-content">
            {items && Array.isArray(items) && items.length > 0 ? (
              itemRenderer ? (
                items.map((item, index) => itemRenderer(item, index))
              ) : (
                <ul className="array-list">
                  {items.map((item, index) => (
                    <li key={index} className="array-item">
                      {typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)}
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <div className="empty-field">Empty</div>
            )}
          </div>
        </div>
      );
    };

    // Helper function to render legal bases with proper structure
    const renderLegalBasesStructured = (legalBases) => {
      return (
        <div className="field-group">
          <h4 className="field-group-title">Legal Bases</h4>
          <div className="field-group-content">
            {legalBases && Array.isArray(legalBases) && legalBases.length > 0 ? (
              <div className="legal-bases-list">
                {legalBases.map((basis, index) => (
                  <div key={index} className="legal-basis-item">
                    <div className="basis-header">
                      <span className="basis-type">{basis.type}</span>
                      {basis.topic && <span className="basis-topic">({basis.topic})</span>}
                    </div>
                    <div className="basis-content">
                      {basis.type === 'internal' ? basis.entry_id : basis.citation}
                    </div>
                    {basis.note && <div className="basis-note">{basis.note}</div>}
                    {basis.url && (
                      <a href={basis.url} target="_blank" rel="noopener noreferrer" className="basis-url">
                        {basis.url}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-field">Empty</div>
            )}
          </div>
        </div>
      );
    };

    // Helper function to render fine schedule with proper table structure
    const renderFineScheduleStructured = (fineSchedule) => {
      if (!fineSchedule || !Array.isArray(fineSchedule) || fineSchedule.length === 0) return null;
      
      return (
        <div className="field-group">
          <h4 className="field-group-title">Fine Schedule</h4>
          <div className="field-group-content">
            <div className="fine-schedule">
              <table className="fine-table">
                <thead>
                  <tr>
                    <th>Offense #</th>
                    <th>Amount</th>
                    <th>Currency</th>
                  </tr>
                </thead>
                <tbody>
                  {fineSchedule.map((fine, index) => (
                    <tr key={index}>
                      <td>{fine.offense_no || index + 1}</td>
                      <td>{fine.amount}</td>
                      <td>{fine.currency || 'PHP'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    };

    // Helper function to render phases with proper structure
    const renderPhasesStructured = (phases) => {
      if (!phases || !Array.isArray(phases) || phases.length === 0) return null;
      
      return (
        <div className="field-group">
          <h4 className="field-group-title">Phases</h4>
          <div className="field-group-content">
            <div className="phases-list">
              {phases.map((phase, phaseIndex) => (
                <div key={phaseIndex} className="phase-item">
                  <h5 className="phase-name">{phase.name}</h5>
                  {phase.steps && Array.isArray(phase.steps) && phase.steps.length > 0 && (
                    <ol className="steps-list">
                      {phase.steps.map((step, stepIndex) => (
                        <li key={stepIndex} className="step-item">
                          <div className="step-text">{step.text}</div>
                          {step.condition && <div className="step-condition">Condition: {step.condition}</div>}
                          {step.deadline && <div className="step-deadline">Deadline: {step.deadline}</div>}
                          {step.evidence_required && Array.isArray(step.evidence_required) && step.evidence_required.length > 0 && (
                            <div className="step-evidence">Evidence: {step.evidence_required.join(', ')}</div>
                          )}
                          {step.failure_state && <div className="step-failure">Failure: {step.failure_state}</div>}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    };

    const pp = (() => {
      const v = entry.prescriptive_period;
      if (!v) return null;
      try {
        if (typeof v === 'string') {
          const parsed = JSON.parse(v);
          if (parsed && parsed.value && parsed.unit) return `${parsed.value} ${String(parsed.unit).replace(/s$/,'')}s`;
        }
        if (typeof v === 'object' && v.value && v.unit) {
          return `${v.value} ${String(v.unit).replace(/s$/,'')}s`;
        }
      } catch {}
      return String(v);
    })();

    switch (entry.type) {
      case 'statute_section':
        return (
          <div className="type-specific-fields">
            <div className="info-grid">
              {renderField('Prescriptive Period', pp || 'Empty')}
              {renderField('Standard of Proof', entry.standard_of_proof)}
            </div>
            {renderArrayFieldStructured('elements', entry.elements, 'Elements')}
            {renderArrayFieldStructured('penalties', entry.penalties, 'Penalties')}
            {renderArrayFieldStructured('defenses', entry.defenses, 'Defenses')}
          </div>
        );

      case 'city_ordinance_section':
        return (
          <div className="type-specific-fields">
            <div className="info-grid">
              {renderField('Elements', entry.elements, 'array')}
              {renderField('Penalties', entry.penalties, 'array')}
              {renderField('Defenses', entry.defenses, 'array')}
            </div>
          </div>
        );

      case 'rule_of_court':
        return (
          <div className="type-specific-fields">
            <div className="info-grid">
              {renderField('Rule Number', entry.rule_no)}
              {renderField('Section Number', entry.section_no)}
            </div>
            {renderArrayFieldStructured('triggers', entry.triggers, 'Triggers')}
            {renderArrayFieldStructured('time_limits', entry.time_limits, 'Time Limits')}
            {renderArrayFieldStructured('required_forms', entry.required_forms, 'Required Forms')}
          </div>
        );

      case 'agency_circular':
        return (
          <div className="type-specific-fields">
            <div className="info-grid">
              {renderField('Circular Number', entry.circular_no)}
              {renderField('Section Number', entry.section_no)}
            </div>
            {renderArrayFieldStructured('applicability', entry.applicability, 'Applicability')}
            {renderArrayFieldStructured('supersedes', entry.supersedes, 'Supersedes')}
          </div>
        );

      case 'doj_issuance':
        return (
          <div className="type-specific-fields">
            <div className="info-grid">
              {renderField('Issuance Number', entry.issuance_no)}
            </div>
            {renderArrayFieldStructured('applicability', entry.applicability, 'Applicability')}
            {renderArrayFieldStructured('supersedes', entry.supersedes, 'Supersedes')}
          </div>
        );

      case 'executive_issuance':
        return (
          <div className="type-specific-fields">
            <div className="info-grid">
              {renderField('Instrument Number', entry.instrument_no)}
            </div>
            {renderArrayFieldStructured('applicability', entry.applicability, 'Applicability')}
            {renderArrayFieldStructured('supersedes', entry.supersedes, 'Supersedes')}
          </div>
        );

      case 'pnp_sop':
        return (
          <div className="type-specific-fields">
            {renderArrayFieldStructured('steps_brief', entry.steps_brief, 'Steps Brief')}
            {renderArrayFieldStructured('forms_required', entry.forms_required, 'Forms Required')}
            {renderArrayFieldStructured('failure_states', entry.failure_states, 'Failure States')}
          </div>
        );

      case 'traffic_rule':
        return (
          <div className="type-specific-fields">
            <div className="info-grid">
              {renderField('Violation Code', entry.violation_code)}
              {renderField('Violation Name', entry.violation_name)}
              {renderField('License Action', entry.license_action)}
            </div>
            {renderFineScheduleStructured(entry.fine_schedule)}
            {renderArrayFieldStructured('apprehension_flow', entry.apprehension_flow, 'Apprehension Flow')}
          </div>
        );

      case 'incident_checklist':
        return (
          <div className="type-specific-fields">
            <div className="info-grid">
              {renderField('Incident', entry.incident)}
            </div>
            {renderPhasesStructured(entry.phases)}
            {renderArrayFieldStructured('forms', entry.forms, 'Forms')}
            {renderArrayFieldStructured('handoff', entry.handoff, 'Handoff')}
            {renderArrayFieldStructured('rights_callouts', entry.rights_callouts, 'Rights Callouts')}
          </div>
        );

      case 'rights_advisory':
        return (
          <div className="type-specific-fields">
            <div className="info-grid">
              {renderField('Rights Scope', entry.rights_scope)}
            </div>
            {renderArrayFieldStructured('advice_points', entry.advice_points, 'Advice Points')}
          </div>
        );

      case 'constitution_provision':
        return (
          <div className="type-specific-fields">
            {renderArrayFieldStructured('topics', entry.topics, 'Topics')}
            {renderArrayFieldStructured('jurisprudence', entry.jurisprudence, 'Jurisprudence')}
          </div>
        );

      default:
        return (
          <div className="type-specific-fields">
            <div className="info-item">
              <span className="label">Entry Type:</span>
              <span className="value">{entry.type}</span>
            </div>
          </div>
        );
    }
  };

  const getTeamMemberName = (teamMemberId) => {
    if (entry.created_by_name) return entry.created_by_name;
    return teamMemberNames[teamMemberId] || `Team Member ${teamMemberId || 'undefined'}`;
  };

  return (
    <div className="entry-view-container">
      <div className="entry-view-content">
        <div className="entry-header">
          <div className="entry-title-section">
            <div className="entry-title-row">
              <h1>{entry.title}</h1>
              <span className="entry-id-badge">{entry.entry_id}</span>
              <span className="entry-type-badge">{entryType ? entryType.label : entry.type}</span>
            </div>
            {entry.offline && entry.offline.pack_include && (
              <div className="offline-pack-indicator">
                Included in Offline Pack
              </div>
            )}
          </div>
          
          <div className="entry-actions">
            <button onClick={onEdit} className="btn-icon" title="Edit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button onClick={onDelete} className="btn-icon btn-icon-danger" title="Delete">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3,6 5,6 21,6"/>
                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="entry-sections">
          {/* Basic Information */}
          <div className="entry-section">
            <h3>Basic Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Team Member:</span>
                <span className="value">{getTeamMemberName(entry.team_member_id)}</span>
              </div>
              <div className="info-item">
                <span className="label">Jurisdiction:</span>
                <span className="value">{jurisdiction ? jurisdiction.label : entry.jurisdiction}</span>
              </div>
              <div className="info-item">
                <span className="label">Law Family:</span>
                <span className="value">{entry.law_family}</span>
              </div>
              {entry.section_id && (
                <div className="info-item">
                  <span className="label">Section ID:</span>
                  <span className="value">{entry.section_id}</span>
                </div>
              )}
              <div className="info-item">
                <span className="label">Canonical Citation:</span>
                <span className="value">{entry.canonical_citation}</span>
              </div>
              <div className="info-item">
                <span className="label">Status:</span>
                <span className="value">
                  <span className={`status-badge status-${entry.status}`}>
                    {entry.status}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="entry-section">
            <h3>Dates</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Entry Created:</span>
                <span className="value">{formatDateTime(entry.created_at)}</span>
              </div>
              <div className="info-item">
                <span className="label">Effective Date:</span>
                <span className="value">{formatDate(entry.effective_date)}</span>
              </div>
              {entry.last_reviewed && (
                <div className="info-item">
                  <span className="label">{`Last Reviewed${entry?.verified_by ? ` (${entry.verified_by})` : ''}:`}</span>
                  <span className="value">
                    {formatDate(entry.last_reviewed)}
                    {(() => {
                      try {
                        const token = localStorage.getItem('auth_token') || '';
                        const payload = JSON.parse(atob((token || '').split('.')[1] || 'e30='));
                        const pid = String(payload?.personId || payload?.pid || '').toUpperCase();
                        const isVerifier = pid === 'P3' || pid === 'P5' || pid === 'P03' || pid === 'P05';
                        if (!isVerifier) return null;
                        const name = (payload?.name || payload?.username || '').trim() || (pid === 'P3' ? 'Paden' : 'Tagarao');
                        return (
                          <button
                            className="btn-verify"
                            style={{ marginLeft: '0.5rem' }}
                            onClick={async () => {
                              try {
                                const now = new Date().toISOString();
                                const body = { ...entry, last_reviewed: now, verified_by: name };
                                const base = (process.env.REACT_APP_API_BASE || process.env.REACT_APP_VECTOR_API_URL || 'http://localhost:4000');
                                const url = `${base}/api/kb/entries/${encodeURIComponent(entry.entry_id)}`;
                                await fetch(url, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                                  body: JSON.stringify(body),
                                });
                                window.dispatchEvent(new Event('refresh-entries'));
                                alert('Entry verified');
                              } catch (e) {
                                alert('Failed to verify');
                              }
                            }}
                          >
                            Verify
                          </button>
                        );
                      } catch {
                        return null;
                      }
                    })()}
                  </span>
                </div>
              )}
              {entry.amendment_date && (
                <div className="info-item">
                  <span className="label">Amendment Date:</span>
                  <span className="value">{formatDate(entry.amendment_date)}</span>
                </div>
              )}
              <div className="info-item">
                <span className="label">Last Updated:</span>
                <span className="value">{formatDateTime(entry.updated_at)}</span>
              </div>
            </div>
          </div>

          {/* Source URLs */}
          {entry.source_urls && entry.source_urls.length > 0 && (
            <div className="entry-section">
              <h3>Source URLs</h3>
              <div className="source-urls">
                {entry.source_urls.map((url, index) => (
                  <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="source-url"
                  >
                    {url}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {entry.summary && (
            <div className="entry-section">
              <h3>Summary</h3>
              <div className="summary-text">{entry.summary}</div>
            </div>
          )}

          {/* Full Text Content */}
          {entry.text && (
            <div className="entry-section">
              <h3>Full Text Content</h3>
              <div className="text-content">{entry.text}</div>
            </div>
          )}

          {/* Tags */}
          {entry.tags && entry.tags.length > 0 && (
            <div className="entry-section">
              <h3>Tags</h3>
              <div className="tags-list">
                {entry.tags.map(tag => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Type-Specific Information */}
          <div className="entry-section">
            <h3>{entryType ? entryType.label : 'Entry'} Details</h3>
            {renderTypeSpecificFields()}
          </div>

          {/* Relations - always visible */}
          <div className="entry-section">
            <h3>Relations</h3>
            {renderLegalBases(entry.legal_bases) || (
              <div className="field-group"><h4>Legal Bases</h4><div className="empty-field">Empty</div></div>
            )}
            <div className="field-group">
              <h4>Related Sections</h4>
              {entry.related_sections && entry.related_sections.length > 0 ? (
                <ul className="array-list">
                  {entry.related_sections.map((rel, idx) => (
                    <li key={idx}>
                      {rel?.type === 'internal' && rel?.entry_id ? (
                        <button className="link-button" onClick={async () => {
                          const target = await fetchEntryById(rel.entry_id);
                          if (target) {
                            window.dispatchEvent(new CustomEvent('open-entry-detail', { detail: { entry: { ...target, id: target.entry_id } } }));
                          }
                        }}>
                          {rel.title ? `${rel.title} (${rel.entry_id})` : rel.entry_id}
                        </button>
                      ) : (
                        String(rel?.citation || rel)
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-field">Empty</div>
              )}
            </div>
          </div>

          {/* Raw Text */}
          {entry.text_raw && (
            <div className="entry-section">
              <h3>Raw Text</h3>
              <div className="text-content">{entry.text_raw}</div>
            </div>
          )}

          {/* Normalized Text */}
          {entry.text_normalized && (
            <div className="entry-section">
              <h3>Normalized Text</h3>
              <div className="text-content">{entry.text_normalized}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EntryView;





