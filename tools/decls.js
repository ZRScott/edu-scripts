const fs = require('fs');
const files = process.argv.slice(2);
for (const f of files) {
  const src = fs.readFileSync('/home/user/tools/sources/' + f, 'utf8');
  const body = src.slice(src.indexOf('// ==/UserScript=='));
  console.log('='.repeat(70));
  console.log('FILE:', f);
  const decls = [...body.matchAll(/^[ \t]*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(.+?);?[ \t]*(?:\/\/(.*))?$/gm)];
  for (const d of decls.slice(0, 40)) {
    const val = d[2].length > 110 ? d[2].slice(0, 110) + '…[' + d[2].length + ']' : d[2];
    console.log('  ' + d[1] + ' = ' + val + (d[3] ? '   // ' + d[3].trim() : ''));
  }
}
