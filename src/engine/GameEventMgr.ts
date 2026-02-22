import { GameEvent, GameEventType } from './GameEvent';

export interface GameEventListener {
  onGameEvent(event: GameEvent): void;
}

export class GameEventMgr {
  private static instance: GameEventMgr | null = null;
  private listeners: Map<GameEventType, GameEventListener[]> = new Map();

  private constructor() {
    for (const val of Object.values(GameEventType)) {
      if (typeof val === 'number') {
        this.listeners.set(val, []);
      }
    }
  }

  static getInstance(): GameEventMgr {
    if (!GameEventMgr.instance) {
      GameEventMgr.instance = new GameEventMgr();
    }
    return GameEventMgr.instance;
  }

  static reset(): void {
    GameEventMgr.instance = null;
  }

  addListener(listener: GameEventListener, type: GameEventType): void {
    const list = this.listeners.get(type);
    if (list) {
      list.push(listener);
    }
  }

  removeListener(listener: GameEventListener, type: GameEventType): void {
    const list = this.listeners.get(type);
    if (list) {
      const idx = list.indexOf(listener);
      if (idx !== -1) list.splice(idx, 1);
    }
  }

  sendEvent(event: GameEvent): void {
    const list = this.listeners.get(event.type);
    if (!list) return;
    const copy = [...list];
    for (const listener of copy) {
      listener.onGameEvent(event);
    }
  }
}
