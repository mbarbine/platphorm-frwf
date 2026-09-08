import { create } from 'zustand';
import { FIGHTERS } from '../data/fighters';
import type { FighterId, Vec2 } from '../types/game';
import { canStandAt, regionAt, WORLD_ENCOUNTERS, WORLD_START } from './showground';
import type { RegionId } from './showground';

const SAVE_KEY = 'frwf.showground.v1';
export interface WorldSave { version: 1; fighter: FighterId; position: Vec2; facing: number; visited: RegionId[]; results: Record<string, { bouts: number; wins: number }> }
export const freshWorld = (fighter: FighterId = 'atlas'): WorldSave => ({ version: 1, fighter, position: { ...WORLD_START }, facing: Math.PI, visited: ['showground'], results: {} });
export function parseWorldSave(raw: string | null): WorldSave {
  try {
    if (!raw || raw.length > 8192) return freshWorld();
    const s = JSON.parse(raw) as Partial<WorldSave>;
    if (s.version !== 1 || !FIGHTERS.some(f => f.id === s.fighter)) return freshWorld();
    const result = freshWorld(s.fighter);
    if (s.position && canStandAt(s.position)) result.position = { x: s.position.x, z: s.position.z };
    if (typeof s.facing === 'number' && Number.isFinite(s.facing)) result.facing = s.facing % (Math.PI * 2);
    result.visited = ['showground', 'backstage', 'ringside'].filter(id => s.visited?.includes(id as RegionId)) as RegionId[];
    if (!result.visited.includes(regionAt(result.position))) result.visited.push(regionAt(result.position));
    for (const encounter of WORLD_ENCOUNTERS) {
      const record = s.results?.[encounter.id];
      if (record && Number.isSafeInteger(record.bouts) && record.bouts >= 0 && record.bouts <= 100000 && Number.isSafeInteger(record.wins) && record.wins >= 0 && record.wins <= record.bouts) result.results[encounter.id] = { bouts: record.bouts, wins: record.wins };
    }
    return result;
  } catch { return freshWorld(); }
}
const readSave = (): WorldSave => { try { return parseWorldSave(localStorage.getItem(SAVE_KEY)); } catch { return freshWorld(); } };
interface WorldState {
  save: WorldSave; saveStatus: 'saved' | 'unavailable'; activeEncounter: string | null;
  enter: (fighter: FighterId) => void;
  move: (position: Vec2, facing: number) => void;
  checkpoint: () => void;
  begin: (id: string) => boolean;
  finish: (won: boolean) => void;
  abandon: () => void;
}
export const useWorldSession = create<WorldState>((set, get) => ({
  save: readSave(), saveStatus: 'saved', activeEncounter: null,
  enter: fighter => { set(state => ({ save: { ...state.save, fighter } })); get().checkpoint(); },
  move: (position, facing) => set(state => {
    const region = regionAt(position);
    return { save: { ...state.save, position, facing, visited: state.save.visited.includes(region) ? state.save.visited : [...state.save.visited, region] } };
  }),
  checkpoint: () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(get().save)); set({ saveStatus: 'saved' }); } catch { set({ saveStatus: 'unavailable' }); } },
  begin: id => {
    if (get().activeEncounter || !WORLD_ENCOUNTERS.some(e => e.id === id && Math.hypot(e.position.x - get().save.position.x, e.position.z - get().save.position.z) <= 2.8)) return false;
    get().checkpoint(); set({ activeEncounter: id }); return true;
  },
  finish: won => {
    const id = get().activeEncounter; if (!id) return;
    set(state => { const before = state.save.results[id] ?? { bouts: 0, wins: 0 }; return { activeEncounter: null, save: { ...state.save, results: { ...state.save.results, [id]: { bouts: Math.min(100000, before.bouts + 1), wins: Math.min(100000, before.wins + (won ? 1 : 0)) } } } }; });
    get().checkpoint();
  },
  abandon: () => { set({ activeEncounter: null }); get().checkpoint(); },
}));
