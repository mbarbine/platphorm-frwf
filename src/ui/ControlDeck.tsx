import { getMove } from '../game/data/moves';
import type { ControlDevice, FighterRuntime } from '../game/types/game';

type ControlId = 'move' | 'run' | 'quick' | 'heavy' | 'grapple' | 'block' | 'counter' | 'jump' | 'interact' | 'context' | 'taunt';

interface ControlDefinition {
  id: ControlId;
  label: string;
  key: string;
}

export interface ControlReadout {
  active: ReadonlySet<ControlId>;
  callout: string;
  state: string;
}

const DEVICE_KEYS: Readonly<Record<ControlDevice, Readonly<Record<ControlId, string>>>> = {
  keyboard: { move: 'WASD', run: 'SHIFT', quick: 'J', heavy: 'K', grapple: 'L', block: 'I', counter: 'SPACE', jump: 'C', interact: 'E', context: 'F', taunt: 'Q' },
  gamepad: { move: 'L STICK', run: 'RT', quick: 'X / □', heavy: 'Y / △', grapple: 'B / ○', block: 'LT', counter: 'A / ×', jump: 'L3', interact: 'LB', context: 'R3', taunt: 'RB' },
  touch: { move: 'STICK', run: 'RUN', quick: 'JAB', heavy: 'POWER', grapple: 'LOCK', block: 'GUARD', counter: '↯', jump: 'JUMP', interact: 'PROP', context: 'ACTION', taunt: 'TAUNT' },
};

const BASE_LABELS: Readonly<Record<ControlId, string>> = {
  move: 'MOVE', run: 'RUN', quick: 'QUICK', heavy: 'POWER', grapple: 'GRAPPLE', block: 'GUARD', counter: 'COUNTER', jump: 'JUMP', interact: 'PROP', context: 'ACTION', taunt: 'TAUNT',
};

export function buildControlReadout(player: FighterRuntime, opponent: FighterRuntime, speed: number, distance: number, paused: boolean, device: ControlDevice = 'keyboard'): ControlReadout {
  const active = new Set<ControlId>();
  if (player.state === 'locomotion') active.add(speed > 3.75 ? 'run' : 'move');
  if (player.state === 'jumping' || player.state === 'airborne') active.add('jump');
  if (player.state === 'blocking') active.add('block');
  if (player.state === 'grappling') active.add('grapple');
  if (player.state === 'climbing' || player.climbStage > 0) {
    active.add('context');
    if (player.climbStage === 3) active.add('taunt');
  }
  if (player.counterWindow > 0) active.add('counter');
  if (player.heldPropId) active.add('interact');
  if (player.ropeRebound > 0) {
    active.add('run');
    active.add('heavy');
  }

  let state = paused ? 'MATCH PAUSED' : 'READY TO WRESTLE';
  if (!paused && player.moveId) {
    const move = getMove(player.moveId);
    state = `${move.displayName.toUpperCase()} · ${(player.attackPhase ?? player.state).toUpperCase()}`;
    if (move.category === 'quick' || move.category === 'ground') active.add('quick');
    if (move.category === 'heavy' || move.category === 'aerial' || move.category === 'finisher' || move.category === 'prop') active.add('heavy');
    if (move.category === 'grapple') active.add('grapple');
    if (move.id === 'taunt') active.add('taunt');
  } else if (!paused && player.state === 'climbing') {
    state = `TURNBUCKLE CLIMB · STAGE ${player.climbStage} / 3`;
  } else if (!paused && player.ropeRebound > 0) {
    state = 'ROPES LOADED · REBOUND WINDOW OPEN';
  } else if (!paused && player.state === 'jumping') {
    state = 'AIRBORNE · BODY UNDER CONTROL';
  } else if (!paused && player.state === 'blocking') {
    state = 'GUARD UP · REVERSAL READY';
  } else if (!paused && speed > 3.75) {
    state = 'SPRINTING · DRIVE INTO THE ROPES';
  } else if (!paused && speed > 0.2) {
    state = 'MOVING · CAMERA-RELATIVE CONTROL';
  }

  const keys = DEVICE_KEYS[device];
  const actionKey = keys.context;
  let callout = `SPRINT INTO A ROPE → ${keys.heavy} STIFF-ARM`;
  if (paused) callout = 'SIMULATION STOPPED · RESUME TO WRESTLE';
  else if (player.ropeRebound > 0) callout = `${keys.heavy} NOW · LAND THE RAILWAY STIFF-ARM`;
  else if (player.climbStage > 0 && player.climbStage < 3) callout = `${actionKey} AGAIN · CLIMB TO ${player.climbStage === 1 ? 'MIDDLE' : 'TOP'} ROPE`;
  else if (player.climbStage === 3) callout = `${actionKey} DIVE · ${keys.taunt} POSE · MOVE INWARD TO DESCEND`;
  else if (player.momentum >= 100 && ['staggered', 'downed'].includes(opponent.state) && distance < 2.2) callout = `${actionKey} · SIGNATURE FINISHER READY`;
  else if (opponent.state === 'downed' && distance < 1.7) callout = `${actionKey} PIN · ${keys.quick} GROUND STRIKE`;
  else if (player.counterWindow > 0) callout = `${keys.counter} NOW · REVERSE THE ATTACK`;
  else if (distance < 1.8) callout = `${keys.grapple} LOCK UP · DIRECTION + QUICK / POWER / GRAPPLE SELECTS THE THROW`;

  return { active, callout, state };
}

function labelsFor(player: FighterRuntime): Readonly<Record<ControlId, string>> {
  return {
    ...BASE_LABELS,
    heavy: player.ropeRebound > 0 ? 'STIFF-ARM!' : player.heldPropId ? 'SWING PROP' : 'POWER',
    context: player.climbStage > 0 ? player.climbStage === 3 ? 'TOP-ROPE DIVE' : `CLIMB ${player.climbStage + 1}/3` : 'PIN / FINISH',
  };
}

export function ControlDeck({ device, player, opponent, speed, distance, paused }: { device: ControlDevice; player: FighterRuntime; opponent: FighterRuntime; speed: number; distance: number; paused: boolean }) {
  const readout = buildControlReadout(player, opponent, speed, distance, paused, device);
  const labels = labelsFor(player);
  const controls: readonly ControlDefinition[] = (Object.keys(BASE_LABELS) as ControlId[]).map((id) => ({ id, key: DEVICE_KEYS[device][id], label: labels[id] }));

  return <aside className={`control-deck${paused ? ' control-deck--paused' : ''}`} aria-label="Live wrestling controls" data-testid="control-deck" data-control-state={readout.state}>
    <header><span>LIVE WRESTLING CONTROLS · {device.toUpperCase()}</span><b>{readout.state}</b><strong>{readout.callout}</strong></header>
    <ul>{controls.map((control) => <li className={readout.active.has(control.id) ? 'is-active' : ''} data-control={control.id} key={control.id}><kbd>{control.key}</kbd><span>{control.label}</span></li>)}</ul>
  </aside>;
}
