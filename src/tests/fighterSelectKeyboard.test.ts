import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../app/App';

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

vi.mock('../game/state/physicsLabStore', () => ({
  usePhysicsLabStore: vi.fn((selector) => {
    const state = { rate: 1, debug: false };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('../game/runtime/runtimeModes', () => ({
  physicsLabEnabled: () => false,
}));

vi.mock('../game/multiplayer/MultiplayerStore', () => ({
  useMultiplayerStore: Object.assign(vi.fn(() => ({})), {
    getState: vi.fn(() => ({ sessionId: 'test', fighters: new Map(), sendAction: vi.fn() })),
  }),
}));

vi.mock('../game/input/useGameInput', () => ({
  useGameInput: () => ({ device: 'keyboard' }),
}));

vi.mock('../game/audio/audioEngine', () => ({
  audioEngine: {
    configure: vi.fn(),
    unlock: vi.fn(),
    play: vi.fn(),
    loadBank: vi.fn(),
    startMusic: vi.fn(),
    stopMusic: vi.fn(),
    playEffect: vi.fn(),
  },
}));

vi.mock('../game/state/settings', () => ({
  useSettings: Object.assign(vi.fn((selector) => {
    const state = {
      automaticPerformanceFallback: false,
      setAutomaticPerformanceFallback: vi.fn(),
      graphicsQuality: 'performance',
      reducedMotion: false,
      highContrast: false,
      lowFlash: false,
      uiScale: 1.0,
    };
    return selector ? selector(state) : state;
  }), { getState: vi.fn(() => ({ highContrast: false, lowFlash: false, uiScale: 1.0 })) }),
}));

vi.mock('../game/physics/physicsRuntime', () => ({
  bodyWorksRuntime: {
    setJointData: vi.fn(),
    metrics: { bodyCount: 100, fixedSteps: 0, emergencyResetCount: 0 },
    beforeFixedStep: vi.fn(),
    afterFixedStep: vi.fn(),
    consumeContacts: vi.fn(() => []),
    fighterSnapshot: vi.fn(() => ({ speed: 0 })),
    intentSnapshot: vi.fn(() => ({})),
    rejectPendingActions: vi.fn(),
  }
}));

describe('App Fighter Select Keyboard Navigation', () => {
  it('navigates with arrow keys on the roster', async () => {
    render(React.createElement(App));

    // Move past init screen
    const enterButton = await screen.findByText('ENTER THE VOLT DOME');
    fireEvent.click(enterButton);

    // On main menu, click play to go to select
    const playButton = await screen.findByText('PLAY');
    fireEvent.click(playButton);

    // Verify select screen is active by looking for heading
    expect(screen.getByText('FIGHTER SELECT')).toBeTruthy();

    // Roster should be present
    const roster = screen.getByRole('list');
    expect(roster).toBeTruthy();

    // The default selection is atlas
    const activeCard = document.querySelector('[data-fighter-select-id="atlas"]') as HTMLButtonElement;
    expect(activeCard).toBeTruthy();
    expect(activeCard.className).toContain('roster-card--active');

    // Focus active card and press ArrowDown
    fireEvent.keyDown(roster, { key: 'ArrowDown' });

    // The next card (vex) should now be active
    const nextCard = document.querySelector('[data-fighter-select-id="vex"]') as HTMLButtonElement;
    expect(nextCard).toBeTruthy();
    expect(nextCard.className).toContain('roster-card--active');

    // Press ArrowUp to navigate back
    fireEvent.keyDown(roster, { key: 'ArrowUp' });
    expect(activeCard.className).toContain('roster-card--active');
  });
});
