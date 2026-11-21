import { fetchAndActivate, getNumber, getString, type RemoteConfig } from 'firebase/remote-config';

/** Defaults used when Remote Config can't be fetched (for example while offline). */
export const rubricDefaults = {
  dz_spinner_timeout_ms: 10000,
  dz_settle_ms: 3000,
  dz_blank_text_threshold: 40,
  dz_max_checks: 30,
  dz_thumb_max_kb: 120,
  dz_cloud_model: 'gemini-3.5-flash-lite',
  dz_prompt_version: 'v2',
};

export interface Rubric {
  source: 'defaults' | 'remote_or_cached';
  spinnerTimeout: number;
  settleMs: number;
  maxChecks: number;
  blankThreshold: number;
  thumbMaxKb: number;
  cloudModel: string;
  promptVersion: string;
}

const MODEL_NAME = /^[a-z0-9][a-z0-9.-]{2,63}$/;

export function defaultRubric(): Rubric {
  return {
    source: 'defaults',
    spinnerTimeout: rubricDefaults.dz_spinner_timeout_ms,
    settleMs: rubricDefaults.dz_settle_ms,
    maxChecks: rubricDefaults.dz_max_checks,
    blankThreshold: rubricDefaults.dz_blank_text_threshold,
    thumbMaxKb: rubricDefaults.dz_thumb_max_kb,
    cloudModel: rubricDefaults.dz_cloud_model,
    promptVersion: rubricDefaults.dz_prompt_version,
  };
}

/** Loads the judging rubric from Remote Config, bounded so a bad value can't break sweeps. */
export async function loadRubric(config: RemoteConfig): Promise<Rubric> {
  config.defaultConfig = rubricDefaults;
  config.settings.fetchTimeoutMillis = 5000;
  let source: Rubric['source'] = 'defaults';
  try {
    await fetchAndActivate(config);
    source = 'remote_or_cached';
  } catch {
    // Offline startup: cached values or defaults are used.
  }
  const bounded = (key: string, min: number, max: number) => Math.max(min, Math.min(max, getNumber(config, key) || 0));
  const cloudModel = getString(config, 'dz_cloud_model').trim();
  const promptVersion = getString(config, 'dz_prompt_version').trim();
  return {
    source,
    spinnerTimeout: bounded('dz_spinner_timeout_ms', 1000, 60000),
    settleMs: bounded('dz_settle_ms', 0, 30000),
    maxChecks: bounded('dz_max_checks', 1, 30),
    blankThreshold: bounded('dz_blank_text_threshold', 0, 500),
    thumbMaxKb: bounded('dz_thumb_max_kb', 20, 160),
    cloudModel: MODEL_NAME.test(cloudModel) ? cloudModel : rubricDefaults.dz_cloud_model,
    promptVersion: promptVersion || rubricDefaults.dz_prompt_version,
  };
}
