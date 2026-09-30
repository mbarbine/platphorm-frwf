import { describe, expect, it, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { CopySeatButton } from '../app/App';

describe('CopySeatButton Accessibility & Micro-UX', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('updates visual text and announces copy completion to screen readers on click', async () => {
    vi.useFakeTimers();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const onError = vi.fn();
    render(React.createElement(CopySeatButton, { invite: 'https://frwf.ja1.io/#room=123.abc', index: 0, onError }));

    const button = screen.getByRole('button', { name: /^COPY SEAT 2 LINK/i });
    expect(button).toBeTruthy();
    expect(button.textContent).toBe('COPY SEAT 2 LINK');

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toBeTruthy();
    expect(liveRegion.textContent).toBe('');

    // Click button to copy
    await act(async () => {
      fireEvent.click(button);
    });

    expect(writeTextMock).toHaveBeenCalledWith('https://frwf.ja1.io/#room=123.abc');
    expect(button.textContent).toBe('SEAT 2 LINK COPIED!');
    expect(liveRegion.textContent).toBe('Copied seat 2 invitation link to clipboard.');

    // Verify Label in Name (WCAG 2.5.3): aria-label starts with exact visible text string
    const updatedButton = screen.getByRole('button', { name: /^SEAT 2 LINK COPIED!/i });
    expect(updatedButton).toBeTruthy();

    // Fast forward 2 seconds: self-reverts to initial state
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(button.textContent).toBe('COPY SEAT 2 LINK');
    expect(liveRegion.textContent).toBe('');
  });

  it('handles clipboard write failure gracefully', async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard error'));
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const onError = vi.fn();
    render(React.createElement(CopySeatButton, { invite: 'https://frwf.ja1.io/#room=123.abc', index: 1, onError }));

    const button = screen.getByRole('button', { name: /^COPY SEAT 3 LINK/i });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(onError).toHaveBeenCalledWith('Clipboard unavailable. Copy the invitation from the address bar after opening it.');
    expect(button.textContent).toBe('COPY SEAT 3 LINK');
  });
});
