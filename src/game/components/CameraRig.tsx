import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import { BATTLE_ROYALE_CAMERA_FRAME, cameraShotIsUrgent, selectCameraShot, usesSteadyBattleRoyaleCamera } from '../camera/cameraDirector';
import type { CameraShot, CameraDirectorContext } from '../camera/cameraDirector';
import { getMove } from '../data/moves';
import { useMatchStore } from '../state/matchStore';
import { useSettings } from '../state/settings';
import { FIGHTER_SLOTS } from '../types/game';
import type { FighterSlot, FighterState, MatchModel } from '../types/game';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import { resolvedSpectatorTarget, useSpectatorStore } from '../state/spectatorStore';
import { isRingside } from '../physics/ringDynamics';

const isFiniteNumber = (value: unknown): value is number => Number.isFinite(value as number);
const safeNumber = (value: unknown, fallback: number): number => isFiniteNumber(value) ? value : fallback;
const boundedPrediction = (position: number, velocity: number, seconds: number): number => {
  const safePosition = safeNumber(position, 0);
  const safeVelocity = safeNumber(velocity, 0);
  return safePosition + Math.max(-1.25, Math.min(1.25, safeVelocity * seconds));
};
const sanitizeVector = (vector: Vector3, fallbackX: number, fallbackY: number, fallbackZ: number): Vector3 => {
  vector.x = safeNumber(vector.x, fallbackX);
  vector.y = safeNumber(vector.y, fallbackY);
  vector.z = safeNumber(vector.z, fallbackZ);
  return vector;
};
const lookAtSafe = (camera: PerspectiveCamera | Pick<{ lookAt: (target: Vector3) => void }, 'lookAt'>, target: Vector3): void => {
  if (Number.isFinite(target.x) && Number.isFinite(target.y) && Number.isFinite(target.z)) {
    camera.lookAt(target);
  }
};

interface CachedSlotState {
  x: number;
  z: number;
  facing: number;
  velocityX: number;
  velocityZ: number;
  climbStage: number;
  state: FighterState;
  moveId: string | null;
  attackPhase: string | null;
}

const updateSlotState = (
  cache: Record<FighterSlot, CachedSlotState>,
  model: MatchModel,
  slot: FighterSlot,
  fallbackX = 0,
  fallbackZ = 0
): CachedSlotState => {
  const actor = model[slot];
  const cached = cache[slot];
  cached.x = safeNumber(actor?.position?.x, fallbackX);
  cached.z = safeNumber(actor?.position?.z, fallbackZ);
  cached.facing = safeNumber(actor?.facing, 0);
  cached.velocityX = safeNumber(actor?.velocity?.x, 0);
  cached.velocityZ = safeNumber(actor?.velocity?.z, 0);
  cached.climbStage = safeNumber(actor?.climbStage, 0);
  cached.state = actor?.state ?? 'idle';
  cached.moveId = actor?.moveId ?? null;
  cached.attackPhase = actor?.attackPhase ?? null;
  return cached;
};

