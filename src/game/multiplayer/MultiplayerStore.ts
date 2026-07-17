import { create } from 'zustand';
import { colyseusClient } from './ColyseusClient';
import type { ConnectionStatus, ClientFighterState, ClientRoomState } from './ColyseusClient';
import type { ActionEvent, FighterId } from '@frwf/game-protocol';
import type { ImpactEventMessage, MatchResultMessage } from '@frwf/game-protocol';

interface ReadableStateMap<T> { forEach: (callback: (value: T, key: string) => void) => void }
const copyStateMap = <T>(source: ReadableStateMap<T> | null | undefined): Map<string, T> => {
  const result = new Map<string, T>(); source?.forEach((value, key) => result.set(key, value)); return result;
};

// ──────────────────────────────────────────────────────────────────────────────
// MultiplayerStore — Zustand store for multiplayer connection state.
// Bridges the ColyseusClient events to React/HUD.
// The game logic remains in useMatchStore; this store only tracks network state.
// ──────────────────────────────────────────────────────────────────────────────

export interface MultiplayerState {
  // Connection
  status: ConnectionStatus;
  roomId: string | null;
  sessionId: string | null;
  myRole: 'player1' | 'player2' | 'spectator' | null;

  // Room phase (mirrored from server state)
  roomPhase: string;

  // Synchronized state Maps
  fighters: Map<string, ClientFighterState>;
  roles: Map<string, string>;

  // Latency
  rtt: number;
  lastServerTimestamp: number;
  lastCommandSeq: number;
  lastAckedSeq: number;
  lastSnapshotSeq: number;
  serverElapsed: number;
  serverHype: number;
  serverAnnouncement: string | null;
  lastImpact: ImpactEventMessage | null;
  matchResult: MatchResultMessage | null;

  // Actions
  connect: (roomName?: string, options?: { fighterId?: FighterId; private?: boolean }) => Promise<void>;
  disconnect: () => Promise<void>;
  createPrivateRoom: (options?: { fighterId?: FighterId }) => Promise<string>;
  joinByRoomId: (roomId: string, options?: { fighterId?: FighterId }) => Promise<void>;
  selectFighter: (fighterId: FighterId) => void;
  ready: () => void;
  sendAction: (event: ActionEvent) => void;
  voteRematch: () => void;
}

export const useMultiplayerStore = create<MultiplayerState>((set) => {
  // Wire up ColyseusClient events to Zustand state
  colyseusClient.setEventHandlers({
    onStatusChange: (status) => set({ status }),
    onStateChange: (state: ClientRoomState) => {
      set((current) => {
        const roomFighters = copyStateMap(state.fighters); const fighters = new Map<string, ClientFighterState>();
        roomFighters.forEach((fighter, sessionId) => fighters.set(sessionId, { ...current.fighters.get(sessionId), ...fighter }));
        const roles = copyStateMap(state.roles);
        return {
        roomPhase: state.phase ?? '',
        fighters,
        roles,
        myRole: colyseusClient.sessionId ? (roles.get(colyseusClient.sessionId) as 'player1' | 'player2' | 'spectator' | undefined) ?? null : null,
      }; });
    },
    onSnapshot: (snapshot) => set({
      lastSnapshotSeq: snapshot.seq,
      serverElapsed: snapshot.elapsed,
      serverHype: snapshot.hype,
      serverAnnouncement: snapshot.announcement,
      fighters: new Map(snapshot.fighters.map((fighter) => [fighter.sessionId, {
        definitionId: fighter.definitionId,
        health: fighter.health, stamina: fighter.stamina, momentum: fighter.momentum,
        posX: fighter.posX, posZ: fighter.posZ, facing: fighter.facing,
        velocityX: fighter.velocityX, velocityZ: fighter.velocityZ,
        combatState: fighter.combatState, moveId: fighter.moveId, attackPhase: fighter.attackPhase,
        phaseElapsed: fighter.phaseElapsed, grappleTargetSessionId: fighter.grappleTargetSessionId,
        pinCount: fighter.pinCount, finisherPrimed: fighter.finisherPrimed, lastCommandSeq: fighter.lastCommandSeq,
      }] as const)),
    }),
    onRoomState: (roomState) => set((current) => {
      const fighters = new Map(current.fighters); const roles = new Map<string, string>();
      roomState.fighters.forEach((fighter) => fighters.set(fighter.sessionId, { ...fighters.get(fighter.sessionId), definitionId: fighter.definitionId } as ClientFighterState));
      roomState.roles.forEach(({ sessionId, role }) => roles.set(sessionId, role));
      return {
        roomPhase: roomState.phase,
        fighters,
        roles,
        myRole: current.sessionId ? (roles.get(current.sessionId) as MultiplayerState['myRole']) ?? null : current.myRole,
      };
    }),
    onCommandAck: (ack) => set({ lastAckedSeq: ack.seq, lastServerTimestamp: ack.serverTimestamp }),
    onImpactEvent: (impact) => set({ lastImpact: impact }),
    onMatchResult: (matchResult) => set({ matchResult, roomPhase: 'result' }),
  });

  return {
    status: 'disconnected',
    roomId: null,
    sessionId: null,
    myRole: null,
    roomPhase: 'lobby',
    fighters: new Map(),
    roles: new Map(),
    rtt: 0,
    lastServerTimestamp: 0,
    lastCommandSeq: 0,
    lastAckedSeq: 0,
    lastSnapshotSeq: 0,
    serverElapsed: 0,
    serverHype: 0,
    serverAnnouncement: null,
    lastImpact: null,
    matchResult: null,

    async connect(roomName = 'wrestling', options = {}) {
      await colyseusClient.joinOrCreate(roomName, options);
      set({ roomId: colyseusClient.roomId ?? null, sessionId: colyseusClient.sessionId ?? null, matchResult: null, lastImpact: null });
    },

    async disconnect() {
      await colyseusClient.leave();
      set({ roomId: null, sessionId: null, myRole: null, status: 'disconnected', fighters: new Map(), roles: new Map(), lastSnapshotSeq: 0, lastImpact: null, matchResult: null });
    },

    async createPrivateRoom(options = {}) {
      const id = await colyseusClient.createPrivateRoom(options);
      set({ roomId: id, sessionId: colyseusClient.sessionId ?? null });
      return id;
    },

    async joinByRoomId(roomId, options = {}) {
      await colyseusClient.joinByRoomId(roomId, options);
      set({ roomId: colyseusClient.roomId ?? null, sessionId: colyseusClient.sessionId ?? null });
    },

    selectFighter(fighterId) { colyseusClient.selectFighter(fighterId); },
    ready() { colyseusClient.ready(); },

    sendAction(event) {
      const seq = colyseusClient.sendAction(event);
      set({ lastCommandSeq: seq });
    },

    voteRematch() { colyseusClient.voteRematch(); },
  };
});
