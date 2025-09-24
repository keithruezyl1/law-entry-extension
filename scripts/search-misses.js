#!/usr/bin/env node
/**
 * Print misses for each gold query: which expected IDs are not in top-K, and what ranked instead.
 *
 * Usage:
 *   node scripts/search-misses.js --entries docs/entries.json --gold docs/search_gold_bootstrapped.json --k 3
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

// Reuse the evaluator by spawning it and parsing ranked list, or inline the search like in other scripts.
// For simplicity and consistency, inline the same search implementation used by search-eval.js.

const DIACRITICS_RE = /[\u0300-\u036f]/g;
const MULTISPACE_RE = /\s+/g;
const romanMap = { m:1000, d:500, c:100, l:50, x:10, v:5, i:1 };
const isRoman = (w) => /^[ivxlcdm]+$/.test(w);
function romanToArabic(w){ if(!isRoman(w)) return null; let s=0,p=0; for(let i=w.length-1;i>=0;i--){const v=romanMap[w[i]]||0; if(v<p) s-=v; else s+=v; p=v;} return s>0?String(s):null; }
function arabicToRoman(numStr){ const n=Number(numStr); if(!Number.isFinite(n)||n<=0||n>=4000) return null; const t=[[1000,'m'],[900,'cm'],[500,'d'],[400,'cd'],[100,'c'],[90,'xc'],[50,'l'],[40,'xl'],[10,'x'],[9,'ix'],[5,'v'],[4,'iv'],[1,'i']]; let x=n,out=''; for(const[a,b] of t){ while(x>=a){ out+=b; x-=a;} } return out||null; }
const __ANTI_ALLOW__ = new Set(['graft','trafficking','terrorism','wiretapping','fencing','hazing','money-laundering','moneylaundering','red-tape','redtape','trafficking-in-persons','carnapping','illegal-drugs','dangerous-drugs','terrorism-financing']);
function normalize(text){ if(!text) return ''; let s=String(text); try{s=s.normalize('NFKD');}catch{} s=s.replace(DIACRITICS_RE,'').toLowerCase(); s=s.replace(/[“”„‟❛❜❝❞]/g,'"').replace(/[‘’‚‛]/g,"'").replace(/[–—―]/g,'-'); s=s.replace(/[&/]/g,' and ').replace(/§/g,' section ').replace(/\bg\.?\s*r\.?\s*no\.?\b/g,' gr number ').replace(/\bgr\.?\s*no\.?\b/g,' gr number ').replace(/\bblg\.?\b/g,' bilang '); s=s.replace(/\bart\.?\b/g,'article').replace(/\bart\.\s*/g,'article ').replace(/\barticulo\b/g,'article').replace(/\bsec\.?\b/g,'section').replace(/\bsec\.\s*/g,'section ').replace(/\bpar\.?\b/g,'paragraph').replace(/\bsubsec\.?\b/g,'subsection').replace(/\bsub\.\b/g,'subsection').replace(/\br\.?a\.?\b/g,'republic act').replace(/\bra\b/g,'republic act').replace(/\bno\.?\b/g,'number'); s=s.replace(/[^a-z0-9\s]/g,' ').replace(MULTISPACE_RE,' ').trim(); s=s.split(' ').map(w=>(w.length>3&&/s$/.test(w)&&!/ss$/.test(w)?w.slice(0,-1):w)).join(' '); return s; }
function expandWordVariants(w){ const v=new Set([w]); if(w.startsWith('anti')&&w.length>4){ const base=w.replace(/^anti[-\s]?/,''); const key=base.replace(MULTISPACE_RE,'-'); if(__ANTI_ALLOW__.has(base)||__ANTI_ALLOW__.has(key)) v.add(base);} if(w==='vs'||w==='vs.'||w==='versus') v.add('v'); if(w==='v') v.add('vs'); const syn={ rpc:['revised','penal','code','revised penal code'], ord:['ordinance'], ordinance:['ord'], ca:['commonwealth','act','commonwealth act'], 'c.a.':['commonwealth','act','commonwealth act'], bp:['batas','pambansa','batas pambansa'], 'b.p.':['batas','pambansa','batas pambansa'], blg:['bilang'], pd:['presidential','decree','presidential decree'], 'p.d.':['presidential','decree','presidential decree'], irr:['implementing','rules','regulations','implementing rules and regulations'], roc:['rules','of','court','rules of court'], doj:['department','of','justice','department of justice'], brgy:['barangay'] }; if (syn[w]) syn[w].forEach(x=>v.add(x)); if(/^\d+$/.test(w)){ const r=arabicToRoman(w); if(r) v.add(r);} else if(isRoman(w)){ const a=romanToArabic(w); if(a) v.add(a);} return Array.from(v); }
function simpleFuzzyMatch(text, query, searchWords){ if(!text||!query) return false; const n=normalize(text); const cn=n.replace(MULTISPACE_RE,''); const cq=String(query).replace(MULTISPACE_RE,''); if(n===query) return true; if(n.startsWith(query)) return true; if(n.includes(query)) return true; if(cn.includes(cq)) return true; const numVar=query.replace(/\b(\d+)\s*([a-z])\b/g,'$1$2'); if(n.includes(numVar)||cn.includes(numVar)) return true; const words=n.split(MULTISPACE_RE); for(const w of words){ if(w.startsWith(query)||query.startsWith(w)) return true;} if(searchWords.length>1){ return searchWords.every(w=> n.includes(w) || words.some(x=>x.startsWith(w)||w.startsWith(x)) ); } return false; }
function rank(entries, query){ const searchTerm=normalize(query); const searchWords=searchTerm.split(MULTISPACE_RE).filter(Boolean); let variants=new Set(searchWords.flatMap(expandWordVariants)); for(let i=0;i<searchWords.length-1;i++){ const a=searchWords[i], b=searchWords[i+1]; if(/^\d+$/.test(a)&&/^[a-z]$/.test(b)){ variants.add(`${a}${b}`); variants.add(`${a}(${b})`); variants.add(`${a}-${b}`);} if(isRoman(a)&&/^[a-z]$/.test(b)){ variants.add(`${a}${b}`); variants.add(`${a}(${b})`); variants.add(`${a}-${b}`); const arab=romanToArabic(a); if(arab){ variants.add(`${arab}${b}`); variants.add(`${arab}(${b})`); variants.add(`${arab}-${b}`);} } } const compact=searchTerm.replace(MULTISPACE_RE,''); const parenth=searchTerm.replace(/\b(\d+)\s*([a-z])\b/g,'$1($2)').replace(/\b(\d+)\s*\(\s*([a-z])\s*\)\b/g,'$1($2)'); const scored=entries.map(e=>{ const tags=Array.isArray(e.tags)?e.tags.join(' '):''; const combo=(e.title&&e.canonical_citation)?`${e.title} ${e.canonical_citation}`:''; const rev=(e.title&&e.canonical_citation)?`${e.canonical_citation} ${e.title}`:''; const fields=[ {t:e.title,w:12},{t:combo,w:13},{t:rev,w:12},{t:e.canonical_citation,w:9},{t:e.section_id,w:6},{t:e.law_family,w:5},{t:tags,w:4},{t:e.entry_id,w:5},{t:[e.title,e.canonical_citation,e.section_id,e.law_family,tags,e.summary].filter(Boolean).join(' '),w:3},{t:e.summary,w:3},{t:e.effective_date,w:3},{t:e.text,w:2},{t:e.text_raw,w:2} ]; let s=0,h=false,pb=false; try{ const n=(x)=>normalize(x); if((combo&&n(combo)===searchTerm)||(rev&&n(rev)===searchTerm)){ s+=1000; h=true; } }catch{} for(const f of fields){ if(!f.t) continue; const n=normalize(f.t); const ct=n.replace(MULTISPACE_RE,''); const words=n.split(MULTISPACE_RE).filter(Boolean); const tv=new Set(words.flatMap(expandWordVariants)); if(n===searchTerm){ s+=f.w*3; h=true; } else if(n.startsWith(searchTerm)){ s+=f.w*2; h=true; } else if(n.includes(searchTerm)){ s+=f.w; h=true; if(!pb&&searchWords.length>1&&(f.w>=12||f.t===e.summary)){ s+=Math.min(20,Math.round(f.w*1.5)); pb=true; } } else if(ct.includes(compact)){ s+=f.w*0.9; h=true; } else if(n.includes(parenth)){ s+=f.w*0.9; h=true; } else { const matched=Array.from(variants).filter(w=> Array.from(tv).some(tw=>tw.includes(w)||w.includes(tw)) ); const cov=matched.length/Math.max(1,searchWords.length); if(cov>=0.6){ s+=f.w*(0.6+0.4*Math.min(1,cov)); h=true; } else if(matched.length>=1){ s+=f.w*0.4; h=true; } else if(simpleFuzzyMatch(f.t,searchTerm,searchWords)){ s+=f.w*0.5; h=true; } } if(!h && (f.w>=6)){ const st=searchWords.filter(w=>w.length>=3&&w.length<=6); if(st.length){ const hit=st.some(qt=> words.some(tw=>{ const la=qt.length, lb=tw.length; if(Math.abs(la-lb)>1) return false; let i=0,j=0,e=0; while(i<la&&j<lb){ if(qt[i]===tw[j]){ i++; j++; continue;} if(e===1) return false; e++; if(la>lb) i++; else if(lb>la) j++; else { i++; j++; } } if(i<la||j<lb) e++; return e<=1; })); if(hit){ s+=f.w*0.6; h=true; } } } } return { entry:e, score:s, hasMatch:h }; }); const EPS=1e-6; return scored.filter(x=>x.hasMatch).sort((a,b)=>{ if(Math.abs(b.score-a.score)>EPS) return b.score-a.score; const av=a.entry.verified===true?1:0, bv=b.entry.verified===true?1:0; if(bv!==av) return bv-av; const aa=String(a.entry.status||'').toLowerCase()==='active'?1:0, ba=String(b.entry.status||'').toLowerCase()==='active'?1:0; if(ba!==aa) return ba-aa; const ad=a.entry.effective_date?Date.parse(a.entry.effective_date):0, bd=b.entry.effective_date?Date.parse(b.entry.effective_date):0; if(bd!==ad) return bd-ad; const at=(a.entry.title||'').length, bt=(b.entry.title||'').length; if(at!==bt) return at-bt; const aid=String(a.entry.entry_id||a.entry.id||''), bid=String(b.entry.entry_id||b.entry.id||''); return aid.localeCompare(bid); }).map(x=>x.entry); }

