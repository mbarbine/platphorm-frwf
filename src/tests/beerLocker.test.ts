import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BeerLocker } from '../app/App';

describe('BeerLocker Accessibility', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders interactive buttons with dynamic aria-label attributes reflecting beer count', () => {
    render(React.createElement(BeerLocker, {
      fighterId: 'atlas',
      beers: 2,
      onChange: () => {},
    }));

    const putBackBtn = screen.getByRole('button', { name: /put one beer back/i });
    const drinkBtn = screen.getByRole('button', { name: /drink a beer/i });

    expect(putBackBtn.getAttribute('aria-label')).toBe('Put one beer back (currently 2 of 5 drunk)');
    expect(drinkBtn.getAttribute('aria-label')).toBe('Drink a beer (currently 2 of 5 drunk)');
  });
});
