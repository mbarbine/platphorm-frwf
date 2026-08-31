import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { SpectatorControls } from '../ui/SpectatorControls';
import { HUD } from '../ui/HUD';
import { createMatch } from '../game/systems/combat';

vi.mock('../game/state/matchStore', () => ({
  useMatchStore: Object.assign(
    vi.fn((selector) => {
      const state = {
        model: mockModel,
        replayActive: false,
      };
      return selector ? selector(state) : state;
    }),
    { getState: vi.fn(() => ({ model: mockModel })) }
  ),
}));

vi.mock('../game/state/spectatorStore', () => ({
  useSpectatorStore: Object.assign(
    vi.fn((selector) => {
      const state = {
        cameraMode: 'first_person',
        target: 'opponent',
        setCameraMode: vi.fn(),
        cycleTarget: vi.fn(),
      };
      return selector ? selector(state) : state;
    }),
    {
      getState: vi.fn(() => ({
        cameraMode: 'first_person',
        target: 'opponent',
        setCameraMode: vi.fn(),
        cycleTarget: vi.fn(),
      })),
    }
  ),
  resolvedSpectatorTarget: vi.fn(() => 'opponent'),
}));

vi.mock('../game/state/settings', () => ({
  useSettings: Object.assign(
    vi.fn((selector) => {
      const state = {
        grappleGuide: 'full',
        controlDeckMode: 'full',
      };
      return selector ? selector(state) : state;
    }),
    { getState: vi.fn(() => ({ grappleGuide: 'full', controlDeckMode: 'full' })) }
  ),
}));

vi.mock('../game/physics/physicsRuntime', () => ({
  bodyWorksRuntime: {
    metrics: {
      bodyCount: 10,
      worldBodyCount: 10,
      invalidRegisteredBodyCount: 0,
      jointCount: 10,
      worldJointCount: 10,
      worldRemoveCount: 0,
      gripCount: 0,
      gripCreateCount: 0,
      gripInvalidCount: 0,
      contactCount: 0,
      nearestGripDistance: 0,
      maximumGripError: 0,
      maximumGripLoad: 0,
      lastGripBreakReason: '',
      emergencyResetCount: 0,
      containmentCount: 0,
      propBodyCount: 0,
      propGripCount: 0,
      currentJointSeparation: 0,
      maximumJointSeparation: 0,
      motorSaturationCount: 0,
      currentMotorSaturations: 0,
      lastContactPair: '',
      lastContactMaximumForce: 0,
      lastContactRelativeSpeed: 0,
      lastStrikeDistance: 0,
      minimumStrikeDistance: 0,
      minimumStrikePlanarDistance: 0,
      minimumStrikeVerticalDistance: 0,
      numericalFaultCount: 0,
      lastNumericalFault: '',
      supportScore: 1,
      taskCount: 0,
      taskTimeoutCount: 0,
      lastTaskPhase: '',
      actionBuffered: 0,
      actionExecuted: 0,
      actionExpired: 0,
      actionRejected: 0,
      actionDuplicate: 0,
      actionAverageWaitMs: 0,
      actionMaximumWaitMs: 0,
    },
    continuousStrikeDiagnostics: () => ({ count: 0, pair: '' }),
    fighterSnapshot: () => ({
      speed: 0,
      pelvisY: 1,
      headY: 1.8,
      footY: 0,
      leftFootY: 0,
      rightFootY: 0,
      restFootOffsetY: 0,
      upright: 1,
      supportFeet: 2,
    }),
    intentSnapshot: () => ({ move: { x: 0, z: 0 }, run: false }),
    segmentSnapshot: () => undefined,
    actionFeedback: () => null,
    pendingCommandCount: () => 0,
    pendingLandingCount: () => 0,
    registeredLandingSurfaceCount: () => 0,
    replay: { size: 0 },
  },
}));

let mockModel = createMatch('atlas', 'nova', 'standard', 'normal', 1, 0, 0, 'battle_royale');

describe('SpectatorControls & HUD target-switch accessibility', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders SpectatorControls with correct ARIA labels and live region when spectating', () => {
    mockModel = createMatch('atlas', 'nova', 'standard', 'normal', 1, 0, 0, 'battle_royale');
    mockModel.player.state = 'defeated';

    render(React.createElement(SpectatorControls));

    const aside = screen.getByTestId('spectator-controls');
    expect(aside.getAttribute('aria-label')).toBe('Spectator camera controls');

    const firstPersonButton = screen.getByRole('button', { name: /FIRST PERSON camera/i });
    expect(firstPersonButton.getAttribute('aria-label')).toBe('FIRST PERSON camera (key 1)');

    const nextButton = screen.getByRole('button', { name: /Next wrestler/i });
    expect(nextButton.getAttribute('aria-label')).toBe('Next wrestler (Tab key)');

    expect(screen.getByText(/Spectating wrestler: NOVA FANG, first person camera/i)).toBeTruthy();
  });

  it('renders target switch button in HUD with explicit aria-label in Battle Royale', () => {
    mockModel = createMatch('atlas', 'nova', 'standard', 'normal', 1, 0, 0, 'battle_royale');

    render(React.createElement(HUD, { device: 'keyboard', paused: false }));

    const targetSwitch = screen.getByTestId('target-switch');
    expect(targetSwitch.getAttribute('aria-label')).toBe('Switch target wrestler (Tab key)');
  });
});
