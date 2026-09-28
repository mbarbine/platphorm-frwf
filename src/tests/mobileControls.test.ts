import { useSettings } from '../game/state/settings';
import { createMatch } from '../game/systems/combat';
import { getMove } from '../game/data/moves';
import { mobileInput } from '../game/input/mobileInput';
import { describe, expect, it, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MobileControls } from '../ui/MobileControls';
import { useMatchStore } from '../game/state/matchStore';

describe('MobileControls component', () => {
  afterEach(() => {
    cleanup();
    mobileInput.reset();
    vi.restoreAllMocks();
  });

  it('renders action buttons with descriptive action-prefixed aria-label attributes', () => {
    useMatchStore.getState().configure('atlas', 'nova', 'standard', 'normal', 0, 0, 'singles');

    render(React.createElement(MobileControls, { onPause: () => {}, paused: false }));

    const quickBtn = screen.getByRole('button', { name: /^Quick strike:/i });
    expect(quickBtn).toBeTruthy();
    expect(quickBtn.getAttribute('aria-label')).toContain('Quick strike:');

    const powerBtn = screen.getByRole('button', { name: /^Power strike:/i });
    expect(powerBtn).toBeTruthy();
    expect(powerBtn.getAttribute('aria-label')).toContain('Power strike:');

    const grappleBtn = screen.getByRole('button', { name: /^Grapple:/i });
    expect(grappleBtn).toBeTruthy();
    expect(grappleBtn.getAttribute('aria-label')).toContain('Grapple:');

    const propBtn = screen.getByRole('button', { name: /^Prop action:/i });
    expect(propBtn).toBeTruthy();
    expect(propBtn.getAttribute('aria-label')).toContain('Prop action:');

    const actionBtn = screen.getByRole('button', { name: /^Action:/i });
    expect(actionBtn).toBeTruthy();
    expect(actionBtn.getAttribute('aria-label')).toContain('Action:');
  });

  describe('HoldButton behavior (RUN and GUARD)', () => {
    it('activates and deactivates run / guard on pointer down and pointer up', () => {
      useMatchStore.getState().configure('atlas', 'nova', 'standard', 'normal', 0, 0, 'singles');
      render(React.createElement(MobileControls, { onPause: () => {}, paused: false }));

      const runBtn = screen.getByRole('button', { name: 'Hold RUN' });
      expect(runBtn.classList.contains('is-pressed')).toBe(false);
      expect(runBtn.getAttribute('aria-pressed')).toBe('false');

      const mockSetPointerCapture = vi.fn();
      (runBtn as unknown as { setPointerCapture: typeof mockSetPointerCapture }).setPointerCapture = mockSetPointerCapture;

      fireEvent.pointerDown(runBtn, { pointerId: 1 });
      expect(mockSetPointerCapture).toHaveBeenCalledWith(1);
      expect(runBtn.classList.contains('is-pressed')).toBe(true);
      expect(runBtn.getAttribute('aria-pressed')).toBe('true');
      expect(mobileInput.read().run).toBe(true);

      fireEvent.pointerUp(runBtn, { pointerId: 1 });
      expect(runBtn.classList.contains('is-pressed')).toBe(false);
      expect(runBtn.getAttribute('aria-pressed')).toBe('false');
      expect(mobileInput.read().run).toBe(false);
    });

    it('deactivates hold buttons on pointer cancel and lost pointer capture', () => {
      useMatchStore.getState().configure('atlas', 'nova', 'standard', 'normal', 0, 0, 'singles');
      render(React.createElement(MobileControls, { onPause: () => {}, paused: false }));

      const guardBtn = screen.getByRole('button', { name: 'Hold GUARD' });
      (guardBtn as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture = vi.fn();

      fireEvent.pointerDown(guardBtn, { pointerId: 2 });
      expect(mobileInput.read().block).toBe(true);

      fireEvent.pointerCancel(guardBtn, { pointerId: 2 });
      expect(mobileInput.read().block).toBe(false);

      fireEvent.pointerDown(guardBtn, { pointerId: 3 });
      expect(mobileInput.read().block).toBe(true);

      fireEvent.lostPointerCapture(guardBtn);
      expect(mobileInput.read().block).toBe(false);
    });

    it('resets pressed state when disabled prop becomes true', () => {
      useMatchStore.getState().configure('atlas', 'nova', 'standard', 'normal', 0, 0, 'singles');
      const { rerender } = render(React.createElement(MobileControls, { onPause: () => {}, paused: false }));

      const runBtn = screen.getByRole('button', { name: 'Hold RUN' });
      (runBtn as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture = vi.fn();

      fireEvent.pointerDown(runBtn, { pointerId: 1 });
      expect(mobileInput.read().run).toBe(true);

      rerender(React.createElement(MobileControls, { onPause: () => {}, paused: true }));
      expect(mobileInput.read().run).toBe(false);
    });
  });

  describe('Movement Joystick (stick)', () => {
    it('handles pointer down, movement clamping, and pointer release on joystick pad', () => {
      useMatchStore.getState().configure('atlas', 'nova', 'standard', 'normal', 0, 0, 'singles');
      render(React.createElement(MobileControls, { onPause: () => {}, paused: false }));

      const stickPad = screen.getByRole('group', { name: 'Movement joystick' });
      const mockSetPointerCapture = vi.fn();
      (stickPad as unknown as { setPointerCapture: typeof mockSetPointerCapture }).setPointerCapture = mockSetPointerCapture;

      vi.spyOn(stickPad, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      // Pointer down at center (x: 50, y: 50) -> movement {x: 0, z: 0}
      fireEvent.pointerDown(stickPad, { pointerId: 10, clientX: 50, clientY: 50 });
      expect(mockSetPointerCapture).toHaveBeenCalledWith(10);
      expect(mobileInput.read().move).toEqual({ x: 0, z: 0 });

      // Move stick far right (x: 150, y: 50) -> offset 100 / radius 38 > 1 -> clamped to x: 1, z: 0
      fireEvent.pointerMove(stickPad, { pointerId: 10, clientX: 150, clientY: 50 });
      const inputState = mobileInput.read();
      expect(inputState.move.x).toBeCloseTo(1.0, 4);
      expect(inputState.move.z).toBeCloseTo(0, 4);

      // Pointer up releases joystick
      fireEvent.pointerUp(stickPad, { pointerId: 10, clientX: 150, clientY: 50 });
      expect(mobileInput.read().move).toEqual({ x: 0, z: 0 });
    });

    it('ignores pointer moves from non-captured pointer IDs', () => {
      useMatchStore.getState().configure('atlas', 'nova', 'standard', 'normal', 0, 0, 'singles');
      render(React.createElement(MobileControls, { onPause: () => {}, paused: false }));

      const stickPad = screen.getByRole('group', { name: 'Movement joystick' });
      (stickPad as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture = vi.fn();

      vi.spyOn(stickPad, 'getBoundingClientRect').mockReturnValue({
        left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => {},
      });

      fireEvent.pointerDown(stickPad, { pointerId: 10, clientX: 50, clientY: 50 });
      fireEvent.pointerMove(stickPad, { pointerId: 99, clientX: 150, clientY: 50 }); // Different pointer ID
      expect(mobileInput.read().move).toEqual({ x: 0, z: 0 });
    });
  });

  describe('Action button queueing & interactions', () => {
    it('queues actions via pointerDown and keyboard clicks (detail: 0)', () => {
      useMatchStore.getState().configure('atlas', 'nova', 'standard', 'normal', 0, 0, 'singles');
      render(React.createElement(MobileControls, { onPause: () => {}, paused: false }));

      const quickBtn = screen.getByRole('button', { name: /^Quick strike:/i });
      fireEvent.pointerDown(quickBtn);

      let frameInput = mobileInput.read();
      expect(frameInput.actions).toHaveLength(1);
      expect(frameInput.actions[0].action).toBe('quickStrike');

      const powerBtn = screen.getByRole('button', { name: /^Power strike:/i });
      // Keyboard click passes detail === 0
      fireEvent.click(powerBtn, { detail: 0 });

      frameInput = mobileInput.read();
      expect(frameInput.actions).toHaveLength(1);
      expect(frameInput.actions[0].action).toBe('heavyStrike');
    });

    it('ignores click events when detail > 0 to prevent double queueing after pointerDown', () => {
      useMatchStore.getState().configure('atlas', 'nova', 'standard', 'normal', 0, 0, 'singles');
      render(React.createElement(MobileControls, { onPause: () => {}, paused: false }));

      const quickBtn = screen.getByRole('button', { name: /^Quick strike:/i });
      fireEvent.click(quickBtn, { detail: 1 });

      const frameInput = mobileInput.read();
      expect(frameInput.actions).toHaveLength(0);
    });

    it('does not queue actions or move stick when match is paused', () => {
      useMatchStore.getState().configure('atlas', 'nova', 'standard', 'normal', 0, 0, 'singles');
      render(React.createElement(MobileControls, { onPause: () => {}, paused: true }));

      const quickBtn = screen.getByRole('button', { name: /^Quick strike:/i });
      fireEvent.pointerDown(quickBtn);
      fireEvent.click(quickBtn, { detail: 0 });

      expect(mobileInput.read().actions).toHaveLength(0);
    });

    it('triggers onPause when pause button is clicked', () => {
      useMatchStore.getState().configure('atlas', 'nova', 'standard', 'normal', 0, 0, 'singles');
      const onPause = vi.fn();
      render(React.createElement(MobileControls, { onPause, paused: false }));

      const pauseBtn = screen.getByRole('button', { name: 'Pause match' });
      fireEvent.click(pauseBtn);

      expect(onPause).toHaveBeenCalledTimes(1);
    });
  });

  describe('Lifecycle and state conditions', () => {
    it('renders null when player state is defeated', () => {
      const model = createMatch('atlas', 'nova', 'standard', 'easy');
      model.player.state = 'defeated';
      useMatchStore.setState({ model });

      const { container } = render(React.createElement(MobileControls, { onPause: () => {}, paused: false }));
      expect(container.firstChild).toBeNull();
    });

    it('resets mobile input state on unmount or paused toggle', () => {
      useMatchStore.getState().configure('atlas', 'nova', 'standard', 'normal', 0, 0, 'singles');
      const resetSpy = vi.spyOn(mobileInput, 'reset');

      const { unmount, rerender } = render(React.createElement(MobileControls, { onPause: () => {}, paused: false }));

      rerender(React.createElement(MobileControls, { onPause: () => {}, paused: true }));
      expect(resetSpy).toHaveBeenCalled();

      unmount();
      expect(resetSpy).toHaveBeenCalled();
    });

    it('locks strike and grapple controls when player is pinned or climbing', () => {
      const model = createMatch('atlas', 'nova', 'standard', 'easy');
      model.player.state = 'pinned';
      useMatchStore.setState({ model });

      render(React.createElement(MobileControls, { onPause: () => {}, paused: false }));

      const quickBtn = screen.getByRole('button', { name: /^Quick strike:/i });
      const powerBtn = screen.getByRole('button', { name: /^Power strike:/i });
      const grappleBtn = screen.getByRole('button', { name: /^Grapple:/i });

      expect(quickBtn.hasAttribute('disabled')).toBe(true);
      expect(powerBtn.hasAttribute('disabled')).toBe(true);
      expect(grappleBtn.hasAttribute('disabled')).toBe(true);
    });

    it('presents aerial moves when climbing at stage 3', () => {
      const model = createMatch('atlas', 'nova', 'standard', 'easy');
      model.player.state = 'climbing';
      model.player.climbStage = 3;
      useMatchStore.setState({ model });

      render(React.createElement(MobileControls, { onPause: () => {}, paused: false }));

      const quickBtn = screen.getByRole('button', { name: /^Quick strike:/i });
      const powerBtn = screen.getByRole('button', { name: /^Power strike:/i });

      expect(quickBtn.getAttribute('data-move-label')).toBe(getMove('aerial_elbow').displayName.toUpperCase());
      expect(powerBtn.getAttribute('data-move-label')).toBe(getMove('aerial_kick').displayName.toUpperCase());
    });
  });
});

describe('mobile move labels follow real Arcade execution', () => {
  afterEach(() => {
    cleanup();
    mobileInput.reset();
  });

  it('shows the Arcade suplex choice rather than the neutral technical piledriver', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'easy');
    model.player.state = 'grappling'; model.player.moveId = 'slam'; model.player.attackPhase = 'anticipation';
    useSettings.setState({ controlStyle: 'arcade' }); useMatchStore.setState({ model });
    render(React.createElement(MobileControls, { onPause: () => {}, paused: false }));
    expect(screen.getByRole('button', { name: /^Grapple:/i }).getAttribute('data-move-label')).toBe(getMove('suplex').displayName.toUpperCase());
  });

  it('only advertises release when a physical lift is actually established', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'easy');
    model.player.state = 'grappling'; model.player.moveId = 'slam'; model.player.attackPhase = 'anticipation';
    model.grapple = { attacker: 'player', defender: 'opponent', position: 'collarTie', leverage: 1, tension: 0, rotation: 0, lift: 1, struggle: 0, age: .5, gripCount: 2, phase: 'lift' };
    useMatchStore.setState({ model });
    render(React.createElement(MobileControls, { onPause: () => {}, paused: false }));
    expect(screen.getByRole('button', { name: /^Quick strike:/i }).getAttribute('data-move-label')).toBe('RELEASE THROW');
  });
});