function main(){
  const args = parseArgs(process.argv);
  const entriesPath = args.entries || args.e;
  const goldPath = args.gold || args.g;
  const k = Number(args.k || 3);
  if (!entriesPath || !goldPath) {
    console.error('Usage: node scripts/search-misses.js --entries docs/entries.json --gold docs/search_gold_bootstrapped.json --k 3');
    process.exit(1);
  }
  const entries = JSON.parse(fs.readFileSync(path.resolve(entriesPath), 'utf8'));
  const gold = JSON.parse(fs.readFileSync(path.resolve(goldPath), 'utf8'));
  let total = 0, misses = 0;
  for (const item of gold) {
    const ideal = (item.ideal_top || []).map(String);
    if (!ideal.length) continue;
    total++;
    const ranked = rank(entries, item.query).slice(0, Math.max(1, k));
    const rankedIds = ranked.map(r => String(r.entry_id || r.id));
    const missing = ideal.filter(id => !rankedIds.includes(id));
    if (missing.length) {
      misses++;
      console.log(`Query: ${item.query}`);
      console.log(`  Missing (expected in top-${k}): ${missing.join(', ')}`);
      console.log(`  Ranked top-${k}: ${rankedIds.join(', ')}`);
    }
  }
  console.log(`\nQueries with misses: ${misses}/${total}`);
}

if (require.main === module) main();


