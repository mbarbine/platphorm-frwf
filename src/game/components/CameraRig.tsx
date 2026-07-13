import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import { getMove } from '../data/moves';
import { useMatchStore } from '../state/matchStore';
import { useSettings } from '../state/settings';

export function CameraRig() {
  const { camera } = useThree(); const target = useMemo(() => new Vector3(), []); const desired = useMemo(() => new Vector3(), []);
  const impactId = useRef(0); const impactImpulse = useRef(0);
  const lastImpact = useMatchStore((state) => state.model.lastImpact); const shake = useSettings((state) => state.shake); const reduced = useSettings((state) => state.reducedMotion);
  useFrame(({ clock }, dt) => {
    const model = useMatchStore.getState().model; const a = model.player.position; const b = model.opponent.position;
    const middleX = (a.x + b.x) / 2; const middleZ = (a.z + b.z) / 2; const separation = Math.hypot(a.x - b.x, a.z - b.z);
    const ringside = Math.max(Math.abs(middleX) / 6, Math.abs(middleZ) / 4.5);
    const playerMove = model.player.moveId ? getMove(model.player.moveId) : null; const opponentMove = model.opponent.moveId ? getMove(model.opponent.moveId) : null;
    const cinematicActor = playerMove && ['grapple', 'finisher'].includes(playerMove.category) ? model.player
      : opponentMove && ['grapple', 'finisher'].includes(opponentMove.category) ? model.opponent : null;
    const cinematicMove = cinematicActor === model.player ? playerMove : cinematicActor === model.opponent ? opponentMove : null;
    if (cinematicActor && cinematicMove && !reduced) {
      const forwardX = Math.sin(cinematicActor.facing); const forwardZ = Math.cos(cinematicActor.facing);
      const rightX = forwardZ; const rightZ = -forwardX; const distance = cinematicMove.category === 'finisher' ? 7.7 : 8.6;
      const firstX = middleX + rightX * distance - forwardX * 2.1; const firstZ = middleZ + rightZ * distance - forwardZ * 2.1;
      const secondX = middleX - rightX * distance - forwardX * 2.1; const secondZ = middleZ - rightZ * distance - forwardZ * 2.1;
      const firstDistance = Math.hypot(camera.position.x - firstX, camera.position.z - firstZ); const secondDistance = Math.hypot(camera.position.x - secondX, camera.position.z - secondZ);
      desired.set(firstDistance <= secondDistance ? firstX : secondX, cinematicMove.category === 'finisher' ? 5.9 : 6.35, firstDistance <= secondDistance ? firstZ : secondZ);
    } else desired.set(middleX * .34, 7.4 + separation * .19 + ringside, middleZ + 11.6 + separation * .52);
    if (lastImpact && lastImpact.id !== impactId.current) { impactId.current = lastImpact.id; impactImpulse.current = lastImpact.intensity; }
    impactImpulse.current = Math.max(0, impactImpulse.current - dt * 4.2);
    const shakeAmount = !reduced ? shake * impactImpulse.current * .075 : 0;
    desired.x += Math.sin(clock.elapsedTime * 57) * shakeAmount; desired.y += Math.cos(clock.elapsedTime * 43) * shakeAmount;
    const damping = reduced ? 2.5 : cinematicActor ? 6.2 : 4.8; camera.position.lerp(desired, 1 - Math.exp(-dt * damping));
    target.set(middleX, cinematicActor ? 2.55 : 2.2, middleZ); camera.lookAt(target);
    if ('fov' in camera) {
      const perspective = camera as PerspectiveCamera;
      const baseFov = cinematicActor ? (cinematicMove?.category === 'finisher' ? 37 : 40) : 44 + Math.min(10, separation * 1.25);
      const desiredFov = baseFov + impactImpulse.current * 1.7 + (model.slowMotion > 0 ? -3 : 0);
      perspective.fov += (desiredFov - perspective.fov) * (1 - Math.exp(-dt * 8)); perspective.updateProjectionMatrix();
    }
  });
  return null;
}
