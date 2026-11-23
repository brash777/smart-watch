/**
 * Copies a text. The Clipboard API only exists on secure origins (HTTPS or localhost); on a
 * phone that opens the dev server through the local network, a hidden text area and the
 * copy command do the same job.
 */
export async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && 'clipboard' in navigator) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Denied: fall through to the older way.
    }
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.className = 'fixed top-0 left-0 opacity-0';
  document.body.append(area);
  area.select();
  try {
    // execCommand is deprecated, but it is the only copy available on insecure origins.
    return document.execCommand('copy');
  } finally {
    area.remove();
  }
}
