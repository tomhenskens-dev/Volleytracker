import { chromium } from 'playwright';
import fs from 'fs';
const out = 'discovery'; fs.mkdirSync(out, { recursive: true });
const log = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.on('response', async r => {
  const t = r.request().resourceType();
  if (!['xhr', 'fetch', 'document'].includes(t)) return;
  let body = '';
  try { body = (await r.text()).slice(0, 4000); } catch {}
  log.push({ t, method: r.request().method(), url: r.url(), post: r.request().postData(), status: r.status(), body });
});
const step = async (name, fn) => { try { await fn(); log.push({ step: name, ok: true }); } catch (e) { log.push({ step: name, err: String(e) }); } };
await page.goto('https://www.volleyscores.be/', { waitUntil: 'networkidle' });
fs.writeFileSync(`${out}/home.html`, await page.content());
await step('limburg', async () => { await page.getByText('Limburg', { exact: true }).first().click(); await page.waitForTimeout(2500); });
fs.writeFileSync(`${out}/limburg.html`, await page.content());
await step('reeks', async () => { await page.getByText('Promo 4 Dames D', { exact: true }).first().click(); await page.waitForTimeout(4000); });
fs.writeFileSync(`${out}/reeks.html`, await page.content());
fs.writeFileSync(`${out}/reeks.txt`, await page.innerText('body'));
log.push({ finalUrl: page.url() });
await page.screenshot({ path: `${out}/reeks.png`, fullPage: true });
fs.writeFileSync(`${out}/network.json`, JSON.stringify(log, null, 1));
await browser.close();
