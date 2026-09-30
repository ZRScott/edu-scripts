const fs = require('fs');
const path = require('path');
const backup = JSON.parse(fs.readFileSync('/home/user/uploads/tampermonkey-backup-chrome-2026-09-30T20-23-03-766Z.txt', 'utf8'));
console.log('scripts:', backup.scripts.length);
fs.mkdirSync('/home/user/tools/sources', { recursive: true });
for (const s of backup.scripts) {
  const src = Buffer.from(s.source, 'base64').toString('utf8');
  const hdrEnd = src.indexOf('// ==/UserScript==');
  const hdr = src.slice(0, hdrEnd);
  const name = ((hdr.match(/@name\s+(.*)/) || [])[1] || 'unknown').trim();
  const runAt = ((hdr.match(/@run-at\s+(.*)/) || [])[1] || 'document-idle').trim();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  fs.writeFileSync(path.join('/home/user/tools/sources', slug + '.user.js'), src);
  console.log('---', JSON.stringify(name), '| run-at:', runAt, '| enabled:', s.enabled, '| bytes:', src.length);
}
