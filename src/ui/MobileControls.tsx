import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { mobileInput } from '../game/input/mobileInput';
import { useMatchStore } from '../game/state/matchStore';
import type { GameAction } from '../game/input/actionLayer';
import { getMove } from '../game/data/moves';
import { GRAPPLE_ACQUISITION_RANGE, selectDirectionalGrapple, selectDirectionalStrike } from '../game/systems/moveSelection';
import { resolveContextAction, resolvePropAction } from '../game/systems/contextResolver';

interface MobileControlsProps { onPause: () => void; paused: boolean }

interface HoldButtonProps {
  activeLabel: string;
  className: string;
  disabled?: boolean;
  onChange: (pressed: boolean) => void;
}

function HoldButton({ activeLabel, className, disabled = false, onChange }: HoldButtonProps) {
  const [pressed, setPressed] = useState(false);
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  const change = (next: boolean): void => {
    if (disabled && next) return;
    setPressed(next); onChangeRef.current(next);
  };
  const press = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    change(true);
  };
  const release = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    change(false);
  };
  useEffect(() => { if (disabled) { setPressed(false); onChangeRef.current(false); } }, [disabled]);
  return <button type="button" disabled={disabled} className={`${className}${pressed ? ' is-pressed' : ''}`} aria-label={`Hold ${activeLabel}`} aria-pressed={pressed} onPointerDown={press} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={() => change(false)}>{activeLabel}</button>;
}

