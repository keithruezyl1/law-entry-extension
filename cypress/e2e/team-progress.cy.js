describe('Team Progress Tracking', () => {
  beforeEach(() => {
    cy.clearTestData();
    cy.login('testuser', 'testpass');
  });

  it('should display team progress section', () => {
    cy.visit('/dashboard');
    
    // Should show team progress section
    cy.get('[data-testid="team-progress"]').should('be.visible');
    cy.get('[data-testid="team-progress-header"]').should('contain', "Today's Team Progress");
  });

  it('should show all team members', () => {
    cy.visit('/dashboard');
    
    // Should display all 5 team members
    cy.get('[data-testid="team-member-card"]').should('have.length', 5);
    
    // Check team member names
    cy.get('[data-testid="team-member-card"]').should('contain', 'Arda');
    cy.get('[data-testid="team-member-card"]').should('contain', 'Delos Cientos');
    cy.get('[data-testid="team-member-card"]').should('contain', 'Paden');
    cy.get('[data-testid="team-member-card"]').should('contain', 'Sendrijas');
    cy.get('[data-testid="team-member-card"]').should('contain', 'Tagarao');
  });

  it('should display progress bars for each team member', () => {
    cy.visit('/dashboard');
    
    // Each team member should have a progress bar
    cy.get('[data-testid="team-member-card"]').each(($card) => {
      cy.wrap($card).within(() => {
        cy.get('[data-testid="progress-bar"]').should('be.visible');
        cy.get('[data-testid="progress-count"]').should('be.visible');
      });
    });
  });

  it('should show quota breakdown for each team member', () => {
    cy.visit('/dashboard');
    
    // Each team member should show quota breakdown
    cy.get('[data-testid="team-member-card"]').each(($card) => {
      cy.wrap($card).within(() => {
        cy.get('[data-testid="quota-breakdown"]').should('be.visible');
        cy.get('[data-testid="quota-item"]').should('exist');
      });
    });
  });

  it('should update progress when entries are created', () => {
    cy.visit('/dashboard');
    
    // Get initial progress count
    cy.get('[data-testid="team-member-card"]').first().within(() => {
      cy.get('[data-testid="progress-count"]').then(($count) => {
        const initialCount = $count.text();
        
        // Create a new entry
        cy.get('[data-testid="create-new-entry-button"]').click();
        cy.url().should('include', '/law-entry/1');
        
        // Fill and submit entry form
        cy.get('[data-testid="entry-type"]').select('statute_section');
        cy.get('[data-testid="entry-title"]').type('Progress Test Entry');
        cy.get('[data-testid="jurisdiction"]').select('PH');
        cy.get('[data-testid="law-family"]').type('Test Law');
        cy.get('[data-testid="canonical-citation"]').type('Test Citation');
        cy.get('[data-testid="next-button"]').click();
        
        cy.get('[data-testid="source-url"]').type('https://example.com');
        cy.get('[data-testid="effective-date"]').type('2025-01-01');
        cy.get('[data-testid="next-button"]').click();
        
        cy.get('[data-testid="summary"]').type('Test summary for progress tracking');
        cy.get('[data-testid="text"]').type('This is a test entry to verify that team progress is updated correctly when new entries are created.');
        cy.get('[data-testid="tags"]').type('test, progress');
        cy.get('[data-testid="next-button"]').click();
        
        cy.get('[data-testid="next-button"]').click();
        cy.get('[data-testid="submit-button"]').click();
        
        // Wait for redirect to dashboard
        cy.url().should('include', '/dashboard');
        
        // Check that progress was updated
        cy.get('[data-testid="team-member-card"]').first().within(() => {
          cy.get('[data-testid="progress-count"]').should('not.contain', initialCount);
        });
      });
    });
  });

  it('should show different quota types', () => {
    cy.visit('/dashboard');
    
    // Check that different entry types are shown in quotas
    cy.get('[data-testid="team-member-card"]').first().within(() => {
      cy.get('[data-testid="quota-item"]').should('contain', 'statute_section');
      cy.get('[data-testid="quota-item"]').should('contain', 'constitution_provision');
      cy.get('[data-testid="quota-item"]').should('contain', 'rule_of_court');
      cy.get('[data-testid="quota-item"]').should('contain', 'agency_circular');
      cy.get('[data-testid="quota-item"]').should('contain', 'rights_advisory');
    });
  });

  it('should show completed quotas in green', () => {
    // Create entries to complete some quotas
    cy.createTestEntry({
      id: 1,
      entry_id: 'TEST-001',
      title: 'Completed Statute',
      type: 'statute_section',
      created_at: '2025-01-01T00:00:00Z',
      created_by: 1,
      created_by_name: 'Test User'
    });
    
    cy.visit('/dashboard');
    
    // Check that completed quotas are styled differently
    cy.get('[data-testid="team-member-card"]').first().within(() => {
      cy.get('[data-testid="quota-item"]').contains('statute_section').should('have.class', 'completed');
    });
  });

  it('should show carryover entries in yellow', () => {
    // Create entries that exceed daily quota
    for (let i = 1; i <= 5; i++) {
      cy.createTestEntry({
        id: i,
        entry_id: `TEST-${i.toString().padStart(3, '0')}`,
        title: `Excess Entry ${i}`,
        type: 'statute_section',
        created_at: '2025-01-01T00:00:00Z',
        created_by: 1,
        created_by_name: 'Test User'
      });
    }
    
    cy.visit('/dashboard');
    
    // Check that excess entries are shown as carryover
    cy.get('[data-testid="team-member-card"]').first().within(() => {
      cy.get('[data-testid="carryover-item"]').should('be.visible');
      cy.get('[data-testid="carryover-item"]').should('contain', 'statute_section');
    });
  });

  it('should display current day information', () => {
    cy.visit('/dashboard');
    
    // Should show current day information
    cy.get('[data-testid="team-progress-header"]').should('contain', 'Day');
    cy.get('[data-testid="team-progress-header"]').should('contain', '2025');
  });

  it('should show yesterday mode when applicable', () => {
    // Create incomplete entries from yesterday
    cy.createTestEntry({
      id: 1,
      entry_id: 'TEST-001',
      title: 'Yesterday Entry',
      type: 'statute_section',
      created_at: '2024-12-31T00:00:00Z', // Yesterday
      created_by: 1,
      created_by_name: 'Test User'
    });
    
    cy.visit('/dashboard');
    
    // Should show incomplete entries notification
    cy.get('[data-testid="incomplete-entries-notification"]').should('be.visible');
    cy.get('[data-testid="incomplete-entries-notification"]').should('contain', 'incomplete entries');
  });

  it('should handle team member quota calculations correctly', () => {
    cy.visit('/dashboard');
    
    // Each team member should show proper quota calculations
    cy.get('[data-testid="team-member-card"]').each(($card) => {
      cy.wrap($card).within(() => {
        // Should show progress in format "X / Y"
        cy.get('[data-testid="progress-count"]').should('match', /\d+ \/ \d+/);
        
        // Progress bar should have proper width
        cy.get('[data-testid="progress-fill"]').should('be.visible');
      });
    });
  });

  it('should update progress in real-time', () => {
    cy.visit('/dashboard');
    
    // Monitor progress updates
    cy.get('[data-testid="team-member-card"]').first().within(() => {
      cy.get('[data-testid="progress-count"]').then(($initialCount) => {
        const initialText = $initialCount.text();
        
        // Create entry in another tab/window (simulated)
        cy.window().then((win) => {
          // Simulate progress update
          win.dispatchEvent(new CustomEvent('refresh-progress'));
        });
        
        // Progress should update
        cy.get('[data-testid="progress-count"]').should('not.contain', initialText);
      });
    });
  });

  it('should show team completion status', () => {
    cy.visit('/dashboard');
    
    // Should show overall team completion status
    cy.get('[data-testid="team-completion-status"]').should('be.visible');
    
    // Status should be one of: completed, partial, incomplete
    cy.get('[data-testid="team-completion-status"]').should('match', /(completed|partial|incomplete)/i);
  });

  it('should handle different team member roles', () => {
    // Test with different user roles
    cy.login('admin', 'adminpass');
    cy.visit('/dashboard');
    
    // Admin should see all team members
    cy.get('[data-testid="team-member-card"]').should('have.length', 5);
    
    // Test with regular user
    cy.login('testuser', 'testpass');
    cy.visit('/dashboard');
    
    // Regular user should also see all team members
    cy.get('[data-testid="team-member-card"]').should('have.length', 5);
  });

  it('should show progress for different entry types', () => {
    // Create entries of different types
    const entryTypes = ['statute_section', 'constitution_provision', 'rule_of_court', 'agency_circular', 'rights_advisory'];
    
    entryTypes.forEach((type, index) => {
      cy.createTestEntry({
        id: index + 1,
        entry_id: `TEST-${(index + 1).toString().padStart(3, '0')}`,
        title: `Test ${type}`,
        type: type,
        created_at: '2025-01-01T00:00:00Z',
        created_by: 1,
        created_by_name: 'Test User'
      });
    });
    
    cy.visit('/dashboard');
    
    // Should show progress for all entry types
    cy.get('[data-testid="team-member-card"]').first().within(() => {
      entryTypes.forEach(type => {
        cy.get('[data-testid="quota-item"]').should('contain', type);
      });
    });
  });

  it('should handle plan loading states', () => {
    cy.visit('/dashboard');
    
    // Should show plan loading state initially
    cy.get('[data-testid="plan-loading"]').should('be.visible');
    
    // Wait for plan to load
    cy.get('[data-testid="plan-loading"]').should('not.exist');
    cy.get('[data-testid="team-progress"]').should('be.visible');
  });
});
