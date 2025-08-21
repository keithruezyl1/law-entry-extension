export function generateEntryId(type: string, lawFamily: string, sectionId?: string): string {
  const now = new Date();
  const year = now.getFullYear();
  
  switch (type) {
    case 'statute_section':
      if (lawFamily.includes('RPC') || lawFamily.includes('Revised Penal Code')) {
        return `RPC-${sectionId || 'Art'}`;
      }
      if (lawFamily.includes('RA')) {
        const raMatch = lawFamily.match(/RA\s*(\d+)/i);
        const raNumber = raMatch ? raMatch[1] : '0000';
        return `RA${raNumber}-${sectionId || 'Sec'}`;
      }
      return `${lawFamily.replace(/\s+/g, '')}-${sectionId || 'Sec'}`;
      
    case 'rule_of_court':
      if (sectionId) {
        const ruleMatch = sectionId.match(/Rule\s*(\d+)/i);
        const secMatch = sectionId.match(/Sec\.\s*(\d+)/i);
        if (ruleMatch && secMatch) {
          return `ROC-Rule${ruleMatch[1]}-Sec${secMatch[1]}`;
        }
      }
      return `ROC-${sectionId || 'Rule'}`;
      
    case 'city_ordinance_section':
      if (lawFamily.includes('Cebu')) {
        const coMatch = lawFamily.match(/Ord\.\s*(\d+)/i);
        const coNumber = coMatch ? coMatch[1] : '0000';
        return `CEBU-CO${coNumber}-${sectionId || 'Sec'}`;
      }
      return `${lawFamily.replace(/\s+/g, '')}-${sectionId || 'Sec'}`;
      
    case 'pnp_sop':
      return `PNP-SOP-${lawFamily.replace(/\s+/g, '')}-${year}`;
      
    case 'incident_checklist':
      // Generate a short identifier based on the first word of law_family
      const shortName = lawFamily.split(' ')[0].toUpperCase();
      return `INC-${shortName}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;
      
    case 'agency_circular':
      return `${lawFamily.replace(/\s+/g, '')}-Circular-${year}`;
      
    case 'doj_issuance':
      return `DOJ-${lawFamily.replace(/\s+/g, '')}-${year}`;
      
    case 'executive_issuance':
      return `EO-${lawFamily.replace(/\s+/g, '')}-${year}`;
      
    case 'traffic_rule':
      return `TRAFFIC-${lawFamily.replace(/\s+/g, '')}-${year}`;
      
    case 'rights_advisory':
      return `RIGHTS-${lawFamily.replace(/\s+/g, '')}-${year}`;
      
    case 'constitution_provision':
      return `CONST-${lawFamily.replace(/\s+/g, '')}-${sectionId || 'Art'}`;
      
    default:
      return `${type.toUpperCase()}-${lawFamily.replace(/\s+/g, '')}-${sectionId || 'Sec'}`;
  }
}

export function validateEntryId(entryId: string): boolean {
  // Basic validation for entry ID format
  const validPatterns = [
    /^RPC-Art\d+$/,
    /^RA\d+-Sec\d+$/,
    /^ROC-Rule\d+-Sec\d+$/,
    /^CEBU-CO\d+-Sec\d+$/,
    /^PNP-SOP-[A-Z]+-\d{4}$/,
    /^INC-[A-Z]+-\d{3}$/,
    /^[A-Z]+-Circular-\d{4}$/,
    /^DOJ-[A-Z]+-\d{4}$/,
    /^EO-[A-Z]+-\d{4}$/,
    /^TRAFFIC-[A-Z]+-\d{4}$/,
    /^RIGHTS-[A-Z]+-\d{4}$/,
    /^CONST-[A-Z]+-Art\d+$/
  ];
  
  return validPatterns.some(pattern => pattern.test(entryId));
}

