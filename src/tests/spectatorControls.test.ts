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

  it('renders mode buttons with aria-label attributes, title tooltips, and live region announcements when spectating', () => {
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

    const fpBtn = screen.getByRole('button', { name: /First person: first person mode \(Key 1\)/i });
    expect(fpBtn).toBeTruthy();
    expect(fpBtn.getAttribute('title')).toBe('Switch to first person mode (Key 1)');

    const tpBtn = screen.getByRole('button', { name: /3rd person: 3rd person mode \(Key 2\)/i });
    expect(tpBtn).toBeTruthy();
    expect(tpBtn.getAttribute('title')).toBe('Switch to 3rd person mode (Key 2)');

    const freeBtn = screen.getByRole('button', { name: /Freestyle camera: freestyle camera mode \(Key 3\)/i });
    expect(freeBtn).toBeTruthy();
    expect(freeBtn.getAttribute('title')).toBe('Switch to freestyle camera mode (Key 3)');

    const nextBtn = screen.getByRole('button', { name: /NEXT WRESTLER: spectate next active wrestler \(Tab key\)/i });
    expect(nextBtn).toBeTruthy();
    expect(nextBtn.getAttribute('title')).toBe('Spectate next active wrestler (Tab key)');

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

    const fpBtn = screen.getByRole('button', { name: /First person: first person mode \(Key 1\)/i });
    fireEvent.click(fpBtn);

    expect(useSpectatorStore.getState().cameraMode).toBe('first_person');

    const liveRegion = screen.getByText(/Spectating wrestler:/i);
    expect(liveRegion.textContent).toContain('first person camera');
  });
});
