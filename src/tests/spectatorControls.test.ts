import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { SpectatorControls } from '../ui/SpectatorControls';
import { useMatchStore } from '../game/state/matchStore';
import { useSpectatorStore } from '../game/state/spectatorStore';
import { createMatch } from '../game/systems/combat';

describe('SpectatorControls accessibility and screen-reader announcements', () => {
  beforeEach(() => {
    useSpectatorStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders spectator controls with ARIA labels and live region when player is eliminated in battle royale', () => {
    const match = createMatch('atlas', 'nova', 'standard', 'normal', 101, 0, 0, 'battle_royale');
    match.player.state = 'defeated';
    useMatchStore.setState({ model: match });

    render(React.createElement(SpectatorControls));

    const aside = screen.getByLabelText('Spectator camera controls');
    expect(aside).toBeTruthy();

    const firstPersonBtn = screen.getByLabelText('FIRST PERSON mode (Shortcut: 1)');
    expect(firstPersonBtn).toBeTruthy();

    const nextWrestlerBtn = screen.getByLabelText('Spectate next wrestler (Shortcut: Tab)');
    expect(nextWrestlerBtn).toBeTruthy();

    expect(screen.getByText(/Spectating wrestler: NOVA FANG, third person camera/i)).toBeTruthy();

    // Click FIRST PERSON mode button
    fireEvent.click(firstPersonBtn);
    expect(screen.getByText(/Spectating wrestler: NOVA FANG, first person camera/i)).toBeTruthy();

    // Click NEXT WRESTLER button
    act(() => {
      fireEvent.click(nextWrestlerBtn);
    });
    expect(screen.getByText(/Spectating wrestler: VEX VOLT, first person camera/i)).toBeTruthy();
  });

  it('handles keyboard shortcuts 1, 2, 3, and Tab', () => {
    const match = createMatch('atlas', 'nova', 'standard', 'normal', 101, 0, 0, 'battle_royale');
    match.player.state = 'defeated';
    useMatchStore.setState({ model: match });

    render(React.createElement(SpectatorControls));

    // Shortcut 1 for first_person
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    });
    expect(useSpectatorStore.getState().cameraMode).toBe('first_person');

    // Shortcut 3 for free
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }));
    });
    expect(useSpectatorStore.getState().cameraMode).toBe('free');

    // Tab key for next wrestler
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    });
    expect(useSpectatorStore.getState().target).toBe('rival1');
  });
});
