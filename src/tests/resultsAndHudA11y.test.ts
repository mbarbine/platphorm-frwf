import { describe, expect, it, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { HUD } from '../ui/HUD';
import { useMatchStore } from '../game/state/matchStore';
import { useSettings } from '../game/state/settings';

describe('HUD and Results Accessibility', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders playing camera switch button with descriptive ARIA label containing current camera mode', () => {
    useSettings.setState({ playerCamera: 'broadcast' });
    useMatchStore.getState().configure('atlas', 'nova', 'standard', 'normal', 0, 0, 'singles');

    render(React.createElement(HUD, { device: 'keyboard', paused: false }));

    const cameraBtn = screen.getByRole('button', { name: /Change playing camera, currently BROADCAST/i });
    expect(cameraBtn).toBeTruthy();
  });
});
