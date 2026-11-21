import { z } from 'zod';
import { SEVERITIES, VERDICT_STATES } from './types';

/** Runtime validation for a single screen verdict (on-device or cloud). */
export const verdictSchema = z.object({
  state: z.enum(['ok', 'infinite_spinner', 'blank_screen', 'raw_error', 'data_loss', 'silent_failure']),
  severity: z.enum(['none', 'low', 'medium', 'high']),
  evidence: z.string().max(200),
  userImpact: z.string().max(280),
  confidence: z.number().min(0).max(1),
});

const FAILED_STATES = VERDICT_STATES.filter((state) => state !== 'ok');

/**
 * JSON Schema sent to the models so they return structured output:
 * - on-device: Prompt API `responseConstraint`
 * - cloud: Gemini `responseJsonSchema`
 */
export const verdictJsonSchema = {
  type: 'object',
  properties: {
    state: { type: 'string', enum: [...VERDICT_STATES] },
    severity: { type: 'string', enum: [...SEVERITIES] },
    evidence: { type: 'string', maxLength: 200 },
    userImpact: { type: 'string', maxLength: 280 },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['state', 'severity', 'evidence', 'userImpact', 'confidence'],
  additionalProperties: false,
} as const;

export const findingsSchema = z.object({
  findings: z.array(
    z.object({
      title: z.string().max(80),
      severity: z.enum(['low', 'medium', 'high']),
      state: z.enum(['infinite_spinner', 'blank_screen', 'raw_error', 'data_loss', 'silent_failure']),
      rootCause: z.string(),
      userImpact: z.string(),
      fixSummary: z.array(z.string()).max(3),
      fixDiff: z.string(),
      filesTouched: z.array(z.string()),
      checkIds: z.array(z.string()).min(1),
    }),
  ),
});

export type DiagnosedFinding = z.infer<typeof findingsSchema>['findings'][number];

export const findingsJsonSchema = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', maxLength: 80 },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
          state: { type: 'string', enum: FAILED_STATES },
          rootCause: { type: 'string' },
          userImpact: { type: 'string' },
          fixSummary: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          fixDiff: { type: 'string' },
          filesTouched: { type: 'array', items: { type: 'string' } },
          checkIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
        },
        required: [
          'title',
          'severity',
          'state',
          'rootCause',
          'userImpact',
          'fixSummary',
          'fixDiff',
          'filesTouched',
          'checkIds',
        ],
      },
    },
  },
  required: ['findings'],
} as const;

/** Strips a Markdown code fence some models wrap around JSON. */
export function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
}
