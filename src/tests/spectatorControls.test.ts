import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { SpectatorControls } from '../ui/SpectatorControls';
import { useMatchStore } from '../game/state/matchStore';
import { useSpectatorStore } from '../game/state/spectatorStore';
import { createMatch } from '../game/systems/combat';

describe('SpectatorControls component accessibility and announcements', () => {
  beforeEach(() => {
    useSpectatorStore.getState().reset();
    const model = createMatch('atlas', 'nova', 'standard', 'normal', 101, 0, 0, 'battle_royale');
    model.player.state = 'defeated';
    useMatchStore.setState({ model });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders explicit ARIA labels for camera mode buttons and Next Wrestler button', () => {
    render(React.createElement(SpectatorControls));

    const fpButton = screen.getByRole('button', { name: /Switch to first person camera/i });
    expect(fpButton).toBeTruthy();
    expect(fpButton.getAttribute('aria-label')).toBe('Switch to first person camera (Shortcut: 1)');

    const tpButton = screen.getByRole('button', { name: /Switch to 3rd person camera/i });
    expect(tpButton).toBeTruthy();
    expect(tpButton.getAttribute('aria-label')).toBe('Switch to 3rd person camera (Shortcut: 2)');

    const freeButton = screen.getByRole('button', { name: /Switch to freestyle camera camera/i });
    expect(freeButton).toBeTruthy();

    const nextButton = screen.getByRole('button', { name: /Spectate next wrestler/i });
    expect(nextButton).toBeTruthy();
    expect(nextButton.getAttribute('aria-label')).toBe('Spectate next wrestler (Shortcut: Tab)');
  });

  it('announces current spectated wrestler and camera mode via aria-live polite region', () => {
    render(React.createElement(SpectatorControls));

    const liveRegion = screen.getByText(/Spectating wrestler:/i);
    expect(liveRegion).toBeTruthy();
    expect(liveRegion.getAttribute('aria-live')).toBe('polite');
    expect(liveRegion.textContent).toContain('Spectating wrestler:');
    expect(liveRegion.textContent).toContain('third person camera');
  });
});
