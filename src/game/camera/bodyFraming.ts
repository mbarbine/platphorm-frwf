export interface FramingPoint { x: number; y: number; z: number }
export interface FramingBounds { min: FramingPoint; max: FramingPoint }

/** Distance along a fixed broadcast sightline that contains every body landmark.
 * The inset reserves space for the HUD and for limbs between physics samples.
 */
export function bodyFramingDistance(bounds: FramingBounds, target: FramingPoint, fov: number, aspect: number, yaw = 0): number {
  const pitch = Math.PI / 8;
  const sin = Math.sin(pitch); const cos = Math.cos(pitch);
  const safeFov = Number.isFinite(fov) && fov > 0 ? fov : 48;
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1.7778;
  const vertical = Math.tan(Math.max(20, Math.min(90, safeFov)) * Math.PI / 360) * .72;
  const horizontal = vertical * Math.max(.3, safeAspect);
  let distance = 6.8;
  const safeTargetX = Number.isFinite(target.x) ? target.x : 0;
  const safeTargetY = Number.isFinite(target.y) ? target.y : 2.2;
  const safeTargetZ = Number.isFinite(target.z) ? target.z : 0;

  const minX = Number.isFinite(bounds.min.x) ? bounds.min.x : safeTargetX - 2;
  const maxX = Number.isFinite(bounds.max.x) ? bounds.max.x : safeTargetX + 2;
  const minY = Number.isFinite(bounds.min.y) ? bounds.min.y : safeTargetY - 1;
  const maxY = Number.isFinite(bounds.max.y) ? bounds.max.y : safeTargetY + 1;
  const minZ = Number.isFinite(bounds.min.z) ? bounds.min.z : safeTargetZ - 2;
  const maxZ = Number.isFinite(bounds.max.z) ? bounds.max.z : safeTargetZ + 2;

  for (let corner = 0; corner < 8; corner++) {
    const dx = (corner & 1 ? maxX : minX) - safeTargetX;
    const dy = (corner & 2 ? maxY : minY) - safeTargetY;
    const dz = (corner & 4 ? maxZ : minZ) - safeTargetZ;
    const across = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    const forward = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    const depth = dy * sin + forward * cos;
    const up = dy * cos - forward * sin;
    distance = Math.max(distance, Math.abs(across) / horizontal + depth, Math.abs(up) / vertical + depth);
  }
  return Number.isFinite(distance) ? Math.max(4.5, Math.min(68.0, distance)) : 6.8;
}

export function placeBroadcastCamera(position: FramingPoint, target: FramingPoint, distance: number, yaw = 0): void {
  position.x = target.x + Math.sin(yaw) * Math.cos(Math.PI / 8) * distance;
  position.y = target.y + Math.sin(Math.PI / 8) * distance;
  position.z = target.z + Math.cos(yaw) * Math.cos(Math.PI / 8) * distance;
}
