import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { InstallGame } from '../ui/InstallGame';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('RINGFALL installable web app', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 Chrome/132.0.0.0 Safari/537.36' });
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: false });
  });
  afterEach(() => cleanup());

  it('ships complete install metadata and valid square PNG icons for browsers and iOS', () => {
    const manifest = JSON.parse(read('public/manifest.webmanifest')) as { id: string; scope: string; start_url: string; display: string; icons: { src: string; sizes: string; purpose: string }[] };
    expect(manifest).toMatchObject({ id: '/', scope: '/', start_url: '/?source=pwa', display: 'standalone' });
    expect(manifest.icons).toEqual(expect.arrayContaining([
      { src: '/icons/ringfall-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/ringfall-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/ringfall-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]));
    for (const icon of [...manifest.icons, { src: '/icons/ringfall-180.png', sizes: '180x180', purpose: 'any' }]) {
      const image = readFileSync(resolve(root, `public${icon.src}`));
      expect(image.subarray(0, 8), icon.src).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(image.readUInt32BE(16), icon.src).toBe(Number(icon.sizes.split('x')[0]));
      expect(image.readUInt32BE(20), icon.src).toBe(Number(icon.sizes.split('x')[1]));
    }
    const html = read('index.html');
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('apple-mobile-web-app-capable');
  });

  it('gives iPhone and iPad users clear Add to Home Screen steps when no prompt API exists', () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1' });
    render(React.createElement(InstallGame));
    const button = screen.getByRole('button', { name: /INSTALL \/ ADD TO HOME SCREEN/ });
    expect(button.getAttribute('aria-label')).toBe('INSTALL / ADD TO HOME SCREEN: view device installation instructions');
    fireEvent.click(button);
    expect(screen.getByText('Add RINGFALL to your Home Screen')).toBeTruthy();
    expect(screen.getAllByText(/tap Share, choose “Add to Home Screen”/).length).toBeGreaterThan(0);
    const liveRegion = screen.getByRole('status');
    expect(liveRegion.textContent).toContain('Installation instructions expanded: Add RINGFALL to your Home Screen');
  });

  it('uses the browser install prompt only after a user click and reports its result', async () => {
    render(React.createElement(InstallGame));
    const prompt = vi.fn(async () => {});
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
    });
    window.dispatchEvent(event);
    const button = await screen.findByRole('button', { name: /INSTALL RINGFALL/ });
    expect(button.getAttribute('aria-label')).toBe('INSTALL RINGFALL: install app to your device');
    expect(prompt).not.toHaveBeenCalled();
    fireEvent.click(button);
    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    expect((await screen.findByRole('status')).textContent).toContain('RINGFALL is installing.');
  });

  it('registers a same-origin offline shell while excluding APIs, multiplayer sockets, and cross-origin requests from caching', () => {
    const source = read('public/sw.js');
    const entry = read('src/main.tsx');
    expect(entry).toContain("navigator.serviceWorker.register('/sw.js', { scope: '/' })");
    expect(source).toContain("url.pathname.startsWith('/api/')");
    expect(source).toContain("url.pathname.includes('/socket')");
    expect(source).toContain('url.origin !== self.location.origin');
    expect(source).toContain("if (request.mode === 'navigate')");
    expect(source).toContain("'/offline.html'");
    expect(source).toContain("'/assets/'");
  });
});
