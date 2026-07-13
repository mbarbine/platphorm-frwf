import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import { useMatchStore } from '../state/matchStore';
import { useSettings } from '../state/settings';

export function CameraRig() {
  const { camera } = useThree(); const target = useMemo(() => new Vector3(), []); const desired = useMemo(() => new Vector3(), []);
  const lastImpact = useMatchStore((state) => state.model.lastImpact); const shake = useSettings((state) => state.shake); const reduced = useSettings((state) => state.reducedMotion);
  useFrame(({ clock }, dt) => {
    const model = useMatchStore.getState().model; const a = model.player.position; const b = model.opponent.position;
    const middleX = (a.x + b.x) / 2; const middleZ = (a.z + b.z) / 2; const separation = Math.hypot(a.x - b.x, a.z - b.z);
    const ringside = Math.max(Math.abs(middleX) / 6, Math.abs(middleZ) / 4.5);
    desired.set(middleX * .34, 7.4 + separation * .19 + ringside, middleZ + 11.6 + separation * .52);
    const shakeAmount = !reduced && model.hitStop > 0 ? shake * (lastImpact?.intensity ?? 0) * .05 : 0;
    desired.x += Math.sin(clock.elapsedTime * 57) * shakeAmount; desired.y += Math.cos(clock.elapsedTime * 43) * shakeAmount;
    const damping = reduced ? 2.5 : 4.8; camera.position.lerp(desired, 1 - Math.exp(-dt * damping));
    target.set(middleX, 1.55, middleZ); camera.lookAt(target);
    if ('fov' in camera) { const perspective = camera as PerspectiveCamera; const desiredFov = 44 + Math.min(10, separation * 1.25) + (model.slowMotion > 0 ? -4 : 0); perspective.fov += (desiredFov - perspective.fov) * (1 - Math.exp(-dt * 7)); perspective.updateProjectionMatrix(); }
  });
  return null;
}
