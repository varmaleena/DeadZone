/** Small DOM helpers. All user and model text is set with textContent, never innerHTML. */

export function $(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element;
}

export function setText(id: string, text: string) {
  $(id).textContent = text;
}

type Props = Record<string, string | number | boolean | undefined>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    if (key === 'className') element.className = String(value);
    else if (key === 'style') element.setAttribute('style', String(value));
    else if (key === 'ariaLabel') element.setAttribute('aria-label', String(value));
    else if (key in element) (element as unknown as Record<string, unknown>)[key] = value;
    else element.setAttribute(key, String(value));
  }
  for (const child of children) {
    if (child === '') continue;
    element.append(child);
  }
  return element;
}
