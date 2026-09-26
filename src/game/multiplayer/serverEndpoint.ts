/** A deployed page must never try to host multiplayer on the player's device. */
export function resolveGameServer(configured: string | undefined, location?: { hostname: string; protocol: string }): string | null {
  const value = configured?.trim();
  if (!value) return location && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
    ? `ws://${location.hostname}:2567` : null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null;
    if (location?.protocol === 'https:' && !['https:', 'wss:'].includes(url.protocol)) return null;
    if (location && !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return null;
    return url.toString().replace(/\/$/, '');
  } catch { return null; }
}

export const gameServerEndpoint = resolveGameServer(import.meta.env.VITE_GAME_SERVER_URL, typeof window === 'undefined' ? undefined : window.location);
