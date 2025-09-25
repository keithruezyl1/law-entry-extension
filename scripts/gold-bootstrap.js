#!/usr/bin/env node
/**
 * Bootstrap ideal_top for the gold set by using the local evaluation search logic.
 *
 * Usage:
 *   node scripts/gold-bootstrap.js --entries path/to/entries.json --gold path/to/gold.json --top 3 --out path/to/gold_bootstrapped.json
 */

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.replace(/^--/, '');
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[key] = val;
    }
  }
  return args;
}

// Import the search/eval helpers by reading the eval script (kept self-contained here to avoid inter-file imports)
const DIACRITICS_RE = /[\u0300-\u036f]/g;
const MULTISPACE_RE = /\s+/g;
const romanMap = { m:1000, d:500, c:100, l:50, x:10, v:5, i:1 };
const isRoman = (w) => /^[ivxlcdm]+$/.test(w);
function romanToArabic(w) { if (!isRoman(w)) return null; let sum=0,prev=0; for (let i=w.length-1;i>=0;i--){const v=romanMap[w[i]]||0; if (v<prev) sum-=v; else sum+=v; prev=v;} return sum>0?String(sum):null; }
function arabicToRoman(numStr){ const n=Number(numStr); if(!Number.isFinite(n)||n<=0||n>=4000) return null; const t=[[1000,'m'],[900,'cm'],[500,'d'],[400,'cd'],[100,'c'],[90,'xc'],[50,'l'],[40,'xl'],[10,'x'],[9,'ix'],[5,'v'],[4,'iv'],[1,'i']]; let x=n,out=''; for(const[va,r]of t){ while(x>=va){ out+=r; x-=va;} } return out||null;}
const __ANTI_ALLOW__ = new Set(['graft','trafficking','terrorism','wiretapping','fencing','hazing','money-laundering','moneylaundering','red-tape','redtape','trafficking-in-persons','carnapping','illegal-drugs','dangerous-drugs','terrorism-financing']);
function normalize(text){ if(!text) return ''; let s=String(text); try{s=s.normalize('NFKD');}catch{} s=s.replace(DIACRITICS_RE,''); s=s.toLowerCase(); s=s.replace(/[“”„‟❛❜❝❞]/g,'"').replace(/[‘’‚‛]/g,"'").replace(/[–—―]/g,'-'); s=s.replace(/[&/]/g,' and '); s=s.replace(/§/g,' section ').replace(/\bg\.?\s*r\.?\s*no\.?\b/g,' gr number ').replace(/\bgr\.?\s*no\.?\b/g,' gr number ').replace(/\bblg\.?\b/g,' bilang '); s=s.replace(/\bart\.?\b/g,'article').replace(/\bart\.\s*/g,'article ').replace(/\barticulo\b/g,'article').replace(/\bsec\.?\b/g,'section').replace(/\bsec\.\s*/g,'section ').replace(/\bpar\.?\b/g,'paragraph').replace(/\bsubsec\.?\b/g,'subsection').replace(/\bsub\.\b/g,'subsection').replace(/\br\.?a\.?\b/g,'republic act').replace(/\bra\b/g,'republic act').replace(/\bno\.?\b/g,'number'); s=s.replace(/[^a-z0-9\s]/g,' '); s=s.replace(MULTISPACE_RE,' ').trim(); s=s.split(' ').map(w=>(w.length>3&&/s$/.test(w)&&!/ss$/.test(w)?w.slice(0,-1):w)).join(' '); return s; }
function expandWordVariants(w){ const variants=new Set([w]); if (w.startsWith('anti')&&w.length>4){ const base=w.replace(/^anti[-\s]?/,''); const key=base.replace(MULTISPACE_RE,'-'); if(__ANTI_ALLOW__.has(base)||__ANTI_ALLOW__.has(key)) variants.add(base);} if(w==='vs'||w==='vs.'||w==='versus') variants.add('v'); if(w==='v') variants.add('vs'); const syn={ rpc:['revised','penal','code','revised penal code'], ord:['ordinance'], ordinance:['ord'], ca:['commonwealth','act','commonwealth act'], 'c.a.':['commonwealth','act','commonwealth act'], bp:['batas','pambansa','batas pambansa'], 'b.p.':['batas','pambansa','batas pambansa'], blg:['bilang'], pd:['presidential','decree','presidential decree'], 'p.d.':['presidential','decree','presidential decree'], irr:['implementing','rules','regulations','implementing rules and regulations'], roc:['rules','of','court','rules of court'], doj:['department','of','justice','department of justice'], brgy:['barangay'], bir:['bureau','of','internal','revenue','bureau of internal revenue'], nbi:['national','bureau','of','investigation','national bureau of investigation'], dilg:['department','of','the','interior','and','local','government','department of the interior and local government'], ltfrb:['land','transportation','franchising','and','regulatory','board','land transportation franchising and regulatory board'], dotr:['department','of','transportation','department of transportation'], dhsud:['department','of','human','settlements','and','urban','development','department of human settlements and urban development']}; if (syn[w]) syn[w].forEach(v=>variants.add(v)); if (/^\d+$/.test(w)){ const r=arabicToRoman(w); if(r) variants.add(r);} else if(isRoman(w)){ const a=romanToArabic(w); if(a) variants.add(a);} return Array.from(variants);} 
function simpleFuzzyMatch(text, query, searchWords){ if(!text||!query) return false; const normalized=normalize(text); const compactNormalized=normalized.replace(MULTISPACE_RE,''); const compactQuery=String(query).replace(MULTISPACE_RE,''); if(normalized===query) return true; if(normalized.startsWith(query)) return true; if(normalized.includes(query)) return true; if(compactNormalized.includes(compactQuery)) return true; const numberLetterVariant=query.replace(/\b(\d+)\s*([a-z])\b/g,'$1$2'); if(normalized.includes(numberLetterVariant)||compactNormalized.includes(numberLetterVariant)) return true; const words=normalized.split(MULTISPACE_RE); for(const word of words){ if(word.startsWith(query)||query.startsWith(word)) return true;} if(searchWords.length>1){ return searchWords.every(word=> normalized.includes(word) || words.some(w=>w.startsWith(word)||word.startsWith(w)) ); } return false; }
function search(entries, query){ let filteredEntries=[...entries]; if (!query||!String(query).trim()) return filteredEntries; const searchTerm=normalize(query); const searchWords=searchTerm.split(MULTISPACE_RE).filter(Boolean); let searchWordVariants=new Set(searchWords.flatMap(expandWordVariants)); for(let i=0;i<searchWords.length-1;i++){ const a=searchWords[i]; const b=searchWords[i+1]; if(/^\d+$/.test(a)&&/^[a-z]$/.test(b)){ searchWordVariants.add(`${a}${b}`); searchWordVariants.add(`${a}(${b})`); searchWordVariants.add(`${a}-${b}`);} if(isRoman(a)&&/^[a-z]$/.test(b)){ searchWordVariants.add(`${a}${b}`); searchWordVariants.add(`${a}(${b})`); searchWordVariants.add(`${a}-${b}`); const arab=romanToArabic(a); if(arab){ searchWordVariants.add(`${arab}${b}`); searchWordVariants.add(`${arab}(${b})`); searchWordVariants.add(`${arab}-${b}`);} } } const compactSearch=searchTerm.replace(MULTISPACE_RE,''); const parentheticalSearch=searchTerm.replace(/\b(\d+)\s*([a-z])\b/g,'$1($2)').replace(/\b(\d+)\s*\(\s*([a-z])\s*\)\b/g,'$1($2)'); const scored=filteredEntries.map(entry=>{ const combinedTags=Array.isArray(entry.tags)?entry.tags.join(' '):''; const combinedTitleCitation=(entry.title&&entry.canonical_citation)?`${entry.title} ${entry.canonical_citation}`:''; const reverseTitleCitation=(entry.title&&entry.canonical_citation)?`${entry.canonical_citation} ${entry.title}`:''; const searchFields=[ {text:entry.title,weight:12}, {text:combinedTitleCitation,weight:13}, {text:reverseTitleCitation,weight:12}, {text:entry.canonical_citation,weight:9}, {text:entry.section_id,weight:6}, {text:entry.law_family,weight:5}, {text:combinedTags,weight:4}, {text:entry.entry_id,weight:5}, {text:[entry.title,entry.canonical_citation,entry.section_id,entry.law_family,combinedTags,entry.summary].filter(Boolean).join(' '),weight:3}, {text:entry.summary,weight:3}, {text:entry.effective_date,weight:3}, {text:entry.text,weight:2}, {text:entry.text_raw,weight:2}, ]; let score=0,hasMatch=false,phraseBoostApplied=false; try{ const norm=(s)=>normalize(s); if((combinedTitleCitation&&norm(combinedTitleCitation)===searchTerm)||(reverseTitleCitation&&norm(reverseTitleCitation)===searchTerm)){ score+=1000; hasMatch=true; } }catch{} for(const {text,weight} of searchFields){ if(!text) continue; const normalizedText=normalize(text); const compactText=normalizedText.replace(MULTISPACE_RE,''); const textWords=normalizedText.split(MULTISPACE_RE).filter(Boolean); const textWordVariants=new Set(textWords.flatMap(expandWordVariants)); if(normalizedText===searchTerm){ score+=weight*3; hasMatch=true; } else if(normalizedText.startsWith(searchTerm)){ score+=weight*2; hasMatch=true; } else if(normalizedText.includes(searchTerm)){ score+=weight; hasMatch=true; if(!phraseBoostApplied&&searchWords.length>1&&(weight>=12||text===entry.summary)){ score+=Math.min(20,Math.round(weight*1.5)); phraseBoostApplied=true; } } else if(compactText.includes(compactSearch)){ score+=weight*0.9; hasMatch=true; } else if(normalizedText.includes(parentheticalSearch)){ score+=weight*0.9; hasMatch=true; } else { const matched=Array.from(searchWordVariants).filter(word=> Array.from(textWordVariants).some(tw=>tw.includes(word)||word.includes(tw)) ); const coverage=matched.length/Math.max(1,searchWords.length); if(coverage>=0.6){ score+=weight*(0.6+0.4*Math.min(1,coverage)); hasMatch=true; } else if(matched.length>=1){ score+=weight*0.4; hasMatch=true; } else if(simpleFuzzyMatch(text,searchTerm,searchWords)){ score+=weight*0.5; hasMatch=true; } } if(!hasMatch && (weight>=6)){ const shortTokens=searchWords.filter(w=>w.length>=3&&w.length<=6); if(shortTokens.length){ const fuzzyHit=shortTokens.some(qt=> textWords.some(tw=>{ const la=qt.length,lb=tw.length; if(Math.abs(la-lb)>1) return false; let i=0,j=0,edits=0; while(i<la&&j<lb){ if(qt[i]===tw[j]){ i++; j++; continue;} if(edits===1) return false; edits++; if(la>lb) i++; else if(lb>la) j++; else { i++; j++; } } if(i<la||j<lb) edits++; return edits<=1; })); if(fuzzyHit){ score+=weight*0.6; hasMatch=true; } } } } return { entry, score, hasMatch }; }); const EPS=1e-6; return scored.filter(({hasMatch})=>hasMatch).sort((a,b)=>{ if(Math.abs(b.score-a.score)>EPS) return b.score-a.score; const av=a.entry.verified===true?1:0; const bv=b.entry.verified===true?1:0; if(bv!==av) return bv-av; const aActive=String(a.entry.status||'').toLowerCase()==='active'?1:0; const bActive=String(b.entry.status||'').toLowerCase()==='active'?1:0; if(bActive!==aActive) return bActive-aActive; const ad=a.entry.effective_date?Date.parse(a.entry.effective_date):0; const bd=b.entry.effective_date?Date.parse(b.entry.effective_date):0; if(bd!==ad) return bd-ad; const at=(a.entry.title||'').length; const bt=(b.entry.title||'').length; if(at!==bt) return at-bt; const aid=String(a.entry.entry_id||a.entry.id||''); const bid=String(b.entry.entry_id||b.entry.id||''); return aid.localeCompare(bid); }).map(({entry})=>entry); }

function main(){
  const args = parseArgs(process.argv);
  const entriesPath = args.entries || args.e;
  const goldPath = args.gold || args.g;
  const topN = Number(args.top || 3);
  const outPath = args.out || goldPath;
  if (!entriesPath || !goldPath) {
    console.error('Usage: node scripts/gold-bootstrap.js --entries path/to/entries.json --gold path/to/gold.json --top 3 --out path/to/output.json');
    process.exit(1);
  }
  const entries = JSON.parse(fs.readFileSync(path.resolve(entriesPath), 'utf8'));
  const gold = JSON.parse(fs.readFileSync(path.resolve(goldPath), 'utf8'));
  const bootstrapped = gold.map(item => {
    const q = String(item.query || '').trim();
    if (!q) return item;
    const results = search(entries, q).slice(0, Math.max(1, topN));
    const ids = results.map(r => String(r.entry_id || r.id)).filter(Boolean);
    return { ...item, ideal_top: (item.ideal_top && item.ideal_top.length ? item.ideal_top : ids) };
  });
  fs.writeFileSync(path.resolve(outPath), JSON.stringify(bootstrapped, null, 2), 'utf8');
  console.log(`Wrote ${bootstrapped.length} items to ${outPath}`);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error(e); process.exit(1); }
}




