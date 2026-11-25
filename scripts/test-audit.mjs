// Unit tests for the shared audit pipeline (no browser, no Firebase).
// Transpiles the pure TypeScript modules to CommonJS and exercises them with node:assert.
import fs from 'node:fs';
import ts from '../packages/shared/node_modules/typescript/lib/typescript.js';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const dir = 'packages/shared/.test-build';
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(`${dir}/package.json`, '{"type":"commonjs"}');
for (const name of ['types', 'schemas', 'audit']) {
  const source = fs.readFileSync(`packages/shared/src/${name}.ts`, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  fs.writeFileSync(`${dir}/${name}.js`, output);
}
const require = createRequire(import.meta.url);
const a = require(`../${dir}/audit.js`);
const s = require(`../${dir}/schemas.js`);

const input = {
  id: '1',
  actionId: 'checkout',
  profileId: 'offline',
  route: '/checkout',
  actionLabel: 'Submit',
  domSummary: '',
  heuristics: { spinnerMs: null, visibleTextLen: 100, formLost: false, consoleErrors: [] },
};
const ok = {
  state: 'ok',
  severity: 'none',
  evidence: 'Offline banner',
  userImpact: 'Draft preserved',
  confidence: 0.9,
};

// Plain-code overrides beat the model.
assert.equal(a.postprocess(ok, { ...input.heuristics, formLost: true }).state, 'data_loss');
assert.equal(a.postprocess(ok, { ...input.heuristics, spinnerMs: 10000 }).state, 'infinite_spinner');
assert.equal(
  a.postprocess({ ...ok, state: 'blank_screen' }, { ...input.heuristics, spinnerMs: 10000 }).state,
  'infinite_spinner',
);
assert.equal(a.postprocess({ ...ok, state: 'raw_error', severity: 'low' }, input.heuristics).severity, 'medium');

// Code fences are tolerated; malformed output is retried once, then pending.
assert.equal(a.parseVerdict('```json\n' + JSON.stringify(ok) + '\n```').state, 'ok');
let calls = 0;
const unavailable = await a.judge(
  input,
  {
    generate: async () => {
      calls++;
      throw Error('unavailable');
    },
  },
  'on_device',
);
assert.equal(unavailable.judgedBy, 'pending');
assert.equal(unavailable.verdict, null);
assert.equal(calls, 1);
calls = 0;
const malformed = await a.judge(
  input,
  {
    generate: async () => {
      calls++;
      return 'not json';
    },
  },
  'on_device',
);
assert.equal(malformed.judgedBy, 'pending');
assert.equal(calls, 2);

// A real on-device run called a readable cart blank: defer contradictory evidence, never invent a pass.
const falseBlank = await a.judge(
  input,
  { generate: async () => JSON.stringify({ ...ok, state: 'blank_screen' }) },
  'on_device',
);
assert.equal(falseBlank.judgedBy, 'pending');
assert.equal(falseBlank.verdict, null);
assert.match(falseBlank.error, /contradicts measured visible content/);
const actualBlank = await a.judge(
  { ...input, heuristics: { ...input.heuristics, visibleTextLen: 0 } },
  { generate: async () => JSON.stringify({ ...ok, state: 'blank_screen' }) },
  'on_device',
);
assert.equal(actualBlank.verdict.state, 'blank_screen');

// Scores stay null while anything is pending.
assert.equal(a.score([unavailable]), null);
assert.equal(a.score([{ input, verdict: ok, judgedBy: 'on_device' }]), 100);
assert.equal(a.score([{ input, verdict: ok, judgedBy: 'on_device' }], 5), null);

// Regressions are matched by action + network profile.
const baseline = [{ input, verdict: ok, judgedBy: 'on_device' }];
const failed = [{ input, verdict: { ...ok, state: 'data_loss', severity: 'high' }, judgedBy: 'cloud' }];
assert.equal(a.regressions(failed, baseline)[0].regression, true);
assert.equal(a.regressions([{ ...failed[0], input: { ...input, profileId: 'flaky' } }], baseline)[0].regression, false);

// Diagnosis: unknown check references are rejected.
const finding = {
  title: 'Lost address',
  severity: 'high',
  state: 'data_loss',
  rootCause: 'reset',
  userImpact: 'Address lost',
  fixSummary: [],
  fixDiff: 'diff --git',
  filesTouched: [],
  checkIds: ['unknown'],
};
await assert.rejects(() => a.diagnose(failed, { generate: async () => JSON.stringify({ findings: [finding] }) }));

// Diagnosis: stable IDs, check references, and no diff without sources.
const diagnosed = await a.diagnose(failed, {
  generate: async () => JSON.stringify({ findings: [{ ...finding, checkIds: ['1'] }] }),
});
assert.equal(diagnosed.findings.length, 1);
assert.equal(diagnosed.findings[0].fixDiff, '');
assert.equal(diagnosed.findings[0].id, a.findingId('data_loss', [{ actionId: 'checkout', profileId: 'offline' }]));
assert.deepEqual(diagnosed.findings[0].checks[0], {
  checkId: '1',
  route: '/checkout',
  actionId: 'checkout',
  profileId: 'offline',
});
assert.equal(
  a.findingId('data_loss', [
    { actionId: 'b', profileId: 'x' },
    { actionId: 'a', profileId: 'x' },
  ]),
  a.findingId('data_loss', [
    { actionId: 'a', profileId: 'x' },
    { actionId: 'b', profileId: 'x' },
  ]),
);

// A finding is resolved only when every covered check passes.
assert.equal(a.isResolvedBy(diagnosed.findings[0], baseline), true);
assert.equal(a.isResolvedBy(diagnosed.findings[0], failed), false);

// Source budget is enforced.
await assert.rejects(() => a.diagnose(failed, { generate: async () => '{}' }, { 'big.ts': 'x'.repeat(70000) }));

// JSON schemas used for structured output agree with the zod schema.
assert.deepEqual(
  [...s.verdictJsonSchema.properties.state.enum].sort(),
  [...s.verdictSchema.shape.state.options].sort(),
);

console.log(
  'Audit checks passed: overrides, fences, retries, pending score, regressions, diagnosis IDs and references, resolution, source budget, schema agreement.',
);
