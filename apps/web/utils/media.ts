export function resolveMediaUrl(url: string | null | undefined, apiBase: string): string | null {
  if (!url) return null;
  return /^(https?:|blob:|data:)/.test(url) ? url : `${apiBase}${url}`;
}
