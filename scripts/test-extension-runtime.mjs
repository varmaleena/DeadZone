import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
const extension = path.resolve('apps/extension/dist');
const targetUrl = process.env.EXTENSION_TEST_URL || 'http://127.0.0.1:5188';
const profile = path.resolve(`tmp/extension-test-profile-${Date.now()}`);
fs.mkdirSync(profile, { recursive: true });
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
try {
  const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  const id = new URL(worker.url()).host;
  const app = await context.newPage();
  await app.goto(targetUrl);
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${id}/panel.html`);
  await panel.locator('#start').waitFor();
  await panel.locator('#tab-sweep').click();
  await panel.locator('#workspace-content').focus();
  await panel.keyboard.press('PageDown');
  await panel.waitForTimeout(200);
  const contentScroll = await panel.locator('#workspace-content').evaluate(el => ({ top: el.scrollTop, height: el.clientHeight, content: el.scrollHeight }));
  if (contentScroll.content > contentScroll.height && contentScroll.top <= 0) throw Error('Workspace content could not scroll');
  console.log('Workspace scroll verified:', contentScroll);
  const target = await panel.evaluate(async (url) => {
    const tabs = await chrome.tabs.query({ url: `${url}/*` });
    return tabs[0].id;
  }, targetUrl);
  await panel.evaluate(async (tabId) => {
    window.testPort = chrome.runtime.connect({ name: 'acceptance' });
    window.pendingTest = new Map();
    window.testPort.onMessage.addListener((message) => {
      const task = window.pendingTest.get(message.id);
      if (task) {
        window.pendingTest.delete(message.id);
        if (message.error) task.reject(Error(message.error));
        else task.resolve(message.data);
      }
    });
    window.testCommand = (type, offline) =>
      new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        window.pendingTest.set(id, { resolve, reject });
        window.testPort.postMessage({ id, type, tabId, offline });
      });
    await window.testCommand('attach');
    await window.testCommand('offline', true);
  }, target);
  const offline = await app.evaluate(async () => {
    try {
      await fetch('/index.html?offline-test=' + Date.now(), { cache: 'no-store' });
      return false;
    } catch {
      return true;
    }
  });
  if (!offline) throw Error('CDP offline was not applied');
  const competing = await panel.evaluate(async (tabId) => {
    const other = chrome.runtime.connect({ name: 'competing-window' });
    const result = await new Promise((resolve) => {
      other.onMessage.addListener(resolve);
      other.postMessage({ id: 'competing', type: 'attach', tabId });
    });
    other.disconnect();
    return result;
  }, target);
  if (!competing.error?.includes('Another Deadzone window')) throw Error('Competing sweep was not rejected');
  await panel.evaluate(() => window.testCommand('ping'));
  if (
    !(await app.evaluate(async () => {
      try {
        await fetch('/?must-stay-offline=' + Date.now(), { cache: 'no-store' });
        return false;
      } catch {
        return true;
      }
    }))
  )
    throw Error('Other panel disconnect interrupted the owning sweep');
  const image = await panel.evaluate(() => window.testCommand('capture'));
  if (typeof image !== 'string' || image.length < 100) throw Error('Screenshot capture failed');
  await panel.evaluate(() => window.testPort.disconnect());
  await app.waitForFunction(
    async () => {
      try {
        return (await fetch('/index.html?restore-test=' + Date.now(), { cache: 'no-store' })).ok;
      } catch {
        return false;
      }
    },
    {},
    { timeout: 15000 },
  );
  console.log(
    'Extension runtime passed: MV3 loaded, debugger attached, offline enforced, competing sweep rejected, other-panel disconnect preserved ownership, heartbeat and screenshot succeeded, owner disconnect restored network.',
  );
} finally {
  await context.close();
}
