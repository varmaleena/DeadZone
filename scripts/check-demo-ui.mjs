import { chromium } from '@playwright/test';
import fs from 'node:fs';
const baseUrl = process.env.CONSOLE_URL || 'http://127.0.0.1:5190';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
fs.mkdirSync('output/ui', { recursive: true });
await page.goto(baseUrl + '/');
await page.locator('.lp-hero').waitFor();
await page.screenshot({ path: 'output/ui/home-desktop.png', fullPage: true });
const brand = await page.locator('.lp-nav .brand-name').innerText();
const homePalette = await page.locator('.lp').evaluate((el) => ({
  background: getComputedStyle(el).backgroundColor,
  heading: getComputedStyle(el.querySelector('h1')).fontFamily,
}));
await page.setViewportSize({ width: 390, height: 844 });
if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Mobile home overflow');
await page.screenshot({ path: 'output/ui/home-mobile.png', fullPage: true });
await page.setViewportSize({ width: 1440, height: 1000 });
for (const [route, heading] of [
  ['/preview', /Offline readiness/],
  ['/preview/checks', 'Screen checks'],
  ['/preview/guide', 'A clear path to your audit.'],
]) {
  await page.goto(baseUrl + route);
  await page.getByRole('heading', { name: heading, exact: typeof heading === 'string' }).waitFor();
  if ((await page.locator('header .brand-name').innerText()) !== brand) throw Error('Brand mismatch');
  const workspacePalette = await page.evaluate(() => ({
    background: getComputedStyle(document.body).backgroundColor,
    heading: getComputedStyle(document.querySelector('h1')).fontFamily,
  }));
  if (JSON.stringify(workspacePalette) !== JSON.stringify(homePalette)) throw Error('Design system mismatch');
  if ((await page.locator('.demo-main>section:visible').count()) !== 1)
    throw Error('Page must show one focused section');
  await page.screenshot({ path: 'output/ui/' + route.replaceAll('/', '-') + '-desktop.png', fullPage: true });
  if (route.endsWith('checks')) {
    await page.getByRole('searchbox').fill('checkout');
    if ((await page.locator('.table-row:not(.table-head):visible').count()) !== 1) throw Error('Search filter failed');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    throw Error('Mobile overflow: ' + route);
  await page.screenshot({ path: 'output/ui/' + route.replaceAll('/', '-') + '-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
}
await browser.close();
console.log(
  'Passed: homepage + three workspace pages; shared branding, palette and heading typography; search; desktop/mobile overflow.',
);
