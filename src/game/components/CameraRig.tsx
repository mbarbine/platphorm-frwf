import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import { getMove } from '../data/moves';
import { useMatchStore } from '../state/matchStore';
import { useSettings } from '../state/settings';

export function CameraRig() {
  const { camera, gl } = useThree(); const target = useMemo(() => new Vector3(), []); const desired = useMemo(() => new Vector3(), []);
  const impactId = useRef(0); const impactImpulse = useRef(0); const elapsed = useRef(0);
  const lastImpact = useMatchStore((state) => state.model.lastImpact); const shake = useSettings((state) => state.shake); const reduced = useSettings((state) => state.reducedMotion);
  useFrame((_, dt) => {
    if (gl.xr.isPresenting) return;
    elapsed.current += dt;
    const state = useMatchStore.getState(); const model = state.model; const replayActive = state.replayActive; const a = model.player.position; const b = model.opponent.position;
    const prediction = reduced ? .08 : model.player.attackPhase === 'anticipation' || model.opponent.attackPhase === 'anticipation' ? .34 : .2;
    const predictedA = { x: a.x + model.player.velocity.x * prediction, z: a.z + model.player.velocity.z * prediction };
    const predictedB = { x: b.x + model.opponent.velocity.x * prediction, z: b.z + model.opponent.velocity.z * prediction };
    const middleX = (predictedA.x + predictedB.x) / 2; const middleZ = (predictedA.z + predictedB.z) / 2; const separation = Math.hypot(predictedA.x - predictedB.x, predictedA.z - predictedB.z);
    const ringside = Math.max(Math.abs(middleX) / 6, Math.abs(middleZ) / 4.5);
    const playerMove = model.player.moveId ? getMove(model.player.moveId) : null; const opponentMove = model.opponent.moveId ? getMove(model.opponent.moveId) : null;
    const securedGrapple = model.grapple && model.grapple.gripCount >= 2 && !['reach', 'acquire', 'failed'].includes(model.grapple.phase) ? model.grapple.attacker : null;
    const cinematicActor = securedGrapple === 'player' && playerMove && ['grapple', 'finisher'].includes(playerMove.category) ? model.player
      : securedGrapple === 'opponent' && opponentMove && ['grapple', 'finisher'].includes(opponentMove.category) ? model.opponent : null;
    const cinematicMove = cinematicActor === model.player ? playerMove : cinematicActor === model.opponent ? opponentMove : null;
    const grapplePhase = cinematicActor ? model.grapple?.phase : null; const grappleLift = cinematicActor ? model.grapple?.lift ?? 0 : 0;
    if (replayActive) {
      const angle = elapsed.current * .58; const radius = 8.4 + separation * .18;
      desired.set(middleX + Math.cos(angle) * radius, 4.8 + Math.sin(angle * .45) * .65, middleZ + Math.sin(angle) * radius);
    } else if (cinematicActor && cinematicMove && !reduced) {
      const forwardX = Math.sin(cinematicActor.facing); const forwardZ = Math.cos(cinematicActor.facing);
      const rightX = forwardZ; const rightZ = -forwardX; const isLiftBeat = grapplePhase === 'load' || grapplePhase === 'lift';
      const distance = cinematicMove.category === 'finisher' ? 7.7 : isLiftBeat ? 7.85 : 8.6;
      const firstX = middleX + rightX * distance - forwardX * 2.1; const firstZ = middleZ + rightZ * distance - forwardZ * 2.1;
      const secondX = middleX - rightX * distance - forwardX * 2.1; const secondZ = middleZ - rightZ * distance - forwardZ * 2.1;
      const firstDistance = Math.hypot(camera.position.x - firstX, camera.position.z - firstZ); const secondDistance = Math.hypot(camera.position.x - secondX, camera.position.z - secondZ);
      desired.set(firstDistance <= secondDistance ? firstX : secondX, cinematicMove.category === 'finisher' ? 5.9 : isLiftBeat ? 5.65 + Math.min(.65, grappleLift * .26) : 6.35, firstDistance <= secondDistance ? firstZ : secondZ);
    } else desired.set(middleX * .34, 7.4 + separation * .19 + ringside, middleZ + 11.6 + separation * .52);
    if (lastImpact && lastImpact.id !== impactId.current) {
      impactId.current = lastImpact.id;
      const hierarchy = lastImpact.kind === 'finisher' || lastImpact.kind === 'ko' ? 1.65 : lastImpact.kind === 'grapple' || lastImpact.kind === 'table' ? 1.35 : lastImpact.kind === 'heavy' || lastImpact.kind === 'weapon' ? 1.12 : lastImpact.kind === 'light' || lastImpact.kind === 'blocked' ? .62 : 1;
      impactImpulse.current = lastImpact.intensity * hierarchy;
    }
    impactImpulse.current = Math.max(0, impactImpulse.current - dt * 4.2);
    const shakeAmount = !reduced ? shake * impactImpulse.current * .075 : 0;
    desired.x += Math.sin(elapsed.current * 57) * shakeAmount; desired.y += Math.cos(elapsed.current * 43) * shakeAmount;
    const damping = reduced ? 2.5 : replayActive ? 3.4 : cinematicActor ? 6.2 : 4.8; camera.position.lerp(desired, 1 - Math.exp(-dt * damping));
    const airborneHeight = Math.max(model.player.body.verticalOffset, model.opponent.body.verticalOffset);
    target.set(middleX, (cinematicActor ? 2.55 : 2.2) + airborneHeight * .34 + grappleLift * .16, middleZ); camera.lookAt(target);
    if ('fov' in camera) {
      const perspective = camera as PerspectiveCamera;
      const baseFov = replayActive ? 39 : cinematicActor ? (cinematicMove?.category === 'finisher' ? 37 : grapplePhase === 'lift' ? 38.5 : 40) : 44 + Math.min(10, separation * 1.25);
      const desiredFov = baseFov + impactImpulse.current * 1.7 + (model.slowMotion > 0 ? -3 : 0);
      perspective.fov += (desiredFov - perspective.fov) * (1 - Math.exp(-dt * 8)); perspective.updateProjectionMatrix();
    }
  });
  return null;
}
