import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getEntryType } from '../../data/entryTypes';
import { getJurisdiction } from '../../data/jurisdictions';
// import { getTagByValue } from '../../data/tags';
import './EntryView.css';

const EntryView = ({ entry, onEdit, onDelete }) => {
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
                {basis.type === 'internal' ? basis.entry_id : basis.citation}
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
    console.log('Entry type:', entry.type);
    console.log('Entry data:', entry);
    
    switch (entry.type) {
      case 'constitution_provision':
        return (
          <>
            {renderArrayField('topics', entry.topics, 'Topics')}
            {renderArrayField('jurisprudence', entry.jurisprudence, 'Jurisprudence')}
            {renderArrayField('related_sections', entry.related_sections, 'Related Sections')}
          </>
        );

      case 'statute_section':
      case 'city_ordinance_section':
        return (
          <>
            {renderArrayField('elements', entry.elements, 'Elements')}
            {renderArrayField('penalties', entry.penalties, 'Penalties')}
            {renderArrayField('defenses', entry.defenses, 'Defenses')}
            {entry.prescriptive_period && (
              <div className="field-group">
                <h4>Prescriptive Period</h4>
                <div className="info-grid">
                  {entry.prescriptive_period.value && (
                    <div className="info-item">
                      <span className="label">Value:</span>
                      <span className="value">{entry.prescriptive_period.value}</span>
                    </div>
                  )}
                  {entry.prescriptive_period.unit && (
                    <div className="info-item">
                      <span className="label">Unit:</span>
                      <span className="value">{entry.prescriptive_period.unit}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {entry.standard_of_proof && (
              <div className="field-group">
                <h4>Standard of Proof</h4>
                <div className="text-content">{entry.standard_of_proof}</div>
              </div>
            )}
            {renderArrayField('related_sections', entry.related_sections, 'Related Sections')}
          </>
        );

      case 'rule_of_court':
        return (
          <>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Rule Number:</span>
                <span className="value">{entry.rule_no}</span>
              </div>
              <div className="info-item">
                <span className="label">Section Number:</span>
                <span className="value">{entry.section_no}</span>
              </div>
            </div>
            {renderArrayField('triggers', entry.triggers, 'Triggers')}
            {renderArrayField('time_limits', entry.time_limits, 'Time Limits')}
            {renderArrayField('required_forms', entry.required_forms, 'Required Forms')}
          </>
        );

      case 'agency_circular':
        return (
          <>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Circular Number:</span>
                <span className="value">{entry.circular_no}</span>
              </div>
              {entry.section_no && (
                <div className="info-item">
                  <span className="label">Section Number:</span>
                  <span className="value">{entry.section_no}</span>
                </div>
              )}
            </div>
            {renderArrayField('applicability', entry.applicability, 'Applicability')}
            {renderLegalBases(entry.legal_bases)}
          </>
        );

      case 'doj_issuance':
        return (
          <>
            <div className="info-item">
              <span className="label">Issuance Number:</span>
              <span className="value">{entry.issuance_no}</span>
            </div>
            {renderArrayField('applicability', entry.applicability, 'Applicability')}
            {renderArrayField('supersedes', entry.supersedes, 'Supersedes')}
            {renderLegalBases(entry.legal_bases)}
          </>
        );

      case 'executive_issuance':
        return (
          <>
            <div className="info-item">
              <span className="label">Instrument Number:</span>
              <span className="value">{entry.instrument_no}</span>
            </div>
            {renderArrayField('applicability', entry.applicability, 'Applicability')}
            {renderArrayField('supersedes', entry.supersedes, 'Supersedes')}
            {renderLegalBases(entry.legal_bases)}
          </>
        );

      case 'pnp_sop':
        return (
          <>
            {renderArrayField('steps_brief', entry.steps_brief, 'Steps Brief')}
            {renderLegalBases(entry.legal_bases)}
            {renderArrayField('forms_required', entry.forms_required, 'Forms Required')}
            {renderArrayField('failure_states', entry.failure_states, 'Failure States')}
          </>
        );

      case 'traffic_rule':
        return (
          <>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Violation Code:</span>
                <span className="value">{entry.violation_code}</span>
              </div>
              <div className="info-item">
                <span className="label">Violation Name:</span>
                <span className="value">{entry.violation_name}</span>
              </div>
            </div>
            {entry.license_action && (
              <div className="field-group">
                <h4>License Action</h4>
                <div className="text-content">{entry.license_action}</div>
              </div>
            )}
            {renderFineSchedule(entry.fine_schedule)}
            {renderArrayField('apprehension_flow', entry.apprehension_flow, 'Apprehension Flow')}
            {renderLegalBases(entry.legal_bases)}
          </>
        );

      case 'incident_checklist':
        return (
          <>
            <div className="info-item">
              <span className="label">Incident:</span>
              <span className="value">{entry.incident}</span>
            </div>
            {renderPhases(entry.phases)}
            {renderArrayField('forms', entry.forms, 'Forms')}
            {renderArrayField('handoff', entry.handoff, 'Handoff')}
            {renderArrayField('rights_callouts', entry.rights_callouts, 'Rights Callouts')}
          </>
        );

      case 'rights_advisory':
        return (
          <>
            <div className="info-item">
              <span className="label">Rights Scope:</span>
              <span className="value">{entry.rights_scope}</span>
            </div>
            {renderArrayField('advice_points', entry.advice_points, 'Advice Points')}
            {renderLegalBases(entry.legal_bases)}
          </>
        );

      default:
        return null;
    }
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
    <div className="entry-view-container">
      <div className="entry-view-content">
        <div className="entry-header">
          <div className="entry-title-section">
            <h1>{entry.title}</h1>
            <div className="entry-id">{entry.entry_id}</div>
            <div className="entry-type">{entryType ? entryType.label : entry.type}</div>
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

          {/* Summary Section */}
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

          {/* Timeline Information */}
          <div className="entry-section">
            <h3>Timeline Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Effective Date:</span>
                <span className="value">{formatDate(entry.effective_date)}</span>
              </div>
              {entry.amendment_date && (
                <div className="info-item">
                  <span className="label">Amendment Date:</span>
                  <span className="value">{formatDate(entry.amendment_date)}</span>
                </div>
              )}
              <div className="info-item">
                <span className="label">Created:</span>
                <span className="value">{formatDateTime(entry.created_at)}</span>
              </div>
              <div className="info-item">
                <span className="label">Last Updated:</span>
                <span className="value">{formatDateTime(entry.updated_at)}</span>
              </div>
            </div>
          </div>

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

          {/* Source URLs */}
          {entry.source_urls && entry.source_urls.length > 0 && (
            <div className="entry-section">
              <h3>Source References</h3>
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





