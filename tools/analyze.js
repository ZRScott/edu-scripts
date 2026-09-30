const fs = require('fs');
const path = require('path');
const dir = '/home/user/tools/sources';
const files = fs.readdirSync(dir).sort();
for (const f of files) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const hdrEnd = src.indexOf('// ==/UserScript==');
  const hdr = src.slice(0, hdrEnd);
  const body = src.slice(hdrEnd);
  const get = (tag) => [...hdr.matchAll(new RegExp('@' + tag + '\\s+(.*)', 'g'))].map(m => m[1].trim());
  console.log('='.repeat(70));
  console.log('FILE:', f);
  console.log('name:', get('name')[0], '| version:', (get('version')[0]||''), '| desc:', (get('description')[0]||'').slice(0,90));
  console.log('matches:', JSON.stringify(get('match')));
  console.log('include-globs:', JSON.stringify(get('include')));
  console.log('grants:', JSON.stringify(get('grant')));
  console.log('connects:', JSON.stringify(get('connect')));
  console.log('require:', JSON.stringify(get('require')));
  console.log('others:', JSON.stringify(['noframes','icon','updateURL','downloadURL','supportURL','homepage','license','author'].filter(t=>hdr.includes('@'+t))));
  // top-level single-line const/let declarations
  const consts = [...body.matchAll(/^[ \t]*(?:const|let|var)\s+([A-Z][A-Z0-9_]*)\s*=\s*(.+?);[ \t]*(?:\/\/(.*))?$/gm)];
  console.log('CONSTS:');
  for (const c of consts) {
    console.log('  ', c[1], '=', c[2].length > 100 ? c[2].slice(0, 100) + '...[' + c[2].length + ' chars]' : c[2], c[3] ? '   // ' + c[3].trim() : '');
  }
}
