/**
 * Query Classifier - Detects query intent and routes to appropriate handlers
 * Handles meta queries, list requests, and conversational follow-ups
 */

// Query type patterns
const QUERY_PATTERNS = {
  // Meta queries (about the system itself)
  meta: {
    patterns: [
      /\b(who are you|what are you|what can you do|what do you know|how do you work)\b/i,
      /\b(help|guide|tutorial|instructions)\b/i,
      /\b(what is (this|villy)|introduce yourself)\b/i,
    ],
    handler: 'meta',
  },
  
  // List/enumeration requests
  list: {
    patterns: [
      /\b(list|enumerate|give me|show me|tell me)\s+(\d+|all|some|many|few)?\s*(republic acts?|statutes?|laws?|rules?|articles?)\b/i,
      /\b(what are (the|all|some))?\s*(republic acts?|statutes?|laws?|rules?)\b/i,
      /\b(name|provide|suggest)\s+(\d+)?\s*(examples?|republic acts?|laws?)\b/i,
    ],
    handler: 'list',
  },
  
  // Follow-up conversational queries
  followUp: {
    patterns: [
      /^(another|more|else|too|also|and|additionally)[\s\d]*/i,
      /^(what about|how about|tell me about)/i,
      /^(next|previous|other)/i,
    ],
    handler: 'followUp',
  },
  
  // Definitional queries (handled well by RAG)
  definition: {
    patterns: [
      /\b(what is|what are|define|meaning of|definition of)\b/i,
      /\bexplain\b/i,
    ],
    handler: 'definition', // Use normal RAG
  },
  
  // Procedural queries (handled well by RAG)
  procedure: {
    patterns: [
      /\b(how to|how do I|how can I|what is the process|procedure for|steps to)\b/i,
      /\b(requirements?|needed|necessary|must)\b/i,
    ],
    handler: 'procedure', // Use normal RAG
  },
  
  // Legal analysis queries (handled well by RAG)
  analysis: {
    patterns: [
      /\b(penalty|penalties|punishment|sentence|imprisonment|fine)\b/i,
      /\b(elements? of|constitutes?|liable|violation)\b/i,
      /\b(rights?|obligations?|duties?|responsibilities?)\b/i,
    ],
    handler: 'analysis', // Use normal RAG
  },
};

/**
 * Classify a user query into a type
 * @param {string} query - User's question
 * @returns {Object} { type, confidence, originalQuery }
 */
export function classifyQuery(query) {
  const q = String(query || '').trim();
  
  if (!q) {
    return { type: 'unknown', confidence: 0, originalQuery: q };
  }
  
  // Check each pattern type
  for (const [type, config] of Object.entries(QUERY_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(q)) {
        return {
          type,
          handler: config.handler,
          confidence: 1.0,
          originalQuery: q,
        };
      }
    }
  }
  
  // Default: legal query (use normal RAG)
  return {
    type: 'legal',
    handler: 'legal',
    confidence: 0.8,
    originalQuery: q,
  };
}

/**
 * Generate a canned response for meta queries
 * @param {string} query 
 * @returns {Object} { answer, sources }
 */
export function handleMetaQuery(query) {
  const q = query.toLowerCase();
  
  if (/who are you|what are you|introduce/.test(q)) {
    return {
      answer: `I am **Villy**, a legal assistant specialized in **Philippine law**. I can help you understand:

• **Criminal law** (Revised Penal Code, special penal laws)
• **Rules of Court** (procedural rules, bail, arrest, evidence)
• **Civil law** (obligations, contracts, family code)
• **Constitutional law** (1987 Constitution, Bill of Rights)
• **Labor law** (Labor Code, employment rights)
• **Administrative law** (agency circulars, executive orders)
• **Special laws** (Republic Acts, Batas Pambansa, Presidential Decrees)

I can answer questions like:
- "What is bail?"
- "What are the elements of theft?"
- "What are the penalties for estafa?"
- "How to file a complaint?"
- "What are my rights when arrested?"

Ask me anything about Philippine law, and I'll provide accurate, cited answers based on official legal texts.`,
      sources: [],
      skipRAG: true,
    };
  }
  
  if (/what can you do|help|guide/.test(q)) {
    return {
      answer: `I can help you with **Philippine law** in several ways:

**1. Legal Definitions**
Ask: "What is estafa?", "What is bail?", "What is probable cause?"

**2. Legal Requirements & Procedures**
Ask: "How to file a complaint?", "What are the requirements for bail?", "What is the process for arrest?"

**3. Legal Analysis**
Ask: "What are the elements of theft?", "What are the penalties for rape?", "What are defenses against libel?"

**4. Rights & Obligations**
Ask: "What are my rights when arrested?", "What are the rights of OFWs?", "What are labor rights?"

**5. Statute Lookups**
Ask: "What is Rule 114 Section 20?", "What is RA 7610?", "What is RPC Article 266-A?"

**Tips:**
- Be specific in your questions
- Mention statute numbers if you know them
- Ask follow-up questions for clarification
- I always cite my sources for accuracy`,
      sources: [],
      skipRAG: true,
    };
  }
  
  // Generic meta response
  return {
    answer: `I am Villy, your Philippine law assistant. I can help you understand laws, statutes, rules of court, and legal procedures. Please ask me a specific legal question, such as "What is bail?" or "What are the penalties for theft?"`,
    sources: [],
    skipRAG: true,
  };
}

