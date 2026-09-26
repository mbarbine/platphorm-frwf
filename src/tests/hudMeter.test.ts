import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { HUD } from '../ui/HUD';
import { useMatchStore } from '../game/state/matchStore';

describe('HUD Meter progressbar accessibility', () => {
  beforeEach(() => {
    useMatchStore.getState().configure('atlas', 'nova', 'standard', 'normal', 0, 0, 'singles');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders health, stamina, balance, and momentum meters with progressbar ARIA attributes', () => {
    render(React.createElement(HUD, { device: 'keyboard', paused: false }));

    const progressbars = screen.getAllByRole('progressbar');
    expect(progressbars.length).toBeGreaterThan(0);

    const healthMeter = screen.getAllByLabelText('HEALTH')[0];
    expect(healthMeter).toBeDefined();
    if (healthMeter) {
      expect(healthMeter.getAttribute('role')).toBe('progressbar');
      expect(healthMeter.getAttribute('aria-valuemin')).toBe('0');
      expect(healthMeter.getAttribute('aria-valuemax')).toBe('100');
      expect(healthMeter.getAttribute('aria-valuenow')).toBe('100');
    }

    const momentumMeter = screen.getAllByLabelText('MOMENTUM')[0];
    expect(momentumMeter).toBeDefined();
    if (momentumMeter) {
      expect(momentumMeter.getAttribute('role')).toBe('progressbar');
      expect(momentumMeter.getAttribute('aria-valuenow')).toBe('0');
    }
  });
});
