describe('Entry Management', () => {
  beforeEach(() => {
    cy.clearTestData();
    cy.login('testuser', 'testpass');
    
    // Create test entries
    cy.createTestEntry({
      id: 1,
      entry_id: 'TEST-001',
      title: 'Test Entry 1',
      type: 'statute_section',
      created_at: '2025-01-01T00:00:00Z',
      created_by: 1,
      created_by_name: 'Test User'
    });
    
    cy.createTestEntry({
      id: 2,
      entry_id: 'TEST-002',
      title: 'Test Entry 2',
      type: 'constitution_provision',
      created_at: '2025-01-02T00:00:00Z',
      created_by: 1,
      created_by_name: 'Test User'
    });
  });

  it('should display entry list', () => {
    cy.visit('/dashboard');
    
    // Should show entries
    cy.get('[data-testid="entry-list"]').should('be.visible');
    cy.get('[data-testid="entry-item"]').should('have.length', 2);
    
    // Check entry details
    cy.get('[data-testid="entry-item"]').first().should('contain', 'Test Entry 1');
    cy.get('[data-testid="entry-item"]').first().should('contain', 'statute_section');
    cy.get('[data-testid="entry-item"]').last().should('contain', 'Test Entry 2');
    cy.get('[data-testid="entry-item"]').last().should('contain', 'constitution_provision');
  });

  it('should search entries', () => {
    cy.visit('/dashboard');
    
    // Search for specific entry
    cy.get('[data-testid="search-input"]').type('Test Entry 1');
    cy.get('[data-testid="search-button"]').click();
    
    // Should show only matching entry
    cy.get('[data-testid="entry-item"]').should('have.length', 1);
    cy.get('[data-testid="entry-item"]').should('contain', 'Test Entry 1');
    
    // Clear search
    cy.get('[data-testid="clear-search"]').click();
    cy.get('[data-testid="entry-item"]').should('have.length', 2);
  });

  it('should filter entries by type', () => {
    cy.visit('/dashboard');
    
    // Filter by statute_section
    cy.get('[data-testid="type-filter"]').select('statute_section');
    
    // Should show only statute entries
    cy.get('[data-testid="entry-item"]').should('have.length', 1);
    cy.get('[data-testid="entry-item"]').should('contain', 'statute_section');
    
    // Filter by constitution_provision
    cy.get('[data-testid="type-filter"]').select('constitution_provision');
    
    // Should show only constitution entries
    cy.get('[data-testid="entry-item"]').should('have.length', 1);
    cy.get('[data-testid="entry-item"]').should('contain', 'constitution_provision');
  });

  it('should filter entries by date range', () => {
    cy.visit('/dashboard');
    
    // Set date range filter
    cy.get('[data-testid="date-from"]').type('2025-01-01');
    cy.get('[data-testid="date-to"]').type('2025-01-01');
    cy.get('[data-testid="apply-date-filter"]').click();
    
    // Should show only entries from that date
    cy.get('[data-testid="entry-item"]').should('have.length', 1);
    cy.get('[data-testid="entry-item"]').should('contain', 'Test Entry 1');
  });

  it('should view entry details', () => {
    cy.visit('/dashboard');
    
    // Click on first entry
    cy.get('[data-testid="entry-item"]').first().click();
    
    // Should navigate to entry view
    cy.url().should('include', '/entry/1');
    cy.get('[data-testid="entry-details"]').should('be.visible');
    
    // Check entry details are displayed
    cy.get('[data-testid="entry-title"]').should('contain', 'Test Entry 1');
    cy.get('[data-testid="entry-type"]').should('contain', 'statute_section');
    cy.get('[data-testid="entry-jurisdiction"]').should('be.visible');
    cy.get('[data-testid="entry-summary"]').should('be.visible');
    cy.get('[data-testid="entry-text"]').should('be.visible');
  });

  it('should edit entry', () => {
    cy.visit('/dashboard');
    
    // Click edit on first entry
    cy.get('[data-testid="entry-item"]').first().within(() => {
      cy.get('[data-testid="edit-button"]').click();
    });
    
    // Should navigate to edit form
    cy.url().should('include', '/entry/1/edit');
    cy.get('[data-testid="entry-form"]').should('be.visible');
    
    // Form should be pre-filled
    cy.get('[data-testid="entry-title"]').should('have.value', 'Test Entry 1');
    cy.get('[data-testid="entry-type"]').should('have.value', 'statute_section');
    
    // Make changes
    cy.get('[data-testid="entry-title"]').clear().type('Updated Test Entry');
    cy.get('[data-testid="submit-button"]').click();
    
    // Should show success message
    cy.get('[data-testid="success-modal"]').should('be.visible');
    cy.get('[data-testid="success-modal"]').should('contain', 'Entry Updated Successfully');
    
    // Should redirect to dashboard
    cy.url().should('include', '/dashboard');
    
    // Check entry was updated
    cy.get('[data-testid="entry-item"]').first().should('contain', 'Updated Test Entry');
  });

  it('should delete entry', () => {
    cy.visit('/dashboard');
    
    // Click delete on first entry
    cy.get('[data-testid="entry-item"]').first().within(() => {
      cy.get('[data-testid="delete-button"]').click();
    });
    
    // Should show confirmation modal
    cy.get('[data-testid="delete-modal"]').should('be.visible');
    cy.get('[data-testid="delete-modal"]').should('contain', 'Are you sure you want to delete');
    
    // Confirm deletion
    cy.get('[data-testid="confirm-delete"]').click();
    
    // Should show success message
    cy.get('[data-testid="success-message"]').should('be.visible');
    cy.get('[data-testid="success-message"]').should('contain', 'Entry deleted successfully');
    
    // Entry should be removed from list
    cy.get('[data-testid="entry-item"]').should('have.length', 1);
    cy.get('[data-testid="entry-item"]').should('not.contain', 'Test Entry 1');
  });

  it('should cancel entry deletion', () => {
    cy.visit('/dashboard');
    
    // Click delete on first entry
    cy.get('[data-testid="entry-item"]').first().within(() => {
      cy.get('[data-testid="delete-button"]').click();
    });
    
    // Should show confirmation modal
    cy.get('[data-testid="delete-modal"]').should('be.visible');
    
    // Cancel deletion
    cy.get('[data-testid="cancel-delete"]').click();
    
    // Modal should close
    cy.get('[data-testid="delete-modal"]').should('not.exist');
    
    // Entry should still be in list
    cy.get('[data-testid="entry-item"]').should('have.length', 2);
    cy.get('[data-testid="entry-item"]').first().should('contain', 'Test Entry 1');
  });

  it('should export single entry', () => {
    cy.visit('/dashboard');
    
    // Click export on first entry
    cy.get('[data-testid="entry-item"]').first().within(() => {
      cy.get('[data-testid="export-button"]').click();
    });
    
    // Should trigger download
    cy.window().then((win) => {
      // Mock the download behavior
      cy.stub(win, 'open').as('windowOpen');
    });
    
    // Verify export was triggered
    cy.get('@windowOpen').should('have.been.called');
  });

  it('should export all entries', () => {
    cy.visit('/dashboard');
    
    // Click export all button
    cy.get('[data-testid="export-all-button"]').click();
    
    // Should trigger download
    cy.window().then((win) => {
      // Mock the download behavior
      cy.stub(win, 'open').as('windowOpen');
    });
    
    // Verify export was triggered
    cy.get('@windowOpen').should('have.been.called');
  });

  it('should handle empty search results', () => {
    cy.visit('/dashboard');
    
    // Search for non-existent entry
    cy.get('[data-testid="search-input"]').type('Non-existent Entry');
    cy.get('[data-testid="search-button"]').click();
    
    // Should show no results message
    cy.get('[data-testid="no-results"]').should('be.visible');
    cy.get('[data-testid="no-results"]').should('contain', 'No entries found');
  });

  it('should sort entries by different criteria', () => {
    cy.visit('/dashboard');
    
    // Sort by title ascending
    cy.get('[data-testid="sort-by"]').select('title-asc');
    cy.get('[data-testid="entry-item"]').first().should('contain', 'Test Entry 1');
    
    // Sort by title descending
    cy.get('[data-testid="sort-by"]').select('title-desc');
    cy.get('[data-testid="entry-item"]').first().should('contain', 'Test Entry 2');
    
    // Sort by date ascending
    cy.get('[data-testid="sort-by"]').select('date-asc');
    cy.get('[data-testid="entry-item"]').first().should('contain', 'Test Entry 1');
    
    // Sort by date descending
    cy.get('[data-testid="sort-by"]').select('date-desc');
    cy.get('[data-testid="entry-item"]').first().should('contain', 'Test Entry 2');
  });

  it('should paginate entries', () => {
    // Create more entries for pagination testing
    for (let i = 3; i <= 15; i++) {
      cy.createTestEntry({
        id: i,
        entry_id: `TEST-${i.toString().padStart(3, '0')}`,
        title: `Test Entry ${i}`,
        type: 'statute_section',
        created_at: `2025-01-${i.toString().padStart(2, '0')}T00:00:00Z`,
        created_by: 1,
        created_by_name: 'Test User'
      });
    }
    
    cy.visit('/dashboard');
    
    // Should show pagination controls
    cy.get('[data-testid="pagination"]').should('be.visible');
    
    // Should show first page with limited entries
    cy.get('[data-testid="entry-item"]').should('have.length', 10);
    
    // Navigate to next page
    cy.get('[data-testid="next-page"]').click();
    
    // Should show next set of entries
    cy.get('[data-testid="entry-item"]').should('have.length', 5);
    
    // Navigate back to first page
    cy.get('[data-testid="prev-page"]').click();
    
    // Should show first set of entries again
    cy.get('[data-testid="entry-item"]').should('have.length', 10);
  });

  it('should show entry statistics', () => {
    cy.visit('/dashboard');
    
    // Check header statistics
    cy.get('[data-testid="total-entries"]').should('contain', '2 entries');
    cy.get('[data-testid="progress-percentage"]').should('be.visible');
    cy.get('[data-testid="remaining-entries"]').should('be.visible');
  });

  it('should handle bulk operations', () => {
    cy.visit('/dashboard');
    
    // Select multiple entries
    cy.get('[data-testid="entry-item"]').first().within(() => {
      cy.get('[data-testid="select-entry"]').check();
    });
    cy.get('[data-testid="entry-item"]').last().within(() => {
      cy.get('[data-testid="select-entry"]').check();
    });
    
    // Should show bulk actions
    cy.get('[data-testid="bulk-actions"]').should('be.visible');
    
    // Test bulk delete
    cy.get('[data-testid="bulk-delete"]').click();
    cy.get('[data-testid="confirm-bulk-delete"]').click();
    
    // Should remove selected entries
    cy.get('[data-testid="entry-item"]').should('have.length', 0);
  });
});