/**
 * Handle list/enumeration requests using SQL aggregation
 * @param {string} query 
 * @param {Function} dbQuery - Database query function
 * @returns {Promise<Object>} { answer, sources, skipRAG }
 */
export async function handleListQuery(query, dbQuery) {
  const q = query.toLowerCase();
  
  // Extract count if specified
  const countMatch = q.match(/(\d+)/);
  const requestedCount = countMatch ? parseInt(countMatch[1]) : 5;
  const limit = Math.min(requestedCount, 20); // Cap at 20
  
  // Determine what type of list is requested
  let type = null;
  let lawFamily = null;
  
  if (/republic act/i.test(q)) {
    type = 'statute_section';
    lawFamily = 'Republic Act';
  } else if (/rules? of court|roc/i.test(q)) {
    type = 'rule_of_court';
  } else if (/penal code|rpc|criminal law/i.test(q)) {
    type = 'statute_section';
    lawFamily = 'Revised Penal Code';
  } else if (/constitution/i.test(q)) {
    type = 'constitution_provision';
  }
  
  try {
    // Build SQL query for diverse, high-quality entries
    const sql = `
      SELECT entry_id, type, title, canonical_citation, summary, tags
      FROM kb_entries
      WHERE ($1::text IS NULL OR type = $1)
        AND ($2::text IS NULL OR law_family = $2)
        AND status = 'active'
        AND verified = true
      ORDER BY 
        -- Prioritize well-documented entries
        (CASE WHEN summary IS NOT NULL AND summary != '' THEN 1 ELSE 0 END) DESC,
        -- Diversify by spreading across different domains
        RANDOM()
      LIMIT $3
    `;
    
    const result = await dbQuery(sql, [type, lawFamily, limit]);
    const entries = result.rows || [];
    
    if (entries.length === 0) {
      return {
        answer: `I couldn't find specific entries matching your request. Please try a more specific question, such as "What is bail?" or "What are the elements of theft?"`,
        sources: [],
        skipRAG: false, // Let RAG handle it
      };
    }
    
    // Format as a numbered list
    const listItems = entries.map((entry, idx) => {
      const citation = entry.canonical_citation || '';
      const summary = entry.summary ? ` - ${entry.summary.slice(0, 150)}${entry.summary.length > 150 ? '...' : ''}` : '';
      return `${idx + 1}. **${entry.title}** (${citation})${summary}`;
    }).join('\n\n');
    
    const typeLabel = type 
      ? (lawFamily || type.replace(/_/g, ' '))
      : 'Philippine law entries';
    
    const answer = `Here are **${entries.length} ${typeLabel}** from the knowledge base:\n\n${listItems}\n\n---\n\n**Note**: For detailed information about any of these, please ask a specific question (e.g., "What is ${entries[0].title}?").`;
    
    return {
      answer,
      sources: entries.map(e => ({
        entry_id: e.entry_id,
        type: e.type,
        title: e.title,
        canonical_citation: e.canonical_citation,
        summary: e.summary,
        tags: e.tags || [],
      })),
      skipRAG: true,
    };
  } catch (error) {
    console.error('[query-classifier] handleListQuery failed:', error.message);
    return {
      answer: null,
      sources: [],
      skipRAG: false, // Fallback to RAG
    };
  }
}

/**
 * Handle follow-up conversational queries by combining with previous context
 * @param {string} query - Current query
 * @param {Object} context - Previous query context { question, answer, sources }
 * @returns {Object} { enhancedQuery, shouldUseRAG }
 */
export function handleFollowUpQuery(query, context) {
  const q = String(query || '').trim();
  
  if (!context || !context.question) {
    // No context available, treat as new query
    return {
      enhancedQuery: q,
      shouldUseRAG: true,
    };
  }
  
  // Check if it's truly a follow-up
  const isFollowUp = /^(another|more|else|too|also|next|other|what about|how about)/i.test(q);
  
  if (!isFollowUp) {
    return {
      enhancedQuery: q,
      shouldUseRAG: true,
    };
  }
  
  // Extract the numeric request if present (e.g., "another 5")
  const numberMatch = q.match(/(\d+)/);
  const isNumberedRequest = numberMatch && /^(another|more)\s+\d+/i.test(q);
  
  if (isNumberedRequest) {
    // User wants more items of the same type
    // Extract the domain from previous question
    const prevQ = context.question.toLowerCase();
    let domain = 'laws';
    
    if (/republic act/i.test(prevQ)) domain = 'republic acts';
    else if (/rule/i.test(prevQ)) domain = 'rules of court';
    else if (/statute/i.test(prevQ)) domain = 'statutes';
    else if (/penal/i.test(prevQ)) domain = 'criminal laws';
    
    const count = numberMatch[1];
    const enhancedQuery = `list ${count} ${domain}`;
    
    return {
      enhancedQuery,
      shouldUseRAG: true,
      isListQuery: true,
    };
  }
  
  // Generic follow-up - append context to query
  const enhancedQuery = `${context.question} ${q}`;
  
  return {
    enhancedQuery,
    shouldUseRAG: true,
    contextAdded: true,
  };
}

export default {
  classifyQuery,
  handleMetaQuery,
  handleListQuery,
  handleFollowUpQuery,
};

