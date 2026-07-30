import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { appConfig } from '../../config/app.config';

/**
 * The reusable Security Validation Layer (P7.2). Centralizes the input-safety
 * checks that would otherwise be re-implemented (and mis-implemented) per call
 * site: SSRF-safe outbound URLs, open-redirect-safe return targets, path-
 * traversal-safe segments, CSV-formula-injection neutralization, and HTTP method
 * validation. Pure + synchronous — no I/O, trivially unit-testable, and safe to
 * call from anywhere. Security rules live HERE and nowhere else.
 */

/** Hostnames/CIDRs that outbound fetches must never reach (SSRF metadata/loopback). */
const BLOCKED_HOST_PATTERNS: readonly RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
  /^169\.254\./, // link-local (cloud metadata 169.254.169.254)
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /\.internal$/i,
  /\.local$/i,
];

export const SAFE_HTTP_METHODS = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
] as const;

/** True when a character is a control char or space (code point <= 0x20 or DEL). */
function isControlOrSpace(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return code <= 0x20 || code === 0x7f;
}

@Injectable()
export class SecurityValidationService {
  constructor(@Inject(appConfig.KEY) private readonly config: ConfigType<typeof appConfig>) {}

  /**
   * SSRF guard for outbound fetches. Returns the parsed URL only when it is
   * https (or http in dev), well-formed, and NOT pointing at a private/loopback/
   * metadata host. Callers fetching a user- or config-supplied URL must route it
   * through here first. Returns null on rejection so callers fail closed.
   */
  safeOutboundUrl(raw: string, opts: { allowHttp?: boolean } = {}): URL | null {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return null;
    }
    const allowHttp = opts.allowHttp ?? this.config.nodeEnv !== 'production';
    if (url.protocol !== 'https:' && !(allowHttp && url.protocol === 'http:')) {
      return null;
    }
    if (url.username !== '' || url.password !== '') {
      return null; // credentials in URL — reject
    }
    if (BLOCKED_HOST_PATTERNS.some((p) => p.test(url.hostname))) {
      return null;
    }
    return url;
  }

  /**
   * Open-redirect guard. A post-auth/return target is safe only when it is a
   * same-origin RELATIVE path (`/foo`) — never an absolute URL to another host,
   * never protocol-relative (`//evil.com`), never a `javascript:`/`data:` URI.
   * Returns the safe path, or the fallback when the input is unsafe.
   */
  safeReturnPath(raw: string | undefined | null, fallback = '/'): string {
    if (raw === undefined || raw === null || raw.length === 0) return fallback;
    // Must start with a single slash and not be protocol-relative or backslash-tricked.
    if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
      return fallback;
    }
    // Reject control chars / whitespace, and any scheme-looking payload
    // (`javascript:`, `data:`) appearing after the leading slash.
    if ([...raw].some(isControlOrSpace) || /^[a-z][a-z0-9+.-]*:/i.test(raw.slice(1))) {
      return fallback;
    }
    return raw;
  }

  /**
   * Path-traversal guard for any user-influenced path segment. True only when
   * the segment is a plain name (no separators, no `..`, no leading dot).
   * Storage keys are server-generated, so this is a belt-and-suspenders check
   * for any future filename-derived path.
   */
  isSafePathSegment(segment: string): boolean {
    if (segment.length === 0 || segment.length > 255) return false;
    if (segment.includes('/') || segment.includes('\\') || segment.includes(' ')) return false;
    if (segment === '.' || segment === '..' || segment.startsWith('.')) return false;
    return /^[A-Za-z0-9._-]+$/.test(segment);
  }

  /**
   * CSV-formula-injection neutralization. A cell beginning with `= + - @` (or a
   * tab/CR some spreadsheets treat as a formula lead) is prefixed with a single
   * quote so a spreadsheet renders it as text, never executes it.
   */
  neutralizeCsvCell(value: string): string {
    if (value.length === 0) return value;
    return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  }

  /** True when `method` is a recognized HTTP method (method-validation guard). */
  isAllowedHttpMethod(method: string): boolean {
    return (SAFE_HTTP_METHODS as readonly string[]).includes(method.toUpperCase());
  }
}
