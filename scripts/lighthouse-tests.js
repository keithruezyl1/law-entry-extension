const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const path = require('path');

class LighthouseTester {
  constructor() {
    this.results = [];
  }

  async runLighthouseTest(url, testName, options = {}) {
    console.log(`🔍 Running Lighthouse test: ${testName} - ${url}`);

    const chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless', '--no-sandbox', '--disable-setuid-sandbox']
    });

    const defaultOptions = {
      logLevel: 'info',
      output: 'json',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      port: chrome.port,
      ...options
    };

    try {
      const runnerResult = await lighthouse(url, defaultOptions);
      const report = runnerResult.report;
      const lhr = JSON.parse(report);

      const result = {
        testName,
        url,
        timestamp: new Date().toISOString(),
        scores: {
          performance: Math.round(lhr.categories.performance.score * 100),
          accessibility: Math.round(lhr.categories.accessibility.score * 100),
          'best-practices': Math.round(lhr.categories['best-practices'].score * 100),
          seo: Math.round(lhr.categories.seo.score * 100)
        },
        metrics: {
          firstContentfulPaint: lhr.audits['first-contentful-paint']?.numericValue,
          largestContentfulPaint: lhr.audits['largest-contentful-paint']?.numericValue,
          cumulativeLayoutShift: lhr.audits['cumulative-layout-shift']?.numericValue,
          speedIndex: lhr.audits['speed-index']?.numericValue,
          totalBlockingTime: lhr.audits['total-blocking-time']?.numericValue,
          timeToInteractive: lhr.audits['interactive']?.numericValue
        },
        opportunities: lhr.categories.performance.auditRefs
          .filter(ref => ref.group === 'load-opportunities')
          .map(ref => ({
            id: ref.id,
            title: lhr.audits[ref.id]?.title,
            score: lhr.audits[ref.id]?.score,
            savings: lhr.audits[ref.id]?.details?.overallSavingsMs
          }))
          .filter(opp => opp.savings > 0)
          .sort((a, b) => b.savings - a.savings)
          .slice(0, 5), // Top 5 opportunities
        diagnostics: lhr.categories.performance.auditRefs
          .filter(ref => ref.group === 'diagnostics')
          .map(ref => ({
            id: ref.id,
            title: lhr.audits[ref.id]?.title,
            score: lhr.audits[ref.id]?.score,
            description: lhr.audits[ref.id]?.description
          }))
          .filter(diag => diag.score < 0.9) // Issues with score < 90%
      };

      this.results.push(result);
      console.log(`✅ ${testName} completed:`);
      console.log(`   Performance: ${result.scores.performance}/100`);
      console.log(`   Accessibility: ${result.scores.accessibility}/100`);
      console.log(`   Best Practices: ${result.scores['best-practices']}/100`);
      console.log(`   SEO: ${result.scores.seo}/100`);

      return result;

    } finally {
      await chrome.kill();
    }
  }

  async runAllTests(baseUrl = 'http://localhost:3000') {
    console.log('🚀 Starting Lighthouse Tests...\n');

    try {
      // Test main pages
      await this.runLighthouseTest(`${baseUrl}/login`, 'Login Page');
      await this.runLighthouseTest(`${baseUrl}/dashboard`, 'Dashboard Page');
      await this.runLighthouseTest(`${baseUrl}/law-entry/1`, 'Entry Form Page');

      // Generate comprehensive report
      await this.generateReport();

    } catch (error) {
      console.error('❌ Lighthouse test failed:', error);
    }
  }

  async generateReport() {
    console.log('\n📊 Lighthouse Test Results:');
    console.log('='.repeat(80));

    // Calculate averages
    const avgScores = {
      performance: 0,
      accessibility: 0,
      'best-practices': 0,
      seo: 0
    };

    this.results.forEach(result => {
      Object.keys(avgScores).forEach(category => {
        avgScores[category] += result.scores[category];
      });
    });

    Object.keys(avgScores).forEach(category => {
      avgScores[category] = Math.round(avgScores[category] / this.results.length);
    });

    console.log(`\n📈 Average Scores:`);
    console.log(`   Performance: ${avgScores.performance}/100`);
    console.log(`   Accessibility: ${avgScores.accessibility}/100`);
    console.log(`   Best Practices: ${avgScores['best-practices']}/100`);
    console.log(`   SEO: ${avgScores.seo}/100`);

    // Performance metrics summary
    console.log(`\n⚡ Performance Metrics:`);
    this.results.forEach(result => {
      console.log(`\n   ${result.testName}:`);
      if (result.metrics.firstContentfulPaint) {
        console.log(`     First Contentful Paint: ${result.metrics.firstContentfulPaint.toFixed(0)}ms`);
      }
      if (result.metrics.largestContentfulPaint) {
        console.log(`     Largest Contentful Paint: ${result.metrics.largestContentfulPaint.toFixed(0)}ms`);
      }
      if (result.metrics.cumulativeLayoutShift) {
        console.log(`     Cumulative Layout Shift: ${result.metrics.cumulativeLayoutShift.toFixed(3)}`);
      }
      if (result.metrics.speedIndex) {
        console.log(`     Speed Index: ${result.metrics.speedIndex.toFixed(0)}ms`);
      }
      if (result.metrics.totalBlockingTime) {
        console.log(`     Total Blocking Time: ${result.metrics.totalBlockingTime.toFixed(0)}ms`);
      }
    });

    // Top optimization opportunities
    console.log(`\n🎯 Top Optimization Opportunities:`);
    const allOpportunities = this.results.flatMap(r => r.opportunities);
    const groupedOpportunities = {};

    allOpportunities.forEach(opp => {
      if (!groupedOpportunities[opp.id]) {
        groupedOpportunities[opp.id] = {
          title: opp.title,
          totalSavings: 0,
          count: 0
        };
      }
      groupedOpportunities[opp.id].totalSavings += opp.savings;
      groupedOpportunities[opp.id].count += 1;
    });

    const sortedOpportunities = Object.entries(groupedOpportunities)
      .map(([id, data]) => ({
        id,
        title: data.title,
        avgSavings: data.totalSavings / data.count,
        count: data.count
      }))
      .sort((a, b) => b.avgSavings - a.avgSavings)
      .slice(0, 5);

    sortedOpportunities.forEach((opp, index) => {
      console.log(`   ${index + 1}. ${opp.title}: ${opp.avgSavings.toFixed(0)}ms avg savings (${opp.count} pages)`);
    });

    // Accessibility issues
    console.log(`\n♿ Accessibility Issues:`);
    const allDiagnostics = this.results.flatMap(r => r.diagnostics);
    const groupedDiagnostics = {};

    allDiagnostics.forEach(diag => {
      if (!groupedDiagnostics[diag.id]) {
        groupedDiagnostics[diag.id] = {
          title: diag.title,
          count: 0,
          avgScore: 0
        };
      }
      groupedDiagnostics[diag.id].count += 1;
      groupedDiagnostics[diag.id].avgScore += diag.score;
    });

    const sortedDiagnostics = Object.entries(groupedDiagnostics)
      .map(([id, data]) => ({
        id,
        title: data.title,
        avgScore: data.avgScore / data.count,
        count: data.count
      }))
      .sort((a, b) => a.avgScore - b.avgScore)
      .slice(0, 5);

    if (sortedDiagnostics.length > 0) {
      sortedDiagnostics.forEach((diag, index) => {
        console.log(`   ${index + 1}. ${diag.title}: ${(diag.avgScore * 100).toFixed(0)}% avg score (${diag.count} pages)`);
      });
    } else {
      console.log(`   No significant accessibility issues found! 🎉`);
    }

    // Performance thresholds
    console.log(`\n🎯 Performance Thresholds:`);
    const thresholds = {
      performance: 90,
      accessibility: 95,
      'best-practices': 90,
      seo: 90
    };

    Object.entries(thresholds).forEach(([category, threshold]) => {
      const passed = avgScores[category] >= threshold;
      console.log(`   ${category}: ${avgScores[category]}/100 (${passed ? '✅ PASS' : '❌ FAIL'} - threshold: ${threshold})`);
    });

    // Core Web Vitals assessment
    console.log(`\n🌐 Core Web Vitals Assessment:`);
    this.results.forEach(result => {
      console.log(`\n   ${result.testName}:`);
      
      const lcp = result.metrics.largestContentfulPaint;
      const fid = result.metrics.totalBlockingTime; // Using TBT as proxy for FID
      const cls = result.metrics.cumulativeLayoutShift;
      
      console.log(`     LCP: ${lcp ? (lcp < 2500 ? '✅ Good' : lcp < 4000 ? '⚠️ Needs Improvement' : '❌ Poor') : 'N/A'} (${lcp ? lcp.toFixed(0) + 'ms' : 'N/A'})`);
      console.log(`     FID: ${fid ? (fid < 100 ? '✅ Good' : fid < 300 ? '⚠️ Needs Improvement' : '❌ Poor') : 'N/A'} (${fid ? fid.toFixed(0) + 'ms' : 'N/A'})`);
      console.log(`     CLS: ${cls ? (cls < 0.1 ? '✅ Good' : cls < 0.25 ? '⚠️ Needs Improvement' : '❌ Poor') : 'N/A'} (${cls ? cls.toFixed(3) : 'N/A'})`);
    });

    // Save detailed results
    const reportPath = path.join(__dirname, '..', 'lighthouse-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n📁 Detailed results saved to: ${reportPath}`);

    // Generate HTML report
    await this.generateHTMLReport();

    console.log('\n✅ Lighthouse tests completed!');
  }

  async generateHTMLReport() {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lighthouse Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .score-card { padding: 20px; border-radius: 8px; text-align: center; }
        .score-good { background-color: #d4edda; color: #155724; }
        .score-warning { background-color: #fff3cd; color: #856404; }
        .score-poor { background-color: #f8d7da; color: #721c24; }
        .score-value { font-size: 2em; font-weight: bold; }
        .score-label { font-size: 0.9em; margin-top: 5px; }
        .test-result { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 10px 0; }
        .metric { padding: 10px; background-color: #f8f9fa; border-radius: 4px; text-align: center; }
        .metric-value { font-weight: bold; color: #007bff; }
        .opportunities { margin: 15px 0; }
        .opportunity { padding: 10px; margin: 5px 0; background-color: #fff3cd; border-left: 4px solid #ffc107; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Lighthouse Performance Report</h1>
        <p class="timestamp">Generated: ${new Date().toLocaleString()}</p>
        
        <div class="summary">
            ${this.generateScoreCards()}
        </div>
        
        ${this.results.map(result => this.generateTestResultHTML(result)).join('')}
    </div>
</body>
</html>`;

    const reportPath = path.join(__dirname, '..', 'lighthouse-report.html');
    fs.writeFileSync(reportPath, htmlContent);
    console.log(`📄 HTML report saved to: ${reportPath}`);
  }

  generateScoreCards() {
    const avgScores = {
      performance: 0,
      accessibility: 0,
      'best-practices': 0,
      seo: 0
    };

    this.results.forEach(result => {
      Object.keys(avgScores).forEach(category => {
        avgScores[category] += result.scores[category];
      });
    });

    Object.keys(avgScores).forEach(category => {
      avgScores[category] = Math.round(avgScores[category] / this.results.length);
    });

    return Object.entries(avgScores).map(([category, score]) => {
      const scoreClass = score >= 90 ? 'score-good' : score >= 50 ? 'score-warning' : 'score-poor';
      return `
        <div class="score-card ${scoreClass}">
          <div class="score-value">${score}</div>
          <div class="score-label">${category.charAt(0).toUpperCase() + category.slice(1)}</div>
        </div>
      `;
    }).join('');
  }

  generateTestResultHTML(result) {
    return `
      <div class="test-result">
        <h3>${result.testName}</h3>
        <p><strong>URL:</strong> ${result.url}</p>
        <p><strong>Timestamp:</strong> ${new Date(result.timestamp).toLocaleString()}</p>
        
        <div class="metrics">
          ${Object.entries(result.metrics).map(([key, value]) => `
            <div class="metric">
              <div class="metric-value">${value ? (typeof value === 'number' ? value.toFixed(0) + (key.includes('Time') || key.includes('Paint') ? 'ms' : '') : value) : 'N/A'}</div>
              <div>${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</div>
            </div>
          `).join('')}
        </div>
        
        ${result.opportunities.length > 0 ? `
          <div class="opportunities">
            <h4>Top Optimization Opportunities:</h4>
            ${result.opportunities.map(opp => `
              <div class="opportunity">
                <strong>${opp.title}</strong> - Potential savings: ${opp.savings.toFixed(0)}ms
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new LighthouseTester();
  const baseUrl = process.env.TEST_URL || 'http://localhost:3000';
  tester.runAllTests(baseUrl).catch(console.error);
}

module.exports = LighthouseTester;
