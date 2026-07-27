import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { App } from '../app/App';

// Silence console.error from error boundary
vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock stores and state
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
      configure: vi.fn(),
      rematch: vi.fn(),
    };
    return selector ? selector(state) : state;
  }), { getState: vi.fn(() => ({ model: { elapsed: 0, networkAuthority: false }, setPhysicsAuthority: vi.fn() })) }),
}));

vi.mock('../game/state/settings', () => ({
  useSettings: Object.assign(vi.fn((selector) => {
    const state = {
      masterVolume: 0.72,
      effectsVolume: 0.86,
      crowdVolume: 0.5,
      shake: 0.5,
      uiScale: 1.0,
      graphicsQuality: 'auto',
      controlDeckMode: 'full',
      grappleGuide: 'full',
      cameraCuts: 'full',
      reducedMotion: false,
      lowFlash: false,
      highContrast: false,
      update: vi.fn(),
      reset: vi.fn(),
    };
    return selector ? selector(state) : state;
  }), { getState: vi.fn(() => ({ masterVolume: 0.72 })) }),
}));

vi.mock('../game/audio/audioEngine', () => ({
  audioEngine: {
    configure: vi.fn(),
    play: vi.fn(),
    unlock: vi.fn(),
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

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => React.createElement('div', { 'data-testid': 'mock-canvas' }, children),
  useFrame: vi.fn(),
  useThree: () => ({ camera: {}, gl: { xr: { isPresenting: false, getCamera: vi.fn() } } }),
}));

vi.mock('@react-three/drei', () => ({
  AdaptiveDpr: () => null,
  BakeShadows: () => null,
  OrbitControls: () => null,
}));

vi.mock('@react-three/rapier', () => ({
  Physics: ({ children }: { children: React.ReactNode }) => React.createElement('div', { 'data-testid': 'mock-physics' }, children),
}));

vi.mock('../game/components/FighterModel', () => ({
  FighterModel: () => null,
}));

vi.mock('../game/components/GameScene', () => ({
  GameScene: () => null,
}));

describe('Fighter Select Keyboard Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows keyboard arrow key navigation through roster cards with wrap-around and updates screen reader live announcer', async () => {
    const { container } = render(React.createElement(App));

    // 1. Click "ENTER THE VOLT DOME" to get past init screen
    const enterBtn = screen.getByRole('button', { name: /ENTER THE VOLT DOME/i });
    fireEvent.click(enterBtn);

    // 2. Click exact "PLAY" button to get past menu screen
    const playBtn = screen.getByRole('button', { name: /^PLAY$/i });
    fireEvent.click(playBtn);

    // 3. Confirm we are on the Fighter Select screen
    expect(screen.getByRole('heading', { name: /FIGHTER SELECT/i })).toBeTruthy();

    // Find roster buttons via data-fighter-select-id
    const atlasCard = container.querySelector('[data-fighter-select-id="atlas"]') as HTMLButtonElement;
    expect(atlasCard).toBeTruthy();
    expect(atlasCard.getAttribute('aria-pressed')).toBe('true');

    // Focus the current roster card
    atlasCard.focus();
    expect(document.activeElement).toBe(atlasCard);

    // 4. Press ArrowDown to select VEX VOLT
    fireEvent.keyDown(atlasCard, { key: 'ArrowDown' });

    // Confirm that VEX VOLT card is now active/pressed
    const vexCard = container.querySelector('[data-fighter-select-id="vex"]') as HTMLButtonElement;
    expect(vexCard).toBeTruthy();
    expect(vexCard.getAttribute('aria-pressed')).toBe('true');

    // Confirm that focus was programmatically transferred to Vex's card
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(document.activeElement).toBe(vexCard);

    // Check that the aria-live announcer was updated
    const liveRegion = screen.getByText(/Selected VEX VOLT/i);
    expect(liveRegion).toBeTruthy();

    // 5. Press ArrowRight to select NOVA FANG
    fireEvent.keyDown(vexCard, { key: 'ArrowRight' });
    const novaCard = container.querySelector('[data-fighter-select-id="nova"]') as HTMLButtonElement;
    expect(novaCard).toBeTruthy();
    expect(novaCard.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(document.activeElement).toBe(novaCard);

    // 6. Press ArrowUp to select VEX VOLT again
    fireEvent.keyDown(novaCard, { key: 'ArrowUp' });
    expect(vexCard.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(document.activeElement).toBe(vexCard);

    // 7. Navigate left and wrap around from ATLAS REX to the last fighter (CHAD "THE CLAW" KINSEY)
    fireEvent.keyDown(vexCard, { key: 'ArrowLeft' }); // back to Atlas
    expect(atlasCard.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(document.activeElement).toBe(atlasCard);

    fireEvent.keyDown(atlasCard, { key: 'ArrowLeft' }); // wraps to Chad
    const chadCard = container.querySelector('[data-fighter-select-id="chad"]') as HTMLButtonElement;
    expect(chadCard).toBeTruthy();
    expect(chadCard.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(document.activeElement).toBe(chadCard);
  });
});
