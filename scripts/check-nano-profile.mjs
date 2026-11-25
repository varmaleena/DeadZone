import { chromium } from '@playwright/test';
import fs from 'node:fs';
const profile = 'F:/DEADZONE/.local-tools/chrome-nano-profile';
const context = await chromium.launchPersistentContext(profile, {
  executablePath: 'C:/Users/leeva/AppData/Local/Google/Chrome/Application/chrome.exe',
  headless: false,
  args: ['--enable-features=PromptAPIForGeminiNano,PromptAPIForGeminiNanoMultimodalInput'],
});
try {
  const page = context.pages()[0] || await context.newPage();
  await page.goto('http://127.0.0.1:5191/');
  const result = await page.evaluate(async () => {
    const model = globalThis.LanguageModel;
    const output = { userAgent: navigator.userAgent, apiPresent: !!model };
    if (model) {
      for (const [name, options] of Object.entries({
        text: { expectedInputs: [{ type: 'text', languages: ['en'] }] },
        screenshots: { expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'image' }] },
      })) {
        try { output[name] = await model.availability(options); }
        catch (error) { output[name] = String(error); }
      }
    }
    return output;
  });
  await page.goto('chrome://on-device-internals/');
  await page.waitForTimeout(2000);
  result.internals = (await page.locator('body').innerText()).slice(0, 12000);
  fs.mkdirSync('output/nano-check', { recursive: true });
  fs.writeFileSync('output/nano-check/availability.json', JSON.stringify(result, null, 2));
  await page.screenshot({ path: 'output/nano-check/internals.png', fullPage: true });
  console.log(JSON.stringify(result, null, 2));
} finally { await context.close(); }
