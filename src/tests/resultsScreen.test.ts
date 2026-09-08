import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { Results } from '../app/App';

vi.mock('../game/audio/BackgroundMusic', () => ({ BackgroundMusic: () => null }));
vi.mock('../game/audio/audioEngine', () => ({
  audioEngine: {
    configure: vi.fn(),
    play: vi.fn(),
    unlock: vi.fn(),
  },
}));

describe('Match Results Screen Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders aria-live polite region with context-prefixed match decision announcement', () => {
    const mockResult = {
      winner: 'player' as const,
      method: 'PINFALL' as const,
      duration: 120,
      hype: 85,
      grade: 'S' as const,
      playerStats: {
        damageDealt: 150,
        counters: 2,
        grapples: 5,
        finishers: 1,
        nearFalls: 3,
        propImpacts: 0,
      },
      highlights: {
        bestSpot: null,
        bestSlam: null,
        mostBrutalImpact: null,
        mostUnexpectedReversal: null,
      },
    };

    render(
      React.createElement(Results, {
        result: mockResult,
        winnerName: 'ATLAS REX',
        onRematch: vi.fn(),
        onChange: vi.fn(),
        onMenu: vi.fn(),
      })
    );

    const announcer = screen.getByText('Match decision: ATLAS REX wins by PINFALL. Hype rating: S.');
    expect(announcer).toBeTruthy();
    expect(announcer.getAttribute('aria-live')).toBe('polite');
  });
});
