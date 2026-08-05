import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { Tutorial } from '../ui/Tutorial';

describe('Tutorial Component', () => {
  const KEY = 'ringfall-tutorial-complete-v2';

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    cleanup();
  });

  it('renders correctly when not completed and on keyboard/gamepad device', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));

    const heading = screen.queryByText('CORE CONTROLS');
    expect(heading).not.toBeNull();
  });

  it('does not render when already completed', () => {
    localStorage.setItem(KEY, 'true');
    render(React.createElement(Tutorial, { device: 'keyboard' }));

    const heading = screen.queryByText('CORE CONTROLS');
    expect(heading).toBeNull();
  });

  it('does not render when device is touch', () => {
    render(React.createElement(Tutorial, { device: 'touch' }));

    const heading = screen.queryByText('CORE CONTROLS');
    expect(heading).toBeNull();
  });

  it('closes when clicking the close button and persists completion', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));

    const closeButton = screen.getByRole('button', { name: 'Close tutorial' });
    fireEvent.click(closeButton);

    const heading = screen.queryByText('CORE CONTROLS');
    expect(heading).toBeNull();
    expect(localStorage.getItem(KEY)).toBe('true');
  });

  it('automatically closes after 13 seconds if not paused', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));

    expect(screen.queryByText('CORE CONTROLS')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(12999);
    });
    expect(screen.queryByText('CORE CONTROLS')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
    expect(localStorage.getItem(KEY)).toBe('true');
  });

  it('pauses the timer on mouse hover and resumes on mouse leave', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));

    const container = screen.getByLabelText('Tutorial');

    // Hover to pause
    fireEvent.mouseEnter(container);

    // Timer shouldn't trigger even after 13+ seconds
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(screen.queryByText('CORE CONTROLS')).not.toBeNull();

    // Mouse leave to resume
    fireEvent.mouseLeave(container);

    // Should not close immediately because timer was reset/re-created
    act(() => {
      vi.advanceTimersByTime(12999);
    });
    expect(screen.queryByText('CORE CONTROLS')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });

  it('pauses the timer on focus and resumes on blur', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));

    const container = screen.getByLabelText('Tutorial');

    // Focus to pause
    fireEvent.focus(container);

    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(screen.queryByText('CORE CONTROLS')).not.toBeNull();

    // Blur to resume
    fireEvent.blur(container, { relatedTarget: null });

    act(() => {
      vi.advanceTimersByTime(13000);
    });
    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });

  it('does not unpause when blur event relatedTarget is still inside the tutorial', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));

    const container = screen.getByLabelText('Tutorial');
    const closeButton = screen.getByRole('button', { name: 'Close tutorial' });

    // Focus the container (pauses)
    fireEvent.focus(container);

    // Blur from container to closeButton (both are inside container)
    fireEvent.blur(container, { relatedTarget: closeButton });

    // Timer should remain paused because focus is still inside the tutorial
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(screen.queryByText('CORE CONTROLS')).not.toBeNull();
  });
});
