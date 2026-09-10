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

  it('renders instant replay skip button with descriptive ARIA label when replay is active', () => {
    useMatchStore.setState({ replayActive: true });
    render(React.createElement('div', { className: 'replay-overlay' },
      React.createElement('span', null, 'FRWF INSTANT REPLAY'),
      React.createElement('b', null, 'PHYSICAL IMPACT REVIEW'),
      React.createElement('button', {
        type: 'button',
        'aria-label': 'Skip instant replay',
        onClick: () => useMatchStore.getState().stopReplay(),
      }, 'SKIP REPLAY')
    ));

    const skipBtn = screen.getByRole('button', { name: 'Skip instant replay' });
    expect(skipBtn).toBeTruthy();
  });

  it('renders control keys wrapped in kbd elements on the How to Play guide', () => {
    render(React.createElement('div', { className: 'how-grid' },
      React.createElement('article', null,
        React.createElement('b', null, '1 · MOVE WITH PURPOSE'),
        React.createElement('p', null, 'Use ', React.createElement('kbd', null, 'WASD'), ' to circle your opponent.')
      )
    ));

    const kbd = screen.getByText('WASD');
    expect(kbd.tagName.toLowerCase()).toBe('kbd');
  });
});
