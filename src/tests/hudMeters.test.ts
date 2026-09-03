import { describe, expect, it, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { HUD } from '../ui/HUD';
import { useMatchStore } from '../game/state/matchStore';

describe('HUD Meter progressbar accessibility', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders progressbar roles with ARIA labels and min/max/now values for fighter meters', () => {
    useMatchStore.getState().configure('atlas', 'nova', 'standard', 'normal', 0, 0, 'singles');

    render(React.createElement(HUD, { device: 'keyboard', paused: false }));

    const healthMeters = screen.getAllByRole('progressbar', { name: /HEALTH/i });
    expect(healthMeters.length).toBeGreaterThanOrEqual(2);

    const playerHealthMeter = healthMeters[0];
    if (playerHealthMeter) {
      expect(playerHealthMeter.getAttribute('aria-valuenow')).toBe('100');
      expect(playerHealthMeter.getAttribute('aria-valuemin')).toBe('0');
      expect(playerHealthMeter.getAttribute('aria-valuemax')).toBe('100');
    }

    const staminaMeters = screen.getAllByRole('progressbar', { name: /STAMINA/i });
    expect(staminaMeters.length).toBeGreaterThanOrEqual(2);

    const balanceMeters = screen.getAllByRole('progressbar', { name: /BALANCE/i });
    expect(balanceMeters.length).toBeGreaterThanOrEqual(2);

    const momentumMeters = screen.getAllByRole('progressbar', { name: /MOMENTUM/i });
    expect(momentumMeters.length).toBeGreaterThanOrEqual(2);
  });
});
