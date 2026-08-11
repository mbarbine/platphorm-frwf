import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { App } from '../app/App';

// Silence console.error from lazy loaded errors or unhandled mock issues
vi.spyOn(console, 'error').mockImplementation(() => {});

vi.mock('../game/audio/audioEngine', () => ({
  audioEngine: {
    configure: vi.fn(),
    play: vi.fn(),
    unlock: vi.fn(),
  }
}));

vi.mock('../ui/FighterPreview', () => ({
  FighterPreview: () => React.createElement('div', { 'data-testid': 'fighter-preview' })
}));

vi.mock('../ui/SettingsPanel', () => ({
  SettingsPanel: () => React.createElement('div', { 'data-testid': 'settings-panel' })
}));

vi.mock('../game/components/PhysicsLab', () => ({
  PhysicsLab: () => React.createElement('div', { 'data-testid': 'physics-lab' })
}));

vi.mock('../game/components/GameScene', () => ({
  GameScene: () => React.createElement('div', { 'data-testid': 'game-scene' })
}));

describe('Fighter Select Keyboard and ARIA Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates to fighter select screen and tests wrap-around Arrow key select with ARIA alerts', async () => {
    render(React.createElement(App));

    // 1. Click "ENTER THE VOLT DOME" to reach Main Menu
    const enterBtn = screen.getByText('ENTER THE VOLT DOME');
    expect(enterBtn).toBeTruthy();
    fireEvent.click(enterBtn);

    // 2. Click "PLAY" to reach Fighter Select screen
    const playBtn = screen.getByText('PLAY');
    expect(playBtn).toBeTruthy();
    fireEvent.click(playBtn);

    // Verify select screen heading
    expect(screen.getByText('FIGHTER SELECT')).toBeTruthy();

    // The default selected fighter is "ATLAS REX" (atlas)
    const atlasCard = document.querySelector('[data-fighter-select-id="atlas"]') as HTMLButtonElement;
    expect(atlasCard).toBeTruthy();
    expect(atlasCard.getAttribute('aria-pressed')).toBe('true');

    // ARIA live region should contain ATLAS REX description
    const announcer = screen.getByText(/Selected fighter: ATLAS REX, Heavyweight Powerhouse/i);
    expect(announcer).toBeTruthy();

    // 3. Trigger ArrowDown (Should select "VEX VOLT")
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    });

    const vexCard = document.querySelector('[data-fighter-select-id="vex"]') as HTMLButtonElement;
    expect(vexCard).toBeTruthy();
    expect(vexCard.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/Selected fighter: VEX VOLT, Agile Striker/i)).toBeTruthy();

    // 4. Trigger ArrowUp (Should wrap back to "ATLAS REX")
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    });
    expect(atlasCard.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/Selected fighter: ATLAS REX, Heavyweight Powerhouse/i)).toBeTruthy();

    // 5. Trigger ArrowLeft (Should wrap to the last fighter "CHAD “THE CLAW” KINSEY")
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    });
    const chadCard = document.querySelector('[data-fighter-select-id="chad"]') as HTMLButtonElement;
    expect(chadCard).toBeTruthy();
    expect(chadCard.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/Selected fighter: CHAD “THE CLAW” KINSEY, Ringside Roughneck/i)).toBeTruthy();

    // 6. Trigger ArrowRight (Should wrap around to the first fighter "ATLAS REX")
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });
    expect(atlasCard.getAttribute('aria-pressed')).toBe('true');
  });
});
