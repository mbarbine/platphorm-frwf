import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { Tutorial } from '../ui/Tutorial';

describe('Tutorial Component', () => {
  let localStorageStore: Record<string, string> = {};

  beforeEach(() => {
    vi.useFakeTimers();
    localStorageStore = {};

    globalThis.localStorage = {
      getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageStore[key] = value;
      }),
      clear: vi.fn(() => {
        localStorageStore = {};
      }),
      removeItem: vi.fn((key: string) => {
        Reflect.deleteProperty(localStorageStore, key);
      }),
      length: 0,
      key: vi.fn().mockReturnValue(null),
    } as unknown as Storage;
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('renders when not complete and device is keyboard/gamepad', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    expect(screen.getByText('CORE CONTROLS')).toBeTruthy();
  });

  it('does not render when complete', () => {
    localStorageStore['ringfall-tutorial-complete-v2'] = 'true';
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });

  it('does not render when device is touch', () => {
    render(React.createElement(Tutorial, { device: 'touch' }));
    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
  });

  it('auto-dismisses after 13 seconds', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    expect(screen.queryByText('CORE CONTROLS')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(13000);
    });

    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
    expect(localStorageStore['ringfall-tutorial-complete-v2']).toBe('true');
  });

  it('pauses auto-dismiss timer on mouse enter and resumes on mouse leave', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    const container = screen.getByText('CORE CONTROLS').closest('aside');
    expect(container).toBeTruthy();

    if (container) {
      // Mouse Enter
      fireEvent.mouseEnter(container);

      act(() => {
        vi.advanceTimersByTime(15000);
      });

      // Still visible because it was paused
      expect(screen.queryByText('CORE CONTROLS')).toBeTruthy();

      // Mouse Leave
      fireEvent.mouseLeave(container);

      act(() => {
        vi.advanceTimersByTime(12000);
      });
      // Still visible before the new 13 seconds timeout completes
      expect(screen.queryByText('CORE CONTROLS')).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      // Now dismissed
      expect(screen.queryByText('CORE CONTROLS')).toBeNull();
    }
  });

  it('pauses auto-dismiss timer on focus and resumes on blur', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    const container = screen.getByText('CORE CONTROLS').closest('aside');
    expect(container).toBeTruthy();

    if (container) {
      // Focus
      fireEvent.focus(container);

      act(() => {
        vi.advanceTimersByTime(15000);
      });

      // Still visible because it was paused
      expect(screen.queryByText('CORE CONTROLS')).toBeTruthy();

      // Blur
      fireEvent.blur(container);

      act(() => {
        vi.advanceTimersByTime(13000);
      });
      // Now dismissed
      expect(screen.queryByText('CORE CONTROLS')).toBeNull();
    }
  });

  it('closes and saves completion when close button is clicked', () => {
    render(React.createElement(Tutorial, { device: 'keyboard' }));
    const closeBtn = screen.getByLabelText('Close tutorial');
    expect(closeBtn).toBeTruthy();

    fireEvent.click(closeBtn);

    expect(screen.queryByText('CORE CONTROLS')).toBeNull();
    expect(localStorageStore['ringfall-tutorial-complete-v2']).toBe('true');
  });
});
