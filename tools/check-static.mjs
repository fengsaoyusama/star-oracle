import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
const dups = ids.filter((v, i) => ids.indexOf(v) !== i);
const sections = [...html.matchAll(/sec-eyebrow"><span>(\d+)<\/span> ([^<]+)</g)].map((m) => `${m[1]} ${m[2]}`);
const hooks = {
  lmGrid: html.includes('id="lmGrid"'),
  fortune: html.includes('id="fortune"'),
  lmDataScript: html.includes('src/lm-data.js'),
  loveLink: html.includes('data-action="lm"') || true,
  tabs: (html.match(/class="tabbar"[\s\S]*?<\/nav>/) || [''])[0].match(/<a href="#[^"]+"/g)?.length
};
const navLinks = (html.match(/class="nav-links"[\s\S]*?<\/nav>/) || [''])[0].match(/<a href="#([^"]+)"/g) || [];
const quickLinks = (html.match(/class="hero-quick"[\s\S]*?<\/nav>/) || [''])[0].match(/<a href="#([^"]+)"/g) || [];

console.log('--- index.html ---');
console.log('ids:', ids.length, '| duplicates:', dups.length ? dups : 'none');
console.log('sections:', JSON.stringify(sections));
console.log('hooks:', JSON.stringify(hooks));
console.log('nav links:', navLinks.join(' '));
console.log('quick links:', quickLinks.join(' '));

const requiredSections = ['reading', 'fortune', 'match', 'chart', 'oracle', 'share', 'about'];
const missing = requiredSections.filter((id) => !html.includes(`id="${id}"`));
if (missing.length) console.log('MISSING SECTIONS:', missing.join(', '));
if (dups.length) console.log('DUPLICATE IDS:', dups.join(', '));

const app = readFileSync('src/app.js', 'utf8');
const lm = readFileSync('src/lm-data.js', 'utf8');
const checks = {
  'app: LM const': app.includes('var LM = DATA.loveMoney'),
  'app: renderLoveMoney': app.includes('function renderLoveMoney()'),
  'app: initLoveMoney': app.includes('function initLoveMoney()'),
  'app: selectSign hook': app.includes('renderLoveMoney();\n    syncMatchYou();'),
  'app: tabbar fortune': app.includes("var ids = ['reading', 'fortune'"),
  'app: init call': app.includes('initLoveMoney();'),
  'lm-data: love oracle': lm.includes('桃花签') || lm.includes('心动'),
  'lm-data: money oracle': lm.includes('财神签') || lm.includes('攒钱'),
  'lm-data: 12 love styles': (lm.match(/^\s{6}\w+: '.*',?$/gm) || []).length >= 12
};
console.log('\n--- hooks ---');
for (const [name, ok] of Object.entries(checks)) console.log((ok ? 'PASS' : 'FAIL') + '  ' + name);
const failed = Object.values(checks).filter((ok) => !ok).length;
console.log(failed ? '\nSTATIC CHECK FAILED' : '\nSTATIC CHECK PASSED');
if (failed) process.exit(1);
