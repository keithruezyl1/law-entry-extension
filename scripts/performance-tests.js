const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class PerformanceTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = [];
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    
    // Enable performance monitoring
    await this.page.setCacheEnabled(false);
    await this.page.setViewport({ width: 1280, height: 720 });
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async measurePageLoad(url, testName) {
    console.log(`Testing ${testName}: ${url}`);
    
    const startTime = Date.now();
    
    // Start performance monitoring
    await this.page.evaluateOnNewDocument(() => {
      window.performance.mark('test-start');
    });

    // Navigate to page
    const response = await this.page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    const endTime = Date.now();
    const loadTime = endTime - startTime;

    // Get performance metrics
    const metrics = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint');
      
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        totalLoadTime: navigation.loadEventEnd - navigation.fetchStart,
        transferSize: navigation.transferSize,
        encodedBodySize: navigation.encodedBodySize,
        decodedBodySize: navigation.decodedBodySize
      };
    });

    const result = {
      testName,
      url,
      loadTime,
      ...metrics,
      status: response.status(),
      timestamp: new Date().toISOString()
    };

    this.results.push(result);
    console.log(`✓ ${testName}: ${loadTime}ms`);
    
    return result;
  }

  async measureFormPerformance(url, testName) {
    console.log(`Testing form performance: ${testName}`);
    
    await this.page.goto(url, { waitUntil: 'networkidle0' });

    // Measure form rendering time
    const formRenderStart = Date.now();
    
    // Wait for form to be visible
    await this.page.waitForSelector('form', { timeout: 10000 });
    
    const formRenderEnd = Date.now();
    const formRenderTime = formRenderEnd - formRenderStart;

    // Measure form interaction performance
    const interactionStart = Date.now();
    
    // Simulate form interactions
    await this.page.type('input[name="title"]', 'Performance Test Entry');
    await this.page.select('select[name="type"]', 'statute_section');
    await this.page.type('input[name="jurisdiction"]', 'PH');
    await this.page.type('input[name="law_family"]', 'Test Law');
    await this.page.type('input[name="canonical_citation"]', 'Test Citation');
    await this.page.type('textarea[name="summary"]', 'This is a test summary for performance testing');
    await this.page.type('textarea[name="text"]', 'This is a longer text content for performance testing. It should be at least 50 characters long to pass validation.');
    
    const interactionEnd = Date.now();
    const interactionTime = interactionEnd - interactionStart;

    // Measure validation performance
    const validationStart = Date.now();
    
    // Trigger validation
    await this.page.click('button[type="submit"]');
    await this.page.waitForTimeout(100); // Wait for validation to complete
    
    const validationEnd = Date.now();
    const validationTime = validationEnd - validationStart;

    const result = {
      testName: `Form Performance - ${testName}`,
      url,
      formRenderTime,
      interactionTime,
      validationTime,
      totalFormTime: formRenderTime + interactionTime + validationTime,
      timestamp: new Date().toISOString()
    };

    this.results.push(result);
    console.log(`✓ Form Performance - ${testName}: ${result.totalFormTime}ms`);
    
    return result;
  }

  async measureSearchPerformance(url, testName, searchQueries) {
    console.log(`Testing search performance: ${testName}`);
    
    await this.page.goto(url, { waitUntil: 'networkidle0' });

    const searchResults = [];

    for (const query of searchQueries) {
      const searchStart = Date.now();
      
      // Perform search
      await this.page.type('input[placeholder*="search" i]', query);
      await this.page.keyboard.press('Enter');
      
      // Wait for search results
      await this.page.waitForTimeout(500);
      
      const searchEnd = Date.now();
      const searchTime = searchEnd - searchStart;

      // Get result count
      const resultCount = await this.page.evaluate(() => {
        const results = document.querySelectorAll('[data-testid="entry-item"]');
        return results.length;
      });

      searchResults.push({
        query,
        searchTime,
        resultCount
      });

      // Clear search
      await this.page.evaluate(() => {
        const searchInput = document.querySelector('input[placeholder*="search" i]');
        if (searchInput) {
          searchInput.value = '';
        }
      });
    }

    const avgSearchTime = searchResults.reduce((sum, r) => sum + r.searchTime, 0) / searchResults.length;

    const result = {
      testName: `Search Performance - ${testName}`,
      url,
      searchResults,
      avgSearchTime,
      timestamp: new Date().toISOString()
    };

    this.results.push(result);
    console.log(`✓ Search Performance - ${testName}: ${avgSearchTime.toFixed(2)}ms avg`);
    
    return result;
  }

  async measureMemoryUsage(url, testName) {
    console.log(`Testing memory usage: ${testName}`);
    
    await this.page.goto(url, { waitUntil: 'networkidle0' });

    // Get initial memory usage
    const initialMemory = await this.page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    });

    // Perform some actions to test memory growth
    for (let i = 0; i < 10; i++) {
      await this.page.evaluate(() => {
        // Simulate some DOM manipulation
        const div = document.createElement('div');
        div.textContent = `Test element ${i}`;
        document.body.appendChild(div);
        
        // Remove it after a short delay
        setTimeout(() => {
          if (div.parentNode) {
            div.parentNode.removeChild(div);
          }
        }, 100);
      });
      
      await this.page.waitForTimeout(100);
    }

    // Get final memory usage
    const finalMemory = await this.page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    });

    const result = {
      testName: `Memory Usage - ${testName}`,
      url,
      initialMemory,
      finalMemory,
      memoryGrowth: finalMemory && initialMemory ? 
        finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize : null,
      timestamp: new Date().toISOString()
    };

    this.results.push(result);
    console.log(`✓ Memory Usage - ${testName}: ${result.memoryGrowth ? `${result.memoryGrowth} bytes growth` : 'N/A'}`);
    
    return result;
  }

  async runAllTests(baseUrl = 'http://localhost:3000') {
    console.log('🚀 Starting Performance Tests...\n');

    try {
      await this.init();

      // Test 1: Page Load Performance
      await this.measurePageLoad(`${baseUrl}/login`, 'Login Page');
      await this.measurePageLoad(`${baseUrl}/dashboard`, 'Dashboard Page');
      await this.measurePageLoad(`${baseUrl}/law-entry/1`, 'Entry Form Page');

      // Test 2: Form Performance
      await this.measureFormPerformance(`${baseUrl}/law-entry/1`, 'Entry Creation Form');

      // Test 3: Search Performance
      await this.measureSearchPerformance(
        `${baseUrl}/dashboard`, 
        'Entry Search', 
        ['criminal', 'civil', 'constitution', 'rights', 'procedure']
      );

      // Test 4: Memory Usage
      await this.measureMemoryUsage(`${baseUrl}/dashboard`, 'Dashboard Memory');
      await this.measureMemoryUsage(`${baseUrl}/law-entry/1`, 'Form Memory');

      // Generate report
      await this.generateReport();

    } catch (error) {
      console.error('❌ Performance test failed:', error);
    } finally {
      await this.cleanup();
    }
  }

  async generateReport() {
    console.log('\n📊 Performance Test Results:');
    console.log('='.repeat(80));

    // Calculate averages
    const pageLoadTests = this.results.filter(r => r.testName.includes('Page'));
    const formTests = this.results.filter(r => r.testName.includes('Form'));
    const searchTests = this.results.filter(r => r.testName.includes('Search'));
    const memoryTests = this.results.filter(r => r.testName.includes('Memory'));

    if (pageLoadTests.length > 0) {
      const avgLoadTime = pageLoadTests.reduce((sum, r) => sum + r.loadTime, 0) / pageLoadTests.length;
      console.log(`\n📄 Page Load Performance:`);
      console.log(`   Average Load Time: ${avgLoadTime.toFixed(2)}ms`);
      
      pageLoadTests.forEach(test => {
        console.log(`   ${test.testName}: ${test.loadTime}ms`);
        if (test.firstContentfulPaint) {
          console.log(`     First Contentful Paint: ${test.firstContentfulPaint.toFixed(2)}ms`);
        }
      });
    }

    if (formTests.length > 0) {
      const avgFormTime = formTests.reduce((sum, r) => sum + r.totalFormTime, 0) / formTests.length;
      console.log(`\n📝 Form Performance:`);
      console.log(`   Average Form Time: ${avgFormTime.toFixed(2)}ms`);
      
      formTests.forEach(test => {
        console.log(`   ${test.testName}: ${test.totalFormTime}ms`);
        console.log(`     Render: ${test.formRenderTime}ms, Interaction: ${test.interactionTime}ms, Validation: ${test.validationTime}ms`);
      });
    }

    if (searchTests.length > 0) {
      console.log(`\n🔍 Search Performance:`);
      
      searchTests.forEach(test => {
        console.log(`   ${test.testName}: ${test.avgSearchTime.toFixed(2)}ms avg`);
        test.searchResults.forEach(result => {
          console.log(`     "${result.query}": ${result.searchTime}ms (${result.resultCount} results)`);
        });
      });
    }

    if (memoryTests.length > 0) {
      console.log(`\n💾 Memory Usage:`);
      
      memoryTests.forEach(test => {
        console.log(`   ${test.testName}:`);
        if (test.memoryGrowth !== null) {
          console.log(`     Memory Growth: ${test.memoryGrowth} bytes`);
        }
        if (test.finalMemory) {
          console.log(`     Final Heap Size: ${(test.finalMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
        }
      });
    }

    // Performance thresholds
    console.log(`\n🎯 Performance Thresholds:`);
    console.log(`   Page Load: < 3000ms (${pageLoadTests.every(t => t.loadTime < 3000) ? '✅ PASS' : '❌ FAIL'})`);
    console.log(`   Form Interaction: < 2000ms (${formTests.every(t => t.totalFormTime < 2000) ? '✅ PASS' : '❌ FAIL'})`);
    console.log(`   Search Response: < 1000ms (${searchTests.every(t => t.avgSearchTime < 1000) ? '✅ PASS' : '❌ FAIL'})`);
    console.log(`   Memory Growth: < 10MB (${memoryTests.every(t => !t.memoryGrowth || t.memoryGrowth < 10 * 1024 * 1024) ? '✅ PASS' : '❌ FAIL'})`);

    // Save detailed results
    const reportPath = path.join(__dirname, '..', 'performance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n📁 Detailed results saved to: ${reportPath}`);

    console.log('\n✅ Performance tests completed!');
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new PerformanceTester();
  const baseUrl = process.env.TEST_URL || 'http://localhost:3000';
  tester.runAllTests(baseUrl).catch(console.error);
}

module.exports = PerformanceTester;
