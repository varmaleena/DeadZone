import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
const extension = path.resolve('apps/extension/dist');
const profile = path.resolve('tmp/extension-test-profile');
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
  await app.goto('http://127.0.0.1:5190/demo');
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${id}/panel.html`);
  await panel.locator('#start').waitFor();
  const target = await panel.evaluate(async () => {
    const tabs = await chrome.tabs.query({ url: 'http://127.0.0.1:5190/*' });
    return tabs[0].id;
  });
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
    'Extension runtime passed: MV3 loaded, panel rendered, debugger attached, tab offline, screenshot captured, disconnect restored network.',
  );
} finally {
  await context.close();
}
