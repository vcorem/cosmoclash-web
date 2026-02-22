import { Entity } from './Entity';

export class EntityPool<T extends Entity> {
  private free: T[] = [];
  private active: Set<T> = new Set();
  private factory: () => T;
  private resetFn: (e: T) => void;

  constructor(
    factory: () => T,
    resetFn: (e: T) => void,
    initialSize: number,
  ) {
    this.factory = factory;
    this.resetFn = resetFn;
    for (let i = 0; i < initialSize; i++) {
      this.free.push(factory());
    }
  }

  acquire(): T {
    const entity = this.free.pop() ?? this.factory();
    this.resetFn(entity);
    entity.alive = true;
    this.active.add(entity);
    return entity;
  }

  release(entity: T): void {
    if (!this.active.has(entity)) return;
    entity.alive = false;
    this.active.delete(entity);
    this.free.push(entity);
  }

  releaseInactive(): void {
    for (const e of this.active) {
      if (!e.alive) {
        this.active.delete(e);
        this.free.push(e);
      }
    }
  }

  forEachActive(fn: (e: T) => void): void {
    for (const e of this.active) {
      fn(e);
    }
  }

  get activeEntities(): T[] {
    return Array.from(this.active);
  }

  get activeCount(): number {
    return this.active.size;
  }

  get freeCount(): number {
    return this.free.length;
  }
}
