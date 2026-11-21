export type VerdictState = 'ok' | 'infinite_spinner' | 'blank_screen' | 'raw_error' | 'data_loss' | 'silent_failure';

export type Severity = 'none' | 'low' | 'medium' | 'high';

export type JudgedBy = 'on_device' | 'cloud' | 'pending';

export type NetworkProfileId = 'offline' | 'flaky';

export type FindingStatus = 'open' | 'fixed' | 'regressed';

export interface Verdict {
  state: VerdictState;
  severity: Severity;
  evidence: string;
  userImpact: string;
  confidence: number;
}

export const VERDICT_STATES: readonly VerdictState[] = [
  'ok',
  'infinite_spinner',
  'blank_screen',
  'raw_error',
  'data_loss',
  'silent_failure',
];

export const SEVERITIES: readonly Severity[] = ['none', 'low', 'medium', 'high'];
