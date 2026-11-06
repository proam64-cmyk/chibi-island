/* End-to-end browser test (Playwright + Chromium). Usage: node tests/e2e.js [screenshotDir] */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createServer } = require('../server/server.js');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.error('Playwright is not installed; skipping e2e tests.'); process.exit(0); }

const shotDir = process.argv[2] || '';
const results = [];
async function step(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('  ✓ ' + name); }
  catch (e) { results.push({ name, ok: false }); console.log('  ✗ ' + name + '\n      ' + e.message.split('\n')[0]); }
}
const assert = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };

(async () => {
  const server = createServer({ env: {} });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/api\/status|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const shot = async (name) => { if (shotDir) await page.screenshot({ path: path.join(shotDir, name + '.png'), fullPage: false }); };
  const editor = () => page.inputValue('#editor');
  const nav = (label) => page.click('#sidebar .nav-item:has-text("' + label + '")');

  console.log('E2E');
  await step('app loads offline-capable shell without errors', async () => {
    await page.goto(base);
    await page.waitForSelector('.hero h1');
    assert((await page.textContent('.hero h1')).includes('Prompt Studio'));
    await shot('01-projects');
  });
  await step('loads the Anime War Arcade sample profile', async () => {
    await page.click('.card.preset:has-text("Anime War Arcade") button');
    await page.waitForSelector('#f-p-profile-title');
    assert((await page.inputValue('#f-p-profile-title')) === 'Anime War Arcade');
    assert(await page.isVisible('.banner.sample'));
  });
  await step('generates a Midjourney master-sheet prompt with continuity lock', async () => {
    await nav('Anime Image Prompts');
    await page.selectOption('#wb-image-provider', 'midjourney');
    await page.selectOption('#wb-image-assetType', 'master-sheet');
    await page.selectOption('#wb-image-characterId', 'AWA-KAEDE');
    await page.click('button[data-action="wbGenerate"]');
    const t = await editor();
    assert(t.includes('--ar 16:9') && t.includes('AWA-KAEDE') && t.includes('--no '), 'prompt content');
    await shot('02-image-workbench');
  });
  await step('Correct fixes a manually inserted problem', async () => {
    await page.fill('#editor', (await editor()) + '\nKey: sk-ant-api03-ABCDEFGHIJKLMNOP');
    await page.waitForTimeout(500);
    assert(await page.isVisible('#issues li.error'), 'checker shows error');
    await page.click('button[data-action="wbCorrect"]');
    const t = await editor();
    assert(!t.includes('sk-ant-api03') && t.includes('[REDACTED-SECRET]'), 'secret redacted');
  });
  await step('compare versions shows a diff', async () => {
    await page.click('button[data-action="wbCompare"]');
    await page.waitForSelector('#cmpOut pre.diff');
    await page.click('#modal footer button[data-action="closeModal"]');
  });
  await step('AI button explains LOCAL fallback when no backend credentials exist', async () => {
    await page.click('button[data-action="wbAI"]');
    await page.waitForSelector('#modal:not([hidden])');
    const txt = await page.textContent('#modal');
    assert(/Falling back to LOCAL|LOCAL mode/.test(txt), txt.slice(0, 200));
    await page.keyboard.press('Escape');
  });
  await step('phase splitting produces coordinated phases', async () => {
    await nav('Gameplay Engineering');
    await page.selectOption('#phaseMode-gameplay', '3');
    await page.click('button[data-action="wbGenerate"]');
    await page.waitForSelector('.phase-tabs button');
    assert((await page.$$('.phase-tabs button')).length === 3);
    assert((await editor()).includes('PHASE 1 of 3'));
    await page.click('.phase-tabs button:nth-child(2)');
    assert((await editor()).includes('PHASE 2 of 3'));
  });
  await step('Android packaging plan for the HTML5 game', async () => {
    await nav('Android Packaging');
    await page.fill('#wb-android-appId', 'com.kirin.animewar');
    await page.click('button[data-action="wbGenerate"]');
    const t = await editor();
    assert(t.includes('assembleDebug') && t.includes('bundleRelease') && t.includes('cannot compile an APK'));
    await shot('03-android');
  });
  await step('project and history persist after reload (IndexedDB)', async () => {
    await page.waitForTimeout(900);
    await page.reload();
    await page.waitForSelector('#sidebar .nav-item');
    await nav('Prompt History');
    const rows = await page.$$('table tbody tr');
    assert(rows.length >= 4, 'history rows: ' + rows.length); // generate image, correct, gameplay, android
  });
  await step('restore a version from history into the editor', async () => {
    await page.click('table tbody tr:last-child button[data-action="histRestore"]');
    await page.waitForSelector('#editor');
    assert((await editor()).length > 100);
  });
  await step('character editor validates palette input', async () => {
    await nav('Characters');
    await page.click('button[data-action="newChar"]');
    await page.fill('#f-c-palette', '#12, notacolor');
    await page.waitForTimeout(100);
    assert((await page.textContent('#charValidation')).includes('Invalid palette'));
  });
  await step('asset import registers files without claiming analysis', async () => {
    await nav('Asset Registry');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await page.setInputFiles('input[data-action-change="importFiles"]', { name: 'kaede_master_v1.png', mimeType: 'image/png', buffer: png });
    await page.waitForSelector('table.assets tbody tr');
    const txt = await page.textContent('table.assets');
    assert(txt.includes('kaede_master_v1') && txt.includes('not analysed'));
    await page.click('button[data-action="analyzeAsset"]');
    assert((await page.textContent('#modal')).includes('Image analysis unavailable'));
    await page.keyboard.press('Escape');
  });
  await step('export and re-import the project JSON', async () => {
    await nav('Projects');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.project-card button[data-action="exportProject"]')]);
    const file = path.join(os.tmpdir(), 'agps-e2e-export.json');
    await dl.saveAs(file);
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert(json.format === 'agps-project' && json.project.characters.length >= 4);
    await page.setInputFiles('input[data-action-change="importProject"]', file);
    await page.waitForTimeout(500);
    await nav('Projects');
    assert((await page.$$('.project-card')).length === 2, 'two projects after import');
  });
  await step('in-app QA suite passes in the browser', async () => {
    await nav('QA & Diagnostics');
    await page.click('button[data-action="runQA"]');
    await page.waitForSelector('.badge.ok', { timeout: 20000 });
    const failed = await page.$$('tr.fail');
    assert(failed.length === 0, failed.length + ' browser test(s) failed');
  });
  await step('Spanish interface', async () => {
    await page.selectOption('#langSel', 'es');
    await page.waitForSelector('#sidebar .nav-item:has-text("Proyectos")');
    await page.selectOption('#langSel', 'en');
  });
  await step('mobile layout has no horizontal scroll and the menu works', async () => {
    const m = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
    const mp = await m.newPage();
    await mp.goto(base);
    await mp.waitForSelector('.hero');
    await mp.click('.card.preset:has-text("KODAMA") button');
    for (const view of ['profile', 'characters', 'assets', 'workflow', 'wb:image', 'wb:meshy', 'models', 'history']) {
      await mp.evaluate((v) => { location.hash = ''; window.AGPS.app.view = v; window.AGPS.ui.render(); }, view);
      const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert(over <= 1, view + ' overflows by ' + over + 'px');
    }
    await mp.click('.nav-toggle');
    assert(await mp.isVisible('#sidebar.open'));
    await mp.waitForTimeout(300);
    const dim = await mp.$eval('#navBackdrop', (e) => getComputedStyle(e).opacity);
    assert(dim === '1', 'backdrop dims the page when the menu is open (opacity ' + dim + ')');
    await mp.mouse.click(340, 400); // tap the dimmed area, right of the drawer
    await mp.waitForTimeout(300);
    assert(!(await mp.$('#sidebar.open')), 'tapping the backdrop closes the menu');
    await mp.click('.nav-toggle');
    await mp.keyboard.press('Escape');
    assert(!(await mp.$('#sidebar.open')), 'Escape closes the menu');
    await mp.click('.nav-toggle');
    const small = await mp.$$eval('.toolbar .btn, .nav-item', (els) => els.filter((e) => e.offsetParent && e.getBoundingClientRect().height < 34).length);
    assert(small === 0, small + ' touch targets under 34px');
    if (shotDir) { await mp.evaluate(() => { window.AGPS.app.view = 'wb:meshy'; window.AGPS.app.navOpen = false; window.AGPS.ui.render(); }); await mp.click('button[data-action="wbGenerate"]'); await mp.screenshot({ path: path.join(shotDir, '04-mobile-meshy.png') }); }
    await m.close();
  });
  await step('AI flow with a (mocked) configured backend: routing, confirmation, served-model labelling', async () => {
    const calls = [];
    const mk = (params) => ({ finalMessage: async () => { calls.push(params); return { model: params.model, stop_reason: 'end_turn', content: [{ type: 'text', text: '# Improved prompt\nAWA-KAEDE stays on model.' }], usage: { input_tokens: 900, output_tokens: 40 } }; } });
    const ai = createServer({ env: { ANTHROPIC_API_KEY: 'test-key-not-real' }, clientFactory: () => ({ client: { messages: { stream: mk }, beta: { messages: { stream: mk } } }, errors: {} }) });
    await new Promise((r) => ai.listen(0, '127.0.0.1', r));
    const aiBase = 'http://127.0.0.1:' + ai.address().port + '/';
    const c2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p2 = await c2.newPage();
    await p2.goto(aiBase);
    await p2.click('.card.preset:has-text("Anime War Arcade") button');
    await p2.click('#sidebar .nav-item:has-text("AI Models")');
    await p2.check('input[name="aiMode"][value="max"]');
    await p2.waitForSelector('.badge.ok');
    await p2.click('#sidebar .nav-item:has-text("Gameplay Engineering")');
    await p2.click('.toolbar button[data-action="wbGenerate"]');
    assert((await p2.textContent('#routeLine')).includes('Claude Opus 5.5'), 'route line shows Opus');
    await p2.click('button[data-action="wbAI"]');
    const modalText = await p2.textContent('#modal');
    assert(/MAXIMUM QUALITY/.test(modalText) && /Estimated usage/.test(modalText), 'confirmation shows reason and estimate');
    assert(calls.length === 0, 'nothing sent before confirmation');
    await p2.click('#modal button[data-action="doAI"]');
    await p2.waitForSelector('#modal', { state: 'hidden' });
    assert((await p2.inputValue('#editor')).includes('Improved prompt'), 'editor updated');
    assert((await p2.textContent('#issues')).includes('Response received from claude-opus-5-5'), 'served model shown');
    assert(calls[0].model === 'claude-opus-5-5' && calls[0].output_config.effort === 'medium', 'request params');
    if (shotDir) await p2.screenshot({ path: path.join(shotDir, '05-ai-flow.png') });
    await c2.close(); ai.close();
  });
  await step('no uncaught page errors', async () => { assert(errors.length === 0, errors.join(' | ')); });

  await browser.close(); server.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
