import { chromium } from '@playwright/test';
import fs from 'node:fs';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const context = browser.contexts()[0];
const page = context.pages().find((p) => p.url().includes(':5174')) || (await context.newPage());
const evidence = { testedAt: new Date().toISOString(), profile: 'F:/DEADZONE/.local-tools/nano-offline-test-profile' };
fs.mkdirSync('output/nano-check', { recursive: true });
try {
  await page.goto('http://127.0.0.1:5174/');
  await page.locator('#prepare').waitFor();
  evidence.availability = await page.evaluate(async () => {
    if (!globalThis.LanguageModel) return { api: false };
    return {
      api: true,
      text: await globalThis.LanguageModel.availability({ expectedInputs: [{ type: 'text' }] }),
      screenshot: await globalThis.LanguageModel.availability({
        expectedInputs: [{ type: 'text' }, { type: 'image' }],
      }),
    };
  });
  await page.locator('#prepare').click();
  await page
    .waitForFunction(
      () => {
        const status = document.querySelector('#status').textContent;
        return !status.startsWith('Preparing') && !status.startsWith('Downloading');
      },
      null,
      { timeout: 45000 },
    )
    .catch(() => {});
  evidence.initialization = await page.locator('#status').innerText();
  if (!(await page.locator('#judge').isDisabled())) {
    const target = await context.newPage();
    await target.goto('http://127.0.0.1:5188/profile');
    await target.getByRole('heading').first().waitFor();
    const screenshot = await target.screenshot();
    await target.close();
    await page
      .locator('#image')
      .setInputFiles({ name: 'offline-screen.png', mimeType: 'image/png', buffer: screenshot });
    const successfulRequests = [];
    const recordResponse = (response) => successfulRequests.push(response.url());
    context.on('response', recordResponse);
    await context.setOffline(true);
    evidence.networkOffline = await page.evaluate(() => !navigator.onLine);
    await page.locator('#judge').click();
    await page.waitForFunction(() => !document.querySelector('#status').textContent.startsWith('Judging'), null, {
      timeout: 300000,
    });
    evidence.offlineStatus = await page.locator('#status').innerText();
    evidence.output = await page.locator('#output').innerText();
    evidence.offlineAtCompletion = await page.evaluate(() => !navigator.onLine);
    evidence.responsesDuringOfflineInference = successfulRequests;
    context.off('response', recordResponse);
    await context.setOffline(false);
  } else {
    evidence.offlineInferenceExecuted = false;
  }
  await page.screenshot({ path: 'output/nano-check/firebase-runtime-test.png', fullPage: true });
  const diagnostics = await context.newPage();
  await diagnostics.goto('chrome://chrome-urls/');
  const enable = diagnostics.getByRole('button', { name: 'Enable internal debugging pages' });
  if (await enable.count()) await enable.click();
  await diagnostics.goto('chrome://on-device-internals/');
  await diagnostics.getByRole('tab', { name: 'Broker State' }).click();
  await diagnostics.waitForTimeout(3000);
  evidence.diagnostics = await diagnostics.locator('body').ariaSnapshot();
  await diagnostics.screenshot({ path: 'output/nano-check/offline-broker.png', fullPage: true });
  await diagnostics.close();
} finally {
  await context.setOffline(false);
  fs.writeFileSync('output/nano-check/offline-test.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
  await browser.close();
}
