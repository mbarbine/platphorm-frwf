import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { GameScene } from '../game/components/GameScene';

// Silence console.error from error boundary
vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock stores and state
vi.mock('../game/state/matchStore', () => ({
  useMatchStore: Object.assign(vi.fn((selector) => {
    const state = {
      model: {
        paused: false,
        toyTestMode: false,
        player: { moveId: null, position: { x: 0, z: 0 }, state: 'idle' },
        targets: { player: 'opponent' },
        opponent: { health: 100, state: 'idle' },
        matchMode: 'singles',
        resolved: false,
        falls: [],
        unstableWithoutCauseSeconds: 0,
      },
      replayActive: false,
    };
    return selector ? selector(state) : state;
  }), { getState: vi.fn(() => ({ model: { elapsed: 0, networkAuthority: false }, setPhysicsAuthority: vi.fn() })) }),
}));

vi.mock('../game/state/spectatorStore', () => ({
  useSpectatorStore: vi.fn(() => ({})),
  resolvedSpectatorTarget: vi.fn(() => 'player'),
}));

vi.mock('../game/state/physicsLabStore', () => ({
  usePhysicsLabStore: vi.fn((selector) => {
    const state = { rate: 1, debug: false };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('../game/runtime/runtimeModes', () => ({
  physicsLabEnabled: () => false,
}));

vi.mock('../game/multiplayer/MultiplayerStore', () => ({
  useMultiplayerStore: Object.assign(vi.fn(() => ({})), {
    getState: vi.fn(() => ({ sessionId: 'test', fighters: new Map(), sendAction: vi.fn() })),
  }),
}));

vi.mock('../game/input/useGameInput', () => ({
  useGameInput: () => ({ device: 'keyboard' }),
}));

vi.mock('../game/audio/audioEngine', () => ({
  audioEngine: { loadBank: vi.fn(), startMusic: vi.fn(), stopMusic: vi.fn(), playEffect: vi.fn() },
}));

vi.mock('../game/state/settings', () => ({
  useSettings: vi.fn((selector) => {
    const state = {
      automaticPerformanceFallback: false,
      setAutomaticPerformanceFallback: vi.fn(),
      graphicsQuality: 'performance',
      reducedMotion: false,
    };
    return selector ? selector(state) : state;
  }),
}));

// Mock physics engine metrics to satisfy simulationReady
vi.mock('../game/physics/physicsRuntime', () => ({
  bodyWorksRuntime: {
    setJointData: vi.fn(),
    metrics: { bodyCount: 100, fixedSteps: 0, emergencyResetCount: 0 },
    beforeFixedStep: vi.fn(),
    afterFixedStep: vi.fn(),
    consumeContacts: vi.fn(() => []),
    fighterSnapshot: vi.fn(() => ({ speed: 0 })),
    intentSnapshot: vi.fn(() => ({})),
    rejectPendingActions: vi.fn(),
  }
}));

// Mock react-three components
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, onCreated }: { children: React.ReactNode, onCreated?: (state: unknown) => void }) => {
    // Call onCreated immediately to trigger the initialization logic
    // such as setting up XR supported state
    React.useEffect(() => {
      if (onCreated) {
        onCreated({
          gl: {
            xr: { enabled: false, isPresenting: false, getCamera: vi.fn(), setReferenceSpaceType: vi.fn(), setSession: vi.fn(), getSession: vi.fn(() => ({ end: vi.fn() })) }
          }
        });
      }
    }, [onCreated]);

    return React.createElement('div', { 'data-testid': 'mock-canvas' }, children);
  },
  useFrame: vi.fn(),
  useThree: () => ({ camera: {}, gl: { xr: { isPresenting: false, getCamera: vi.fn() } } }),
}));
vi.mock('@react-three/drei', () => ({
  AdaptiveDpr: () => null,
  BakeShadows: () => null,
  OrbitControls: () => null,
}));
vi.mock('@react-three/rapier', () => ({
  Physics: ({ children }: { children: React.ReactNode }) => React.createElement('div', { 'data-testid': 'mock-physics' }, children),
  useAfterPhysicsStep: vi.fn(),
  useBeforePhysicsStep: vi.fn(),
}));

// Mock game components
vi.mock('../game/components/Arena', () => ({ Arena: () => null }));
vi.mock('../game/components/CameraRig', () => ({ CameraRig: () => null }));
vi.mock('../game/components/ImpactEffects', () => ({ ImpactEffects: () => null }));
vi.mock('../game/components/FighterModel', () => ({ FighterModel: () => null }));
vi.mock('../game/components/PhysicalFighterRig', () => ({ PhysicalFighterRig: () => null }));
vi.mock('../game/components/ReplayFighter', () => ({ ReplayDirector: () => null, RecordedPhysicalFighter: () => null }));
vi.mock('../game/components/SpectatorFreeCamera', () => ({ SpectatorFreeCamera: () => null }));
vi.mock('../game/runtime/renderDiagnostics', () => ({
  RuntimeDiagnosticsSampler: () => null,
  renderDiagnostics: { drawCalls: 0, triangles: 0, geometries: 0, textures: 0, shaderPrograms: 0, framesOver100ms: 0, frameP95Ms: 0, frameP99Ms: 0 },
  resetRenderDiagnostics: vi.fn(),
  sampleRenderDiagnostics: vi.fn(),
}));
vi.mock('../game/presentation/presentationManifest', () => ({
  selectFighterDetail: vi.fn(() => ({ tier: 'performance' })),
}));
vi.mock('../game/runtime/quality', () => ({
  browserRuntimeQuality: vi.fn(() => ({ tier: 'performance', bakeShadows: false })),
}));
vi.mock('../game/systems/falls', () => ({
  fallCount: vi.fn(() => 0),
}));
vi.mock('../game/input/gamepadHaptics', () => ({
  pulseConnectedGamepads: vi.fn(),
}));
vi.mock('../game/input/cameraRelative', () => ({
  cameraInputBasis: vi.fn(() => ({ x: 0, z: -1, length: 1, angle: 0 })),
  updateStableBasis: vi.fn(),
  transformCameraRelative: vi.fn(() => ({ x: 0, z: 0 })),
}));


describe('GameScene XR', () => {
  const mockRequestSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock XR environment
    const mockXr = {
      isSessionSupported: vi.fn().mockResolvedValue(true),
      requestSession: mockRequestSession,
      setReferenceSpaceType: vi.fn(),
      setSession: vi.fn(),
      getSession: vi.fn(() => ({ end: vi.fn() })),
    };

    Object.defineProperty(global.navigator, 'xr', {
      value: mockXr,
      configurable: true,
      writable: true,
    });
  });

  it('renders XR entry button when XR is supported', async () => {
    render(React.createElement(GameScene, { onPause: vi.fn(), onDevice: vi.fn(), onFinished: vi.fn() }));

    const xrButton = await screen.findByTestId('xr-entry');
    expect(xrButton).toBeTruthy();
    expect(xrButton.textContent).toContain('ENTER ARENA XR');
  });

  it('handles XR session request failure and displays error', async () => {
    mockRequestSession.mockRejectedValueOnce(new Error('Device not connected'));

    render(React.createElement(GameScene, { onPause: vi.fn(), onDevice: vi.fn(), onFinished: vi.fn() }));

    const xrButton = await screen.findByTestId('xr-entry');

    await act(async () => {
      fireEvent.click(xrButton);
    });

    await waitFor(() => {
      const errorMsg = screen.getByRole('status');
      expect(errorMsg.textContent).toContain('Device not connected');
    });
  });
});
