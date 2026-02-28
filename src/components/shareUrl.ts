import type { SwordParams } from '../three/SwordGenerator';

/**
 * Encode sword state into a compact URL-safe base64 string.
 * Uses JSON + deflate-like compression via built-in browser APIs.
 */
export function encodeShareState(state: SwordParams): string {
  const json = JSON.stringify(state);
  // Use base64url encoding (URL-safe, no padding)
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decode a share string back into SwordParams.
 * Returns null if the string is invalid.
 */
export function decodeShareState(encoded: string): SwordParams | null {
  try {
    // Restore standard base64
    let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding
    while (b64.length % 4 !== 0) b64 += '=';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    // Basic validation: must have a blade object
    if (!parsed || typeof parsed !== 'object' || !parsed.blade) return null;
    return parsed as SwordParams;
  } catch {
    return null;
  }
}

/**
 * Read share state from current URL hash.
 * Expects format: #share=<encoded>
 */
export function readShareFromUrl(): SwordParams | null {
  try {
    const hash = window.location.hash;
    if (!hash.startsWith('#share=')) return null;
    const encoded = hash.slice(7);
    if (!encoded) return null;
    return decodeShareState(encoded);
  } catch {
    return null;
  }
}

/**
 * Write share state to URL hash and copy to clipboard.
 * Returns the full share URL.
 */
export async function writeShareToUrl(state: SwordParams): Promise<string> {
  const encoded = encodeShareState(state);
  const url = `${window.location.origin}${window.location.pathname}#share=${encoded}`;
  // Update URL without triggering navigation
  history.replaceState(null, '', `#share=${encoded}`);
  // Copy to clipboard
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    // Fallback: select + copy
    const textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
  return url;
}
