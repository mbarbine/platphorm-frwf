import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { Tutorial } from '../ui/Tutorial';

describe('Tutorial Component', () => {
  const KEY = 'ringfall-tutorial-complete-v2';

  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.localStorage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      clear: vi.fn(),
      removeItem: vi.fn(),
      length: 0,
      key: vi.fn(),
    };
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('renders tutorial when localStorage key is not set', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    expect(screen.queryByText('CORE CONTROLS')).not.toBeNull();
  });

  it('does not render tutorial when localStorage key is set to true', () => {
    globalThis.localStorage.getItem = vi.fn().mockReturnValue('true');
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });

  it('does not render on touch devices', () => {
    render(React.createElement(Tutorial, { device: 'touch' }));
    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });

  it('closes tutorial when clicking the close button', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    const closeButton = screen.getByLabelText('Close tutorial');

    fireEvent.click(closeButton);

    expect(globalThis.localStorage.setItem).toHaveBeenCalledWith(KEY, 'true');
    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });

  it('automatically closes tutorial after 13 seconds when not interacted with', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    expect(screen.queryByText('CORE CONTROLS')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(13000);
    });

    expect(globalThis.localStorage.setItem).toHaveBeenCalledWith(KEY, 'true');
    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });

  it('pauses timer on hover and resumes when mouse leaves', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    const heading = screen.queryByText('CORE CONTROLS');
    expect(heading).not.toBeNull();
    const tutorialElement = heading ? heading.closest('aside') : null;
    expect(tutorialElement).not.toBeNull();

    // Hover to pause
    if (tutorialElement) {
      fireEvent.mouseEnter(tutorialElement);
    }

    act(() => {
      vi.advanceTimersByTime(15000); // More than 13 seconds
    });

    // Tutorial should still be visible because hover paused the timer
    expect(screen.queryByText('CORE CONTROLS')).not.toBeNull();
    expect(globalThis.localStorage.setItem).not.toHaveBeenCalledWith(KEY, 'true');

    // Mouse leave to resume
    if (tutorialElement) {
      fireEvent.mouseLeave(tutorialElement);
    }

    act(() => {
      vi.advanceTimersByTime(13000); // 13 more seconds to trigger auto close
    });

    expect(globalThis.localStorage.setItem).toHaveBeenCalledWith(KEY, 'true');
    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });

  it('pauses timer on focus and resumes on blur', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    const heading = screen.queryByText('CORE CONTROLS');
    expect(heading).not.toBeNull();
    const tutorialElement = heading ? heading.closest('aside') : null;
    expect(tutorialElement).not.toBeNull();

    // Focus to pause
    if (tutorialElement) {
      fireEvent.focus(tutorialElement);
    }

    act(() => {
      vi.advanceTimersByTime(15000); // More than 13 seconds
    });

    // Tutorial should still be visible because focus paused the timer
    expect(screen.queryByText('CORE CONTROLS')).not.toBeNull();
    expect(globalThis.localStorage.setItem).not.toHaveBeenCalledWith(KEY, 'true');

    // Blur to resume
    if (tutorialElement) {
      fireEvent.blur(tutorialElement);
    }

    act(() => {
      vi.advanceTimersByTime(13000); // 13 more seconds to trigger auto close
    });

    expect(globalThis.localStorage.setItem).toHaveBeenCalledWith(KEY, 'true');
    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });
});
