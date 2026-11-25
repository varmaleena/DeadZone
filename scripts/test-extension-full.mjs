import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
// Restore Chrome's normal feature configuration; Playwright's defaults suppress model eligibility.
const playwrightBundle = fs.readFileSync(
  'node_modules/.pnpm/playwright-core@1.65.1/node_modules/playwright-core/lib/coreBundle.js',
  'utf8',
);
const disabledList = playwrightBundle.match(/disabledFeatures = \[([\s\S]*?)\]\.filter/)[1];
const disabledFlag =
  '--disable-features=' + [...disabledList.matchAll(/"([^"]+)"/g)].map((match) => match[1]).join(',');
const cloudLocal = process.argv.includes('--cloud-local');
const cartCheck = process.argv.includes('--cart');
const cloudTest = process.argv.includes('--cloud') || cloudLocal;
const cloudConfig = cloudTest ? JSON.parse(fs.readFileSync('tmp/private/e2e-cloud.json', 'utf8')) : null;
const outputDir = cartCheck
  ? 'output/extension-cart-recheck'
  : cloudLocal
    ? 'output/extension-cloud-local-e2e'
    : cloudTest
      ? 'output/extension-cloud-e2e'
      : 'output/extension-e2e';
const context = await chromium.launchPersistentContext(
  path.resolve(cloudTest ? '.local-tools/extension-cloud-test-profile' : '.local-tools/nano-offline-test-profile'),
  {
    executablePath: 'C:/Users/leeva/AppData/Local/Google/Chrome/Application/chrome.exe',
    headless: false,
    ignoreDefaultArgs: cloudTest
      ? ['--disable-extensions']
      : [
          '--disable-component-update',
          '--disable-background-networking',
          '--disable-extensions',
          '--disable-field-trial-config',
          '--enable-automation',
          disabledFlag,
        ],
    args: [
      '--enable-unsafe-extension-debugging',
      cloudTest
        ? '--disable-features=AIPromptAPI,AIPromptAPIMultimodalInput'
        : '--enable-features=PromptAPIForGeminiNano,PromptAPIForGeminiNanoMultimodalInput',
    ],
    viewport: { width: 1280, height: 900 },
  },
);
try {
  if (cloudConfig)
    await context.addInitScript((token) => {
      globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = token;
    }, cloudConfig.debugToken);
  const session = await context.browser().newBrowserCDPSession();
  const loaded = await session.send('Extensions.loadUnpacked', { path: path.resolve('apps/extension/dist') });
  console.log('Loaded actual extension', loaded.id);
  const app = await context.newPage();
  await app.goto('http://127.0.0.1:5188/');
  const panel = await context.newPage();
  const diagnosticLogs = [];
  panel.on('console', message => diagnosticLogs.push({ type: message.type(), text: message.text() }));
  await panel.goto(`chrome-extension://${loaded.id}/panel.html`);
  await panel.locator('#start').waitFor({ state: 'attached' });
  await panel.waitForFunction(() => !document.querySelector('#nano-chip').textContent.includes('…'));
  console.log('Model:', await panel.locator('#nano-chip').innerText());
  console.log(
    'Website model:',
    await app.evaluate(async () => ({
      available: globalThis.LanguageModel
        ? await globalThis.LanguageModel.availability({ expectedInputs: [{ type: 'text' }, { type: 'image' }] })
        : 'API disabled for fallback test',
    })),
  );
  panel.on('dialog', (dialog) => dialog.accept());
  fs.mkdirSync(outputDir, { recursive: true });
  await panel.screenshot({ path: `${outputDir}/extension-ready.png`, fullPage: true });
  const fullPlan = JSON.parse(fs.readFileSync('apps/extension/src/plans/freshcart.json', 'utf8'));
  const plan = cloudTest
    ? fullPlan.filter((action) => action.id === 'checkout-submit')
    : cartCheck
      ? fullPlan.filter((action) => action.id === 'cart-view')
      : fullPlan;
  if (cloudConfig && !cloudLocal) {
    await panel.locator('#tab-setup').click();
    if ((await panel.locator('#workspace').inputValue()) !== cloudConfig.workspaceId) {
      await panel.locator('#workspace').fill(cloudConfig.workspaceId);
      await panel.locator('#pair-code').fill(cloudConfig.pairingCode);
      await panel.locator('#pair').click();
      await panel.waitForFunction(() => !document.querySelector('#pair').disabled, null, { timeout: 30000 });
      const pairStatus = await panel.locator('#status').innerText();
      if (!pairStatus.toLowerCase().includes('workspace paired')) {
        fs.writeFileSync('tmp/private/extension-pairing-diagnostics.json', JSON.stringify(diagnosticLogs, null, 2));
        throw Error(pairStatus);
      }
    }
    console.log('Paired with temporary live workspace');
  }
  await panel.locator('#tab-sweep').click();
  await panel.getByText('Edit sweep plan (JSON)', { exact: true }).click();
  await panel.locator('#plan').fill(JSON.stringify(plan));
  const aiRequestsDuringSweep = [];
  const trackAI = (request) => {
    if (/firebase(?:vertexai|aiplatform)\.googleapis\.com/.test(request.url()))
      aiRequestsDuringSweep.push(request.url());
  };
  context.on('request', trackAI);
  // Keep the app active while invoking the genuine panel button, as a side panel does.
  await app.bringToFront();
  await panel.evaluate(() => document.querySelector('#start').click());
  for (let attempt = 0; attempt < 180; attempt++) {
    await panel.waitForTimeout(5000);
    const running = await panel.locator('#start').isDisabled();
    const count = await panel.evaluate(
      async () => (await chrome.storage.local.get('lastSweep')).lastSweep?.length || 0,
    );
    console.log(`Sweep ${count}/${plan.length}: ${await panel.locator('#step-text').innerText()}`);
    if (!running) break;
  }
  const stored = await panel.evaluate(() => chrome.storage.local.get(['lastSweep', 'lastFindings']));
  context.off('request', trackAI);
  if (aiRequestsDuringSweep.length) throw Error('Local-only sweep attempted a cloud AI request');
  console.log('Verified: zero cloud AI requests during local-only sweep');
  fs.writeFileSync(`${outputDir}/sweep.json`, JSON.stringify(stored, null, 2));
  await panel.locator('#tab-results').click();
  await panel.screenshot({ path: `${outputDir}/results.png`, fullPage: true });
  console.log(
    'Summary',
    JSON.stringify(
      stored.lastSweep?.map((c) => ({ route: c.route, judgedBy: c.judgedBy, verdict: c.verdict, error: c.error })),
    ),
  );
  if (stored.lastSweep?.length !== plan.length) throw Error('Sweep did not finish all actions');
  if (
    cartCheck &&
    stored.lastSweep.some(
      (c) =>
        c.verdict?.state !== 'ok' &&
        !(c.judgedBy === 'pending' && c.error?.includes('contradicts measured visible content')),
    )
  )
    throw Error('Cart verdict is neither a valid empty state nor deferred contradictory evidence');
  if (!cloudTest && !cartCheck && stored.lastSweep.some((c) => c.judgedBy !== 'on_device'))
    throw Error('Not every check completed on-device');
  if (cloudTest) {
    if (!stored.lastSweep.some((c) => c.judgedBy === 'pending'))
      throw Error('Expected a real pending check before cloud evaluation');
    await panel.locator('#tab-results').click();
    await panel.locator('#diagnose').click();
    await panel.waitForFunction(() => !document.querySelector('#diagnose').disabled, null, { timeout: 180000 });
    console.log('Cloud status:', await panel.locator('#status').innerText());
    const diagnosed = await panel.evaluate(() => chrome.storage.local.get(['lastSweep', 'lastFindings']));
    fs.writeFileSync(`${outputDir}/diagnosis.json`, JSON.stringify(diagnosed, null, 2));
    await panel.screenshot({ path: `${outputDir}/diagnosis.png`, fullPage: true });
    if (diagnosed.lastSweep.some((c) => c.judgedBy !== 'cloud'))
      throw Error('Pending checks were not completed in cloud');
    if (!diagnosed.lastFindings?.length) throw Error('No cloud finding returned for the broken checkout');
    console.log(
      'Cloud findings:',
      diagnosed.lastFindings
        .map((f) => ({ title: f.title, severity: f.severity, files: f.files, fix: f.fix }))
        .map((f) => JSON.stringify(f))
        .join('\n'),
    );
  }
  await panel.reload();
  await panel.locator('#tab-results').click();
  const reloaded = await panel.evaluate(async () => (await chrome.storage.local.get('lastSweep')).lastSweep);
  if (reloaded.length !== plan.length) throw Error('Saved results were lost after reload');
  if (!(await app.evaluate(async () => (await fetch('/?recovery=' + Date.now(), { cache: 'no-store' })).ok)))
    throw Error('Target network not restored');
  console.log(
    cloudTest
      ? 'PASS: live pairing, pending screenshot verdict, cloud diagnosis, saved results after reload, connection recovery.'
      : 'PASS: full genuine extension sweep, on-device verdicts, saved results after reload, target connection restored.',
  );
} finally {
  await context.close();
}
