import { useSettings } from '../game/state/settings';
import { createMatch } from '../game/systems/combat';
import { getMove } from '../game/data/moves';
import { describe, expect, it, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MobileControls } from '../ui/MobileControls';
import { useMatchStore } from '../game/state/matchStore';

describe('MobileControls component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders action buttons with descriptive action-prefixed aria-label attributes', () => {
    useMatchStore.getState().configure('atlas', 'nova', 'standard', 'normal', 0, 0, 'singles');

    render(React.createElement(MobileControls, { onPause: () => {}, paused: false }));

    const quickBtn = screen.getByRole('button', { name: /^Quick strike:/i });
    expect(quickBtn).toBeTruthy();
    expect(quickBtn.getAttribute('aria-label')).toContain('Quick strike:');

    const powerBtn = screen.getByRole('button', { name: /^Power strike:/i });
    expect(powerBtn).toBeTruthy();
    expect(powerBtn.getAttribute('aria-label')).toContain('Power strike:');

    const grappleBtn = screen.getByRole('button', { name: /^Grapple:/i });
    expect(grappleBtn).toBeTruthy();
    expect(grappleBtn.getAttribute('aria-label')).toContain('Grapple:');

    const propBtn = screen.getByRole('button', { name: /^Prop action:/i });
    expect(propBtn).toBeTruthy();
    expect(propBtn.getAttribute('aria-label')).toContain('Prop action:');

    const actionBtn = screen.getByRole('button', { name: /^Action:/i });
    expect(actionBtn).toBeTruthy();
    expect(actionBtn.getAttribute('aria-label')).toContain('Action:');
  });
});


describe('mobile move labels follow real Arcade execution', () => {
  afterEach(() => cleanup());
  it('shows the Arcade suplex choice rather than the neutral technical piledriver', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'easy');
    model.player.state = 'grappling'; model.player.moveId = 'slam'; model.player.attackPhase = 'anticipation';
    useSettings.setState({ controlStyle: 'arcade' }); useMatchStore.setState({ model });
    render(React.createElement(MobileControls, { onPause: () => {}, paused: false }));
    expect(screen.getByRole('button', { name: /^Grapple:/i }).getAttribute('data-move-label')).toBe(getMove('suplex').displayName.toUpperCase());
  });
  it('only advertises release when a physical lift is actually established', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'easy');
    model.player.state = 'grappling'; model.player.moveId = 'slam'; model.player.attackPhase = 'anticipation';
    model.grapple = { attacker: 'player', defender: 'opponent', position: 'collarTie', leverage: 1, tension: 0, rotation: 0, lift: 1, struggle: 0, age: .5, gripCount: 2, phase: 'lift' };
    useMatchStore.setState({ model });
    render(React.createElement(MobileControls, { onPause: () => {}, paused: false }));
    expect(screen.getByRole('button', { name: /^Quick strike:/i }).getAttribute('data-move-label')).toBe('RELEASE THROW');
  });
});