export function MobileControls({ onPause, paused }: MobileControlsProps) {
  const pad = useRef<HTMLDivElement | null>(null);
  const pointer = useRef<number | null>(null);
  const [stick, setStick] = useState({ x: 0, z: 0 });
  const model = useMatchStore((state) => state.model);
  const player = model.player;
  const opponent = model[model.targets.player];
  const contextResolution = resolveContextAction(model, 'player', stick);
  const propResolution = resolvePropAction(model, 'player', stick);
  const targetDistance = Math.hypot(player.position.x - opponent.position.x, player.position.z - opponent.position.z);
  const contextLabel = contextResolution.displayName;
  const quickMove = player.state === 'grappling' ? selectDirectionalGrapple(stick, 'quick')
    : player.state === 'climbing' && player.climbStage === 3 ? 'aerial_elbow'
      : opponent.state === 'downed' ? 'ground' : selectDirectionalStrike(stick, 'quick', player.comboStep);
  const heavyMove = player.state === 'grappling' ? selectDirectionalGrapple(stick, 'heavy')
    : player.state === 'climbing' && player.climbStage === 3 ? 'aerial_kick'
      : player.ropeRebound > 0 ? 'stiff_arm' : player.heldPropId ? 'prop' : selectDirectionalStrike(stick, 'heavy', player.comboStep);
  const grappleMove = player.state === 'grappling' ? selectDirectionalGrapple(stick, 'grapple') : null;
  const quickLabel = player.state === 'downed' ? 'NO STRIKE' : getMove(quickMove).displayName.toUpperCase();
  const powerLabel = player.state === 'downed' ? 'NO STRIKE' : getMove(heavyMove).displayName.toUpperCase();
  const grappleLabel = player.state === 'climbing' || player.state === 'downed' || player.state === 'pinned' ? 'NO LOCK'
    : grappleMove ? getMove(grappleMove).displayName.toUpperCase()
      : targetDistance <= GRAPPLE_ACQUISITION_RANGE ? 'VOLTAGE SLAM' : 'COLLAR REACH (MISS)';
  const strikeLocked = player.state === 'downed' || player.state === 'pinned' || (player.state === 'climbing' && player.climbStage < 3);
  const grappleLocked = player.state === 'downed' || player.state === 'pinned' || player.state === 'climbing';

  useEffect(() => {
    if (paused) { pointer.current = null; setStick({ x: 0, z: 0 }); mobileInput.reset(); }
  }, [paused]);
  useEffect(() => () => mobileInput.reset(), []);

  const moveStick = (clientX: number, clientY: number): void => {
    const rect = pad.current?.getBoundingClientRect();
    if (!rect) return;
    const radius = Math.max(34, Math.min(rect.width, rect.height) * .38);
    let x = (clientX - (rect.left + rect.width / 2)) / radius;
    let z = (clientY - (rect.top + rect.height / 2)) / radius;
    const magnitude = Math.hypot(x, z);
    if (magnitude > 1) { x /= magnitude; z /= magnitude; }
    const next = { x, z };
    setStick(next);
    mobileInput.setMove(next);
  };
  const startStick = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (paused || pointer.current !== null) return;
    event.preventDefault();
    pointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    moveStick(event.clientX, event.clientY);
  };
  const updateStick = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (pointer.current !== event.pointerId) return;
    event.preventDefault();
    moveStick(event.clientX, event.clientY);
  };
  const stopStick = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (pointer.current !== event.pointerId) return;
    event.preventDefault();
    pointer.current = null;
    setStick({ x: 0, z: 0 });
    mobileInput.setMove({ x: 0, z: 0 });
  };
  const queuePointer = (action: GameAction) => (event: ReactPointerEvent<HTMLButtonElement>): void => { event.preventDefault(); if (!paused) mobileInput.queue(action); };
  const queueKeyboard = (action: GameAction) => (event: ReactMouseEvent<HTMLButtonElement>): void => { if (!paused && event.detail === 0) mobileInput.queue(action); };

  if (player.state === 'defeated') return null;
  return <div className={`mobile-controls${paused ? ' mobile-controls--paused' : ''}`} data-testid="mobile-controls">
    <button type="button" className="mobile-pause" aria-label="Pause match" onClick={onPause}>Ⅱ</button>
    <div ref={pad} className="mobile-stick" role="group" aria-label="Movement joystick" aria-disabled={paused} onPointerDown={startStick} onPointerMove={updateStick} onPointerUp={stopStick} onPointerCancel={stopStick}>
      <span>MOVE</span><i style={{ transform: `translate(${stick.x * 34}px, ${stick.z * 34}px)` }} />
    </div>
    <div className="mobile-modifiers">
      <HoldButton activeLabel="RUN" className="mobile-hold mobile-hold--run" disabled={paused} onChange={(pressed) => mobileInput.setRun(pressed)} />
      <HoldButton activeLabel="GUARD" className="mobile-hold mobile-hold--guard" disabled={paused} onChange={(pressed) => mobileInput.setBlock(pressed)} />
      <button type="button" disabled={paused} className="mobile-hold mobile-hold--prop" aria-label="Pick up, drop, or throw prop" title={propResolution.displayName} data-action-id={propResolution.actionId} data-action-legal={propResolution.legalState ? 'true' : 'false'} onPointerDown={queuePointer('propAction')} onClick={queueKeyboard('propAction')}>PROP</button>
      <button type="button" disabled={paused} className="mobile-hold mobile-hold--taunt" aria-label="Taunt" onPointerDown={queuePointer('taunt')} onClick={queueKeyboard('taunt')}>TAUNT</button>
    </div>
    <div className="mobile-actions" aria-label="Wrestling actions">
      <button type="button" disabled={paused || strikeLocked} className={`mobile-action mobile-action--quick${player.moveId === quickMove ? ' is-pressed' : ''}`} aria-label={quickLabel} data-move-label={quickLabel} onPointerDown={queuePointer('quickStrike')} onClick={queueKeyboard('quickStrike')}><b>STRIKE</b><small>{quickLabel}</small></button>
      <button type="button" disabled={paused || strikeLocked} className={`mobile-action mobile-action--power${player.moveId === heavyMove ? ' is-pressed' : ''}`} aria-label={powerLabel} data-move-label={powerLabel} onPointerDown={queuePointer('heavyStrike')} onClick={queueKeyboard('heavyStrike')}><b>POWER</b><small>{powerLabel}</small></button>
      <button type="button" disabled={paused || grappleLocked} className={`mobile-action mobile-action--grapple${player.state === 'grappling' ? ' is-pressed' : ''}`} aria-label={grappleLabel} data-move-label={grappleLabel} onPointerDown={queuePointer('grapple')} onClick={queueKeyboard('grapple')}><b>GRAPPLE</b><small>{grappleLabel}</small></button>
      <button type="button" disabled={paused} className={`mobile-action mobile-action--context${player.state === 'pinning' || player.moveId === 'finisher' || player.moveId === 'aerial' ? ' is-pressed' : ''}`} aria-label={contextLabel} data-action-id={contextResolution.actionId} data-action-legal={contextResolution.legalState ? 'true' : 'false'} onPointerDown={queuePointer('contextAction')} onClick={queueKeyboard('contextAction')}><b>ACTION</b><small>{contextLabel}</small></button>
      <button type="button" disabled={paused} className={`mobile-action mobile-action--counter${player.moveId === 'kick_up' ? ' is-pressed' : ''}`} aria-label={player.state === 'downed' ? 'Kick up' : 'Dodge or counter'} onPointerDown={queuePointer('dodgeCounter')} onClick={queueKeyboard('dodgeCounter')}><b>{player.state === 'downed' || player.moveId === 'kick_up' ? 'GET UP' : 'DODGE'}</b><small>{player.state === 'downed' || player.moveId === 'kick_up' ? 'KICK-UP' : 'COUNTER'}</small></button>
    </div>
  </div>;
}
