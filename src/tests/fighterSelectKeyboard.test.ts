import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../app/App';

// Mock all dynamic lazy modules to isolate the UI rendering and prevent background dynamic imports during teardown
vi.mock('../game/components/GameScene', () => ({
  default: () => null,
  GameScene: () => null,
}));

vi.mock('../ui/FighterPreview', () => ({
  default: () => null,
  FighterPreview: () => null,
}));

vi.mock('../ui/SettingsPanel', () => ({
  default: () => null,
  SettingsPanel: () => null,
}));

vi.mock('../game/components/PhysicsLab', () => ({
  default: () => null,
  PhysicsLab: () => null,
}));

vi.mock('../game/state/matchStore', () => ({
  useMatchStore: Object.assign(vi.fn((selector) => {
    const state = {
      model: {
        paused: false,
        toyTestMode: false,
        player: { moveId: null, position: { x: 0, z: 0 }, state: 'idle' },
        targets: { player: 'opponent' },
        opponent: { health: 100, state: 'idle' },
        matchMode: 'singles',
        resolved: false,
        falls: [],
        unstableWithoutCauseSeconds: 0,
      },
      replayActive: false,
    };
    return selector ? selector(state) : state;
  }), { getState: vi.fn(() => ({ model: { elapsed: 0, networkAuthority: false }, setPhysicsAuthority: vi.fn() })) }),
}));

vi.mock('../game/state/spectatorStore', () => ({
  useSpectatorStore: vi.fn(() => ({})),
  resolvedSpectatorTarget: vi.fn(() => 'player'),
}));

vi.mock('../game/state/settings', () => ({
  useSettings: vi.fn(() => ({
    uiScale: 1,
    highContrast: false,
    lowFlash: false,
    controlDeckMode: 'full',
  })),
}));

vi.mock('../game/audio/audioEngine', () => ({
  audioEngine: {
    configure: vi.fn(),
    unlock: vi.fn(),
    play: vi.fn(),
  },
}));

vi.mock('../game/multiplayer/MultiplayerStore', () => ({
  useMultiplayerStore: Object.assign(vi.fn(() => ({})), {
    getState: vi.fn(() => ({
      status: 'disconnected',
      roomPhase: 'idle',
      roomId: '',
      myRole: 'player1',
      roles: new Map(),
      fighters: new Map(),
      disconnect: vi.fn(),
    })),
  }),
}));

describe('Fighter Select Keyboard Arrow Navigation and ARIA Announcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates the roster list via Arrow keys and updates visually-hidden aria-live announcement', async () => {
    // 1. Render App
    const { container } = render(React.createElement(App));

    // 2. Click ENTER THE VOLT DOME to reach the main menu screen
    const enterButton = screen.getByRole('button', { name: /ENTER THE VOLT DOME/i });
    fireEvent.click(enterButton);

    // 3. Click PLAY to reach the Fighter Select screen
    const playButton = screen.getByRole('button', { name: /^PLAY$/ });
    fireEvent.click(playButton);

    // Verify we are on the FIGHTER SELECT screen
    const heading = screen.getByRole('heading', { name: /FIGHTER SELECT/i });
    expect(heading).toBeTruthy();

    // Verify Atlas Rex is selected by default using data-fighter-select-id attribute
    const atlasCard = container.querySelector('[data-fighter-select-id="atlas"]');
    expect(atlasCard).toBeTruthy();
    expect(atlasCard?.getAttribute('aria-pressed')).toBe('true');

    // ARIA Live announcement should represent Atlas Rex
    const announcement = screen.getByText(/Selected ATLAS REX/i);
    expect(announcement).toBeTruthy();

    // 4. Press ArrowDown key to select the next fighter
    fireEvent.keyDown(window, { key: 'ArrowDown' });

    // Roster index 1 should be VEX VOLT
    const vexCard = container.querySelector('[data-fighter-select-id="vex"]');
    expect(vexCard).toBeTruthy();
    expect(vexCard?.getAttribute('aria-pressed')).toBe('true');

    // ARIA Live announcement should be updated to Vex Volt
    expect(announcement.textContent).toContain('Selected VEX VOLT');

    // 5. Press ArrowUp key to go back to ATLAS REX
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(atlasCard?.getAttribute('aria-pressed')).toBe('true');
    expect(announcement.textContent).toContain('Selected ATLAS REX');
  });
});
