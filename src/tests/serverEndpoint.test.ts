import { describe, expect, it } from 'vitest';
import { resolveGameServer } from '../game/multiplayer/serverEndpoint';
const production = { hostname: 'frwf.platphormnews.com', protocol: 'https:' };
describe('multiplayer server addressing', () => {
  it('never sends a production player to their own device or an insecure socket', () => {
    for (const value of [undefined, '', 'ws://localhost:2567', 'wss://localhost:2567', 'ws://matches.platphormnews.com', 'not a URL']) {
      expect(resolveGameServer(value, production)).toBeNull();
    }
    expect(resolveGameServer('wss://matches.platphormnews.com', production)).toBe('wss://matches.platphormnews.com');
  });
  it('supports local development and rejects credentials in client configuration', () => {
    expect(resolveGameServer(undefined, { hostname: '127.0.0.1', protocol: 'http:' })).toBe('ws://127.0.0.1:2567');
    expect(resolveGameServer('wss://user:secret@matches.platphormnews.com', production)).toBeNull();
  });
});
