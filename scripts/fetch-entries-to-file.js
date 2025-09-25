#!/usr/bin/env node
/**
 * Fetch all KB entries from your backend and write to a JSON file.
 *
 * Usage (Windows cmd):
 *   set AUTH_TOKEN=YOUR_JWT_HERE && node scripts\fetch-entries-to-file.js --api http://localhost:4000 --out docs\entries.json
 * Or PowerShell:
 *   $env:AUTH_TOKEN="YOUR_JWT_HERE"; node scripts/fetch-entries-to-file.js --api http://localhost:4000 --out docs/entries.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

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

async function main() {
  const args = parseArgs(process.argv);
  const api = (args.api || process.env.REACT_APP_API_BASE || 'http://localhost:4000').replace(/\/$/, '');
  const out = args.out || 'docs/entries.json';
  const token = process.env.AUTH_TOKEN || process.env.auth_token || null;
  const url = `${api}/api/kb/entries`;

  const headers = { 'Cache-Control': 'no-cache' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method: 'GET', headers, rejectUnauthorized: false, agent: new https.Agent({ rejectUnauthorized: false }) };

  const fetchImpl = async () => {
    return await fetch(url, opts);
  };

  let resp;
  try {
    // Node18+ has global fetch
    resp = await fetchImpl();
  } catch (e) {
    console.error('Fetch failed:', e);
    process.exit(1);
  }

  if (!resp.ok) {
    console.error(`Request failed: ${resp.status} ${resp.statusText}`);
    process.exit(1);
  }
  const json = await resp.json();
  const rows = Array.isArray(json?.entries) ? json.entries : [];
  const outPath = path.resolve(out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(rows, null, 2), 'utf8');
  console.log(`Wrote ${rows.length} entries to ${outPath}`);
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}





