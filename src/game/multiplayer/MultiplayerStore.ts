import { create } from 'zustand';
import { colyseusClient } from './ColyseusClient';
import type { ConnectionStatus, ClientFighterState, ClientRoomState } from './ColyseusClient';
import type { ActionEvent, FighterId } from '@frwf/game-protocol';
import type { ImpactEventMessage, LobbyChatEventMessage, MatchResultMessage } from '@frwf/game-protocol';

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
  joinInvite: string | null;
  hostSessionId: string | null;
  myRole: 'player1' | 'player2' | 'player3' | 'player4' | 'player5' | 'player6' | 'spectator' | null;

  // Room phase (mirrored from server state)
  roomPhase: string;
  ruleset: 'standard' | 'chaos';

  // Synchronized state Maps
  fighters: Map<string, ClientFighterState>;
  roles: Map<string, string>;
  connected: Map<string, boolean>;
  readyPlayers: Map<string, boolean>;
  lobbyChat: LobbyChatEventMessage[];

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
  createPrivateRoom: (options?: { fighterId?: FighterId; ruleset?: 'standard' | 'chaos' }) => Promise<string>;
  joinByRoomId: (roomId: string, options?: { fighterId?: FighterId }) => Promise<void>;
  selectFighter: (fighterId: FighterId) => void;
  ready: () => void;
  setReady: (ready: boolean) => void;
  startMatch: () => void;
  sendLobbyChat: (text: string) => void;
  sendAction: (event: ActionEvent) => void;
  voteRematch: () => void;
  updateRoomSettings: (ruleset: 'standard' | 'chaos') => void;
}

export const useMultiplayerStore = create<MultiplayerState>((set) => {
  // Wire up ColyseusClient events to Zustand state
  colyseusClient.setEventHandlers({
    onStatusChange: (status) => set({ status, ...(status === 'connecting' ? { sessionId: null, myRole: null } : {}) }),
    onWelcome: ({ sessionId, roomId }) => set(state => ({ sessionId, roomId, myRole: (state.roles.get(sessionId) as MultiplayerState['myRole']) ?? null })),
    onStateChange: (state: ClientRoomState) => {
      set((current) => {
        const roomFighters = copyStateMap(state.fighters); const fighters = new Map<string, ClientFighterState>();
        roomFighters.forEach((fighter, sessionId) => fighters.set(sessionId, { ...current.fighters.get(sessionId), ...fighter }));
        const roles = copyStateMap(state.roles);
        return {
        roomPhase: state.phase ?? '',
        ruleset: state.ruleset,
        fighters,
        roles,
        myRole: colyseusClient.sessionId ? (roles.get(colyseusClient.sessionId) as MultiplayerState['myRole']) ?? null : null,
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
      const fighters = new Map<string, ClientFighterState>(); const roles = new Map<string, string>();
      roomState.fighters.forEach((fighter) => fighters.set(fighter.sessionId, { ...current.fighters.get(fighter.sessionId), definitionId: fighter.definitionId } as ClientFighterState));
      const connected = new Map<string, boolean>(); const readyPlayers = new Map<string, boolean>();
      roomState.roles.forEach(({ sessionId, role, connected: isConnected, ready }) => { roles.set(sessionId, role); connected.set(sessionId, isConnected); readyPlayers.set(sessionId, ready); });
      return {
        roomPhase: roomState.phase,
        ruleset: roomState.ruleset,
        hostSessionId: roomState.hostSessionId,
        ...(roomState.phase === 'active' ? { matchResult: null } : {}),
        fighters,
        roles,
        connected,
        readyPlayers,
        lobbyChat: roomState.chat.map(entry => ({ type: 'lobbyChatEvent' as const, ...entry })),
        myRole: current.sessionId ? (roles.get(current.sessionId) as MultiplayerState['myRole']) ?? null : current.myRole,
      };
    }),
    onCommandAck: (ack) => set(state => {
      const sample = Number.isFinite(ack.clientTimestamp) ? Math.max(0, performance.now() - ack.clientTimestamp) : 0;
      return { lastAckedSeq: ack.seq, lastServerTimestamp: ack.serverTimestamp, rtt: sample ? state.rtt === 0 ? sample : state.rtt * .75 + sample * .25 : state.rtt };
    }),
    onHeartbeat: (sample) => set(state => ({ rtt: state.rtt === 0 ? sample : state.rtt * .75 + sample * .25 })),
    onImpactEvent: (impact) => set({ lastImpact: impact }),
    onLobbyChat: (event) => set(state => ({ lobbyChat: [...state.lobbyChat, event].slice(-40) })),
    onMatchResult: (matchResult) => set({ matchResult, roomPhase: 'result' }),
  });

  return {
    status: 'disconnected',
    roomId: null,
    sessionId: null,
    joinInvite: null,
    hostSessionId: null,
    myRole: null,
    roomPhase: 'lobby',
    ruleset: 'standard',
    fighters: new Map(),
    roles: new Map(),
    connected: new Map(),
    readyPlayers: new Map(),
    lobbyChat: [],
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
      set({ roomId: null, sessionId: null, joinInvite: null, hostSessionId: null, myRole: null, status: 'disconnected', fighters: new Map(), roles: new Map(), connected: new Map(), readyPlayers: new Map(), lobbyChat: [], roomPhase: 'lobby', lastCommandSeq: 0, lastAckedSeq: 0, lastSnapshotSeq: 0, serverElapsed: 0, serverHype: 0, serverAnnouncement: null, lastImpact: null, matchResult: null });
    },

    async createPrivateRoom(options = {}) {
      const created = await colyseusClient.createPrivateRoom(options);
      const sessionId = colyseusClient.sessionId ?? null;
      set((state) => ({ roomId: created.roomId, joinInvite: created.joinInvite, sessionId, myRole: sessionId ? state.roles.get(sessionId) as MultiplayerState['myRole'] ?? null : null }));
      return created.roomId;
    },

    async joinByRoomId(roomId, options = {}) {
      await colyseusClient.joinByRoomId(roomId, options);
      const sessionId = colyseusClient.sessionId ?? null;
      set((state) => ({ roomId: colyseusClient.roomId ?? null, sessionId, myRole: sessionId ? state.roles.get(sessionId) as MultiplayerState['myRole'] ?? null : null }));
    },

    selectFighter(fighterId) { colyseusClient.selectFighter(fighterId); },
    ready() { colyseusClient.ready(true); },
    setReady(ready) { colyseusClient.ready(ready); },
    startMatch() { colyseusClient.startMatch(); },
    sendLobbyChat(text) { colyseusClient.sendLobbyChat(text); },

    sendAction(event) {
      const seq = colyseusClient.sendAction(event);
      set({ lastCommandSeq: seq });
    },

    voteRematch() { colyseusClient.voteRematch(); },
    updateRoomSettings(ruleset) { colyseusClient.updateRoomSettings(ruleset); },
  };
});

if (typeof window !== 'undefined') {
  (window as unknown as { useMultiplayerStore: typeof useMultiplayerStore }).useMultiplayerStore = useMultiplayerStore;
}
