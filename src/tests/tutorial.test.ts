import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { Tutorial } from '../ui/Tutorial';

describe('Tutorial Component timed overlay with pause-on-hover/focus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.localStorage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      clear: vi.fn(),
      removeItem: vi.fn(),
      length: 0,
      key: vi.fn(),
    } as unknown as Storage;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('renders tutorial when localStorage key is not set to true', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    expect(screen.getByText('CORE CONTROLS')).toBeTruthy();
  });

  it('does not render tutorial when localStorage key is true', () => {
    vi.mocked(globalThis.localStorage.getItem).mockReturnValueOnce('true');
    const { container } = render(React.createElement(Tutorial, { device: 'keyboard' }));
    expect(container.firstChild).toBeNull();
  });

  it('does not render tutorial when device is touch', () => {
    const { container } = render(React.createElement(Tutorial, { device: 'touch' }));
    expect(container.firstChild).toBeNull();
  });

  it('closes tutorial when the close button is clicked', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    const closeBtn = screen.getByLabelText('Close tutorial');
    fireEvent.click(closeBtn);
    expect(globalThis.localStorage.setItem).toHaveBeenCalledWith('ringfall-tutorial-complete-v2', 'true');
    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });

  it('closes tutorial automatically after 13 seconds of unpaused time', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    expect(screen.getByText('CORE CONTROLS')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(13000);
    });

    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });

  it('pauses the auto-close timer on hover (mouseenter) and resumes on mouseleave', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    const tutorialAside = screen.getByText('CORE CONTROLS').closest('aside');
    expect(tutorialAside).toBeTruthy();

    if (!tutorialAside) {
      throw new Error('tutorialAside is null');
    }

    // Advance 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Hover (pause)
    act(() => {
      fireEvent.mouseEnter(tutorialAside);
    });
    expect(tutorialAside.getAttribute('data-paused')).toBe('true');

    // Advance another 15 seconds while paused - should NOT close
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(screen.getByText('CORE CONTROLS')).toBeTruthy();

    // Unhover (resume)
    act(() => {
      fireEvent.mouseLeave(tutorialAside);
    });
    expect(tutorialAside.getAttribute('data-paused')).toBe('false');

    // Advance remaining 10 seconds (13s - 3s = 10s) - should close now
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });

  it('pauses the auto-close timer on focus and resumes on blur', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    const tutorialAside = screen.getByText('CORE CONTROLS').closest('aside');
    expect(tutorialAside).toBeTruthy();

    if (!tutorialAside) {
      throw new Error('tutorialAside is null');
    }

    // Focus (pause)
    act(() => {
      fireEvent.focus(tutorialAside);
    });
    expect(tutorialAside.getAttribute('data-paused')).toBe('true');

    // Advance 20 seconds while focused - should NOT close
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(screen.getByText('CORE CONTROLS')).toBeTruthy();

    // Blur (resume)
    act(() => {
      fireEvent.blur(tutorialAside);
    });
    expect(tutorialAside.getAttribute('data-paused')).toBe('false');

    // Advance remaining 13 seconds - should close
    act(() => {
      vi.advanceTimersByTime(13000);
    });
    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });
});
