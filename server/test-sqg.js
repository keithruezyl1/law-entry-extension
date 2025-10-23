/**
 * Test script for Structured Query Generation (SQG)
 * 
 * Usage:
 *   node test-sqg.js "What is bail?"
 *   node test-sqg.js "Hey, what's the rule when computing deadlines if the last day falls on a Sunday?"
 */

import 'dotenv/config';
import { generateStructuredQuery } from './src/utils/structured-query-generator.js';

async function testSQG() {
  const question = process.argv[2] || "What is bail?";
  
  console.log('\n📝 Testing Structured Query Generation\n');
  console.log('Input Question:', question);
  console.log('\n' + '='.repeat(60) + '\n');
  
  try {
    const started = Date.now();
    const structuredQuery = await generateStructuredQuery(question);
    const elapsed = Date.now() - started;
    
    console.log('✅ SQG Output:\n');
    console.log(JSON.stringify(structuredQuery, null, 2));
    
    console.log('\n' + '='.repeat(60));
    console.log(`⏱️  Latency: ${elapsed}ms`);
    console.log('✅ Test completed successfully!\n');
    
    // Summary stats
    console.log('📊 Summary:');
    console.log(`  - Keywords: ${structuredQuery.keywords.length}`);
    console.log(`  - Legal Topics: ${structuredQuery.legal_topics.length}`);
    console.log(`  - Statutes: ${structuredQuery.statutes_referenced.length}`);
    console.log(`  - Query Expansions: ${structuredQuery.query_expansions.length}`);
    console.log(`  - Urgency: ${structuredQuery.urgency}`);
    console.log(`  - Jurisdiction: ${structuredQuery.jurisdiction}`);
    
  } catch (error) {
    console.error('\n❌ SQG Test Failed:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

testSQG();

