// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// Custom command for login
Cypress.Commands.add('login', (username = 'testuser', password = 'testpass') => {
  cy.session([username, password], () => {
    cy.visit('/login');
    cy.get('[data-testid="username-input"]').type(username);
    cy.get('[data-testid="password-input"]').type(password);
    cy.get('[data-testid="login-button"]').click();
    cy.url().should('include', '/dashboard');
  });
});

// Custom command for creating a test entry
Cypress.Commands.add('createTestEntry', (entryData = {}) => {
  const defaultEntry = {
    type: 'statute_section',
    title: 'Test Entry',
    jurisdiction: 'PH',
    law_family: 'Test Law',
    canonical_citation: 'Test Citation',
    summary: 'Test summary',
    text: 'Test text content',
    source_urls: ['https://example.com'],
    tags: ['test'],
    ...entryData
  };

  cy.window().then((win) => {
    win.localStorage.setItem('test_entry', JSON.stringify(defaultEntry));
  });
});

// Custom command for clearing all test data
Cypress.Commands.add('clearTestData', () => {
  cy.window().then((win) => {
    win.localStorage.clear();
    win.sessionStorage.clear();
  });
});

// Custom command for waiting for API calls
Cypress.Commands.add('waitForApi', (alias) => {
  cy.wait(alias, { timeout: 10000 });
});

// Custom command for checking performance metrics
Cypress.Commands.add('checkPerformance', () => {
  cy.window().then((win) => {
    return new Cypress.Promise((resolve) => {
      win.performance.getEntriesByType('navigation').forEach((entry) => {
        expect(entry.loadEventEnd - entry.loadEventStart).to.be.lessThan(3000);
        expect(entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart).to.be.lessThan(2000);
      });
      resolve();
    });
  });
});
