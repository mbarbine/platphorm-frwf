import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import { Tutorial } from '../ui/Tutorial';

describe('Tutorial timing and interaction support', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('is initially visible and auto-closes after 13 seconds', () => {
    const { queryByText } = render(React.createElement(Tutorial, { device: 'keyboard' }));
    expect(queryByText('CORE CONTROLS')).not.toBeNull();

    // Fast-forward 13 seconds
    act(() => {
      vi.advanceTimersByTime(13000);
    });

    expect(queryByText('CORE CONTROLS')).toBeNull();
  });

  it('pauses the closing timer when mouse enters and resumes when mouse leaves', () => {
    const { container, queryByText } = render(React.createElement(Tutorial, { device: 'keyboard' }));
    const aside = container.querySelector('aside');
    expect(aside).not.toBeNull();
    if (!aside) return;

    // Advance 5 seconds, still visible
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(queryByText('CORE CONTROLS')).not.toBeNull();

    // Hover mouse
    act(() => {
      fireEvent.mouseEnter(aside);
    });

    // Advance 10 more seconds (total elapsed would be 15s if unpaused)
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(queryByText('CORE CONTROLS')).not.toBeNull();

    // Mouse leave - resumes timer. Remaining time should be 8000ms.
    act(() => {
      fireEvent.mouseLeave(aside);
    });

    // Advance 7.9 seconds - should still be there
    act(() => {
      vi.advanceTimersByTime(7900);
    });
    expect(queryByText('CORE CONTROLS')).not.toBeNull();

    // Advance 0.2 seconds - should close
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(queryByText('CORE CONTROLS')).toBeNull();
  });

  it('pauses when focused and resumes when blurred', () => {
    const { container, queryByText } = render(React.createElement(Tutorial, { device: 'keyboard' }));
    const aside = container.querySelector('aside');
    expect(aside).not.toBeNull();
    if (!aside) return;

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Focus aside
    act(() => {
      fireEvent.focus(aside);
    });

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(queryByText('CORE CONTROLS')).not.toBeNull();

    // Blur aside
    act(() => {
      fireEvent.blur(aside);
    });

    act(() => {
      vi.advanceTimersByTime(8100);
    });
    expect(queryByText('CORE CONTROLS')).toBeNull();
  });
});
