import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { Tutorial } from '../ui/Tutorial';

const KEY = 'ringfall-tutorial-complete-v2';

describe('Tutorial component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders the tutorial if not completed', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    expect(screen.getByText('CORE CONTROLS')).toBeTruthy();
  });

  it('does not render if device is touch', () => {
    render(React.createElement(Tutorial, { device: 'touch' }));
    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });

  it('does not render if already completed in localStorage', () => {
    localStorage.setItem(KEY, 'true');
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });

  it('closes automatically after 13 seconds of idle time', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    expect(screen.getByText('CORE CONTROLS')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(13000);
    });

    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
    expect(localStorage.getItem(KEY)).toBe('true');
  });

  it('pauses the timer when hovered and resumes when mouse leaves', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    const aside = screen.getByText('CORE CONTROLS').closest('aside');
    expect(aside).not.toBeNull();
    if (!aside) return;

    // Hover to pause
    fireEvent.mouseEnter(aside);

    act(() => {
      vi.advanceTimersByTime(15000);
    });

    // Should still be visible because it is paused
    expect(screen.getByText('CORE CONTROLS')).toBeTruthy();

    // Mouse leave to resume
    fireEvent.mouseLeave(aside);

    act(() => {
      vi.advanceTimersByTime(13000);
    });

    // Should now be closed
    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });

  it('pauses the timer when focused and resumes when blurred', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    const aside = screen.getByText('CORE CONTROLS').closest('aside');
    expect(aside).not.toBeNull();
    if (!aside) return;

    // Focus to pause
    fireEvent.focus(aside);

    act(() => {
      vi.advanceTimersByTime(15000);
    });

    // Should still be visible
    expect(screen.getByText('CORE CONTROLS')).toBeTruthy();

    // Blur to resume
    fireEvent.blur(aside);

    act(() => {
      vi.advanceTimersByTime(13000);
    });

    // Should now be closed
    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });

  it('closes when the close button is clicked', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    const closeBtn = screen.getByLabelText('Close tutorial');

    fireEvent.click(closeBtn);

    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
    expect(localStorage.getItem(KEY)).toBe('true');
  });
});