export function CameraRig() {
  const { camera, gl } = useThree();
  const desired = useMemo(() => new Vector3(), []);
  const desiredTarget = useMemo(() => new Vector3(), []);
  const smoothedTarget = useMemo(() => new Vector3(0, 2.2, 0), []);
  const impactId = useRef(0);
  const impactImpulse = useRef(0);
  const elapsed = useRef(0);
  const shot = useRef<CameraShot>('broadcast');
  const shotChangedAt = useRef(0);
  const lastRuntimeId = useRef(-1);
  const bootstrapFrames = useRef(0);
  const shotSide = useRef<1 | -1>(1);
  const shake = useSettings((state) => state.shake);
  const reduced = useSettings((state) => state.reducedMotion);
  const cameraCuts = useSettings((state) => state.cameraCuts);

  // Pre-allocated states/caches to eliminate high-frequency GC allocations inside useFrame
  const slotStateCache = useRef<Record<FighterSlot, CachedSlotState>>({
    player: { x: 0, z: 0, facing: 0, velocityX: 0, velocityZ: 0, climbStage: 0, state: 'idle', moveId: null, attackPhase: null },
    opponent: { x: 0, z: 0, facing: 0, velocityX: 0, velocityZ: 0, climbStage: 0, state: 'idle', moveId: null, attackPhase: null },
    rival1: { x: 0, z: 0, facing: 0, velocityX: 0, velocityZ: 0, climbStage: 0, state: 'idle', moveId: null, attackPhase: null },
    rival2: { x: 0, z: 0, facing: 0, velocityX: 0, velocityZ: 0, climbStage: 0, state: 'idle', moveId: null, attackPhase: null },
    rival3: { x: 0, z: 0, facing: 0, velocityX: 0, velocityZ: 0, climbStage: 0, state: 'idle', moveId: null, attackPhase: null },
  });

  const activeSlotsRef = useRef<FighterSlot[]>(['player', 'opponent', 'rival1', 'rival2', 'rival3']);
  const framingSlotsRef = useRef<FighterSlot[]>(['player', 'opponent', 'rival1', 'rival2', 'rival3']);

  const cameraDirectorContextRef = useRef<CameraDirectorContext>({
    replayActive: false,
    middleX: 0,
    middleZ: 0,
    separation: 0,
    playerState: 'idle',
    opponentState: 'idle',
    playerMoveCategory: null,
    opponentMoveCategory: null,
    playerAttackPhase: null,
    opponentAttackPhase: null,
    securedGrapple: false,
    grapplePhase: null,
    tablePosition: null,
    lastImpactKind: null,
  });

  useFrame((_, dt) => {
    if (gl.xr.isPresenting) return;
    elapsed.current += dt;
    const state = useMatchStore.getState();
    const model = state.model;
    const replayActive = state.replayActive;
    const activeRuntimeId = model.runtimeId;

    // Stable interpolation: clamp frame delta to guard against sudden framerate drops or lag spikes
    const clampedDt = Math.min(dt, 0.1);

    if (activeRuntimeId !== lastRuntimeId.current) {
      lastRuntimeId.current = activeRuntimeId;
      bootstrapFrames.current = 0;
      shot.current = model.matchMode === 'battle_royale' ? 'battle-royale-steady' : 'broadcast';
      shotChangedAt.current = 0;
      impactId.current = 0;
      impactImpulse.current = 0;
    }
    sanitizeVector(camera.position, 0, 4.45, 0);
    const isBootstrapping = bootstrapFrames.current < 6;

    const spectating = model.matchMode === 'battle_royale' && model.player.state === 'defeated' && !model.resolved;
    const playerBootstrap = updateSlotState(slotStateCache.current, model, 'player', 0, 0);
    const opponentBootstrap = updateSlotState(slotStateCache.current, model, 'opponent', playerBootstrap.x + 2.75, playerBootstrap.z + 0.42);
    const bootstrapLookX = (playerBootstrap.x + opponentBootstrap.x) / 2;
    const bootstrapLookZ = (playerBootstrap.z + opponentBootstrap.z) / 2;
    const bootstrapDistance = model.matchMode === 'battle_royale' ? 17.5 : 8.6;
    const bootstrapHeight = model.matchMode === 'battle_royale' ? 8.1 : 7.8;

    if (isBootstrapping && !spectating) {
      bootstrapFrames.current += 1;
      const bootstrapFrame = model.matchMode === 'battle_royale'
        ? BATTLE_ROYALE_CAMERA_FRAME
        : null;
      desired.set(
        bootstrapFrame ? bootstrapFrame.position.x : bootstrapLookX - 0.62 * bootstrapDistance,
        bootstrapFrame ? bootstrapFrame.position.y : bootstrapHeight,
        bootstrapFrame ? bootstrapFrame.position.z : bootstrapLookZ + bootstrapDistance,
      );
      desiredTarget.set(
        bootstrapFrame ? bootstrapFrame.target.x : bootstrapLookX,
        bootstrapFrame ? bootstrapFrame.target.y : 2.25,
        bootstrapFrame ? bootstrapFrame.target.z : bootstrapLookZ,
      );
      sanitizeVector(desired, 0, bootstrapHeight, 12.6);
      sanitizeVector(desiredTarget, bootstrapLookX, 2.25, bootstrapLookZ);
      if (bootstrapFrames.current === 1) {
        // A slow GPU must not spend several seconds interpolating from the
        // default camera while the player sees only cropped boots.
        camera.position.copy(desired); smoothedTarget.copy(desiredTarget);
      } else {
        camera.position.lerp(desired, 1 - Math.exp(-clampedDt * 12));
        smoothedTarget.lerp(desiredTarget, 1 - Math.exp(-clampedDt * 12));
      }
      lookAtSafe(camera as PerspectiveCamera, smoothedTarget);
      if ('fov' in camera) {
        const perspective = camera as PerspectiveCamera;
        const targetFov = bootstrapFrame ? bootstrapFrame.fov : 48;
        perspective.fov += (targetFov - perspective.fov) * (1 - Math.exp(-clampedDt * 10));
        perspective.updateProjectionMatrix();
        document.documentElement.dataset.cameraFov = perspective.fov.toFixed(2);
      }
      return;
    }

    if (spectating) {
      const spectator = useSpectatorStore.getState();
      const targetSlot = resolvedSpectatorTarget(model, spectator.target);
      const target = model[targetSlot];
      document.documentElement.dataset.cameraShot = `spectator-${spectator.cameraMode}`;
      if (spectator.cameraMode === 'free') return;

      const targetState = updateSlotState(slotStateCache.current, model, targetSlot, safeNumber(target?.position?.x, 0), safeNumber(target?.position?.z, 0));
      const resolvedHead = bodyWorksRuntime.segmentSnapshot(targetSlot, 'head')?.position;
      const headX = safeNumber(resolvedHead?.x, targetState.x);
      const headY = safeNumber(resolvedHead?.y, 3.58);
      const headZ = safeNumber(resolvedHead?.z, targetState.z);

      const forwardX = Math.sin(targetState.facing);
      const forwardZ = Math.cos(targetState.facing);
      if (spectator.cameraMode === 'first_person') {
        // Spectator first-person is an eye-line camera, not a rigid-body debug
        // camera. Clamp it above the local floor and look level so a transient
        // crouch or noisy head snapshot cannot leave the viewer at boot height.
        const floorY = isRingside(target.position) ? 0 : 1.5;
        const eyeY = Math.max(headY + .12, floorY + 1.82);
        desired.set(headX + forwardX * 0.38, eyeY, headZ + forwardZ * 0.38);
        desiredTarget.set(headX + forwardX * 5, eyeY + .03, headZ + forwardZ * 5);
      } else {
        desired.set(headX - forwardX * 5.2, headY + 2.35, headZ - forwardZ * 5.2);
        desiredTarget.set(headX + forwardX * 0.55, headY - 0.32, headZ + forwardZ * 0.55);
      }
      camera.position.lerp(desired, 1 - Math.exp(-clampedDt * (spectator.cameraMode === 'first_person' ? 12 : 5.8)));
      smoothedTarget.lerp(desiredTarget, 1 - Math.exp(-clampedDt * 8.5));
      document.documentElement.dataset.spectatorCameraY = camera.position.y.toFixed(3);
      document.documentElement.dataset.spectatorTargetY = smoothedTarget.y.toFixed(3);
      lookAtSafe(camera as PerspectiveCamera, smoothedTarget);
      if ('fov' in camera) {
        const perspective = camera as PerspectiveCamera;
        const targetFov = spectator.cameraMode === 'first_person' ? 64 : 52;
        perspective.fov += (targetFov - perspective.fov) * (1 - Math.exp(-clampedDt * 7));
        perspective.updateProjectionMatrix();
      }
      return;
    }

    if (usesSteadyBattleRoyaleCamera(model.matchMode)) {
      const frame = BATTLE_ROYALE_CAMERA_FRAME;
      shot.current = 'battle-royale-steady';
      document.documentElement.dataset.cameraShot = shot.current;
      desired.set(frame.position.x, frame.position.y, frame.position.z);
      desiredTarget.set(frame.target.x, frame.target.y, frame.target.z);
      camera.position.lerp(desired, 1 - Math.exp(-clampedDt * 5.2));
      smoothedTarget.lerp(desiredTarget, 1 - Math.exp(-clampedDt * 6.4));
      lookAtSafe(camera as PerspectiveCamera, smoothedTarget);
      if ('fov' in camera) {
        const perspective = camera as PerspectiveCamera;
        perspective.fov += (frame.fov - perspective.fov) * (1 - Math.exp(-clampedDt * 6.4));
        perspective.updateProjectionMatrix();
        document.documentElement.dataset.cameraFov = perspective.fov.toFixed(2);
      }
      return;
    }

    // Populate active slots without allocating arrays
    let activeSlotsCount = 0;
    if (model.matchMode === 'battle_royale') {
      for (let i = 0; i < FIGHTER_SLOTS.length; i++) {
        const slot = FIGHTER_SLOTS[i] as FighterSlot;
        if (model[slot]?.state !== 'defeated') {
          activeSlotsRef.current[activeSlotsCount++] = slot;
        }
      }
    } else {
      activeSlotsRef.current[0] = 'player';
      activeSlotsRef.current[1] = 'opponent';
      activeSlotsCount = 2;
    }

    const playerTargetSlot = model.targets.player ?? 'opponent';
    const playerTarget = model[playerTargetSlot] ?? model.player;
    const playerTargetState = updateSlotState(slotStateCache.current, model, playerTargetSlot, 0, 0);

    // Populate framing slots without allocating arrays
    let framingSlotsCount: number;
    if (model.matchMode === 'battle_royale' && model.player.state !== 'defeated') {
      framingSlotsRef.current[0] = 'player';
      framingSlotsRef.current[1] = playerTargetSlot;
      framingSlotsCount = 2;
    } else {
      for (let i = 0; i < activeSlotsCount; i++) {
        framingSlotsRef.current[i] = activeSlotsRef.current[i] as FighterSlot;
      }
      framingSlotsCount = activeSlotsCount;
    }

    const prediction = reduced
      ? 0.06
      : (model.player?.attackPhase === 'anticipation' || (playerTargetSlot && model[playerTargetSlot]?.attackPhase === 'anticipation')) ? 0.3 : 0.16;

    // Direct O(N) single-pass calculations for min/max positions with absolutely 0 allocation pressure
    let minimumX = Infinity;
    let maximumX = -Infinity;
    let minimumZ = Infinity;
    let maximumZ = -Infinity;

    if (framingSlotsCount > 0) {
      for (let i = 0; i < framingSlotsCount; i++) {
        const slot = framingSlotsRef.current[i] as FighterSlot;
        const slotState = updateSlotState(slotStateCache.current, model, slot);
        const predX = boundedPrediction(slotState.x, slotState.velocityX, prediction);
        const predZ = boundedPrediction(slotState.z, slotState.velocityZ, prediction);
        if (predX < minimumX) minimumX = predX;
        if (predX > maximumX) maximumX = predX;
        if (predZ < minimumZ) minimumZ = predZ;
        if (predZ > maximumZ) maximumZ = predZ;
      }
    } else {
      const fallbackX = safeNumber(model.player?.position?.x, 0);
      const fallbackZ = safeNumber(model.player?.position?.z, 0);
      minimumX = fallbackX;
      maximumX = fallbackX;
      minimumZ = fallbackZ;
      maximumZ = fallbackZ;
    }

    const middleX = (minimumX + maximumX) / 2;
    const middleZ = (minimumZ + maximumZ) / 2;
    const separation = Math.hypot(maximumX - minimumX, maximumZ - minimumZ);

    const player = updateSlotState(slotStateCache.current, model, 'player', 0, 0);
    const playerState = model.player;
    const playerMove = playerState?.moveId ? getMove(playerState.moveId) : null;
    const targetEngagingPlayer = model.targets[playerTargetSlot] === 'player'
      || Boolean(model.grapple && [model.grapple.attacker, model.grapple.defender].includes('player')
        && [model.grapple.attacker, model.grapple.defender].includes(playerTargetSlot));
    const opponentMove = targetEngagingPlayer && playerTarget?.moveId ? getMove(playerTarget.moveId) : null;
    const playerInGrapple = Boolean(model.grapple && (model.grapple.attacker === 'player' || model.grapple.defender === 'player'));
    const securedGrapple = Boolean(
      playerInGrapple
      && model.grapple
      && model.grapple.gripCount >= 2
      && !['reach', 'acquire', 'failed'].includes(model.grapple.phase)
    );

    const table = model.props.find((prop) => prop.kind === 'table' && !prop.broken) ?? null;

    // Use pre-allocated context to completely eliminate garbage collection overhead inside useFrame
    const ctx = cameraDirectorContextRef.current;
    ctx.replayActive = replayActive;
    ctx.middleX = middleX;
    ctx.middleZ = middleZ;
    ctx.separation = separation;
    ctx.playerState = model.player.state;
    ctx.opponentState = playerTargetState.state;
    ctx.playerMoveCategory = playerMove?.category ?? null;
    ctx.opponentMoveCategory = opponentMove?.category ?? null;
    ctx.securedGrapple = securedGrapple;
    ctx.playerAttackPhase = model.player.attackPhase;
    ctx.opponentAttackPhase = targetEngagingPlayer ? playerTarget.attackPhase : null;
    ctx.grapplePhase = playerInGrapple ? model.grapple?.phase ?? null : null;
    ctx.tablePosition = table?.position ?? null;
    ctx.lastImpactKind = model.lastImpact?.kind ?? null;

    const directedShot = selectCameraShot(ctx);

    const playerEngaged = replayActive
      || playerInGrapple
      || model.player.moveId !== null
      || ['grappling', 'grabbed', 'climbing', 'airborne', 'jumping', 'pinning', 'pinned'].includes(model.player.state);
    const battleShot = directedShot;
    const requestedShot = cameraCuts === 'off' && battleShot !== 'replay'
      ? model.matchMode === 'battle_royale' ? 'wide' : 'broadcast'
      : battleShot;
    const cutInterval = cameraCuts === 'reduced' ? 1.8 : 0.72;
    const urgent = (cameraCuts === 'full' && cameraShotIsUrgent(requestedShot)) || requestedShot === 'replay';
    if (requestedShot !== shot.current && (urgent || elapsed.current - shotChangedAt.current >= cutInterval)) {
      shot.current = requestedShot;
      shotChangedAt.current = elapsed.current;
      document.documentElement.dataset.cameraShot = requestedShot;
    }

    const grappleActorKey = model.grapple?.attacker ?? 'player';
    const grappleActor = updateSlotState(slotStateCache.current, model, grappleActorKey, player.x, player.z);
    const grappleDefenderKey = model.grapple?.defender ?? model.targets[grappleActorKey] ?? 'player';
    const grappleDefender = updateSlotState(slotStateCache.current, model, grappleDefenderKey, grappleActor.x, grappleActor.z);
    const grappleMove = grappleActor.moveId ? getMove(grappleActor.moveId) : null;
    const grapplePhase = model.grapple?.phase ?? null;
    const grappleLift = safeNumber(model.grapple?.lift, 0);

    // Compute maximum air time without dynamic array mapping or allocations
    let maximumAir = 0;
    for (let i = 0; i < activeSlotsCount; i++) {
      const slot = activeSlotsRef.current[i] as FighterSlot;
      const offset = safeNumber(model[slot]?.body?.verticalOffset, 0);
      if (offset > maximumAir) {
        maximumAir = offset;
      }
    }

    let focusX = middleX;
    let focusZ = middleZ;
    switch (shot.current) {
      case 'replay': {
        const angle = elapsed.current * 0.5;
        const radius = 9.2 + separation * 0.2;
        desired.set(middleX + Math.cos(angle) * radius, 5.1 + Math.sin(angle * 0.42) * 0.55, middleZ + Math.sin(angle) * radius);
        break;
      }
      case 'grapple': {
        const forwardX = Math.sin(grappleActor.facing);
        const forwardZ = Math.cos(grappleActor.facing);
        const rightX = forwardZ;
        const rightZ = -forwardX;
        // Cinematic: Closer, tighter grapple camera angle to pull player into the grapple struggle
        const distance = grappleMove?.category === 'finisher' ? 7.8 : 7.2;
        const height = grappleMove?.category === 'finisher' ? 4.6 : 3.8;
        focusX = (grappleActor.x + grappleDefender.x) * 0.5;
        focusZ = (grappleActor.z + grappleDefender.z) * 0.5;
        desired.set(focusX + rightX * distance * shotSide.current - forwardX * 1.2, height, focusZ + rightZ * distance * shotSide.current - forwardZ * 1.2);
        break;
      }
      case 'slam': {
        const forwardX = Math.sin(grappleActor.facing);
        const forwardZ = Math.cos(grappleActor.facing);
        const rightX = forwardZ;
        const rightZ = -forwardX;
        const isPiledriver = grappleActor.moveId === 'piledriver';
        const peakLift = grapplePhase === 'lift'
          ? Math.min(isPiledriver ? 2.2 : 1.6, grappleLift * (isPiledriver ? 1 : 0.72))
          : 0;
        // Keep the lift and landing above the foreground rope plane. A low
        // ringside angle hid the carried body behind the middle rope.
        const distance = isPiledriver ? 6.2 : 8.1;
        const baseHeight = isPiledriver ? 4.15 : 5.15;
        focusX = (grappleActor.x + grappleDefender.x) * 0.5;
        focusZ = (grappleActor.z + grappleDefender.z) * 0.5;
        desired.set(
          focusX + rightX * distance * shotSide.current - forwardX * (isPiledriver ? 0.3 : 0.65),
          baseHeight + peakLift,
          focusZ + rightZ * distance * shotSide.current - forwardZ * (isPiledriver ? 0.3 : 0.65),
        );
        break;
      }
      case 'strike': {
        let attackerSlot: FighterSlot = 'player';
        if (model.player.moveId) {
          attackerSlot = 'player';
        } else if (targetEngagingPlayer && playerTarget.moveId) {
          attackerSlot = playerTargetSlot;
        } else {
          for (let i = 0; i < activeSlotsCount; i++) {
            const slot = activeSlotsRef.current[i] as FighterSlot;
            if (model[slot]?.attackPhase === 'active') {
              attackerSlot = slot;
              break;
            }
          }
        }
        const attacker = updateSlotState(slotStateCache.current, model, attackerSlot, player.x, player.z);
        const strikeTargetSlot = model.targets[attackerSlot] ?? (attackerSlot === 'player' ? 'opponent' : 'player');
        const strikeTarget = updateSlotState(slotStateCache.current, model, strikeTargetSlot, attacker.x, attacker.z);
        const forwardX = Math.sin(attacker.facing);
        const forwardZ = Math.cos(attacker.facing);
        const rightX = forwardZ;
        const rightZ = -forwardX;
        focusX = (attacker.x + strikeTarget.x) * 0.5;
        focusZ = (attacker.z + strikeTarget.z) * 0.5;
        const strikeSeparation = Math.hypot(strikeTarget.x - attacker.x, strikeTarget.z - attacker.z);
        // Cinematic: Lower standard strike camera from 4.65 to 3.85, and tighten the shot to amplify strike impact
        const distance = Math.max(6.5, Math.min(8.2, 6.2 + strikeSeparation * 0.6));
        desired.set(focusX + rightX * distance * shotSide.current - forwardX * 0.35, 3.85, focusZ + rightZ * distance * shotSide.current - forwardZ * 0.35);
        break;
      }
      case 'corner': {
        // Find climber slot without array allocations
        let climberSlot: FighterSlot = 'player';
        for (let i = 0; i < activeSlotsCount; i++) {
          const slot = activeSlotsRef.current[i] as FighterSlot;
          if (model[slot]?.state === 'climbing') {
            climberSlot = slot;
            break;
          }
        }
        const climber = updateSlotState(slotStateCache.current, model, climberSlot, player.x, player.z);
        const cornerX = Math.sign(climber.x || 1) * 5.45;
        const cornerZ = Math.sign(climber.z || 1) * 3.95;
        const inwardX = -Math.sign(cornerX);
        const inwardZ = -Math.sign(cornerZ);
        desired.set(cornerX - inwardZ * 8.8 * shotSide.current + inwardX * 4.2, 6.55 + climber.climbStage * 0.48, cornerZ + inwardX * 8.8 * shotSide.current + inwardZ * 4.2);
        break;
      }
      case 'aerial': {
        // Find aerial slot without array allocations
        let aerialSlot: FighterSlot = 'player';
        for (let i = 0; i < activeSlotsCount; i++) {
          const slot = activeSlotsRef.current[i] as FighterSlot;
          const actor = model[slot];
          if (actor) {
            const hasAerialCategory = actor.moveId ? getMove(actor.moveId).category === 'aerial' : false;
            if (actor.state === 'climbing' || actor.state === 'airborne' || hasAerialCategory) {
              aerialSlot = slot;
              break;
            }
          }
        }
        const aerialActor = updateSlotState(slotStateCache.current, model, aerialSlot, player.x, player.z);
        const forwardX = Math.sin(aerialActor.facing);
        const forwardZ = Math.cos(aerialActor.facing);
        const rightX = forwardZ;
        const rightZ = -forwardX;
        desired.set(
          middleX + rightX * 8.8 * shotSide.current - forwardX * 5.3,
          7.7 + maximumAir * 0.48,
          middleZ + rightZ * 8.8 * shotSide.current - forwardZ * 5.3,
        );
        break;
      }
      case 'table': {
        const focus = table?.position ?? model.lastImpact?.position ?? { x: middleX, z: middleZ };
        const focusXVal = safeNumber(focus?.x, middleX);
        const focusZVal = safeNumber(focus?.z, middleZ);
        desired.set(focusXVal + shotSide.current * (8.4 + separation * 0.18), 5.25 + separation * 0.12, focusZVal + 4.5);
        break;
      }
      case 'ringside-z': {
        const edge = (Math.sign(middleZ) || 1) as 1 | -1;
        desired.set(middleX + shotSide.current * (8.7 + separation * 0.22), 5.8 + separation * 0.18, middleZ + edge * 5.1);
        break;
      }
      case 'ringside-x': {
        const edge = (Math.sign(middleX) || 1) as 1 | -1;
        desired.set(middleX + edge * 5.5, 5.8 + separation * 0.18, middleZ + shotSide.current * (8.5 + separation * 0.22));
        break;
      }
      case 'wide':
        desired.set(
          middleX * 0.18,
          (model.matchMode === 'battle_royale' ? 11.1 : 9.8) + separation * 0.22,
          middleZ + (model.matchMode === 'battle_royale' ? 15.1 : 13.6) + separation * 0.55
        );
        break;
      default: {
        const lineX = playerTargetState.x - player.x;
        const lineZ = playerTargetState.z - player.z;
        const lineLength = Math.max(0.001, Math.hypot(lineX, lineZ));
        const sideX = lineZ / lineLength;
        const sideZ = -lineX / lineLength;
        const distance = 6.25 + Math.min(1.35, separation * 0.38);
        desired.set(middleX + sideX * distance * shotSide.current, 4.45 + separation * 0.14, middleZ + sideZ * distance * shotSide.current);
        break;
      }
    }

    const fallbackTargetY = 2.2 + maximumAir * 0.35;
    const fallbackRadius = Math.max(3.4, 4.2 + Math.min(1.3, Math.hypot(middleX, middleZ)));
    sanitizeVector(desired, middleX + Math.cos(elapsed.current) * fallbackRadius, 4.25 + maximumAir * 0.4, middleZ + Math.sin(elapsed.current) * fallbackRadius);
    const impact = model.lastImpact;
    if (impact && impact.id !== impactId.current) {
      impactId.current = impact.id;
      const hierarchy = impact.kind === 'finisher' || impact.kind === 'ko'
        ? 1.5
        : impact.kind === 'grapple' || impact.kind === 'table'
          ? 1.22
          : impact.kind === 'heavy' || impact.kind === 'weapon'
            ? 1.02
            : impact.kind === 'light' || impact.kind === 'blocked'
              ? 0.5
              : 0.85;
      const playerPositionX = safeNumber(model.player?.position?.x, player.x);
      const playerPositionZ = safeNumber(model.player?.position?.z, player.z);
      const impactPositionX = safeNumber(impact.position?.x, playerPositionX);
      const impactPositionZ = safeNumber(impact.position?.z, playerPositionZ);
      const battleImpactRelevant = model.matchMode !== 'battle_royale'
        || playerEngaged
        || Math.hypot(impactPositionX - playerPositionX, impactPositionZ - playerPositionZ) < 2.4;
      impactImpulse.current = battleImpactRelevant ? impact.intensity * hierarchy : 0;
      const isMajorStrike = (impact.kind === 'heavy' || impact.kind === 'counter' || impact.kind === 'weapon') && impact.intensity >= 1.3;
      if (battleImpactRelevant && isMajorStrike && !['slam', 'aerial', 'grapple', 'replay'].includes(shot.current) && cameraCuts === 'full') {
        shot.current = 'strike';
        shotChangedAt.current = elapsed.current;
        document.documentElement.dataset.cameraShot = 'strike';
      }
    }

    impactImpulse.current = Math.max(0, impactImpulse.current - dt * 4.8);
    // BLOCKBUSTER: Enhanced screen shake multiplier from 0.042 to 0.084 for a heavier feel on impact
    const shakeMult = model.matchMode === 'singles' ? 1.5 : 1.0;
    const shakeAmount = !reduced ? shake * impactImpulse.current * 0.084 * shakeMult : 0;
    desired.x += Math.sin(elapsed.current * 53) * shakeAmount;
    desired.y += Math.cos(elapsed.current * 41) * shakeAmount * 0.7;
    desired.z += Math.sin(elapsed.current * 47) * shakeAmount * 0.45;

    const positionDamping = reduced
      ? 2.8
      : shot.current === 'replay'
        ? 3.1
        : shot.current === 'wide'
          ? 3.4
          : shot.current === 'strike'
            ? 11.5
            : shot.current === 'aerial' || shot.current === 'corner'
              ? 4.2
              : shot.current === 'slam'
                ? 14
                : shot.current === 'grapple' || shot.current === 'table'
                  ? 8
                : 4.6;
    camera.position.lerp(desired, 1 - Math.exp(-clampedDt * positionDamping));
    desiredTarget.set(
      focusX,
      (shot.current === 'grapple' ? 2.7 : shot.current === 'slam' ? 2.45 : shot.current === 'corner' ? 3.05 : shot.current === 'aerial' ? 2.7 : shot.current === 'strike' ? 2.75 : 2.2)
        + maximumAir * 0.34
        + grappleLift * (shot.current === 'slam' ? 0.3 : 0.14),
      focusZ
    );
    sanitizeVector(desiredTarget, middleX, fallbackTargetY, middleZ);
    sanitizeVector(smoothedTarget, middleX, fallbackTargetY, middleZ);
    smoothedTarget.lerp(desiredTarget, 1 - Math.exp(-clampedDt * (reduced ? 4 : 7.2)));
    lookAtSafe(camera as PerspectiveCamera, smoothedTarget);

    if ('fov' in camera) {
      const perspective = camera as PerspectiveCamera;
      const baseFov = shot.current === 'replay'
        ? 39
        : shot.current === 'grapple'
          ? grappleMove?.category === 'finisher'
            ? 40
            : 43
          : shot.current === 'slam'
            ? (grappleActor.moveId === 'piledriver' ? 32 : 40)
            : shot.current === 'strike'
              ? 43
              : shot.current === 'corner'
                ? 46
                : shot.current === 'aerial'
                  ? 43
                  : shot.current === 'table'
                    ? 41
                    : shot.current === 'wide'
                      ? 50
                      : shot.current.startsWith('ringside')
                        ? 46
                        : 44 + Math.min(9, separation * 1.15);
      const fovModifier = (model.matchMode === 'singles' && ['grapple', 'slam', 'strike'].includes(shot.current)) ? -4 : 0;
      const pinInProgress = FIGHTER_SLOTS.some((slot) => model[slot]?.state === 'pinned');
      const nearfallZoom = (model.matchMode === 'singles' && pinInProgress) ? -6 : 0;
      const singlesFovOffset = fovModifier + nearfallZoom;
      const desiredFov = Math.max(
        model.matchMode === 'battle_royale' && shot.current === 'wide' ? 53 : 0,
        baseFov + singlesFovOffset + impactImpulse.current * 1.15 + (model.slowMotion > 0 ? -2.5 : 0),
      );
      perspective.fov += (desiredFov - perspective.fov) * (1 - Math.exp(-clampedDt * 7.5));
      perspective.updateProjectionMatrix();
    }
  });

  return null;
}
