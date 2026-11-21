/**
 * Source linking for cloud diagnosis: keeps application source files only (any folder layout),
 * never dependencies, build output, tests, or anything that looks like a secret.
 */

const SOURCE_EXTENSIONS = /\.(tsx?|jsx?|mjs|vue|svelte|kt)$/i;
const EXCLUDED_PATHS =
  /(^|\/)(node_modules|dist|dist-[^/]+|build|out|coverage|\.git|\.next|\.turbo|vendor)(\/|$)|\.(test|spec)\.[^/]+$|\.d\.ts$|(\.env|secret|credential|password|token|private[-_]?key)/i;
export const SOURCE_BUDGET_BYTES = 55000;

export function isLinkableSource(path: string): boolean {
  return SOURCE_EXTENSIONS.test(path) && !EXCLUDED_PATHS.test(path);
}

export async function linkSources(
  fileList: FileList | File[],
): Promise<{ files: Record<string, string>; summary: string }> {
  const candidates: { file: File; path: string; preferred: boolean }[] = [];
  for (const file of Array.from(fileList)) {
    const fullPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    // Relative to the selected folder, so a generated diff applies from that folder.
    const path = fullPath.split('/').slice(1).join('/') || file.name;
    if (isLinkableSource(path)) candidates.push({ file, path, preferred: /(^|\/)src\//.test(path) });
  }
  candidates.sort((a, b) => Number(b.preferred) - Number(a.preferred) || a.file.size - b.file.size);

  const files: Record<string, string> = {};
  const lines: string[] = [];
  const skipped: string[] = [];
  let total = 0;
  for (const { file, path } of candidates) {
    const text = await file.text();
    const bytes = new TextEncoder().encode(text).length;
    if (total + bytes > SOURCE_BUDGET_BYTES) {
      skipped.push(path);
      continue;
    }
    total += bytes;
    files[path] = text;
    lines.push(`${path}  (${(bytes / 1024).toFixed(1)} KB)`);
  }
  let summary = lines.length
    ? `${lines.join('\n')}\n\nTotal ${(total / 1024).toFixed(1)} KB of 60 KB`
    : 'No application source files found in that folder.';
  if (skipped.length) summary += `\nSkipped (over budget): ${skipped.join(', ')}`;
  return { files, summary };
}
