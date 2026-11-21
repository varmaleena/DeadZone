import { test, expect } from '@playwright/test';
import {
  targetOrigin,
  validatePlan,
  runPageAction,
  snapshotPage,
  expectedFields,
} from '../apps/extension/src/integration.ts';
const action = {
  id: 'save-note',
  route: '/notes',
  steps: [
    { type: 'fill', selector: '[name=note]', value: 'Inspection complete' },
    { type: 'submit', selector: 'button' },
  ],
};
test('plan accepts unrelated HTTPS apps and rejects unsafe targets', () => {
  expect(targetOrigin('https://example.com/notes')).toBe('https://example.com');
  expect(() => targetOrigin('chrome://settings')).toThrow();
  expect(() => validatePlan([{ ...action, route: '//other.test/path' }], 'https://example.com')).toThrow();
  expect(() => validatePlan([action, action], 'https://example.com')).toThrow();
  expect(validatePlan([action], 'https://example.com')).toHaveLength(1);
});
for (const losesInput of [true, false])
  test(`unrelated notes app detects ${losesInput ? 'lost' : 'retained'} input`, async ({ page }) => {
    await page.setContent(
      `<main><h1>Field notes</h1><form><textarea name="note"></textarea><button>Save note</button><p role="status"></p></form></main>`,
    );
    await page.evaluate(
      (loses) =>
        document.querySelector('form').addEventListener('submit', (event) => {
          event.preventDefault();
          document.querySelector('[role=status]').textContent = 'Offline: note queued';
          if (loses) event.target.reset();
        }),
      losesInput,
    );
    await page.evaluate(runPageAction, action);
    const expected = expectedFields(action);
    const snapshot = await page.evaluate(snapshotPage, { fields: Object.keys(expected), expected });
    expect(snapshot.formLost).toBe(losesInput);
    expect(snapshot.text).toContain('note queued');
  });
test('snapshot ignores hidden loading indicators', async ({ page }) => {
  await page.setContent('<main><h1>Notes saved</h1><div role="progressbar" hidden></div></main>');
  expect((await page.evaluate(snapshotPage, {})).spinner).toBe(false);
});
