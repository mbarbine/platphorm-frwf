import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LAWNMOWER_ACTIVITY, LawnmowerGame } from '../game/world/LawnmowerActivity';

afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('embedded mower loading lifecycle', () => {
  it('times out even while the FRWF world continually rerenders', () => {
    vi.useFakeTimers();
    const view = render(createElement(LawnmowerGame, { onClose: () => {} }));
    for (let i = 0; i < 30; i++) {
      act(() => { vi.advanceTimersByTime(1000); });
      view.rerender(createElement(LawnmowerGame, { onClose: () => {} }));
    }
    expect(screen.getByRole('button', { name: 'RETRY HERE' })).toBeTruthy();
    expect(screen.queryByText('Loading your backyard. The grass is nervous.')).toBeNull();
  });
  it('uncovers the iframe when its document loads without pretending the engine is ready', () => {
    render(createElement(LawnmowerGame, { onClose: () => {} }));
    const frame = screen.getByTitle('Lawnmower game') as HTMLIFrameElement;
    expect(frame.src).toBe(`${LAWNMOWER_ACTIVITY.url}/embed`);
    fireEvent.load(frame);
    expect(screen.queryByText('Loading your backyard. The grass is nervous.')).toBeNull();
    expect(screen.queryByText(/MULCH MADNESS/)).toBeNull();
    expect(document.querySelector('a[target="_blank"]')).toBeNull();
  });
  it('accepts ready and exit only from the expected iframe and origin', () => {
    const onClose = vi.fn();
    render(createElement(LawnmowerGame, { onClose }));
    const frame = screen.getByTitle('Lawnmower game') as HTMLIFrameElement;
    const send = (origin: string, source: Window | null, type: string) => act(() => window.dispatchEvent(new MessageEvent('message', { origin, source, data: { source: 'platphorm-lawnmower', type } })));
    send('https://evil.test', frame.contentWindow, 'ready');
    send(LAWNMOWER_ACTIVITY.url, window, 'ready');
    expect(screen.queryByText(/MULCH MADNESS/)).toBeNull();
    send(LAWNMOWER_ACTIVITY.url, frame.contentWindow, 'ready');
    expect(screen.getByText(/MULCH MADNESS/)).toBeTruthy();
    send(LAWNMOWER_ACTIVITY.url, frame.contentWindow, 'exit');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
