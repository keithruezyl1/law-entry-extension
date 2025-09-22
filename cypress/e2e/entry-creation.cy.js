describe('Entry Creation Flow', () => {
  beforeEach(() => {
    cy.clearTestData();
    cy.login('testuser', 'testpass');
  });

  it('should navigate to entry form from dashboard', () => {
    cy.get('[data-testid="create-new-entry-button"]').click();
    cy.url().should('include', '/law-entry/1');
    cy.get('[data-testid="entry-form"]').should('be.visible');
  });

  it('should display all form steps', () => {
    cy.visit('/law-entry/1');
    
    // Step 1: Basics
    cy.get('[data-testid="step-1"]').should('be.visible');
    cy.get('[data-testid="step-title"]').should('contain', 'Basics');
    
    // Navigate to step 2
    cy.get('[data-testid="entry-type"]').select('statute_section');
    cy.get('[data-testid="entry-title"]').type('Test Statute');
    cy.get('[data-testid="jurisdiction"]').select('PH');
    cy.get('[data-testid="law-family"]').type('Test Law');
    cy.get('[data-testid="canonical-citation"]').type('Test Citation');
    cy.get('[data-testid="next-button"]').click();
    
    // Step 2: Sources & Dates
    cy.get('[data-testid="step-2"]').should('be.visible');
    cy.get('[data-testid="step-title"]').should('contain', 'Sources & Dates');
    
    // Navigate to step 3
    cy.get('[data-testid="source-url"]').type('https://example.com');
    cy.get('[data-testid="effective-date"]').type('2025-01-01');
    cy.get('[data-testid="next-button"]').click();
    
    // Step 3: Content
    cy.get('[data-testid="step-3"]').should('be.visible');
    cy.get('[data-testid="step-title"]').should('contain', 'Content');
    
    // Navigate to step 4
    cy.get('[data-testid="summary"]').type('This is a test summary for the entry');
    cy.get('[data-testid="text"]').type('This is the full text content of the legal entry. It contains detailed information about the statute and its provisions.');
    cy.get('[data-testid="tags"]').type('test, statute, law');
    cy.get('[data-testid="next-button"]').click();
    
    // Step 4: Type-Specific & Relations
    cy.get('[data-testid="step-4"]').should('be.visible');
    cy.get('[data-testid="step-title"]').should('contain', 'Type-Specific & Relations');
    
    // Navigate to step 5
    cy.get('[data-testid="next-button"]').click();
    
    // Step 5: Review & Publish
    cy.get('[data-testid="step-5"]').should('be.visible');
    cy.get('[data-testid="step-title"]').should('contain', 'Review & Publish');
  });

  it('should validate required fields', () => {
    cy.visit('/law-entry/1');
    
    // Try to proceed without filling required fields
    cy.get('[data-testid="next-button"]').click();
    
    // Should show validation errors
    cy.get('[data-testid="entry-type-error"]').should('be.visible');
    cy.get('[data-testid="entry-title-error"]').should('be.visible');
    cy.get('[data-testid="jurisdiction-error"]').should('be.visible');
    cy.get('[data-testid="law-family-error"]').should('be.visible');
    cy.get('[data-testid="canonical-citation-error"]').should('be.visible');
  });

  it('should validate URL format', () => {
    cy.visit('/law-entry/2');
    
    // Fill required fields from step 1
    cy.get('[data-testid="entry-type"]').select('statute_section');
    cy.get('[data-testid="entry-title"]').type('Test Statute');
    cy.get('[data-testid="jurisdiction"]').select('PH');
    cy.get('[data-testid="law-family"]').type('Test Law');
    cy.get('[data-testid="canonical-citation"]').type('Test Citation');
    cy.get('[data-testid="next-button"]').click();
    
    // Try to enter invalid URL
    cy.get('[data-testid="source-url"]').type('invalid-url');
    cy.get('[data-testid="next-button"]').click();
    
    // Should show URL validation error
    cy.get('[data-testid="source-url-error"]').should('be.visible');
    cy.get('[data-testid="source-url-error"]').should('contain', 'Please enter a valid URL');
  });

  it('should validate text length', () => {
    cy.visit('/law-entry/3');
    
    // Fill required fields from previous steps
    cy.get('[data-testid="entry-type"]').select('statute_section');
    cy.get('[data-testid="entry-title"]').type('Test Statute');
    cy.get('[data-testid="jurisdiction"]').select('PH');
    cy.get('[data-testid="law-family"]').type('Test Law');
    cy.get('[data-testid="canonical-citation"]').type('Test Citation');
    cy.get('[data-testid="next-button"]').click();
    
    cy.get('[data-testid="source-url"]').type('https://example.com');
    cy.get('[data-testid="effective-date"]').type('2025-01-01');
    cy.get('[data-testid="next-button"]').click();
    
    // Try to enter text that's too short
    cy.get('[data-testid="summary"]').type('Short summary');
    cy.get('[data-testid="text"]').type('Short text');
    cy.get('[data-testid="tags"]').type('test');
    cy.get('[data-testid="next-button"]').click();
    
    // Should show text length validation error
    cy.get('[data-testid="text-error"]').should('be.visible');
    cy.get('[data-testid="text-error"]').should('contain', 'Text must be at least 50 characters');
  });

  it('should create entry successfully', () => {
    cy.visit('/law-entry/1');
    
    // Fill all required fields
    cy.get('[data-testid="entry-type"]').select('statute_section');
    cy.get('[data-testid="entry-title"]').type('Test Statute Entry');
    cy.get('[data-testid="jurisdiction"]').select('PH');
    cy.get('[data-testid="law-family"]').type('Test Law Family');
    cy.get('[data-testid="canonical-citation"]').type('Test Citation 001');
    cy.get('[data-testid="next-button"]').click();
    
    cy.get('[data-testid="source-url"]').type('https://example.com/test-statute');
    cy.get('[data-testid="effective-date"]').type('2025-01-01');
    cy.get('[data-testid="next-button"]').click();
    
    cy.get('[data-testid="summary"]').type('This is a comprehensive test summary for the statute entry');
    cy.get('[data-testid="text"]').type('This is the complete text content of the legal statute. It contains detailed provisions, definitions, and requirements that must be followed by all parties involved.');
    cy.get('[data-testid="tags"]').type('test, statute, law, criminal');
    cy.get('[data-testid="next-button"]').click();
    
    // Skip type-specific fields for now
    cy.get('[data-testid="next-button"]').click();
    
    // Review and submit
    cy.get('[data-testid="submit-button"]').click();
    
    // Should show success message and redirect to dashboard
    cy.get('[data-testid="success-modal"]').should('be.visible');
    cy.get('[data-testid="success-modal"]').should('contain', 'Entry Created Successfully');
    
    // Wait for redirect to dashboard
    cy.url().should('include', '/dashboard');
  });

  it('should handle form cancellation', () => {
    cy.visit('/law-entry/1');
    
    // Fill some fields
    cy.get('[data-testid="entry-type"]').select('statute_section');
    cy.get('[data-testid="entry-title"]').type('Test Entry');
    
    // Click cancel
    cy.get('[data-testid="cancel-button"]').click();
    
    // Should show confirmation modal
    cy.get('[data-testid="cancel-modal"]').should('be.visible');
    cy.get('[data-testid="confirm-cancel"]').click();
    
    // Should redirect to dashboard
    cy.url().should('include', '/dashboard');
  });

  it('should save draft automatically', () => {
    cy.visit('/law-entry/1');
    
    // Fill some fields
    cy.get('[data-testid="entry-type"]').select('statute_section');
    cy.get('[data-testid="entry-title"]').type('Draft Entry');
    cy.get('[data-testid="jurisdiction"]').select('PH');
    
    // Wait for auto-save
    cy.wait(2000);
    
    // Navigate away and back
    cy.visit('/dashboard');
    cy.get('[data-testid="create-new-entry-button"]').click();
    
    // Should show resume draft modal
    cy.get('[data-testid="resume-modal"]').should('be.visible');
    cy.get('[data-testid="resume-modal"]').should('contain', 'Previous Session Found');
  });

  it('should handle different entry types', () => {
    const entryTypes = [
      { type: 'constitution_provision', title: 'Constitution Test' },
      { type: 'statute_section', title: 'Statute Test' },
      { type: 'rule_of_court', title: 'Rule Test' },
      { type: 'agency_circular', title: 'Circular Test' },
      { type: 'rights_advisory', title: 'Rights Test' }
    ];

    entryTypes.forEach(({ type, title }) => {
      cy.visit('/law-entry/1');
      
      cy.get('[data-testid="entry-type"]').select(type);
      cy.get('[data-testid="entry-title"]').type(title);
      cy.get('[data-testid="jurisdiction"]').select('PH');
      cy.get('[data-testid="law-family"]').type('Test Law');
      cy.get('[data-testid="canonical-citation"]').type('Test Citation');
      cy.get('[data-testid="next-button"]').click();
      
      // Should proceed to next step
      cy.get('[data-testid="step-2"]').should('be.visible');
    });
  });

  it('should show progress indicator', () => {
    cy.visit('/law-entry/1');
    
    // Check initial progress
    cy.get('[data-testid="progress-indicator"]').should('be.visible');
    cy.get('[data-testid="progress-step-1"]').should('have.class', 'active');
    
    // Move to step 2
    cy.get('[data-testid="entry-type"]').select('statute_section');
    cy.get('[data-testid="entry-title"]').type('Test Entry');
    cy.get('[data-testid="jurisdiction"]').select('PH');
    cy.get('[data-testid="law-family"]').type('Test Law');
    cy.get('[data-testid="canonical-citation"]').type('Test Citation');
    cy.get('[data-testid="next-button"]').click();
    
    // Check progress update
    cy.get('[data-testid="progress-step-1"]').should('have.class', 'completed');
    cy.get('[data-testid="progress-step-2"]').should('have.class', 'active');
  });
});
