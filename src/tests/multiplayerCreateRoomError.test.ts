import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { App } from '../app/App';

// Silence console.error from lazy loaded errors or unhandled mock issues
vi.spyOn(console, 'error').mockImplementation(() => {});

vi.mock('../game/audio/BackgroundMusic', () => ({ BackgroundMusic: () => null }));
vi.mock('../game/audio/audioEngine', () => ({
  audioEngine: {
    configure: vi.fn(),
    play: vi.fn(),
    unlock: vi.fn(),
    connectMusic: vi.fn(() => ({ volume: vi.fn(), destroy: vi.fn() })),
  }
}));

vi.mock('../ui/FighterPreview', () => ({
  FighterPreview: () => React.createElement('div', { 'data-testid': 'fighter-preview' })
}));

vi.mock('../ui/SettingsPanel', () => ({
  SettingsPanel: () => React.createElement('div', { 'data-testid': 'settings-panel' })
}));

vi.mock('../game/components/PhysicsLab', () => ({
  PhysicsLab: () => React.createElement('div', { 'data-testid': 'physics-lab' })
}));

vi.mock('../game/components/GameScene', () => ({
  GameScene: () => React.createElement('div', { 'data-testid': 'game-scene' })
}));

const createPrivateRoomMock = vi.fn();
vi.mock('../game/multiplayer/MultiplayerStore', () => {
  // Mock the return value of useMultiplayerStore to match selector paths in App.tsx
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const storeHook: any = (selector: (state: any) => any) => {
    const state = {
      status: 'disconnected', // 'disconnected' is what App uses to trigger screen='select'
      roomPhase: 'lobby',
      rtt: 0,
      createPrivateRoom: createPrivateRoomMock,
    };
    return selector(state);
  };
  storeHook.getState = () => ({
    createPrivateRoom: createPrivateRoomMock,
  });
  return {
    useMultiplayerStore: storeHook
  };
});

describe('App Multiplayer Host Match Error', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('displays an error message when hosting a match fails', async () => {
    const errorMsg = 'Could not host a match. Servers might be full or under maintenance.';
    createPrivateRoomMock.mockRejectedValueOnce(new Error(errorMsg));

    render(React.createElement(App));

    const enterButton = screen.getByRole('button', { name: 'ENTER RINGFALL' });
    await act(async () => {
      fireEvent.click(enterButton);
    });

    const onlineButton = screen.getByRole('button', { name: 'PLAY ONLINE' });
    await act(async () => {
      fireEvent.click(onlineButton);
    });

    // Now we should be on select screen with online mode, so 'HOST A MATCH' should be visible
    const hostButton = screen.getByRole('button', { name: 'HOST A MATCH' });

    await act(async () => {
      fireEvent.click(hostButton);
    });

    expect(screen.getByText(errorMsg)).toBeTruthy();

    // Verify it clears when retrying and succeeds
    createPrivateRoomMock.mockResolvedValueOnce(undefined);
    await act(async () => {
      fireEvent.click(hostButton);
    });

    expect(screen.queryByText(errorMsg)).toBeNull();
  });
});
