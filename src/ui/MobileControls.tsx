import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { mobileInput } from '../game/input/mobileInput';
import { useMatchStore } from '../game/state/matchStore';
import type { GameCommand } from '../game/types/game';
import { getMove } from '../game/data/moves';
import { canTransitionThroughRopes, selectDirectionalGrapple, selectDirectionalStrike } from '../game/systems/combat';

interface MobileControlsProps { onPause: () => void; paused: boolean }

interface HoldButtonProps {
  activeLabel: string;
  className: string;
  onChange: (pressed: boolean) => void;
}

function HoldButton({ activeLabel, className, onChange }: HoldButtonProps) {
  const [pressed, setPressed] = useState(false);
  const change = (next: boolean): void => { setPressed(next); onChange(next); };
  const press = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    change(true);
  };
  const release = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    change(false);
  };
  return <button type="button" className={`${className}${pressed ? ' is-pressed' : ''}`} aria-label={`Hold ${activeLabel}`} aria-pressed={pressed} onPointerDown={press} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={() => change(false)}>{activeLabel}</button>;
}

export function MobileControls({ onPause, paused }: MobileControlsProps) {
  const pad = useRef<HTMLDivElement | null>(null);
  const pointer = useRef<number | null>(null);
  const [stick, setStick] = useState({ x: 0, z: 0 });
  const player = useMatchStore((state) => state.model.player);
  const opponent = useMatchStore((state) => state.model.opponent);
  const distance = Math.hypot(player.position.x - opponent.position.x, player.position.z - opponent.position.z);
  const nearCorner = Math.abs(player.position.x) > 4.35 && Math.abs(player.position.z) > 2.95;
  const ringside = Math.abs(player.position.x) > 5.82 || Math.abs(player.position.z) > 4.32;
  const contextLabel = player.state === 'climbing'
    ? player.climbStage === 1 ? 'CLIMB II' : player.climbStage === 2 ? 'CLIMB TOP' : 'DIVE'
    : player.momentum >= 100 && ['staggered', 'downed'].includes(opponent.state) && distance < 2.2 ? 'FINISH'
      : opponent.state === 'downed' && distance < 1.7 ? 'PIN' : nearCorner ? 'CLIMB I'
        : canTransitionThroughRopes(player.position) ? ringside ? 'ENTER RING' : 'EXIT RING' : 'ACTION';
  const quickMove = player.state === 'grappling' ? selectDirectionalGrapple(stick, 'quick')
    : player.state === 'climbing' && player.climbStage === 3 ? 'aerial_elbow'
      : opponent.state === 'downed' ? 'ground' : selectDirectionalStrike(stick, 'quick', player.comboStep);
  const heavyMove = player.state === 'grappling' ? selectDirectionalGrapple(stick, 'heavy')
    : player.state === 'climbing' && player.climbStage === 3 ? 'aerial_kick'
      : player.ropeRebound > 0 ? 'stiff_arm' : player.heldPropId ? 'prop' : selectDirectionalStrike(stick, 'heavy', player.comboStep);
  const grappleMove = player.state === 'grappling' ? selectDirectionalGrapple(stick, 'grapple') : null;
  const quickLabel = player.state === 'downed' ? 'NO STRIKE' : getMove(quickMove).displayName.toUpperCase();
  const powerLabel = player.state === 'downed' ? 'NO STRIKE' : getMove(heavyMove).displayName.toUpperCase();
  const grappleLabel = player.state === 'climbing' || player.state === 'downed' || player.state === 'pinned' ? 'NO LOCK' : grappleMove ? getMove(grappleMove).displayName.toUpperCase() : 'LOCK UP';
  const strikeLocked = player.state === 'downed' || player.state === 'pinned' || (player.state === 'climbing' && player.climbStage < 3);
  const grappleLocked = player.state === 'downed' || player.state === 'pinned' || player.state === 'climbing';

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
    if (pointer.current !== null) return;
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
  const queuePointer = (command: GameCommand) => (event: ReactPointerEvent<HTMLButtonElement>): void => { event.preventDefault(); mobileInput.queue(command); };
  const queueKeyboard = (command: GameCommand) => (event: ReactMouseEvent<HTMLButtonElement>): void => { if (event.detail === 0) mobileInput.queue(command); };

  return <div className={`mobile-controls${paused ? ' mobile-controls--paused' : ''}`} data-testid="mobile-controls">
    <button type="button" className="mobile-pause" aria-label="Pause match" onClick={onPause}>Ⅱ</button>
    <div ref={pad} className="mobile-stick" role="group" aria-label="Movement joystick" onPointerDown={startStick} onPointerMove={updateStick} onPointerUp={stopStick} onPointerCancel={stopStick}>
      <span>MOVE</span><i style={{ transform: `translate(${stick.x * 34}px, ${stick.z * 34}px)` }} />
    </div>
    <div className="mobile-modifiers">
      <HoldButton activeLabel="RUN" className="mobile-hold mobile-hold--run" onChange={(pressed) => mobileInput.setRun(pressed)} />
      <HoldButton activeLabel="GUARD" className="mobile-hold mobile-hold--guard" onChange={(pressed) => mobileInput.setBlock(pressed)} />
      <button type="button" className="mobile-hold mobile-hold--prop" aria-label="Pick up, drop, or throw prop" onPointerDown={queuePointer('interact')} onClick={queueKeyboard('interact')}>PROP</button>
      <button type="button" className="mobile-hold mobile-hold--taunt" aria-label="Taunt" onPointerDown={queuePointer('taunt')} onClick={queueKeyboard('taunt')}>TAUNT</button>
    </div>
    <div className="mobile-actions" aria-label="Wrestling actions">
      <button type="button" disabled={strikeLocked} className={`mobile-action mobile-action--quick${player.moveId === quickMove ? ' is-pressed' : ''}`} aria-label={quickLabel} onPointerDown={queuePointer('quick')} onClick={queueKeyboard('quick')}><b>{quickLabel}</b><small>QUICK</small></button>
      <button type="button" disabled={strikeLocked} className={`mobile-action mobile-action--power${player.ropeRebound > 0 ? ' is-pressed' : ''}`} aria-label="Heavy strike or stiff-arm" onPointerDown={queuePointer('heavy')} onClick={queueKeyboard('heavy')}><b>{powerLabel}</b><small>{player.ropeRebound > 0 ? 'STIFF-ARM' : 'POWER'}</small></button>
      <button type="button" disabled={grappleLocked} className={`mobile-action mobile-action--grapple${player.state === 'grappling' ? ' is-pressed' : ''}`} aria-label={grappleLabel} onPointerDown={queuePointer('grapple')} onClick={queueKeyboard('grapple')}><b>{grappleLabel}</b><small>GRAPPLE</small></button>
      <button type="button" className="mobile-action mobile-action--jump" aria-label="Jump" onPointerDown={queuePointer('jump')} onClick={queueKeyboard('jump')}><b>↑</b><small>JUMP</small></button>
      <button type="button" className="mobile-action mobile-action--context" aria-label={contextLabel} onPointerDown={queuePointer('context')} onClick={queueKeyboard('context')}><b>{contextLabel}</b><small>ACTION</small></button>
      <button type="button" className="mobile-action mobile-action--counter" aria-label={player.state === 'downed' ? 'Kick up' : 'Dodge or counter'} onPointerDown={queuePointer('dodge')} onClick={queueKeyboard('dodge')}><b>↯</b><small>{player.state === 'downed' ? 'KICK-UP' : 'COUNTER'}</small></button>
    </div>
  </div>;
}
