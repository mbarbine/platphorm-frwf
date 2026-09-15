import { describe, expect, it, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SettingsPanel } from '../ui/SettingsPanel';

describe('SettingsPanel Accessibility', () => {
  afterEach(() => {
    cleanup();
  });

  it('announces double-confirmation prompt and reset completion to screen readers via aria-live', () => {
    const onBack = vi.fn();
    render(React.createElement(SettingsPanel, { onBack }));

    const resetButton = screen.getByRole('button', { name: /Reset all saved settings to defaults/i });
    expect(resetButton).toBeTruthy();

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toBeTruthy();
    expect(liveRegion.getAttribute('aria-live')).toBe('polite');
    expect(liveRegion.textContent).toBe('');

    // First click: triggers double-confirmation requirement
    fireEvent.click(resetButton);
    expect(liveRegion.textContent).toBe('Settings reset confirmation required: press again to confirm reset of all settings to defaults.');

    // Second click: confirms reset
    const confirmButton = screen.getByRole('button', { name: /Confirm reset of all settings to defaults/i });
    fireEvent.click(confirmButton);
    expect(liveRegion.textContent).toBe('All saved settings have been reset to defaults.');
  });
});
