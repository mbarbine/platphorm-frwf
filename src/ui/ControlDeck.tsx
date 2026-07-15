import { getMove } from '../game/data/moves';
import { canTransitionThroughRopes, combatDirection, selectDirectionalGrapple, selectDirectionalStrike } from '../game/systems/combat';
import type { ControlDevice, FighterRuntime, Vec2 } from '../game/types/game';

type ControlId = 'move' | 'run' | 'quick' | 'heavy' | 'grapple' | 'block' | 'counter' | 'jump' | 'interact' | 'context' | 'taunt';

interface ControlDefinition {
  id: ControlId;
  label: string;
  key: string;
}

export interface ControlReadout {
  active: ReadonlySet<ControlId>;
  callout: string;
  labels: Readonly<Record<ControlId, string>>;
  state: string;
}

const DEVICE_KEYS: Readonly<Record<ControlDevice, Readonly<Record<ControlId, string>>>> = {
  keyboard: { move: 'WASD', run: 'SHIFT', quick: 'J', heavy: 'K', grapple: 'L', block: 'I', counter: 'SPACE', jump: 'C', interact: 'E', context: 'F', taunt: 'Q' },
  gamepad: { move: 'L STICK', run: 'RT', quick: 'X / □', heavy: 'Y / △', grapple: 'B / ○', block: 'LT', counter: 'A / ×', jump: 'L3', interact: 'LB', context: 'R3', taunt: 'RB' },
  touch: { move: 'STICK', run: 'RUN', quick: 'QUICK', heavy: 'KICK', grapple: 'BODY SLAM', block: 'GUARD', counter: '↯', jump: 'JUMP', interact: 'PROP', context: 'SPECIAL / PIN', taunt: 'TAUNT' },
};

export const controlPrompt = (device: ControlDevice, control: ControlId): string => DEVICE_KEYS[device][control];

const BASE_LABELS: Readonly<Record<ControlId, string>> = {
  move: 'MOVE', run: 'SPRINT', quick: 'PUNCH', heavy: 'KICK', grapple: 'BODY SLAM', block: 'GUARD (HOLD)', counter: 'DODGE / COUNTER', jump: 'JUMP', interact: 'PROP', context: 'SPECIAL / PIN', taunt: 'TAUNT',
};

const moveLabel = (moveId: string): string => getMove(moveId).displayName.toUpperCase();

