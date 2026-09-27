import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ArchiveBackdrop, ArenaLoading } from '../ui/ArchiveBackdrop';
import { useSettings } from '../game/state/settings';
import archive from '../../public/video/manifest.json';

describe('ArchiveBackdrop & ArenaLoading components', () => {
  let originalConnection: unknown;

  beforeEach(() => {
    vi.restoreAllMocks();
    useSettings.setState({ reducedMotion: false });
    window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => Promise.resolve());
    window.HTMLMediaElement.prototype.pause = vi.fn().mockImplementation(() => {});
    originalConnection = (navigator as unknown as Record<string, unknown>).connection;
  });

  afterEach(() => {
    cleanup();
    if (originalConnection === undefined) {
      delete (navigator as unknown as Record<string, unknown>).connection;
    } else {
      Object.defineProperty(navigator, 'connection', {
        value: originalConnection,
        configurable: true,
        writable: true,
      });
    }
  });

  it('renders active video backdrop with poster, initial clip src, and caption', () => {
    render(React.createElement(ArchiveBackdrop, { active: true }));

    const container = screen.getByTestId('archive-backdrop');
    expect(container).toBeTruthy();

    const video = container.querySelector('video');
    expect(video).toBeTruthy();
    expect(video?.getAttribute('poster')).toBe(archive.poster);
    expect(video?.getAttribute('src')).toBe(archive.clips[0].src);
    expect(video?.getAttribute('aria-hidden')).toBe('true');

    expect(screen.getByText('FRWF ORIGINALS · REAL RINGSIDE FOOTAGE')).toBeTruthy();

    const toggleBtn = screen.getByRole('button', { name: 'Pause background footage' });
    expect(toggleBtn.textContent).toBe('PAUSE FOOTAGE');
  });

  it('toggles pause and play states when button is clicked', () => {
    render(React.createElement(ArchiveBackdrop));

    const toggleBtn = screen.getByRole('button', { name: 'Pause background footage' });
    expect(toggleBtn.textContent).toBe('PAUSE FOOTAGE');

    fireEvent.click(toggleBtn);

    const playBtn = screen.getByRole('button', { name: 'Play background footage' });
    expect(playBtn.textContent).toBe('PLAY FOOTAGE');

    fireEvent.click(playBtn);
    expect(screen.getByRole('button', { name: 'Pause background footage' }).textContent).toBe('PAUSE FOOTAGE');
  });

  it('suppresses video src and toggle button when active is false', () => {
    render(React.createElement(ArchiveBackdrop, { active: false }));

    const container = screen.getByTestId('archive-backdrop');
    const video = container.querySelector('video');
    expect(video?.getAttribute('src')).toBeNull();

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('suppresses video src and toggle button when reducedMotion setting is active', () => {
    useSettings.setState({ reducedMotion: true });

    render(React.createElement(ArchiveBackdrop, { active: true }));

    const container = screen.getByTestId('archive-backdrop');
    const video = container.querySelector('video');
    expect(video?.getAttribute('src')).toBeNull();

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('suppresses video src when saveData is enabled on network connection', () => {
    Object.defineProperty(navigator, 'connection', {
      value: { saveData: true },
      configurable: true,
      writable: true,
    });

    render(React.createElement(ArchiveBackdrop, { active: true }));

    const container = screen.getByTestId('archive-backdrop');
    const video = container.querySelector('video');
    expect(video?.getAttribute('src')).toBeNull();
  });

  it('handles onError event by marking video failed and hiding toggle button', () => {
    render(React.createElement(ArchiveBackdrop));

    const container = screen.getByTestId('archive-backdrop');
    const video = container.querySelector('video')!;
    expect(video).toBeTruthy();

    expect(screen.getByRole('button', { name: 'Pause background footage' })).toBeTruthy();

    fireEvent.error(video);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('advances clip index on video onEnded event', () => {
    render(React.createElement(ArchiveBackdrop));

    const container = screen.getByTestId('archive-backdrop');
    const video = container.querySelector('video')!;
    expect(video.getAttribute('src')).toBe(archive.clips[0].src);

    fireEvent.ended(video);

    const nextClipSrc = archive.clips[1 % archive.clips.length].src;
    expect(video.getAttribute('src')).toBe(nextClipSrc);
  });

  it('pauses video playback when visibilitychange fires while document is hidden', () => {
    const pauseSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'pause');

    render(React.createElement(ArchiveBackdrop));

    Object.defineProperty(document, 'hidden', {
      value: true,
      configurable: true,
    });

    fireEvent(document, new Event('visibilitychange'));

    expect(pauseSpy).toHaveBeenCalled();

    Object.defineProperty(document, 'hidden', {
      value: false,
      configurable: true,
    });
  });

  it('renders ArenaLoading status copy with ArchiveBackdrop backdrop', () => {
    render(React.createElement(ArenaLoading));

    const statusRegion = screen.getByRole('status');
    expect(statusRegion).toBeTruthy();
    expect(statusRegion.textContent).toContain('THE FRWF ARENA IS POWERING UP');
    expect(statusRegion.textContent).toContain('Getting the ring ready…');

    expect(screen.getByTestId('archive-backdrop')).toBeTruthy();
  });
});
