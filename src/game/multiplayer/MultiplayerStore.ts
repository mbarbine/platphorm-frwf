import { create } from 'zustand';
import { colyseusClient } from './ColyseusClient';
import type { ConnectionStatus } from './ColyseusClient';
import type { ClientRoomState } from './ColyseusClient';
import type { FighterId } from '@frwf/game-protocol';

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

  // Latency
  rtt: number;
  lastServerTimestamp: number;
  lastCommandSeq: number;
  lastAckedSeq: number;

  // Actions
  connect: (roomName?: string, options?: { fighterId?: FighterId; private?: boolean }) => Promise<void>;
  disconnect: () => Promise<void>;
  createPrivateRoom: (options?: { fighterId?: FighterId }) => Promise<string>;
  joinByRoomId: (roomId: string, options?: { fighterId?: FighterId }) => Promise<void>;
  selectFighter: (fighterId: FighterId) => void;
  ready: () => void;
  sendCommand: (command: string, direction: { x: number; z: number }, running: boolean, block: boolean) => void;
  voteRematch: () => void;
}

export const useMultiplayerStore = create<MultiplayerState>((set, get) => {
  // Wire up ColyseusClient events to Zustand state
  colyseusClient['options'].onStatusChange = (status) => set({ status });
  colyseusClient['options'].onStateChange = (state: ClientRoomState) => {
    set({ roomPhase: state.phase ?? '' });
  };

  return {
    status: 'disconnected',
    roomId: null,
    sessionId: null,
    myRole: null,
    roomPhase: 'lobby',
    rtt: 0,
    lastServerTimestamp: 0,
    lastCommandSeq: 0,
    lastAckedSeq: 0,

    async connect(roomName = 'wrestling', options = {}) {
      await colyseusClient.joinOrCreate(roomName, options);
      set({ roomId: colyseusClient.roomId ?? null, sessionId: colyseusClient.sessionId ?? null });
    },

    async disconnect() {
      await colyseusClient.leave();
      set({ roomId: null, sessionId: null, myRole: null, status: 'disconnected' });
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

    sendCommand(command, direction, running, block) {
      const seq = colyseusClient.sendCommand(command as never, direction, running, block);
      set({ lastCommandSeq: seq });
    },

    voteRematch() { colyseusClient.voteRematch(); },
  };
});