export function buildControlLabels(player: FighterRuntime, opponent: FighterRuntime, speed: number, distance: number, direction: Vec2 = { x: 0, z: 0 }, running = false): Readonly<Record<ControlId, string>> {
  const labels: Record<ControlId, string> = { ...BASE_LABELS };
  const nearCorner = Math.abs(player.position.x) > 4.35 && Math.abs(player.position.z) > 2.95;
  const ringside = Math.abs(player.position.x) > 5.82 || Math.abs(player.position.z) > 4.32;
  const clinchCornerDistance = Math.hypot(opponent.position.x - Math.sign(opponent.position.x || player.position.x || 1) * 5.35, opponent.position.z - Math.sign(opponent.position.z || player.position.z || 1) * 3.85);
  const effectiveDirection = Math.hypot(direction.x, direction.z) > .08
    ? direction
    : speed > .08 ? player.velocity : direction;
  const directionId = combatDirection(effectiveDirection);
  const isStanding = ['idle', 'locomotion', 'blocking', 'attacking', 'staggered', 'recovering', 'airborne', 'jumping'].includes(player.state);

  labels.quick = opponent.state === 'downed' ? moveLabel('ground')
    : isStanding && directionId === 'neutral' ? BASE_LABELS.quick
      : moveLabel(selectDirectionalStrike(effectiveDirection, 'quick', player.comboStep));
  labels.heavy = player.heldPropId ? moveLabel('prop')
    : player.ropeRebound > 0
      ? directionId === 'left' ? 'LEFT ARM STIFF-ARM' : directionId === 'right' ? 'RIGHT ARM STIFF-ARM' : moveLabel('stiff_arm')
      : running || speed > 3.6 ? moveLabel('stiff_arm')
        : isStanding && directionId === 'neutral' ? BASE_LABELS.heavy
        : moveLabel(selectDirectionalStrike(effectiveDirection, 'heavy', player.comboStep));

  if (player.state === 'grappling') {
    labels.quick = moveLabel(selectDirectionalGrapple(direction, 'quick'));
    labels.heavy = moveLabel(selectDirectionalGrapple(direction, 'heavy'));
    labels.grapple = moveLabel(selectDirectionalGrapple(direction, 'grapple'));
    labels.context = clinchCornerDistance <= 3.15 ? moveLabel('corner_smash') : 'DRAG CLINCH TO CORNER';
  } else if (player.state === 'climbing') {
    if (player.climbStage === 3) {
      labels.quick = moveLabel('aerial_elbow'); labels.heavy = moveLabel('aerial_kick'); labels.grapple = 'NO LOCK-UP';
      labels.context = moveLabel('aerial'); labels.counter = 'CLIMB DOWN'; labels.taunt = 'TOP-ROPE TAUNT';
    } else {
      labels.quick = 'HOLD BALANCE'; labels.heavy = 'HOLD BALANCE'; labels.grapple = 'NO LOCK-UP';
      labels.context = `CLIMB TO ${player.climbStage === 1 ? 'MIDDLE' : 'TOP'} ROPE`; labels.counter = 'CLIMB DOWN';
    }
  } else if (player.state === 'downed' || player.moveId === 'kick_up') {
    labels.quick = 'NO STRIKE'; labels.heavy = 'NO STRIKE'; labels.grapple = 'NO LOCK-UP'; labels.counter = moveLabel('kick_up'); labels.context = 'RECOVER FIRST';
  } else if (player.state === 'pinned') {
    labels.quick = 'RECOVER'; labels.heavy = 'RECOVER'; labels.grapple = 'RECOVER'; labels.counter = 'KICK OUT'; labels.context = 'KICK OUT';
  } else {
    labels.grapple = distance < 1.8 ? BASE_LABELS.grapple : 'CLOSE DISTANCE';
    if (player.momentum >= 100 && ['staggered', 'downed'].includes(opponent.state) && distance < 2.2) labels.context = 'SIGNATURE FINISHER';
    else if (opponent.state === 'downed' && distance < 1.7) labels.context = 'PIN SHOULDERS';
    else if (nearCorner) labels.context = 'CLIMB TURNBUCKLE';
    else if (canTransitionThroughRopes(player.position)) labels.context = ringside ? 'ENTER CENTER ROPE' : 'EXIT CENTER ROPE';
    else labels.context = BASE_LABELS.context;
  }
  labels.interact = player.heldPropId ? 'DROP / THROW PROP' : 'PICK UP PROP';
  return labels;
}

