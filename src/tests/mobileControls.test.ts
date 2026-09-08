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
