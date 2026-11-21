/**
 * Sweep plan validation and the functions injected into the page under test.
 *
 * IMPORTANT: runPageAction and snapshotPage are serialised by chrome.scripting.executeScript,
 * so they must stay self-contained: no imports, no references to module-level values.
 */

export type StepType = 'navigate' | 'click' | 'fill' | 'submit' | 'wait';

export interface PlanStep {
  type: StepType;
  selector?: string;
  value?: string;
  ms?: number;
  mode?: 'reload';
}

export interface PlanAction {
  id: string;
  label?: string;
  route: string;
  rootSelector?: string;
  steps: PlanStep[];
  expectsFormFields?: string[];
}

export interface PageSnapshot {
  text: string;
  spinner: boolean;
  fields: Record<string, string | null>;
  formLost: boolean;
  /** Cheap fingerprint of the visible DOM, used to detect when the screen has settled. */
  fingerprint: string;
}

export interface SnapshotOptions {
  rootSelector?: string;
  fields?: string[];
  expected?: Record<string, string>;
}

const STEP_TYPES: readonly StepType[] = ['navigate', 'click', 'fill', 'submit', 'wait'];

export function targetOrigin(value: string | undefined): string {
  const url = new URL(value ?? '');
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Choose an HTTP or HTTPS app tab. Browser pages and extension pages are not supported.');
  }
  return url.origin;
}

export function validatePlan(plan: unknown, origin: string, max = 30): PlanAction[] {
  if (!Array.isArray(plan) || !plan.length || plan.length > max) {
    throw new Error(`The sweep plan must contain between 1 and ${max} actions.`);
  }
  const ids = new Set<string>();
  for (const action of plan as PlanAction[]) {
    if (!action || typeof action.id !== 'string' || !action.id || ids.has(action.id)) {
      throw new Error('Action IDs must be unique, non-empty strings.');
    }
    ids.add(action.id);
    if (
      typeof action.route !== 'string' ||
      !action.route.startsWith('/') ||
      new URL(action.route, origin).origin !== origin
    ) {
      throw new Error(`Route for "${action.id}" must stay within ${origin}.`);
    }
    if (!Array.isArray(action.steps) || action.steps.length > 30) {
      throw new Error(`"${action.id}" needs a steps array with at most 30 steps.`);
    }
    for (const step of action.steps) {
      if (!STEP_TYPES.includes(step.type)) throw new Error(`Unsupported step type "${String(step.type)}".`);
      if (step.type === 'wait' && (!Number.isFinite(step.ms) || step.ms! < 0 || step.ms! > 30000)) {
        throw new Error('Wait steps need "ms" between 0 and 30000.');
      }
      if (['click', 'fill', 'submit'].includes(step.type) && typeof step.selector !== 'string') {
        throw new Error(`A "${step.type}" step needs a selector.`);
      }
    }
    if (action.expectsFormFields && !Array.isArray(action.expectsFormFields)) {
      throw new Error('"expectsFormFields" must be an array of selectors.');
    }
  }
  return plan as PlanAction[];
}

/** Values typed by fill steps; if these fields are empty after the action, input was lost. */
export function expectedFields(action: PlanAction): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const step of action.steps) {
    if (step.type === 'fill' && step.value && step.selector) fields[step.selector] = step.value;
  }
  return fields;
}

/** Runs in the target page. */
export async function runPageAction(action: PlanAction): Promise<void> {
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  for (const step of action.steps) {
    if (step.type === 'navigate') {
      if (step.mode === 'reload') {
        location.reload();
        return;
      }
      history.pushState({}, '', action.route);
      dispatchEvent(new PopStateEvent('popstate'));
      continue;
    }
    if (step.type === 'wait') {
      await wait(step.ms ?? 0);
      continue;
    }
    let element: Element | null = null;
    for (let attempt = 0; attempt < 50 && !element; attempt++) {
      element = document.querySelector(step.selector!);
      if (!element) await wait(100);
    }
    if (!element) throw new Error('Selector not found: ' + step.selector);
    if (step.type === 'fill') {
      const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (!setter) throw new Error('Fill target must be an input or textarea.');
      // Native setter so frameworks with controlled inputs (React, Vue) see the change.
      setter.call(element, step.value ?? '');
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (step.type === 'submit') {
      const form = element.closest('form');
      if (!form) throw new Error('Submit target must be inside a form.');
      form.requestSubmit();
    } else {
      (element as HTMLElement).click();
    }
  }
}

/** Runs in the target page. One function is used for both spinner timing and final evidence. */
export function snapshotPage(options: SnapshotOptions = {}): PageSnapshot {
  const SPINNER_SELECTOR = '[role="progressbar"],[aria-busy="true"],.spinner,.loader,.loading';
  const area =
    (options.rootSelector && document.querySelector(options.rootSelector)) ||
    document.querySelector('main') ||
    document.body;
  const fields: Record<string, string | null> = {};
  for (const selector of options.fields ?? []) {
    const element = document.querySelector(selector);
    fields[selector] = element && 'value' in element ? String((element as HTMLInputElement).value) : null;
  }
  const visible = (element: Element) =>
    element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
  const spinner = [...area.querySelectorAll(SPINNER_SELECTOR)].some(visible);
  const text = (area as HTMLElement).innerText ?? '';
  const formLost = Object.entries(options.expected ?? {}).some(
    ([selector, value]) => !!value && fields[selector] === '',
  );
  return {
    text: text.slice(0, 2048),
    spinner,
    fields,
    formLost,
    fingerprint: `${text.length}:${area.querySelectorAll('*').length}`,
  };
}