export function buildControlReadout(player: FighterRuntime, opponent: FighterRuntime, speed: number, distance: number, paused: boolean, device: ControlDevice = 'keyboard', direction: Vec2 = { x: 0, z: 0 }, runHeld = false): ControlReadout {
  const active = new Set<ControlId>();
  const labels = buildControlLabels(player, opponent, speed, distance, direction, runHeld);
  // Detect lift phase so the throw command is discoverable
  const liftMoveIds = new Set(['slam', 'piledriver', 'powerbomb', 'skyhook', 'mountain_drop', 'suplex']);
  const isInLift = player.state === 'grappling' && player.moveId !== null && liftMoveIds.has(player.moveId)
    && player.attackPhase === 'anticipation'
    && player.phaseElapsed > getMove(player.moveId).anticipationDuration * .36;
  const movementHeld = Math.hypot(direction.x, direction.z) > .08;
  if (player.state === 'locomotion' || movementHeld) active.add(runHeld || speed > 3.75 ? 'run' : 'move');
  if (player.state === 'jumping' || player.state === 'airborne') active.add('jump');
  if (player.state === 'blocking') active.add('block');
  if (player.state === 'grappling') active.add('grapple');
  if (player.state === 'climbing' || player.climbStage > 0) {
    active.add('context');
    if (player.climbStage === 3) active.add('taunt');
  }
  if (player.counterWindow > 0 || player.state === 'downed' || player.state === 'pinned') active.add('counter');
  if (player.heldPropId) active.add('interact');
  if (player.ropeRebound > 0) { active.add('run'); active.add('heavy'); }

  let state = paused ? 'MATCH PAUSED' : distance > 5.5 ? 'APPROACH YOUR OPPONENT' : 'READY TO FIGHT';
  if (!paused && player.moveId) {
    const move = getMove(player.moveId);
    const phaseLabel = isInLift ? 'LIFT ACTIVE — THROW OR SLAM' : (player.attackPhase ?? player.state).toUpperCase();
    state = `${move.displayName.toUpperCase()} · ${phaseLabel}`;
    if (move.category === 'quick' || move.category === 'ground') active.add('quick');
    if (move.category === 'heavy' || move.category === 'aerial' || move.category === 'finisher' || move.category === 'prop') active.add('heavy');
    if (move.category === 'grapple') active.add('grapple');
    if (move.id === 'taunt') active.add('taunt');
    if (move.id === 'kick_up') active.add('counter');
  } else if (!paused && player.state === 'downed') state = 'DOWNED · KICK-UP WINDOW OPEN';
  else if (!paused && player.state === 'pinned') state = 'SHOULDERS DOWN · KICK OUT';
  else if (!paused && player.state === 'climbing') state = `TURNBUCKLE CLIMB · STAGE ${player.climbStage} / 3`;
  else if (!paused && player.ropeRebound > 0) state = 'ROPES LOADED · REBOUND WINDOW OPEN';
  else if (!paused && player.state === 'jumping') state = 'AIRBORNE · BODY UNDER CONTROL';
  else if (!paused && player.state === 'blocking') state = 'GUARD UP · REVERSAL READY';
  else if (!paused && (runHeld || speed > 3.75) && movementHeld) state = 'SPRINTING · RUNNING ATTACK READY';
  else if (!paused && (movementHeld || speed > .08)) state = distance < 4.8 && !runHeld ? `${combatDirection(direction).toUpperCase()} STRAFE · OPPONENT LOCKED` : `${combatDirection(direction).toUpperCase()} MOVEMENT · CAMERA-RELATIVE`;

  const keys = DEVICE_KEYS[device]; const actionKey = keys.context; const directionId = combatDirection(direction).toUpperCase();
  const nearCorner = Math.abs(player.position.x) > 4.35 && Math.abs(player.position.z) > 2.95;
  const ringside = Math.abs(player.position.x) > 5.82 || Math.abs(player.position.z) > 4.32;
  const clinchCornerDistance = Math.hypot(opponent.position.x - Math.sign(opponent.position.x || player.position.x || 1) * 5.35, opponent.position.z - Math.sign(opponent.position.z || player.position.z || 1) * 3.85);
  let callout = distance > 5.5
    ? `${keys.move} MOVE · ${keys.run} SPRINT · CLOSE IN THEN ${keys.quick} PUNCH OR ${keys.grapple} BODY SLAM`
    : `${keys.quick} PUNCH · ${keys.heavy} KICK · ${keys.grapple} BODY SLAM · ${keys.jump} JUMP · ${keys.block} GUARD`;
  if (paused) callout = 'SIMULATION STOPPED · RESUME TO WRESTLE';
  else if (player.state === 'pinned') callout = `${keys.counter} RAPIDLY · KICK OUT BEFORE THREE`;
  else if (player.state === 'downed' || player.moveId === 'kick_up') callout = `${keys.counter} · LIVEWIRE KICK-UP`;
  else if (player.ropeRebound > 0) callout = directionId === 'LEFT'
    ? `${keys.heavy} NOW · LEFT ARM STIFF-ARM`
    : directionId === 'RIGHT'
      ? `${keys.heavy} NOW · RIGHT ARM STIFF-ARM`
      : `${keys.heavy} NOW · RAILWAY STIFF-ARM KNOCKDOWN`;
  else if (player.climbStage > 0 && player.climbStage < 3) callout = `${actionKey} AGAIN · CLIMB TO ${player.climbStage === 1 ? 'MIDDLE' : 'TOP'} ROPE · ${keys.counter} DOWN`;
  else if (player.climbStage === 3) callout = `${keys.quick} ELBOW · ${keys.heavy} MISSILE KICK · ${actionKey} DOMEFALL · ${keys.taunt} POSE`;
  else if (isInLift) callout = `${keys.quick} THROW · WASD WALK CARRYING · ${keys.heavy} POWER SLAM`;
  else if (player.state === 'grappling') callout = clinchCornerDistance <= 3.15
    ? `${actionKey} ${labels.context} · ${directionId} CLINCH · ${keys.quick} / ${keys.heavy} / ${keys.grapple} THROW`
    : `${directionId} CLINCH · ${keys.quick} ${labels.quick} · ${keys.heavy} ${labels.heavy} · ${keys.grapple} ${labels.grapple}`;
  else if (player.momentum >= 100 && ['staggered', 'downed'].includes(opponent.state) && distance < 2.2) callout = `${actionKey} · SIGNATURE FINISHER READY`;
  else if (opponent.state === 'downed' && distance < 1.7) callout = `${actionKey} PIN · ${keys.quick} GROUND STRIKE`;
  else if (nearCorner) callout = `${actionKey} · CLIMB LOWER TURNBUCKLE`;
  else if (canTransitionThroughRopes(player.position)) callout = `${actionKey} · ${ringside ? 'ENTER RING' : 'EXIT TO RINGSIDE'} THROUGH CENTER ROPE`;
  else if (!nearCorner && (Math.abs(player.position.x) > 4.1 || Math.abs(player.position.z) > 3.2)) callout = `NEAR ROPES · SPRINT TO REBOUND · ${actionKey} AT APRON TO EXIT RING`;
  else if (player.counterWindow > 0) callout = `${keys.counter} NOW · REVERSE THE ATTACK`;
  else if (distance < 1.8) callout = `${keys.quick} RAPID COMBO · UP+${keys.quick}=CROSS · DOWN+${keys.quick}=KICK · ${keys.grapple} BODY SLAM`;
  else if (distance < 4.8 && movementHeld && !runHeld) callout = `IN RANGE · RAPID ${keys.quick}=JAB→CROSS→KICK · HOLD WASD+${keys.quick}/${keys.heavy} FOR DIRECTIONAL STRIKES`;

  return { active, callout, labels, state };
}

