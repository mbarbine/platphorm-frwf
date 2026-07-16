import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import { BATTLE_ROYALE_CAMERA_FRAME, cameraShotIsUrgent, selectCameraShot, usesSteadyBattleRoyaleCamera } from '../camera/cameraDirector';
import type { CameraShot } from '../camera/cameraDirector';
import { getMove } from '../data/moves';
import { useMatchStore } from '../state/matchStore';
import { useSettings } from '../state/settings';
import { FIGHTER_SLOTS } from '../types/game';
import type { FighterSlot } from '../types/game';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import { resolvedSpectatorTarget, useSpectatorStore } from '../state/spectatorStore';

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

  useFrame((_, dt) => {
    if (gl.xr.isPresenting) return;
    elapsed.current += dt;
    const state = useMatchStore.getState();
    const model = state.model;
    const replayActive = state.replayActive;
    const activeRuntimeId = model.runtimeId;
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

    const safeSlotState = (slot: FighterSlot, fallbackX = 0, fallbackZ = 0) => {
      const actor = model[slot];
      return {
        x: safeNumber(actor?.position?.x, fallbackX),
        z: safeNumber(actor?.position?.z, fallbackZ),
        facing: safeNumber(actor?.facing, 0),
        velocityX: safeNumber(actor?.velocity?.x, 0),
        velocityZ: safeNumber(actor?.velocity?.z, 0),
        climbStage: safeNumber(actor?.climbStage, 0),
        state: actor?.state ?? 'idle',
        moveId: actor?.moveId ?? null,
        attackPhase: actor?.attackPhase ?? null,
      };
    };

    const spectating = model.matchMode === 'battle_royale' && model.player.state === 'defeated' && !model.resolved;
    const playerBootstrap = safeSlotState('player', 0, 0);
    const opponentBootstrap = safeSlotState('opponent', playerBootstrap.x + 2.75, playerBootstrap.z + 0.42);
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
      camera.position.lerp(desired, 1 - Math.exp(-dt * 12));
      smoothedTarget.lerp(desiredTarget, 1 - Math.exp(-dt * 12));
      lookAtSafe(camera as PerspectiveCamera, smoothedTarget);
      if ('fov' in camera) {
        const perspective = camera as PerspectiveCamera;
        const targetFov = bootstrapFrame ? bootstrapFrame.fov : 48;
        perspective.fov += (targetFov - perspective.fov) * (1 - Math.exp(-dt * 10));
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

      const targetState = safeSlotState(targetSlot, safeNumber(target?.position?.x, 0), safeNumber(target?.position?.z, 0));
      const resolvedHead = bodyWorksRuntime.segmentSnapshot(targetSlot, 'head')?.position;
      const head = {
        x: safeNumber(resolvedHead?.x, targetState.x),
        y: safeNumber(resolvedHead?.y, 3.58),
        z: safeNumber(resolvedHead?.z, targetState.z),
      };

      const forwardX = Math.sin(targetState.facing);
      const forwardZ = Math.cos(targetState.facing);
      if (spectator.cameraMode === 'first_person') {
        desired.set(head.x + forwardX * 0.3, head.y + 0.02, head.z + forwardZ * 0.3);
        desiredTarget.set(head.x + forwardX * 5, head.y - 0.12, head.z + forwardZ * 5);
      } else {
        desired.set(head.x - forwardX * 5.2, head.y + 2.35, head.z - forwardZ * 5.2);
        desiredTarget.set(head.x + forwardX * 0.55, head.y - 0.32, head.z + forwardZ * 0.55);
      }
      camera.position.lerp(desired, 1 - Math.exp(-dt * (spectator.cameraMode === 'first_person' ? 12 : 5.8)));
      smoothedTarget.lerp(desiredTarget, 1 - Math.exp(-dt * 8.5));
      lookAtSafe(camera as PerspectiveCamera, smoothedTarget);
      if ('fov' in camera) {
        const perspective = camera as PerspectiveCamera;
        const targetFov = spectator.cameraMode === 'first_person' ? 64 : 52;
        perspective.fov += (targetFov - perspective.fov) * (1 - Math.exp(-dt * 7));
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
      camera.position.lerp(desired, 1 - Math.exp(-dt * 5.2));
      smoothedTarget.lerp(desiredTarget, 1 - Math.exp(-dt * 6.4));
      lookAtSafe(camera as PerspectiveCamera, smoothedTarget);
      if ('fov' in camera) {
        const perspective = camera as PerspectiveCamera;
        perspective.fov += (frame.fov - perspective.fov) * (1 - Math.exp(-dt * 6.4));
        perspective.updateProjectionMatrix();
        document.documentElement.dataset.cameraFov = perspective.fov.toFixed(2);
      }
      return;
    }

    const activeSlots: FighterSlot[] = model.matchMode === 'battle_royale'
      ? FIGHTER_SLOTS.filter((slot) => model[slot]?.state !== 'defeated')
      : ['player', 'opponent'];
    const playerTargetSlot = model.targets.player ?? 'opponent';
    const playerTarget = model[playerTargetSlot] ?? model.player;
    const playerTargetState = safeSlotState(playerTargetSlot, 0, 0);

    const framingSlots: FighterSlot[] = model.matchMode === 'battle_royale' && model.player.state !== 'defeated'
      ? ['player', playerTargetSlot]
      : activeSlots;
    const prediction = reduced
      ? 0.06
      : framingSlots.some((slot) => model[slot]?.attackPhase === 'anticipation') ? 0.3 : 0.16;

    const predicted = framingSlots.map((slot) => {
      const slotState = safeSlotState(slot);
      return {
        slot,
        x: boundedPrediction(slotState.x, slotState.velocityX, prediction),
        z: boundedPrediction(slotState.z, slotState.velocityZ, prediction),
      };
    });
    sanitizeVector(desired, 0, 4.45, 0);
    const safePredicted = predicted.length > 0
      ? predicted
      : [{ slot: 'player', x: safeNumber(model.player?.position?.x, 0), z: safeNumber(model.player?.position?.z, 0) }];
    const minimumX = Math.min(...safePredicted.map(({ x }) => safeNumber(x, 0)));
    const maximumX = Math.max(...safePredicted.map(({ x }) => safeNumber(x, 0)));
    const minimumZ = Math.min(...safePredicted.map(({ z }) => safeNumber(z, 0)));
    const maximumZ = Math.max(...safePredicted.map(({ z }) => safeNumber(z, 0)));
    const middleX = (minimumX + maximumX) / 2;
    const middleZ = (minimumZ + maximumZ) / 2;
    const separation = Math.hypot(maximumX - minimumX, maximumZ - minimumZ);

    const player = safeSlotState('player', 0, 0);
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
    const directedShot = selectCameraShot({
      replayActive,
      middleX,
      middleZ,
      separation,
      playerState: model.player.state,
      opponentState: playerTargetState.state,
      playerMoveCategory: playerMove?.category ?? null,
      opponentMoveCategory: opponentMove?.category ?? null,
      securedGrapple,
      playerAttackPhase: model.player.attackPhase,
      opponentAttackPhase: targetEngagingPlayer ? playerTarget.attackPhase : null,
      grapplePhase: playerInGrapple ? model.grapple?.phase ?? null : null,
      tablePosition: table?.position ?? null,
      lastImpactKind: model.lastImpact?.kind ?? null,
    });
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
    const grappleActor = safeSlotState(grappleActorKey, player.x, player.z);
    const grappleDefenderKey = model.grapple?.defender ?? model.targets[grappleActorKey] ?? 'player';
    const grappleDefender = safeSlotState(grappleDefenderKey, grappleActor.x, grappleActor.z);
    const grappleMove = grappleActor.moveId ? getMove(grappleActor.moveId) : null;
    const grapplePhase = model.grapple?.phase ?? null;
    const grappleLift = safeNumber(model.grapple?.lift, 0);
    const maximumAir = Math.max(0, ...activeSlots.map((slot) => safeNumber(model[slot]?.body?.verticalOffset, 0)));

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
        const distance = grappleMove?.category === 'finisher' ? 8.4 : 7.8;
        const height = grappleMove?.category === 'finisher' ? 5.2 : 4.5;
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
        const distance = isPiledriver ? 7.0 : 9.2;
        const baseHeight = isPiledriver ? 2.2 : 3.8;
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
        const attackerSlot = model.player.moveId
          ? 'player'
          : targetEngagingPlayer && playerTarget.moveId
            ? playerTargetSlot
            : activeSlots.find((slot) => model[slot]?.attackPhase === 'active') ?? 'player';
        const attacker = safeSlotState(attackerSlot, player.x, player.z);
        const strikeTargetSlot = model.targets[attackerSlot] ?? (attackerSlot === 'player' ? 'opponent' : 'player');
        const strikeTarget = safeSlotState(strikeTargetSlot, attacker.x, attacker.z);
        const forwardX = Math.sin(attacker.facing);
        const forwardZ = Math.cos(attacker.facing);
        const rightX = forwardZ;
        const rightZ = -forwardX;
        focusX = (attacker.x + strikeTarget.x) * 0.5;
        focusZ = (attacker.z + strikeTarget.z) * 0.5;
        const strikeSeparation = Math.hypot(strikeTarget.x - attacker.x, strikeTarget.z - attacker.z);
        const distance = Math.max(7.4, Math.min(9.1, 7.2 + strikeSeparation * 0.75));
        desired.set(focusX + rightX * distance * shotSide.current - forwardX * 0.35, 4.65, focusZ + rightZ * distance * shotSide.current - forwardZ * 0.35);
        break;
      }
      case 'corner': {
        const climberSlot = activeSlots.find((slot) => model[slot]?.state === 'climbing') ?? 'player';
        const climber = safeSlotState(climberSlot, player.x, player.z);
        const cornerX = Math.sign(climber.x || 1) * 5.45;
        const cornerZ = Math.sign(climber.z || 1) * 3.95;
        const inwardX = -Math.sign(cornerX);
        const inwardZ = -Math.sign(cornerZ);
        desired.set(cornerX - inwardZ * 8.8 * shotSide.current + inwardX * 4.2, 6.55 + climber.climbStage * 0.48, cornerZ + inwardX * 8.8 * shotSide.current + inwardZ * 4.2);
        break;
      }
      case 'aerial': {
        const aerialSlot = activeSlots.find((slot) =>
          model[slot]?.state === 'climbing'
          || model[slot]?.state === 'airborne'
          || (model[slot]?.moveId ? getMove(model[slot].moveId ?? '').category === 'aerial' : false)
        ) ?? 'player';
        const aerialActor = safeSlotState(aerialSlot, player.x, player.z);
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
        const focusX = safeNumber(focus?.x, middleX);
        const focusZ = safeNumber(focus?.z, middleZ);
        desired.set(focusX + shotSide.current * (8.4 + separation * 0.18), 5.25 + separation * 0.12, focusZ + 4.5);
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
              : shot.current === 'grapple' || shot.current === 'slam' || shot.current === 'table'
                ? 4.8
                : 4.6;
    camera.position.lerp(desired, 1 - Math.exp(-dt * positionDamping));
    desiredTarget.set(
      focusX,
      (shot.current === 'grapple' ? 2.7 : shot.current === 'slam' ? 2.45 : shot.current === 'corner' ? 3.05 : shot.current === 'aerial' ? 2.7 : shot.current === 'strike' ? 2.75 : 2.2)
        + maximumAir * 0.34
        + grappleLift * (shot.current === 'slam' ? 0.3 : 0.14),
      focusZ
    );
    sanitizeVector(desiredTarget, middleX, fallbackTargetY, middleZ);
    sanitizeVector(smoothedTarget, middleX, fallbackTargetY, middleZ);
    smoothedTarget.lerp(desiredTarget, 1 - Math.exp(-dt * (reduced ? 4 : 7.2)));
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
      perspective.fov += (desiredFov - perspective.fov) * (1 - Math.exp(-dt * 7.5));
      perspective.updateProjectionMatrix();
    }
  });

  return null;
}
