import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Tutorial } from '../ui/Tutorial';

describe('Tutorial accessibility & keyboard navigation', () => {
  beforeEach(() => {
    const values = new Map<string,string>();
    vi.stubGlobal('localStorage',{ getItem: (key:string) => values.get(key) ?? null, setItem: (key:string,value:string) => values.set(key,value), clear: () => values.clear() });
  });

  afterEach(() => {
    cleanup(); vi.unstubAllGlobals();
  });

  it('renders live region announcement when tutorial is displayed', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    const announcement = screen.getByText(/Core controls overlay displayed/i);
    expect(announcement).toBeTruthy();
    expect(announcement.getAttribute('aria-live')).toBe('polite');
  });

  it('dismisses tutorial overlay when Escape key is pressed', () => {
    const { container } = render(React.createElement(Tutorial, { device: 'keyboard' }));
    expect(container.firstChild).not.toBeNull();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(container.firstChild).toBeNull();
    expect(localStorage.getItem('ringfall-tutorial-complete-v2')).toBe('true');
  });
});
