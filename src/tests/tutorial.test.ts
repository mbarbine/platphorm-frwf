import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { Tutorial } from '../ui/Tutorial';

describe('Tutorial component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    localStorage.clear();
  });

  it('renders correctly when not completed', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    expect(screen.getByText('CORE CONTROLS')).toBeTruthy();
    expect(screen.getByText('MOVE')).toBeTruthy();
  });

  it('does not render when completed in localStorage', () => {
    localStorage.setItem('ringfall-tutorial-complete-v2', 'true');
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });

  it('does not render for touch devices', () => {
    render(React.createElement(Tutorial, { device: 'touch' }));
    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });

  it('automatically closes after 13 seconds', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    expect(screen.getByText('CORE CONTROLS')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(13000);
    });

    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
    expect(localStorage.getItem('ringfall-tutorial-complete-v2')).toBe('true');
  });

  it('pauses timer on hover/focus and resumes on leave/blur', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    const container = screen.getByTestId('tutorial-aside');

    // Hover (mouseEnter)
    act(() => {
      fireEvent.mouseEnter(container);
    });

    // Advance by 15 seconds, shouldn't close because it's paused
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(screen.getByText('CORE CONTROLS')).toBeTruthy();

    // Mouse Leave
    act(() => {
      fireEvent.mouseLeave(container);
    });

    // Advance 12 seconds, should still be visible
    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(screen.getByText('CORE CONTROLS')).toBeTruthy();

    // Advance 1 more second, making it 13 seconds since leave, should close
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });

  it('closes when close button is clicked', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    const closeBtn = screen.getByRole('button', { name: 'Close tutorial' });

    act(() => {
      fireEvent.click(closeBtn);
    });

    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
    expect(localStorage.getItem('ringfall-tutorial-complete-v2')).toBe('true');
  });
});
