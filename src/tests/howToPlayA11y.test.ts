import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { App } from '../app/App';
import { audioEngine } from '../game/audio/audioEngine';

describe('How to Play screen Accessibility & Keyboard Navigation', () => {
  beforeEach(() => {
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders live region announcement and dismisses when Escape is pressed', () => {
    vi.spyOn(audioEngine, 'unlock').mockImplementation(() => {});
    vi.spyOn(audioEngine, 'play').mockImplementation(() => {});
    vi.spyOn(audioEngine, 'connectMusic').mockReturnValue({
      volume: vi.fn(),
      stop: vi.fn(),
      dispose: vi.fn(),
    } as unknown as ReturnType<typeof audioEngine.connectMusic>);

    render(React.createElement(App));

    // First enter the main menu screen by clicking "ENTER THE VOLT DOME"
    const enterButton = screen.getByRole('button', { name: /ENTER THE VOLT DOME/i });
    fireEvent.click(enterButton);

    // Open How to Play screen
    const howToPlayButton = screen.getByRole('button', { name: /HOW TO PLAY/i });
    fireEvent.click(howToPlayButton);

    // Verify aria-live announcement is present
    const announcement = screen.getByText(/How to Play guide displayed/i);
    expect(announcement).toBeTruthy();
    expect(announcement.getAttribute('aria-live')).toBe('polite');

    // Verify section landmark
    const guideSection = screen.getByRole('region', { name: /How to play guide/i });
    expect(guideSection).toBeTruthy();

    // Press Escape to navigate back to main menu
    fireEvent.keyDown(window, { key: 'Escape' });

    // Verify main menu button is back
    expect(screen.getByRole('button', { name: /HOW TO PLAY/i })).toBeTruthy();
  });
});
