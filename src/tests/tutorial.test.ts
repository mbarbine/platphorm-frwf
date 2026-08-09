import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { Tutorial } from '../ui/Tutorial';

describe('Tutorial Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('renders the tutorial when localStorage has not completed it', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    expect(screen.getByText('CORE CONTROLS')).toBeTruthy();
  });

  it('does not render the tutorial when device is touch', () => {
    render(React.createElement(Tutorial, { device: 'touch' }));
    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });

  it('dismisses the tutorial after the 13-second timer', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    expect(screen.getByText('CORE CONTROLS')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(13000);
    });

    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
    expect(localStorage.getItem('ringfall-tutorial-complete-v2')).toBe('true');
  });

  it('pauses the timer on mouse enter and resumes on mouse leave', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    const aside = screen.getByText('CORE CONTROLS').closest('aside');
    expect(aside).toBeTruthy();

    if (aside) {
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      act(() => {
        fireEvent.mouseEnter(aside);
      });

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(screen.getByText('CORE CONTROLS')).toBeTruthy();

      act(() => {
        fireEvent.mouseLeave(aside);
      });

      act(() => {
        vi.advanceTimersByTime(7900);
      });
      expect(screen.getByText('CORE CONTROLS')).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(screen.queryByText('CORE CONTROLS')).toBeNull();
    }
  });

  it('pauses the timer on focus and resumes on blur', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    const aside = screen.getByText('CORE CONTROLS').closest('aside');
    expect(aside).toBeTruthy();

    if (aside) {
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      act(() => {
        fireEvent.focus(aside);
      });

      act(() => {
        vi.advanceTimersByTime(15000);
      });

      expect(screen.getByText('CORE CONTROLS')).toBeTruthy();

      act(() => {
        fireEvent.blur(aside);
      });

      act(() => {
        vi.advanceTimersByTime(9900);
      });
      expect(screen.getByText('CORE CONTROLS')).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(screen.queryByText('CORE CONTROLS')).toBeNull();
    }
  });

  it('allows manual closing of the tutorial via button click', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    const closeBtn = screen.getByLabelText('Close tutorial');
    expect(closeBtn).toBeTruthy();

    act(() => {
      fireEvent.click(closeBtn);
    });

    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
    expect(localStorage.getItem('ringfall-tutorial-complete-v2')).toBe('true');
  });
});
