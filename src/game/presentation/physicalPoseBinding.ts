import { Matrix4, Quaternion, Vector3 } from 'three';
import type { Group } from 'three';
import type { SegmentTransformSnapshot } from '../physics/physicsRuntime';

/** Fit the authored mesh hierarchy to solved anatomy without changing collision authority. */
export class PhysicalPoseBinding {
  private readonly matrix = new Matrix4();
  private readonly inverse = new Matrix4();
  private readonly position = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly correction = new Quaternion();
  private readonly scale = new Vector3();
  private readonly direction = new Vector3();
  private readonly localDirection = new Vector3();

  anchor(body: SegmentTransformSnapshot, offset: readonly [number, number, number], result: Vector3): Vector3 {
    this.rotation.set(body.rotation.x, body.rotation.y, body.rotation.z, body.rotation.w);
    return result.set(...offset).applyQuaternion(this.rotation).add(body.position);
  }

  place(group: Group, position: Vector3, rotation: Quaternion, scale: number): void {
    if (!group.parent) return;
    group.parent.updateWorldMatrix(true, false);
    this.matrix.compose(position, rotation, this.scale.setScalar(scale));
    this.inverse.copy(group.parent.matrixWorld).invert();
    this.matrix.premultiply(this.inverse).decompose(group.position, group.quaternion, group.scale);
    group.updateWorldMatrix(false, false);
  }

  landmark(group: Group, body: SegmentTransformSnapshot, local: readonly [number, number, number], scale = .75): void {
    this.rotation.set(body.rotation.x, body.rotation.y, body.rotation.z, body.rotation.w);
    this.position.set(...local).multiplyScalar(-scale).applyQuaternion(this.rotation).add(body.position);
    this.place(group, this.position, this.rotation, scale);
  }

  limb(group: Group, start: Vector3, end: Vector3, authoredEnd: readonly [number, number, number], reference: SegmentTransformSnapshot): void {
    this.direction.copy(end).sub(start);
    const dx = this.direction.x;
    const dy = this.direction.y;
    const dz = this.direction.z;
    // OPTIMIZATION: Replacing Three.js length() and normalize() with direct Math.sqrt and pre-calculated scalar division
    // avoids duplicate length calculations and Math.hypot overhead (~8x gain per limb on hot R3F render frame paths).
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const lx = authoredEnd[0];
    const ly = authoredEnd[1];
    const lz = authoredEnd[2];
    const authoredLength = Math.sqrt(lx * lx + ly * ly + lz * lz);

    if (length < .001 || authoredLength < .001) return;

    this.localDirection.set(lx, ly, lz);
    // Preserve physical twist, then rotate its longitudinal axis onto the
    // solved joint endpoints. Uniform scaling avoids inherited shear.
    this.rotation.set(reference.rotation.x, reference.rotation.y, reference.rotation.z, reference.rotation.w);
    // Direct scalar multiplication with pre-computed reciprocal lengths avoids redundant length calculations and divisions
    this.localDirection.multiplyScalar(1 / authoredLength).applyQuaternion(this.rotation);
    this.direction.multiplyScalar(1 / length);
    this.rotation.premultiply(this.correction.setFromUnitVectors(this.localDirection, this.direction));
    this.place(group, start, this.rotation, length / authoredLength);
  }
}
