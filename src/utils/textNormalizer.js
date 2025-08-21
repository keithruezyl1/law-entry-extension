/**
 * Text normalization utilities for legal content
 */

/**
 * Normalize raw text by cleaning up formatting, whitespace, and standardizing abbreviations
 * @param {string} rawText - The raw text to normalize
 * @returns {string} - Normalized text
 */
export const normalizeText = (rawText) => {
  if (!rawText) return '';

  let normalized = rawText;

  // Remove extra whitespace and normalize line breaks
  normalized = normalized.replace(/\s+/g, ' ');
  normalized = normalized.replace(/\n\s*\n/g, '\n\n');
  normalized = normalized.trim();

  // Standardize common legal abbreviations
  const abbreviations = {
    'Sec\\.': 'Section',
    'Art\\.': 'Article',
    'Para\\.': 'Paragraph',
    'Sub-sec\\.': 'Subsection',
    'Sub-art\\.': 'Sub-article',
    'RA\\s+': 'Republic Act ',
    'PD\\s+': 'Presidential Decree ',
    'EO\\s+': 'Executive Order ',
    'MC\\s+': 'Memorandum Circular ',
    'DO\\s+': 'Department Order ',
    'AO\\s+': 'Administrative Order ',
    'CA\\s+': 'Commonwealth Act ',
    'BP\\s+': 'Batas Pambansa ',
    'ROTC\\s+': 'Rules of Court ',
    'PNP\\s+': 'Philippine National Police ',
    'LTO\\s+': 'Land Transportation Office ',
    'DOJ\\s+': 'Department of Justice ',
    'CHR\\s+': 'Commission on Human Rights ',
    'GBV\\s+': 'Gender-Based Violence ',
    'DUI\\s+': 'Driving Under the Influence ',
    'TVR\\s+': 'Traffic Violation Report ',
    'NOA\\s+': 'Notice of Apprehension ',
    'BWC\\s+': 'Body-Worn Camera '
  };

  Object.entries(abbreviations).forEach(([pattern, replacement]) => {
    const regex = new RegExp(pattern, 'gi');
    normalized = normalized.replace(regex, replacement);
  });

  // Standardize punctuation
  normalized = normalized.replace(/\.{2,}/g, '...');
  normalized = normalized.replace(/\s+([.,;:!?])/g, '$1');
  normalized = normalized.replace(/([.,;:!?])(?=[A-Za-z])/g, '$1 ');

  // Fix common formatting issues
  normalized = normalized.replace(/\s*\(\s*/g, ' (');
  normalized = normalized.replace(/\s*\)\s*/g, ') ');
  normalized = normalized.replace(/\s*\[\s*/g, ' [');
  normalized = normalized.replace(/\s*\]\s*/g, '] ');

  // Remove multiple spaces again after other operations
  normalized = normalized.replace(/\s+/g, ' ');

  return normalized.trim();
};

/**
 * Generate a concise summary from normalized text
 * @param {string} normalizedText - The normalized text to summarize
 * @returns {string} - Generated summary
 */
export const generateSummary = (normalizedText) => {
  if (!normalizedText) return '';

  // Simple summary generation - extract key information
  const sentences = normalizedText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  if (sentences.length === 0) return '';

  // Look for key phrases that indicate the main topic
  const keyPhrases = [
    'prohibits', 'requires', 'establishes', 'defines', 'provides',
    'authorizes', 'mandates', 'regulates', 'governs', 'prescribes',
    'penalty', 'fine', 'imprisonment', 'suspension', 'revocation',
    'procedure', 'process', 'steps', 'guidelines', 'standards'
  ];

  // Find sentences with key phrases
  const relevantSentences = sentences.filter(sentence => 
    keyPhrases.some(phrase => 
      sentence.toLowerCase().includes(phrase.toLowerCase())
    )
  );

  // If we found relevant sentences, use the first one
  if (relevantSentences.length > 0) {
    return relevantSentences[0].trim() + '.';
  }

  // Otherwise, use the first sentence if it's not too long
  const firstSentence = sentences[0].trim();
  if (firstSentence.length <= 200) {
    return firstSentence + '.';
  }

  // If the first sentence is too long, create a simple summary
  const words = firstSentence.split(' ').slice(0, 15);
  return words.join(' ') + '...';
};

/**
 * Extract key phrases from text for tagging suggestions
 * @param {string} text - The text to analyze
 * @returns {string[]} - Array of key phrases
 */
export const extractKeyPhrases = (text) => {
  if (!text) return [];

  const phrases = [];
  const lowerText = text.toLowerCase();

  // Legal domain keywords
  const legalKeywords = [
    'traffic', 'arrest', 'search', 'seizure', 'detention', 'custody',
    'rights', 'counsel', 'miranda', 'warrant', 'probable cause',
    'violation', 'penalty', 'fine', 'suspension', 'revocation',
    'checkpoint', 'sobriety', 'breath test', 'field test',
    'incident', 'report', 'blotter', 'evidence', 'witness',
    'police', 'officer', 'law enforcement', 'public safety'
  ];

  legalKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) {
      phrases.push(keyword);
    }
  });

  // Add police-mode tag if police-related content is found
  const policeTerms = ['police', 'officer', 'law enforcement', 'checkpoint', 'arrest', 'search'];
  if (policeTerms.some(term => lowerText.includes(term))) {
    phrases.push('police-mode');
  }

  return [...new Set(phrases)]; // Remove duplicates
};

/**
 * Calculate text statistics
 * @param {string} text - The text to analyze
 * @returns {object} - Statistics object
 */
export const getTextStats = (text) => {
  if (!text) {
    return {
      characters: 0,
      words: 0,
      sentences: 0,
      paragraphs: 0,
      readingTime: 0
    };
  }

  const characters = text.length;
  const words = text.split(/\s+/).filter(word => word.length > 0).length;
  const sentences = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0).length;
  const paragraphs = text.split(/\n\s*\n/).filter(para => para.trim().length > 0).length;
  
  // Estimate reading time (average 200 words per minute)
  const readingTime = Math.ceil(words / 200);

  return {
    characters,
    words,
    sentences,
    paragraphs,
    readingTime
  };
};

/**
 * Clean and format text for display
 * @param {string} text - The text to format
 * @returns {string} - Formatted text
 */
export const formatTextForDisplay = (text) => {
  if (!text) return '';

  let formatted = text;

  // Preserve line breaks for display
  formatted = formatted.replace(/\n/g, '<br>');
  
  // Highlight important terms
  const importantTerms = [
    'shall', 'must', 'required', 'prohibited', 'penalty', 'fine',
    'imprisonment', 'suspension', 'revocation', 'warrant', 'rights'
  ];

  importantTerms.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    formatted = formatted.replace(regex, `<strong>${term}</strong>`);
  });

  return formatted;
};





