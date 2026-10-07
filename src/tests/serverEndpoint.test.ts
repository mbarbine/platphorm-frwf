import { describe, it, expect } from 'vitest';
import { resolveGameServer, parseServerEndpoint } from '../game/multiplayer/serverEndpoint';

describe('resolveGameServer', () => {
  describe('when no configured URL is provided', () => {
    it('should return a default local ws:// URL if location is localhost', () => {
      expect(resolveGameServer(undefined, { hostname: 'localhost', protocol: 'http:' })).toBe('ws://localhost:2567');
      expect(resolveGameServer('', { hostname: '127.0.0.1', protocol: 'http:' })).toBe('ws://127.0.0.1:2567');
      expect(resolveGameServer('   ', { hostname: '[::1]', protocol: 'http:' })).toBe('ws://[::1]:2567');
    });

    it('should return null if location is not local', () => {
      expect(resolveGameServer(undefined, { hostname: 'example.com', protocol: 'https:' })).toBeNull();
    });

    it('should return null if location is not provided', () => {
      expect(resolveGameServer(undefined)).toBeNull();
    });
  });

  describe('when configured URL is provided', () => {
    it('should parse and return valid HTTP/WS URLs', () => {
      expect(resolveGameServer('http://example.com')).toBe('http://example.com');
      expect(resolveGameServer('https://api.example.com:8080')).toBe('https://api.example.com:8080');
      expect(resolveGameServer('ws://game.local')).toBe('ws://game.local');
      expect(resolveGameServer('wss://secure.game.local')).toBe('wss://secure.game.local');
    });

    it('should trim whitespace from configured URL', () => {
      expect(resolveGameServer('  http://example.com  ')).toBe('http://example.com');
    });

    it('should remove trailing slash from configured URL', () => {
      expect(resolveGameServer('http://example.com/')).toBe('http://example.com');
      expect(resolveGameServer('https://example.com:8443/')).toBe('https://example.com:8443');
    });

    it('should return null for invalid protocols', () => {
      expect(resolveGameServer('ftp://example.com')).toBeNull();
      expect(resolveGameServer('file:///path/to/file')).toBeNull();
      expect(resolveGameServer('mailto:user@example.com')).toBeNull();
    });

    it('should return null if URL contains credentials', () => {
      expect(resolveGameServer('http://user@example.com')).toBeNull();
      expect(resolveGameServer('http://user:pass@example.com')).toBeNull();
    });

    it('should return null if URL contains search parameters or hash', () => {
      expect(resolveGameServer('http://example.com?query=1')).toBeNull();
      expect(resolveGameServer('http://example.com#section')).toBeNull();
    });

    it('should return null for completely invalid URL strings', () => {
      expect(resolveGameServer('not-a-url')).toBeNull();
      expect(resolveGameServer('http://')).toBeNull();
    });
  });

  describe('mixed environment protections (HTTPS location)', () => {
    const secureLocation = { hostname: 'example.com', protocol: 'https:' };
    const insecureLocation = { hostname: 'example.com', protocol: 'http:' };

    it('should reject insecure configured URLs when location is HTTPS', () => {
      expect(resolveGameServer('http://game.example.com', secureLocation)).toBeNull();
      expect(resolveGameServer('ws://game.example.com', secureLocation)).toBeNull();
    });

    it('should allow secure configured URLs when location is HTTPS', () => {
      expect(resolveGameServer('https://game.example.com', secureLocation)).toBe('https://game.example.com');
      expect(resolveGameServer('wss://game.example.com', secureLocation)).toBe('wss://game.example.com');
    });

    it('should allow insecure configured URLs when location is HTTP', () => {
      expect(resolveGameServer('http://game.example.com', insecureLocation)).toBe('http://game.example.com');
      expect(resolveGameServer('ws://game.example.com', insecureLocation)).toBe('ws://game.example.com');
    });
  });

  describe('localhost leak protection (Remote location pointing to localhost)', () => {
    const remoteLocation = { hostname: 'example.com', protocol: 'https:' };
    const localLocation = { hostname: 'localhost', protocol: 'http:' };

    it('should return null if remote location tries to connect to local configured URL', () => {
      expect(resolveGameServer('http://localhost', remoteLocation)).toBeNull();
      expect(resolveGameServer('ws://127.0.0.1:2567', remoteLocation)).toBeNull();
      expect(resolveGameServer('https://[::1]', remoteLocation)).toBeNull();
    });

    it('should allow local configured URL if location is also local', () => {
      expect(resolveGameServer('http://localhost:8080', localLocation)).toBe('http://localhost:8080');
      expect(resolveGameServer('ws://127.0.0.1:2567', localLocation)).toBe('ws://127.0.0.1:2567');
    });
  });
});

describe('parseServerEndpoint', () => {
  it('should return the hostname of a valid URL', () => {
    expect(parseServerEndpoint('http://example.com')).toBe('example.com');
    expect(parseServerEndpoint('ws://game.example.com:8080/path')).toBe('game.example.com');
  });

  it('should return "localhost" when an empty string is provided', () => {
    expect(parseServerEndpoint('')).toBe('localhost');
  });

  it('should return "localhost" when undefined is provided', () => {
    expect(parseServerEndpoint(undefined)).toBe('localhost');
  });

  it('should return "localhost" when an invalid URL string is provided', () => {
    expect(parseServerEndpoint('not a valid url')).toBe('localhost');
    expect(parseServerEndpoint('just-a-string')).toBe('localhost');
  });
});
