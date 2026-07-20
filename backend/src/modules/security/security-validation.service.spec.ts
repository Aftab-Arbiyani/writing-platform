import type { ConfigType } from '@nestjs/config';

import type { appConfig } from '../../config/app.config';
import { SecurityValidationService } from './security-validation.service';

function make(nodeEnv: string): SecurityValidationService {
  return new SecurityValidationService({ nodeEnv } as unknown as ConfigType<typeof appConfig>);
}

describe('SecurityValidationService', () => {
  const prod = make('production');
  const dev = make('development');

  describe('safeOutboundUrl (SSRF)', () => {
    it('accepts a public https host', () => {
      expect(prod.safeOutboundUrl('https://api.example.com/v1')).not.toBeNull();
    });
    it('rejects loopback, private, and metadata hosts', () => {
      expect(prod.safeOutboundUrl('https://localhost/x')).toBeNull();
      expect(prod.safeOutboundUrl('https://127.0.0.1/x')).toBeNull();
      expect(prod.safeOutboundUrl('https://10.0.0.5/x')).toBeNull();
      expect(prod.safeOutboundUrl('https://192.168.1.1/x')).toBeNull();
      expect(prod.safeOutboundUrl('https://169.254.169.254/latest')).toBeNull();
      expect(prod.safeOutboundUrl('https://foo.internal/x')).toBeNull();
    });
    it('rejects non-https in production but allows http in dev', () => {
      expect(prod.safeOutboundUrl('http://api.example.com')).toBeNull();
      expect(dev.safeOutboundUrl('http://api.example.com')).not.toBeNull();
    });
    it('rejects credentials-in-url and malformed input', () => {
      expect(prod.safeOutboundUrl('https://user:pass@example.com')).toBeNull();
      expect(prod.safeOutboundUrl('not a url')).toBeNull();
    });
  });

  describe('safeReturnPath (open redirect)', () => {
    it('accepts a same-origin relative path', () => {
      expect(prod.safeReturnPath('/dashboard/settings')).toBe('/dashboard/settings');
      expect(prod.safeReturnPath('/my-page-1')).toBe('/my-page-1');
    });
    it('rejects absolute, protocol-relative, scheme, and backslash targets', () => {
      expect(prod.safeReturnPath('https://evil.com')).toBe('/');
      expect(prod.safeReturnPath('//evil.com')).toBe('/');
      expect(prod.safeReturnPath('/\\evil.com')).toBe('/');
      expect(prod.safeReturnPath('/javascript:alert(1)')).toBe('/');
      expect(prod.safeReturnPath('/a\tb')).toBe('/');
      expect(prod.safeReturnPath(undefined)).toBe('/');
    });
  });

  describe('isSafePathSegment', () => {
    it('accepts plain names, rejects traversal/separators', () => {
      expect(prod.isSafePathSegment('avatar_1.webp')).toBe(true);
      expect(prod.isSafePathSegment('..')).toBe(false);
      expect(prod.isSafePathSegment('a/b')).toBe(false);
      expect(prod.isSafePathSegment('.hidden')).toBe(false);
      expect(prod.isSafePathSegment('')).toBe(false);
    });
  });

  describe('neutralizeCsvCell', () => {
    it('prefixes formula-lead cells and leaves normal cells', () => {
      expect(prod.neutralizeCsvCell('=SUM(A1)')).toBe("'=SUM(A1)");
      expect(prod.neutralizeCsvCell('+1')).toBe("'+1");
      expect(prod.neutralizeCsvCell('@cmd')).toBe("'@cmd");
      expect(prod.neutralizeCsvCell('hello')).toBe('hello');
      expect(prod.neutralizeCsvCell('')).toBe('');
    });
  });

  describe('isAllowedHttpMethod', () => {
    it('recognizes standard methods', () => {
      expect(prod.isAllowedHttpMethod('post')).toBe(true);
      expect(prod.isAllowedHttpMethod('TRACE')).toBe(false);
    });
  });
});
