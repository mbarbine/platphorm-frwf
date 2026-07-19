import type { WebGLRenderer } from 'three';

export interface RenderDiagnosticsSnapshot {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  shaderPrograms: number;
  frameP50Ms: number;
  frameP95Ms: number;
  frameP99Ms: number;
  framesOver100Ms: number;
  sampleCount: number;
}

const FRAME_CAPACITY = 360;
const frames = new Float32Array(FRAME_CAPACITY);
const scratch = new Float32Array(FRAME_CAPACITY);
let cursor = 0;
let size = 0;
let samplesSincePercentiles = 0;

export const renderDiagnostics: RenderDiagnosticsSnapshot = {
  drawCalls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
  shaderPrograms: 0,
  frameP50Ms: 0,
  frameP95Ms: 0,
  frameP99Ms: 0,
  framesOver100Ms: 0,
  sampleCount: 0,
};

const percentile = (sorted: Float32Array, fraction: number): number => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))] ?? 0;

export function sampleRenderDiagnostics(renderer: WebGLRenderer, frameSeconds: number): void {
  const frameMs = Math.min(1_000, Math.max(0, frameSeconds * 1_000));
  frames[cursor] = frameMs;
  cursor = (cursor + 1) % FRAME_CAPACITY;
  size = Math.min(FRAME_CAPACITY, size + 1);
  renderDiagnostics.drawCalls = renderer.info.render.calls;
  renderDiagnostics.triangles = renderer.info.render.triangles;
  renderDiagnostics.geometries = renderer.info.memory.geometries;
  renderDiagnostics.textures = renderer.info.memory.textures;
  renderDiagnostics.shaderPrograms = renderer.info.programs?.length ?? 0;
  renderDiagnostics.sampleCount = size;
  samplesSincePercentiles += 1;
  if (samplesSincePercentiles < 30 && size > 1) return;
  samplesSincePercentiles = 0;
  scratch.set(frames.subarray(0, size), 0);
  const sorted = scratch.subarray(0, size); sorted.sort();
  renderDiagnostics.frameP50Ms = percentile(sorted, .5);
  renderDiagnostics.frameP95Ms = percentile(sorted, .95);
  renderDiagnostics.frameP99Ms = percentile(sorted, .99);
  let framesOver100Ms = 0;
  for (let index = 0; index < size; index += 1) if ((sorted[index] ?? 0) > 100) framesOver100Ms += 1;
  renderDiagnostics.framesOver100Ms = framesOver100Ms;
}

export function resetRenderDiagnostics(): void {
  frames.fill(0); scratch.fill(0); cursor = 0; size = 0; samplesSincePercentiles = 0;
  Object.assign(renderDiagnostics, { drawCalls: 0, triangles: 0, geometries: 0, textures: 0, shaderPrograms: 0, frameP50Ms: 0, frameP95Ms: 0, frameP99Ms: 0, framesOver100Ms: 0, sampleCount: 0 });
}
