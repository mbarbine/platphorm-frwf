import { describe, expect, it, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SpectatorControls } from '../ui/SpectatorControls';
import { useMatchStore } from '../game/state/matchStore';
import { useSpectatorStore } from '../game/state/spectatorStore';

describe('SpectatorControls component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing when not spectating (singles match or not defeated)', () => {
    const { container } = render(React.createElement(SpectatorControls));
    expect(container.firstChild).toBeNull();
  });

  it('renders mode buttons with aria-label attributes and live region announcements when spectating', () => {
    // Configure match state to Battle Royale and player defeated
    useMatchStore.getState().configure('atlas', 'nova', 'standard', 'normal', 0, 0, 'battle_royale');
    useMatchStore.setState((state) => ({
      model: {
        ...state.model,
        player: {
          ...state.model.player,
          state: 'defeated',
        },
      },
    }));

    render(React.createElement(SpectatorControls));

    const fpBtn = screen.getByRole('button', { name: /FIRST PERSON mode \(Key 1\)/i });
    expect(fpBtn).toBeTruthy();

    const tpBtn = screen.getByRole('button', { name: /3RD PERSON mode \(Key 2\)/i });
    expect(tpBtn).toBeTruthy();

    const freeBtn = screen.getByRole('button', { name: /FREESTYLE CAMERA mode \(Key 3\)/i });
    expect(freeBtn).toBeTruthy();

    const nextBtn = screen.getByRole('button', { name: /Spectate next wrestler \(Tab key\)/i });
    expect(nextBtn).toBeTruthy();

    // Verify aria-live region content prefix
    const liveRegion = screen.getByText(/Spectating wrestler:/i);
    expect(liveRegion).toBeTruthy();
    expect(liveRegion.textContent).toContain('Spectating wrestler:');
  });

  it('updates camera mode when mode button is clicked', () => {
    useMatchStore.getState().configure('atlas', 'nova', 'standard', 'normal', 0, 0, 'battle_royale');
    useMatchStore.setState((state) => ({
      model: {
        ...state.model,
        player: {
          ...state.model.player,
          state: 'defeated',
        },
      },
    }));

    render(React.createElement(SpectatorControls));

    const fpBtn = screen.getByRole('button', { name: /FIRST PERSON mode \(Key 1\)/i });
    fireEvent.click(fpBtn);

    expect(useSpectatorStore.getState().cameraMode).toBe('first_person');

    const liveRegion = screen.getByText(/Spectating wrestler:/i);
    expect(liveRegion.textContent).toContain('first person camera');
  });
});
