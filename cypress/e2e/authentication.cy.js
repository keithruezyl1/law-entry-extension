describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.clearTestData();
    cy.visit('/login');
  });

  it('should display login form', () => {
    cy.get('[data-testid="username-input"]').should('be.visible');
    cy.get('[data-testid="password-input"]').should('be.visible');
    cy.get('[data-testid="login-button"]').should('be.visible');
  });

  it('should show validation errors for empty fields', () => {
    cy.get('[data-testid="login-button"]').click();
    
    // Should show validation errors
    cy.get('[data-testid="username-error"]').should('be.visible');
    cy.get('[data-testid="password-error"]').should('be.visible');
  });

  it('should handle invalid credentials', () => {
    cy.get('[data-testid="username-input"]').type('invaliduser');
    cy.get('[data-testid="password-input"]').type('wrongpassword');
    cy.get('[data-testid="login-button"]').click();

    // Should show error message
    cy.get('[data-testid="error-message"]').should('be.visible');
    cy.get('[data-testid="error-message"]').should('contain', 'Invalid credentials');
  });

  it('should login successfully with valid credentials', () => {
    cy.get('[data-testid="username-input"]').type('testuser');
    cy.get('[data-testid="password-input"]').type('testpass');
    cy.get('[data-testid="login-button"]').click();

    // Should redirect to dashboard
    cy.url().should('include', '/dashboard');
    cy.get('[data-testid="dashboard-header"]').should('be.visible');
  });

  it('should logout successfully', () => {
    cy.login('testuser', 'testpass');
    
    // Click logout button
    cy.get('[data-testid="logout-button"]').click();
    
    // Should show logout confirmation modal
    cy.get('[data-testid="logout-modal"]').should('be.visible');
    cy.get('[data-testid="confirm-logout"]').click();
    
    // Should redirect to login page
    cy.url().should('include', '/login');
  });

  it('should handle session expiration', () => {
    cy.login('testuser', 'testpass');
    
    // Simulate session expiration by clearing token
    cy.window().then((win) => {
      win.localStorage.removeItem('auth_token');
    });
    
    // Try to access protected route
    cy.visit('/dashboard');
    
    // Should redirect to login
    cy.url().should('include', '/login');
  });

  it('should remember login state on page refresh', () => {
    cy.login('testuser', 'testpass');
    
    // Refresh the page
    cy.reload();
    
    // Should still be on dashboard
    cy.url().should('include', '/dashboard');
    cy.get('[data-testid="dashboard-header"]').should('be.visible');
  });
});
