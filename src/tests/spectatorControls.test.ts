import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { SpectatorControls } from '../ui/SpectatorControls';
import { useMatchStore } from '../game/state/matchStore';
import { useSpectatorStore } from '../game/state/spectatorStore';

describe('SpectatorControls accessibility and screen reader support', () => {
  beforeEach(() => {
    useSpectatorStore.setState({ cameraMode: 'first_person', target: 'rival1' });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders aria-label and aria-live announcements when spectating in battle royale', () => {
    useMatchStore.setState({
      model: {
        ...useMatchStore.getState().model,
        matchMode: 'battle_royale',
        player: { ...useMatchStore.getState().model.player, state: 'defeated' },
        resolved: false,
      },
    });

    render(React.createElement(SpectatorControls));

    const aside = screen.getByTestId('spectator-controls');
    expect(aside.getAttribute('aria-label')).toBe('Spectator camera controls');

    const firstPersonBtn = screen.getByLabelText('FIRST PERSON camera mode (Shortcut: 1)');
    expect(firstPersonBtn).toBeTruthy();

    const thirdPersonBtn = screen.getByLabelText('3RD PERSON camera mode (Shortcut: 2)');
    expect(thirdPersonBtn).toBeTruthy();

    const freeBtn = screen.getByLabelText('FREESTYLE CAMERA camera mode (Shortcut: 3)');
    expect(freeBtn).toBeTruthy();

    const nextBtn = screen.getByLabelText('Spectate next wrestler (Shortcut: Tab)');
    expect(nextBtn).toBeTruthy();

    expect(screen.getByText((content) => content.includes('Spectating wrestler:'))).toBeTruthy();
  });
});
