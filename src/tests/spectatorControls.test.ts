import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SpectatorControls } from '../ui/SpectatorControls';
import { useMatchStore } from '../game/state/matchStore';
import { useSpectatorStore } from '../game/state/spectatorStore';

describe('SpectatorControls accessibility and ARIA features', () => {
  beforeEach(() => {
    useSpectatorStore.getState().reset();
    useMatchStore.setState((state) => ({
      model: {
        ...state.model,
        matchMode: 'battle_royale',
        player: {
          ...state.model.player,
          state: 'defeated',
        },
        resolved: false,
      },
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it('renders spectator controls landmark with correct aria-label when spectating', () => {
    render(React.createElement(SpectatorControls));
    const aside = screen.getByRole('complementary', { name: 'Spectator controls' });
    expect(aside).toBeTruthy();
    expect(aside.getAttribute('data-testid')).toBe('spectator-controls');
  });

  it('provides descriptive aria-labels for camera mode and cycle buttons', () => {
    render(React.createElement(SpectatorControls));
    expect(screen.getByRole('button', { name: 'Switch camera to FIRST PERSON' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Switch camera to 3RD PERSON' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Switch camera to FREESTYLE CAMERA' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Spectate next wrestler' })).toBeTruthy();
  });

  it('announces spectated wrestler and camera mode in aria-live region', () => {
    render(React.createElement(SpectatorControls));
    const liveRegion = screen.getByText(/Spectating .*, 3RD PERSON mode/);
    expect(liveRegion).toBeTruthy();
    expect(liveRegion.getAttribute('aria-live')).toBe('polite');

    const firstPersonBtn = screen.getByRole('button', { name: 'Switch camera to FIRST PERSON' });
    fireEvent.click(firstPersonBtn);

    expect(screen.getByText(/Spectating .*, FIRST PERSON mode/)).toBeTruthy();
  });
});
