import type { FighterSlot as FighterKey } from '../types/game';

export type MotionTaskStatus = 'starting' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface MotionTask {
  id: string;
  moveId: string;
  actorId: FighterKey;
  targetId?: FighterKey;
  attackInstanceId: number;
  phaseId: string;
  elapsed: number;
  maximumDuration: number;
  status: MotionTaskStatus;
  ownedGripIds: string[];
  ownedPlantIds: string[];
}

export interface MotionTaskRequest {
  actorId: FighterKey;
  targetId?: FighterKey;
  moveId: string;
  attackInstanceId: number;
  maximumDuration: number;
  phaseId: string;
}

export interface MotionTaskUpdate { timedOut: readonly MotionTask[]; completed: readonly MotionTask[] }

/** One bounded high-level task per fighter; no task can wait forever. */
export class MotionTaskRunner {
  private readonly tasks = new Map<FighterKey, MotionTask>();

  request(request: MotionTaskRequest): MotionTask {
    const current = this.tasks.get(request.actorId);
    if (current?.attackInstanceId === request.attackInstanceId && current.moveId === request.moveId) return current;
    if (current) current.status = 'cancelled';
    const task: MotionTask = {
      id: `${request.actorId}:${request.moveId}:${request.attackInstanceId}`,
      moveId: request.moveId,
      actorId: request.actorId,
      targetId: request.targetId,
      attackInstanceId: request.attackInstanceId,
      phaseId: request.phaseId,
      elapsed: 0,
      maximumDuration: Math.max(.1, request.maximumDuration),
      status: 'starting',
      ownedGripIds: [],
      ownedPlantIds: [],
    };
    this.tasks.set(request.actorId, task);
    return task;
  }

  setPhase(actor: FighterKey, phaseId: string): void {
    const task = this.tasks.get(actor); if (!task) return;
    task.phaseId = phaseId; task.status = 'running';
  }

  ownGrip(actor: FighterKey, gripId: string): void {
    const task = this.tasks.get(actor); if (task && !task.ownedGripIds.includes(gripId)) task.ownedGripIds.push(gripId);
  }

  releaseGrip(actor: FighterKey, gripId: string): void {
    const task = this.tasks.get(actor); if (!task) return;
    const index = task.ownedGripIds.indexOf(gripId); if (index >= 0) task.ownedGripIds.splice(index, 1);
  }

  complete(actor: FighterKey): MotionTask | null {
    const task = this.tasks.get(actor); if (!task) return null;
    task.status = 'completed'; this.tasks.delete(actor); return task;
  }

  cancel(actor: FighterKey): MotionTask | null {
    const task = this.tasks.get(actor); if (!task) return null;
    task.status = 'cancelled'; this.tasks.delete(actor); return task;
  }

  update(dt: number): MotionTaskUpdate {
    const timedOut: MotionTask[] = []; const completed: MotionTask[] = [];
    for (const [actor, task] of this.tasks) {
      task.elapsed += dt;
      if (task.elapsed <= task.maximumDuration) continue;
      task.status = 'failed'; timedOut.push(task); this.tasks.delete(actor);
    }
    return { timedOut, completed };
  }

  active(actor: FighterKey): MotionTask | null { return this.tasks.get(actor) ?? null; }
  clear(): void { for (const task of this.tasks.values()) task.status = 'cancelled'; this.tasks.clear(); }
  get size(): number { return this.tasks.size; }
}
