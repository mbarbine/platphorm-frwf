import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import { cameraShotIsUrgent, selectCameraShot } from '../camera/cameraDirector';
import type { CameraShot } from '../camera/cameraDirector';
import { getMove } from '../data/moves';
import { useMatchStore } from '../state/matchStore';
import { useSettings } from '../state/settings';

const boundedPrediction = (position: number, velocity: number, seconds: number): number => position + Math.max(-1.25, Math.min(1.25, velocity * seconds));

export function CameraRig() {
  const { camera, gl } = useThree();
  const desired = useMemo(() => new Vector3(), []); const desiredTarget = useMemo(() => new Vector3(), []); const smoothedTarget = useMemo(() => new Vector3(0, 2.2, 0), []);
  const impactId = useRef(0); const impactImpulse = useRef(0); const elapsed = useRef(0);
  const shot = useRef<CameraShot>('broadcast'); const shotChangedAt = useRef(0); const shotSide = useRef<1 | -1>(1);
  const shake = useSettings((state) => state.shake); const reduced = useSettings((state) => state.reducedMotion);
  const cameraCuts = useSettings((state) => state.cameraCuts);

  useFrame((_, dt) => {
    if (gl.xr.isPresenting) return;
    elapsed.current += dt;
    const state = useMatchStore.getState(); const model = state.model; const replayActive = state.replayActive;
    const prediction = reduced ? .06 : model.player.attackPhase === 'anticipation' || model.opponent.attackPhase === 'anticipation' ? .3 : .16;
    const predictedA = { x: boundedPrediction(model.player.position.x, model.player.velocity.x, prediction), z: boundedPrediction(model.player.position.z, model.player.velocity.z, prediction) };
    const predictedB = { x: boundedPrediction(model.opponent.position.x, model.opponent.velocity.x, prediction), z: boundedPrediction(model.opponent.position.z, model.opponent.velocity.z, prediction) };
    const middleX = (predictedA.x + predictedB.x) / 2; const middleZ = (predictedA.z + predictedB.z) / 2;
    const separation = Math.hypot(predictedA.x - predictedB.x, predictedA.z - predictedB.z);
    const playerMove = model.player.moveId ? getMove(model.player.moveId) : null; const opponentMove = model.opponent.moveId ? getMove(model.opponent.moveId) : null;
    const securedGrapple = Boolean(model.grapple && model.grapple.gripCount >= 2 && !['reach', 'acquire', 'failed'].includes(model.grapple.phase));
    const table = model.props.find((prop) => prop.kind === 'table' && !prop.broken) ?? null;
    const directedShot = selectCameraShot({
      replayActive, middleX, middleZ, separation, playerState: model.player.state, opponentState: model.opponent.state,
      playerMoveCategory: playerMove?.category ?? null, opponentMoveCategory: opponentMove?.category ?? null, securedGrapple,
      playerAttackPhase: model.player.attackPhase, opponentAttackPhase: model.opponent.attackPhase, grapplePhase: model.grapple?.phase ?? null,
      tablePosition: table?.position ?? null, lastImpactKind: model.lastImpact?.kind ?? null,
    });
    const requestedShot = cameraCuts === 'off' && directedShot !== 'replay' ? 'broadcast' : directedShot;
    const cutInterval = cameraCuts === 'reduced' ? 1.8 : .72;
    const urgent = (cameraCuts === 'full' && cameraShotIsUrgent(requestedShot)) || requestedShot === 'replay';
    if (requestedShot !== shot.current && (urgent || elapsed.current - shotChangedAt.current >= cutInterval)) {
      shot.current = requestedShot; shotChangedAt.current = elapsed.current;
      document.documentElement.dataset.cameraShot = requestedShot;
    }

    const grappleActorKey = model.grapple?.attacker ?? 'player'; const grappleActor = model[grappleActorKey];
    const grappleMove = grappleActor.moveId ? getMove(grappleActor.moveId) : null; const grapplePhase = model.grapple?.phase ?? null; const grappleLift = model.grapple?.lift ?? 0;
    const maximumAir = Math.max(model.player.body.verticalOffset, model.opponent.body.verticalOffset);
    switch (shot.current) {
      case 'replay': {
        const angle = elapsed.current * .5; const radius = 9.2 + separation * .2;
        desired.set(middleX + Math.cos(angle) * radius, 5.1 + Math.sin(angle * .42) * .55, middleZ + Math.sin(angle) * radius);
        break;
      }
      case 'grapple': {
        const forwardX = Math.sin(grappleActor.facing); const forwardZ = Math.cos(grappleActor.facing); const rightX = forwardZ; const rightZ = -forwardX;
        const distance = grappleMove?.category === 'finisher' ? 8.4 : 7.8;
        const height = grappleMove?.category === 'finisher' ? 5.2 : 4.5;
        desired.set(middleX + rightX * distance * shotSide.current - forwardX * 2.8, height, middleZ + rightZ * distance * shotSide.current - forwardZ * 2.8);
        break;
      }
      case 'slam': {
        const forwardX = Math.sin(grappleActor.facing); const forwardZ = Math.cos(grappleActor.facing); const rightX = forwardZ; const rightZ = -forwardX;
        const isPiledriver = grappleActor.moveId === 'piledriver';
        const peakLift = grapplePhase === 'lift' ? Math.min(isPiledriver ? 2.2 : 1.6, grappleLift * (isPiledriver ? 1.0 : .72)) : 0;
        const distance = isPiledriver ? 7.0 : 9.2;
        // Piledriver: camera near ground looking UP at the inversion — the most dramatic shot
        const baseHeight = isPiledriver ? 2.2 : 3.8;
        desired.set(middleX + rightX * distance * shotSide.current - forwardX * (isPiledriver ? .6 : 1.15), baseHeight + peakLift, middleZ + rightZ * distance * shotSide.current - forwardZ * (isPiledriver ? .6 : 1.15));
        break;
      }
      case 'strike': {
        const attacker = model.player.attackPhase === 'active' ? model.player : model.opponent;
        const forwardX = Math.sin(attacker.facing); const forwardZ = Math.cos(attacker.facing); const rightX = forwardZ; const rightZ = -forwardX;
        desired.set(middleX + rightX * 9.7 * shotSide.current - forwardX * 3.2, 5.35, middleZ + rightZ * 9.7 * shotSide.current - forwardZ * 3.2);
        break;
      }
      case 'corner': {
        const climber = model.player.state === 'climbing' ? model.player : model.opponent;
        const cornerX = Math.sign(climber.position.x || 1) * 5.45; const cornerZ = Math.sign(climber.position.z || 1) * 3.95;
        const inwardX = -Math.sign(cornerX); const inwardZ = -Math.sign(cornerZ);
        desired.set(cornerX - inwardZ * 8.8 * shotSide.current + inwardX * 4.2, 6.55 + climber.climbStage * .48, cornerZ + inwardX * 8.8 * shotSide.current + inwardZ * 4.2);
        break;
      }
      case 'aerial': {
        const aerialActor = model.player.state === 'climbing' || model.player.state === 'airborne' || playerMove?.category === 'aerial' ? model.player : model.opponent;
        const forwardX = Math.sin(aerialActor.facing); const forwardZ = Math.cos(aerialActor.facing); const rightX = forwardZ; const rightZ = -forwardX;
        desired.set(middleX + rightX * 8.8 * shotSide.current - forwardX * 5.3, 7.7 + maximumAir * .48, middleZ + rightZ * 8.8 * shotSide.current - forwardZ * 5.3);
        break;
      }
      case 'table': {
        const focus = table?.position ?? model.lastImpact?.position ?? { x: middleX, z: middleZ };
        desired.set(focus.x + shotSide.current * (8.4 + separation * .18), 5.25 + separation * .12, focus.z + 4.5);
        break;
      }
      case 'ringside-z': {
        const edge = (Math.sign(middleZ) || 1) as 1 | -1;
        desired.set(middleX + shotSide.current * (8.7 + separation * .22), 5.8 + separation * .18, middleZ + edge * 5.1);
        break;
      }
      case 'ringside-x': {
        const edge = (Math.sign(middleX) || 1) as 1 | -1;
        desired.set(middleX + edge * 5.5, 5.8 + separation * .18, middleZ + shotSide.current * (8.5 + separation * .22));
        break;
      }
      case 'wide':
        desired.set(middleX * .18, 9.8 + separation * .22, middleZ + 13.6 + separation * .55);
        break;
      default:
        desired.set(middleX * .3, 7.35 + separation * .2, middleZ + 11.7 + separation * .5);
    }

    const impact = model.lastImpact;
    if (impact && impact.id !== impactId.current) {
      impactId.current = impact.id;
      const hierarchy = impact.kind === 'finisher' || impact.kind === 'ko' ? 1.5 : impact.kind === 'grapple' || impact.kind === 'table' ? 1.22 : impact.kind === 'heavy' || impact.kind === 'weapon' ? 1.02 : impact.kind === 'light' || impact.kind === 'blocked' ? .5 : .85;
      impactImpulse.current = impact.intensity * hierarchy;
      // Force cut to strike camera on major heavy or counter impacts
      const isMajorStrike = (impact.kind === 'heavy' || impact.kind === 'counter' || impact.kind === 'weapon') && impact.intensity >= 1.3;
      if (isMajorStrike && !['slam', 'aerial', 'grapple', 'replay'].includes(shot.current) && cameraCuts === 'full') {
        shot.current = 'strike'; shotChangedAt.current = elapsed.current;
        document.documentElement.dataset.cameraShot = 'strike';
      }
    }
    impactImpulse.current = Math.max(0, impactImpulse.current - dt * 4.8);
    const shakeAmount = !reduced ? shake * impactImpulse.current * .042 : 0;
    desired.x += Math.sin(elapsed.current * 53) * shakeAmount; desired.y += Math.cos(elapsed.current * 41) * shakeAmount * .7; desired.z += Math.sin(elapsed.current * 47) * shakeAmount * .45;

    const positionDamping = reduced ? 2.8 : shot.current === 'replay' ? 3.1 : shot.current === 'wide' ? 3.4 : shot.current === 'aerial' || shot.current === 'corner' ? 4.2 : shot.current === 'grapple' || shot.current === 'slam' || shot.current === 'table' ? 4.8 : 4.6;
    camera.position.lerp(desired, 1 - Math.exp(-dt * positionDamping));
    desiredTarget.set(middleX, (shot.current === 'grapple' ? 2.7 : shot.current === 'slam' ? 2.45 : shot.current === 'corner' ? 3.05 : shot.current === 'aerial' ? 2.7 : 2.2) + maximumAir * .34 + grappleLift * (shot.current === 'slam' ? .3 : .14), middleZ);
    smoothedTarget.lerp(desiredTarget, 1 - Math.exp(-dt * (reduced ? 4 : 7.2))); camera.lookAt(smoothedTarget);
    if ('fov' in camera) {
      const perspective = camera as PerspectiveCamera;
      const baseFov = shot.current === 'replay' ? 39 : shot.current === 'grapple' ? grappleMove?.category === 'finisher' ? 40 : 43
        : shot.current === 'slam' ? (grappleActor?.moveId === 'piledriver' ? 32 : 40) : shot.current === 'strike' ? 43 : shot.current === 'corner' ? 46 : shot.current === 'aerial' ? 43 : shot.current === 'table' ? 41 : shot.current === 'wide' ? 50 : shot.current.startsWith('ringside') ? 46 : 44 + Math.min(9, separation * 1.15);
      const desiredFov = baseFov + impactImpulse.current * 1.15 + (model.slowMotion > 0 ? -2.5 : 0);
      perspective.fov += (desiredFov - perspective.fov) * (1 - Math.exp(-dt * 7.5)); perspective.updateProjectionMatrix();
    }
  });
  return null;
}
