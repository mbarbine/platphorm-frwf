import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SpectatorControls } from '../ui/SpectatorControls';
import { useMatchStore } from '../game/state/matchStore';
import { useSpectatorStore } from '../game/state/spectatorStore';
import { createMatch, resolveMatch } from '../game/systems/combat';

describe('SpectatorControls accessibility and interactions', () => {
  beforeEach(() => {
    useSpectatorStore.getState().reset();
    useMatchStore.setState({
      model: createMatch('atlas', 'nova', 'standard', 'normal', 101, 0, 0, 'battle_royale'),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('does not render when player is not defeated', () => {
    const { container } = render(React.createElement(SpectatorControls));
    expect(container.firstChild).toBeNull();
  });

  it('renders spectator controls with accessible ARIA labels when player is defeated in Battle Royale', () => {
    const store = useMatchStore.getState();
    resolveMatch(store.model, 'opponent', 'PINFALL', 'player');

    render(React.createElement(SpectatorControls));

    expect(screen.getByTestId('spectator-controls')).toBeTruthy();

    const fpBtn = screen.getByLabelText('Switch to FIRST PERSON camera (Press 1)');
    const tpBtn = screen.getByLabelText('Switch to 3RD PERSON camera (Press 2)');
    const freeBtn = screen.getByLabelText('Switch to FREESTYLE CAMERA camera (Press 3)');
    const nextBtn = screen.getByLabelText('Spectate next wrestler (Press Tab)');

    expect(fpBtn).toBeTruthy();
    expect(tpBtn).toBeTruthy();
    expect(freeBtn).toBeTruthy();
    expect(nextBtn).toBeTruthy();

    expect(tpBtn.getAttribute('aria-pressed')).toBe('true');
    expect(fpBtn.getAttribute('aria-pressed')).toBe('false');

    const liveRegion = screen.getByText(/Spectating wrestler:/);
    expect(liveRegion).toBeTruthy();
    expect(liveRegion.textContent).toContain('Spectating wrestler: NOVA FANG, third person camera');
  });

  it('updates camera mode and aria-live announcement when mode button is clicked', () => {
    const store = useMatchStore.getState();
    resolveMatch(store.model, 'opponent', 'PINFALL', 'player');

    render(React.createElement(SpectatorControls));

    const fpBtn = screen.getByLabelText('Switch to FIRST PERSON camera (Press 1)');
    fireEvent.click(fpBtn);

    expect(useSpectatorStore.getState().cameraMode).toBe('first_person');
    expect(fpBtn.getAttribute('aria-pressed')).toBe('true');

    const liveRegion = screen.getByText(/Spectating wrestler:/);
    expect(liveRegion.textContent).toContain('Spectating wrestler: NOVA FANG, first person camera');
  });

  it('handles keyboard shortcuts for camera switching and target cycling', () => {
    const store = useMatchStore.getState();
    resolveMatch(store.model, 'opponent', 'PINFALL', 'player');

    render(React.createElement(SpectatorControls));

    fireEvent.keyDown(window, { key: '1' });
    expect(useSpectatorStore.getState().cameraMode).toBe('first_person');

    fireEvent.keyDown(window, { key: '3' });
    expect(useSpectatorStore.getState().cameraMode).toBe('free');

    fireEvent.keyDown(window, { key: 'Tab' });
    expect(useSpectatorStore.getState().target).toBe('rival1');
  });
});