export function ControlDeck({ device, player, opponent, speed, distance, paused, direction = { x: 0, z: 0 }, runHeld = false, contextPreview, propPreview }: { device: ControlDevice; player: FighterRuntime; opponent: FighterRuntime; speed: number; distance: number; paused: boolean; direction?: Vec2; runHeld?: boolean; contextPreview?: string; propPreview?: string }) {
  const readout = buildControlReadout(player, opponent, speed, distance, paused, device, direction, runHeld);
  const controls: readonly ControlDefinition[] = (Object.keys(BASE_LABELS) as ControlId[]).map((id) => ({ id, key: DEVICE_KEYS[device][id], label: readout.labels[id] }));

  return <aside className={`control-deck${paused ? ' control-deck--paused' : ''}`} aria-label="Live wrestling controls" data-testid="control-deck" data-control-state={readout.state} data-control-direction={combatDirection(direction)} data-context-preview={contextPreview ?? ''} data-prop-preview={propPreview ?? ''}>
    <header><span>LIVE WRESTLING CONTROLS · {device.toUpperCase()}</span><b>{readout.state}</b><strong>{contextPreview || propPreview ? `F ${contextPreview ?? 'NO ACTION'} · E ${propPreview ?? 'NO ACTION'}` : readout.callout}</strong></header>
    <ul>{controls.map((control) => <li className={readout.active.has(control.id) ? 'is-active' : ''} data-control={control.id} data-move-label={control.label} key={control.id}><kbd>{control.key}</kbd><span>{control.label}</span></li>)}</ul>
  </aside>;
}
