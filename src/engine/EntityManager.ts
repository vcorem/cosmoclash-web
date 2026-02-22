import { Entity, Vec3 } from './Entity';

export class EntityManager {
  entities: Entity[] = [];

  add(entity: Entity): void {
    this.entities.push(entity);
  }

  update(dt: number, camCenter: Vec3): void {
    for (const entity of this.entities) {
      if (!entity.alive) continue;
      entity.update(dt);
      entity.handleWrapAround(camCenter);
    }
  }

  removeDeadEntities(): void {
    this.entities = this.entities.filter(e => e.alive);
  }
}
