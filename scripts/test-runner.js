#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestRunner {
  constructor() {
    this.results = {
      unit: { passed: 0, failed: 0, duration: 0 },
      integration: { passed: 0, failed: 0, duration: 0 },
      e2e: { passed: 0, failed: 0, duration: 0 },
      performance: { passed: 0, failed: 0, duration: 0 },
      lighthouse: { passed: 0, failed: 0, duration: 0 }
    };
    this.startTime = Date.now();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      progress: '🔄'
    }[type] || 'ℹ️';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async runCommand(command, description) {
    this.log(`Starting: ${description}`, 'progress');
    const startTime = Date.now();
    
    try {
      const output = execSync(command, { 
        encoding: 'utf8', 
        stdio: 'pipe',
        cwd: process.cwd()
      });
      
      const duration = Date.now() - startTime;
      this.log(`Completed: ${description} (${duration}ms)`, 'success');
      
      return { success: true, output, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log(`Failed: ${description} (${duration}ms)`, 'error');
      this.log(error.message, 'error');
      
      return { success: false, error: error.message, duration };
    }
  }

  async runUnitTests() {
    this.log('Running Unit Tests...', 'progress');
    
    const result = await this.runCommand(
      'npm run test:ci',
      'Unit and Integration Tests'
    );
    
    if (result.success) {
      this.results.unit.passed = 1;
      this.results.unit.duration = result.duration;
      
      // Parse coverage from output
      const coverageMatch = result.output.match(/All files\s+\|\s+(\d+(?:\.\d+)?)\s+\|\s+(\d+(?:\.\d+)?)\s+\|\s+(\d+(?:\.\d+)?)\s+\|\s+(\d+(?:\.\d+)?)/);
      if (coverageMatch) {
        const [, statements, branches, functions, lines] = coverageMatch;
        this.log(`Coverage - Statements: ${statements}%, Branches: ${branches}%, Functions: ${functions}%, Lines: ${lines}%`, 'info');
      }
    } else {
      this.results.unit.failed = 1;
      this.results.unit.duration = result.duration;
    }
    
    return result;
  }

  async runE2ETests() {
    this.log('Running End-to-End Tests...', 'progress');
    
    const result = await this.runCommand(
      'npm run test:e2e',
      'End-to-End Tests'
    );
    
    if (result.success) {
      this.results.e2e.passed = 1;
      this.results.e2e.duration = result.duration;
      
      // Parse test results from output
      const testMatch = result.output.match(/(\d+) passing.*?(\d+) failing/);
      if (testMatch) {
        const [, passing, failing] = testMatch;
        this.log(`E2E Tests - Passing: ${passing}, Failing: ${failing}`, 'info');
      }
    } else {
      this.results.e2e.failed = 1;
      this.results.e2e.duration = result.duration;
    }
    
    return result;
  }

  async runPerformanceTests() {
    this.log('Running Performance Tests...', 'progress');
    
    const result = await this.runCommand(
      'npm run test:performance',
      'Performance Tests'
    );
    
    if (result.success) {
      this.results.performance.passed = 1;
      this.results.performance.duration = result.duration;
    } else {
      this.results.performance.failed = 1;
      this.results.performance.duration = result.duration;
    }
    
    return result;
  }

  async runLighthouseTests() {
    this.log('Running Lighthouse Tests...', 'progress');
    
    const result = await this.runCommand(
      'npm run test:lighthouse',
      'Lighthouse Tests'
    );
    
    if (result.success) {
      this.results.lighthouse.passed = 1;
      this.results.lighthouse.duration = result.duration;
    } else {
      this.results.lighthouse.failed = 1;
      this.results.lighthouse.duration = result.duration;
    }
    
    return result;
  }

  generateReport() {
    const totalDuration = Date.now() - this.startTime;
    const totalPassed = Object.values(this.results).reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = Object.values(this.results).reduce((sum, r) => sum + r.failed, 0);
    
    this.log('\n' + '='.repeat(80), 'info');
    this.log('🧪 TEST SUITE SUMMARY', 'info');
    this.log('='.repeat(80), 'info');
    
    Object.entries(this.results).forEach(([category, result]) => {
      const status = result.failed > 0 ? '❌ FAILED' : '✅ PASSED';
      const duration = `${result.duration}ms`;
      this.log(`${category.toUpperCase().padEnd(15)} | ${status.padEnd(10)} | ${duration.padStart(8)}`, 'info');
    });
    
    this.log('-'.repeat(80), 'info');
    this.log(`TOTAL${' '.repeat(10)} | ${totalFailed > 0 ? '❌ FAILED' : '✅ PASSED'.padEnd(10)} | ${totalDuration.toString().padStart(8)}ms`, 'info');
    this.log('='.repeat(80), 'info');
    
    // Overall status
    if (totalFailed > 0) {
      this.log(`❌ Test suite failed with ${totalFailed} failed test category(ies)`, 'error');
      process.exit(1);
    } else {
      this.log('✅ All tests passed successfully!', 'success');
    }
  }

  async runAllTests() {
    this.log('🚀 Starting Comprehensive Test Suite', 'info');
    this.log(`Started at: ${new Date().toLocaleString()}`, 'info');
    
    try {
      // Run tests in sequence to avoid conflicts
      await this.runUnitTests();
      await this.runE2ETests();
      await this.runPerformanceTests();
      await this.runLighthouseTests();
      
      this.generateReport();
      
    } catch (error) {
      this.log(`Test suite failed with error: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const runner = new TestRunner();
  runner.runAllTests().catch(console.error);
}

module.exports = TestRunner;
