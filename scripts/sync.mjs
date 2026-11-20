// Haalt ranking + wedstrijden van Promo 4 Dames D (Limburg) op volleyscores.be en schrijft data.json
import { chromium } from 'playwright';
import fs from 'fs';

const REEKS = { title: 'Reeks LDP4-D Promo 4 Dames D (L)', serieId: '12594', naam: 'Promo 4 Dames D', code: 'LDP4-D' };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto('https://www.volleyscores.be/', { waitUntil: 'networkidle' });
await page.evaluate(r => loadPage(r.title, 'sd', '', '', r.serieId, '', '', '', '', '%'), REEKS);
await page.waitForFunction(() => document.querySelectorAll('#reqContent table').length >= 2, null, { timeout: 60000 });
await page.waitForTimeout(1500);

const tables = await page.$$eval('#reqContent table', ts => ts.map(t => {
  const heads = [...t.querySelectorAll('th')].map(th => th.innerText.trim());
  const rows = [...t.querySelectorAll('tbody tr')].map(tr =>
    [...tr.querySelectorAll('td')].filter(td => !td.classList.contains('visible-xs')).map(td => td.innerText.trim())
  ).filter(r => r.length > 3);
  return { heads, rows };
}));
await browser.close();

const rankT = tables.find(t => t.heads.includes('Ptn') && t.heads.includes('Ploeg'));
const matchT = tables.find(t => t.heads.includes('Thuis') && t.heads.includes('Bezoekers'));
if (!rankT || !matchT) throw new Error('Tabellen niet gevonden: ' + JSON.stringify(tables.map(t => t.heads)));

const n = s => Number(String(s).replace(/[^\d-]/g, '')) || 0;
const ranking = rankT.rows.map(r => ({
  pos: r[0].replace(/\.$/, '').replace(/^0/, ''), ploeg: r[1], ptn: n(r[2]), wed: n(r[3]),
  gew30: n(r[4]), gew32: n(r[5]), verl30: n(r[6]), verl32: n(r[7]), setsW: n(r[8]), setsV: n(r[9]), forfaits: n(r[10])
}));

const toIso = d => { const [dd, mm, yy] = d.split('/'); return `${yy}-${mm}-${dd}`; };
const matches = matchT.rows.map(r => {
  const uitslag = (r[7] || '').replace(/\s/g, '');
  const m = uitslag.match(/^(\d)-(\d)$/);
  return {
    nr: r[0], dag: r[1], datum: toIso(r[2]), uur: r[3], thuis: r[4], uit: r[5], sporthal: r[6],
    thuisSets: m ? +m[1] : null, uitSets: m ? +m[2] : null, uitslagTekst: m ? null : (uitslag || null),
    sets: (r[8] || '').split(',').map(s => s.trim()).filter(Boolean)
  };
}).sort((a, b) => (a.datum + a.uur).localeCompare(b.datum + b.uur));

if (ranking.length < 5 || matches.length < 10) throw new Error(`Te weinig data (ranking ${ranking.length}, wedstrijden ${matches.length}) — niets overschreven`);

const nieuw = { reeks: REEKS.naam, code: REEKS.code, provincie: 'Limburg', bron: 'https://www.volleyscores.be/', ranking, matches };
let oud = null; try { oud = JSON.parse(fs.readFileSync('data.json', 'utf8')); } catch {}
const zelfde = oud && JSON.stringify({ ...oud, bijgewerkt: undefined, gecontroleerd: undefined }) === JSON.stringify(nieuw);
const nu = new Date().toISOString();
const data = { bijgewerkt: zelfde ? oud.bijgewerkt : nu, gecontroleerd: nu, ...nieuw };
fs.writeFileSync('data.json', JSON.stringify(data, null, 1));
console.log(`OK: ${ranking.length} ploegen, ${matches.length} wedstrijden, ${matches.filter(m => m.thuisSets !== null).length} gespeeld${zelfde ? ' (geen wijzigingen)' : ''}`);
