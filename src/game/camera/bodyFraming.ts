export interface FramingPoint { x: number; y: number; z: number }
export interface FramingBounds { min: FramingPoint; max: FramingPoint }

/** Distance along a fixed broadcast sightline that contains every body landmark.
 * The inset reserves space for the HUD and for limbs between physics samples.
 */
export function bodyFramingDistance(bounds: FramingBounds, target: FramingPoint, fov: number, aspect: number): number {
  const pitch = Math.PI / 8;
  const sin = Math.sin(pitch); const cos = Math.cos(pitch);
  const vertical = Math.tan(Math.max(20, Math.min(90, fov)) * Math.PI / 360) * .72;
  const horizontal = vertical * Math.max(.3, aspect);
  let distance = 7.8;
  for (let corner = 0; corner < 8; corner++) {
    const dx = (corner & 1 ? bounds.max.x : bounds.min.x) - target.x;
    const dy = (corner & 2 ? bounds.max.y : bounds.min.y) - target.y;
    const dz = (corner & 4 ? bounds.max.z : bounds.min.z) - target.z;
    const depth = dy * sin + dz * cos;
    const up = dy * cos - dz * sin;
    distance = Math.max(distance, Math.abs(dx) / horizontal + depth, Math.abs(up) / vertical + depth);
  }
  return distance;
}

export function placeBroadcastCamera(position: FramingPoint, target: FramingPoint, distance: number): void {
  position.x = target.x;
  position.y = target.y + Math.sin(Math.PI / 8) * distance;
  position.z = target.z + Math.cos(Math.PI / 8) * distance;
}
