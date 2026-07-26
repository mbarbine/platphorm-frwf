import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { App } from '../app/App';

// Mock other stores & state to isolate select screen
vi.mock('../game/audio/audioEngine', () => ({
  audioEngine: {
    configure: vi.fn(),
    unlock: vi.fn(),
    play: vi.fn(),
  },
}));

vi.mock('../ui/FighterPreview', () => ({
  FighterPreview: () => React.createElement('div', { 'data-testid': 'mock-fighter-preview' }),
}));

vi.mock('../game/multiplayer/MultiplayerStore', () => {
  const mockStore = vi.fn((selector) => {
    const state = {
      status: 'disconnected',
      roomPhase: 'idle',
      roomId: '',
      myRole: 'player1',
      roles: new Map(),
      fighters: new Map(),
    };
    return selector ? selector(state) : state;
  });
  return {
    useMultiplayerStore: Object.assign(mockStore, {
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
  };
});

describe('Fighter Select Keyboard Arrow Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows wrap-around arrow key navigation to switch selected fighters', async () => {
    render(React.createElement(App));

    // 1. Click "ENTER THE VOLT DOME" to go to the main menu
    const enterBtn = screen.getByText('ENTER THE VOLT DOME');
    fireEvent.click(enterBtn);

    // 2. Click "PLAY" to go to select screen
    const playBtn = screen.getByText('PLAY');
    fireEvent.click(playBtn);

    // 3. Find the roster buttons
    const rosterDiv = screen.getByRole('list');
    expect(rosterDiv).toBeTruthy();

    // Default selected should be Atlas Rex (atlas)
    const atlasCard = rosterDiv.querySelector('[data-fighter-select-id="atlas"]') as HTMLButtonElement;
    expect(atlasCard).toBeTruthy();
    expect(atlasCard.getAttribute('aria-pressed')).toBe('true');

    // Focus on the first roster card to simulate keyboard user focus
    atlasCard.focus();
    expect(document.activeElement).toBe(atlasCard);

    // Press ArrowDown or ArrowRight to select Vex Volt (vex)
    fireEvent.keyDown(rosterDiv, { key: 'ArrowDown' });

    // Verify Vex Volt is now active
    const vexCard = rosterDiv.querySelector('[data-fighter-select-id="vex"]') as HTMLButtonElement;
    expect(vexCard).toBeTruthy();
    expect(vexCard.getAttribute('aria-pressed')).toBe('true');
    expect(atlasCard.getAttribute('aria-pressed')).toBe('false');

    // Focus should have been programmatically transferred to vexCard
    // Wait for the setTimeout focus transfer
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.activeElement).toBe(vexCard);

    // Press ArrowUp or ArrowLeft to wrap around to Atlas Rex (atlas)
    fireEvent.keyDown(rosterDiv, { key: 'ArrowLeft' });

    const updatedAtlasCard = rosterDiv.querySelector('[data-fighter-select-id="atlas"]') as HTMLButtonElement;
    expect(updatedAtlasCard.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.activeElement).toBe(updatedAtlasCard);

    // Press ArrowUp to wrap around to the end of the roster (Chad Kinsey)
    fireEvent.keyDown(rosterDiv, { key: 'ArrowUp' });

    const chadCard = rosterDiv.querySelector('[data-fighter-select-id="chad"]') as HTMLButtonElement;
    expect(chadCard.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.activeElement).toBe(chadCard);

    // Check that aria-live polite contains the announcement for the new selection
    const liveAnnouncer = screen.getByText(/Selected CHAD “THE CLAW” KINSEY/i);
    expect(liveAnnouncer).toBeTruthy();
    expect(liveAnnouncer.getAttribute('aria-live')).toBe('polite');
  });
});
