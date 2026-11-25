import { chromium } from '@playwright/test';
import fs from 'node:fs';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const context = browser.contexts()[0];
const page =
  context.pages().find((p) => p.url().startsWith('chrome-extension://ecfdkkjfapeojjfnoedamodnhdppehjc')) ||
  (await context.newPage());
fs.mkdirSync('output/ui', { recursive: true });
try {
  await page.goto('chrome-extension://ecfdkkjfapeojjfnoedamodnhdppehjc/panel.html');
  await page.bringToFront();
  await page.evaluate(() => document.fonts.ready);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const tab of ['setup', 'sweep', 'results', 'settings']) {
      await page.locator(`#tab-${tab}`).click();
      if ((await page.locator('main > .view:visible').count()) !== 1) throw Error(`Overlapping views: ${width}/${tab}`);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
        throw Error(`Horizontal overflow: ${width}/${tab}`);
      await page.screenshot({
        path: `output/ui/extension-${tab}-${width}.png`,
        fullPage: width > 1000,
        animations: 'disabled',
        timeout: 60000,
      });
    }
    await page.locator('#tab-results').click();
    await page.screenshot({
      path: `output/ui/extension-enterprise-${width}.png`,
      fullPage: true,
      animations: 'disabled',
      timeout: 60000,
    });
    console.log(`PASS: all four views at ${width}px; no overflow or overlapping panels`);
  }
  const original = await page.locator('#results .result-row').count();
  await page.locator('#result-search').fill('no-matching-screen-999');
  if ((await page.locator('#results .result-row').count()) !== 0) throw Error('Search failed');
  await page.locator('#result-search').fill('');
  if ((await page.locator('#results .result-row').count()) !== original) throw Error('Search reset failed');
  await page.locator('#result-severity').selectOption('high');
  await page.locator('#result-origin').selectOption('on_device');
  const rows = await page.locator('#results .result-row').allTextContents();
  if (rows.some((row) => !row.includes('HIGH') || !row.includes('ON DEVICE'))) throw Error('Combined filters failed');
  await page.locator('#result-severity').selectOption('');
  await page.locator('#result-origin').selectOption('');
  const firstSaved = await page.evaluate(async () => (await chrome.storage.local.get('lastSweep')).lastSweep?.[0]);
  if (firstSaved) {
    await page.locator('#result-origin').selectOption(firstSaved.judgedBy);
    await page.locator('#result-severity').selectOption(firstSaved.verdict?.severity ?? 'pending');
    if (!(await page.locator('#results .result-row').allTextContents()).some((text) => text.includes(firstSaved.route)))
      throw Error('Filters excluded a matching real result');
    await page.locator('#result-origin').selectOption('');
    await page.locator('#result-severity').selectOption('');
  }
  if (original) {
    await page.locator('#results .result-row').first().click();
    await page.locator('#view-detail').waitFor();
    if ((await page.locator('#detail .compare img').count()) !== 2) throw Error('Evidence screenshots missing');
    await page.locator('#back').click();
  }
  await page.locator('#tab-results').focus();
  await page.keyboard.press('ArrowRight');
  if ((await page.locator('#tab-settings').getAttribute('aria-selected')) !== 'true')
    throw Error('Keyboard navigation failed');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#tab-results').click();
  await page.screenshot({
    path: 'output/ui/extension-enterprise-desktop.png',
    fullPage: true,
    animations: 'disabled',
    timeout: 60000,
  });
  console.log('PASS: search, combined filters, evidence details, back navigation and keyboard tabs');
} finally {
  await browser.close();
}
