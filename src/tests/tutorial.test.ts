import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { Tutorial } from '../ui/Tutorial';

describe('Tutorial component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders tutorial when localStorage key is not set and device is keyboard', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    expect(screen.getByText('CORE CONTROLS')).toBeTruthy();
    expect(screen.getByText('MOVE')).toBeTruthy();
  });

  it('does not render when device is touch', () => {
    const { container } = render(React.createElement(Tutorial, { device: 'touch' }));
    expect(container.firstChild).toBeNull();
  });

  it('closes when close button is clicked and sets localStorage', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    const closeButton = screen.getByLabelText('Close tutorial');

    act(() => {
      fireEvent.click(closeButton);
    });

    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
    expect(globalThis.localStorage.getItem('ringfall-tutorial-complete-v2')).toBe('true');
  });

  it('closes automatically after 13 seconds', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    expect(screen.getByText('CORE CONTROLS')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(13000);
    });

    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });

  it('pauses timer on mouse enter and resumes on mouse leave', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    expect(screen.getByText('CORE CONTROLS')).toBeTruthy();

    const tutorialAside = screen.getByText('CORE CONTROLS').closest('aside');
    expect(tutorialAside).not.toBeNull();
    if (!tutorialAside) return;

    // Hover mouse enter
    act(() => {
      fireEvent.mouseEnter(tutorialAside);
    });

    // Advance 13 seconds, should still be visible because it is paused
    act(() => {
      vi.advanceTimersByTime(13000);
    });
    expect(screen.getByText('CORE CONTROLS')).toBeTruthy();

    // Hover mouse leave
    act(() => {
      fireEvent.mouseLeave(tutorialAside);
    });

    // Now advance 13 seconds, should close
    act(() => {
      vi.advanceTimersByTime(13000);
    });
    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });

  it('pauses timer on focus and resumes on blur', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    expect(screen.getByText('CORE CONTROLS')).toBeTruthy();

    const tutorialAside = screen.getByText('CORE CONTROLS').closest('aside');
    expect(tutorialAside).not.toBeNull();
    if (!tutorialAside) return;

    // Focus
    act(() => {
      fireEvent.focus(tutorialAside);
    });

    // Advance 13 seconds, should still be visible
    act(() => {
      vi.advanceTimersByTime(13000);
    });
    expect(screen.getByText('CORE CONTROLS')).toBeTruthy();

    // Blur
    act(() => {
      fireEvent.blur(tutorialAside);
    });

    // Now advance 13 seconds, should close
    act(() => {
      vi.advanceTimersByTime(13000);
    });
    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });
});
