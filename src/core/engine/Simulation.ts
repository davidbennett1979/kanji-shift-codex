import { ENTITY_DEFS } from '../content/kanjiDefs';
import { FUSION_RECIPES } from '../content/fusionRecipes';
import type {
  ActiveRuleView,
  Direction,
  EntityDef,
  EntityState,
  FusionRecipe,
  LevelData,
  NounKey,
  ParsedRule,
  PropertyKey,
  SimulationEvent,
  SimulationSnapshot,
} from '../model/Types';

type HistorySnapshot = {
  entities: EntityState[];
  moveCount: number;
  won: boolean;
};

const DIR_VECTORS: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

const NOUN_GLOSS: Record<NounKey, string> = {
  human: '人',
  tree: '木',
  rock: '石',
  mountain: '山',
  fire: '火',
  water: '水',
  gate: '門',
  volcano: '火山',
  hotspring: '湯',
  charcoal: '炭',
};

const PROPERTY_GLOSS: Record<PropertyKey, string> = {
  YOU: '遊',
  PUSH: '押',
  STOP: '止',
  WIN: '勝',
  FLOAT: '浮',
  SINK: '沈',
  HOT: '熱',
};

const OBJECT_DEF_BY_NOUN: Partial<Record<NounKey, string>> = Object.values(ENTITY_DEFS).reduce((acc, def) => {
  if (def.kind === 'object' && def.nounKey) {
    acc[def.nounKey] = def.id;
  }
  return acc;
}, {} as Partial<Record<NounKey, string>>);

export class Simulation {
  private level: LevelData;
  private entities = new Map<string, EntityState>();
  private nextId = 1;
  private moveCount = 0;
  private won = false;
  private history: HistorySnapshot[] = [];
  private activeRules: ParsedRule[] = [];
  private activeProps = new Map<NounKey, Set<PropertyKey>>();
  private activeTransforms = new Map<NounKey, NounKey>();
  private lastEvents: SimulationEvent[] = [];

  constructor(level: LevelData) {
    this.level = level;
    this.loadLevel(level);
  }

  loadLevel(level: LevelData): void {
    this.level = level;
    this.entities.clear();
    this.nextId = 1;
    this.moveCount = 0;
    this.won = false;
    this.history = [];

    for (const placement of level.entities) {
      this.spawnEntity(placement.defId, placement.x, placement.y);
    }

    this.rebuildRules();
    this.lastEvents = [{ type: 'level-load', message: `Loaded ${level.name}` }];
  }

  restart(): void {
    this.loadLevel(this.level);
    this.lastEvents = [{ type: 'restart', message: `Restarted ${this.level.name}` }];
  }

  undo(): void {
    const prev = this.history.pop();
    if (!prev) {
      this.lastEvents = [{ type: 'undo', message: 'Nothing to undo' }];
      return;
    }

    this.restoreHistorySnapshot(prev);
    this.rebuildRules();
    this.lastEvents = [{ type: 'undo', message: 'Undo' }];
  }

  move(direction: Direction): void {
    if (this.won) {
      this.lastEvents = [{ type: 'blocked', message: 'Level already cleared. Press N for next level.' }];
      return;
    }

    const before = this.captureHistorySnapshot();
    const beforeRuleSig = this.ruleSignature(this.activeRules);
    const events: SimulationEvent[] = [];
    const moved = this.applyMovement(direction, events);

    if (!moved) {
      this.lastEvents = events.length > 0 ? events : [{ type: 'blocked', message: 'Blocked' }];
      return;
    }

    this.history.push(before);
    this.moveCount += 1;

    this.applyFusion(events);
    this.rebuildRules(events);

    const afterRuleSig = this.ruleSignature(this.activeRules);
    if (afterRuleSig !== beforeRuleSig) {
      events.push({ type: 'rule-change', message: `Rules changed (${this.activeRules.length})` });
    }

    this.applyInteractions(events);

    this.lastEvents = events.length > 0 ? events : [{ type: 'move', message: `Moved ${direction}` }];
  }

  getSnapshot(): SimulationSnapshot {
    return {
      levelId: this.level.id,
      levelName: this.level.name,
      width: this.level.width,
      height: this.level.height,
      hint: this.level.hint,
      moveCount: this.moveCount,
      won: this.won,
      entities: [...this.entities.values()].map((e) => ({ ...e })),
      activeRules: this.activeRules.map((rule): ActiveRuleView => (
        rule.kind === 'property'
          ? { kind: 'property', noun: rule.noun, property: rule.property, cells: [...rule.cells], axis: rule.axis }
          : { kind: 'transform', noun: rule.noun, targetNoun: rule.targetNoun, cells: [...rule.cells], axis: rule.axis }
      )),
      lastEvents: [...this.lastEvents],
    };
  }

  getDef(defId: string): EntityDef {
    const def = ENTITY_DEFS[defId];
    if (!def) {
      throw new Error(`Unknown entity def: ${defId}`);
    }
    return def;
  }

  formatRule(rule: ActiveRuleView): string {
    if (rule.kind === 'transform' && rule.targetNoun) {
      return `${NOUN_GLOSS[rule.noun]} は ${NOUN_GLOSS[rule.targetNoun]}`;
    }
    if (rule.kind === 'property' && rule.property) {
      return `${NOUN_GLOSS[rule.noun]} は ${PROPERTY_GLOSS[rule.property]}`;
    }
    return `${NOUN_GLOSS[rule.noun]} は ?`;
  }

  private applyMovement(direction: Direction, events: SimulationEvent[]): boolean {
    const controllers = [...this.entities.values()]
      .filter((entity) => this.hasProp(entity, 'YOU'))
      .sort((a, b) => a.id.localeCompare(b.id));

    if (controllers.length === 0) {
      events.push({ type: 'blocked', message: 'No controllable object (need 人 は 遊)' });
      return false;
    }

    const { dx, dy } = DIR_VECTORS[direction];
    let anyMoved = false;

    for (const controller of controllers) {
      const current = this.entities.get(controller.id);
      if (!current) {
        continue;
      }

      const checkpoint = this.cloneEntityPositions();
      const movedIds = new Set<string>();
      const ok = this.moveEntityRecursive(current.id, dx, dy, new Set<string>(), movedIds);
      if (!ok) {
        this.restoreEntityPositions(checkpoint);
        continue;
      }

      if (movedIds.has(current.id)) {
        anyMoved = true;
      }
    }

    if (anyMoved) {
      events.push({ type: 'move', message: `Moved ${direction}` });
    }

    return anyMoved;
  }

  private moveEntityRecursive(
    entityId: string,
    dx: number,
    dy: number,
    visiting: Set<string>,
    movedIds: Set<string>,
  ): boolean {
    if (visiting.has(entityId)) {
      return false;
    }
    visiting.add(entityId);

    const entity = this.entities.get(entityId);
    if (!entity) {
      return false;
    }

    const tx = entity.x + dx;
    const ty = entity.y + dy;
    if (!this.isInBounds(tx, ty)) {
      return false;
    }

    const occupants = this.getOccupants(tx, ty)
      .filter((o) => o.id !== entityId)
      .sort((a, b) => a.id.localeCompare(b.id));

    for (const occ of occupants) {
      if (this.isPushable(occ)) {
        const pushed = this.moveEntityRecursive(occ.id, dx, dy, visiting, movedIds);
        if (!pushed) {
          return false;
        }
        continue;
      }

      if (this.isBlocking(occ)) {
        return false;
      }
    }

    entity.x = tx;
    entity.y = ty;
    movedIds.add(entity.id);
    visiting.delete(entityId);
    return true;
  }

  private applyFusion(events: SimulationEvent[]): void {
    const candidates = [...this.entities.values()]
      .filter((e) => this.getDef(e.defId).kind === 'object')
      .sort((a, b) => a.id.localeCompare(b.id));

    const consumed = new Set<string>();
    const spawns: Array<{ defId: string; x: number; y: number; message: string }> = [];

    for (const entity of candidates) {
      if (consumed.has(entity.id) || !this.entities.has(entity.id)) {
        continue;
      }
      const defA = this.getDef(entity.defId);
      if (!defA.nounKey) {
        continue;
      }

      const neighbors = [
        { x: entity.x + 1, y: entity.y },
        { x: entity.x, y: entity.y + 1 },
      ];

      for (const pos of neighbors) {
        const neighbor = this.getOccupants(pos.x, pos.y)
          .filter((occ) => !consumed.has(occ.id) && occ.id !== entity.id)
          .find((occ) => this.getDef(occ.defId).kind === 'object');
        if (!neighbor) {
          continue;
        }

        const defB = this.getDef(neighbor.defId);
        if (!defB.nounKey) {
          continue;
        }

        const recipe = this.findRecipe(defA.nounKey, defB.nounKey);
        if (!recipe) {
          continue;
        }

        consumed.add(entity.id);
        consumed.add(neighbor.id);
        const outDef = this.getDef(recipe.outputDefId);
        spawns.push({
          defId: recipe.outputDefId,
          x: neighbor.x,
          y: neighbor.y,
          message: `${defA.glyph} + ${defB.glyph} → ${outDef.glyph}`,
        });
        break;
      }
    }

    if (consumed.size === 0) {
      return;
    }

    for (const id of consumed) {
      this.entities.delete(id);
    }
    for (const spawn of spawns) {
      this.spawnEntity(spawn.defId, spawn.x, spawn.y);
      events.push({ type: 'fusion', message: spawn.message, x: spawn.x, y: spawn.y, cells: [[spawn.x, spawn.y]] });
    }
  }

  private applyInteractions(events: SimulationEvent[]): void {
    const cells = this.buildCellMap();
    const toRemove = new Set<string>();

    for (const occupants of cells.values()) {
      const sinks = occupants.filter((e) => this.hasProp(e, 'SINK'));
      if (sinks.length === 0) {
        continue;
      }
      const victims = occupants.filter((e) => !this.hasProp(e, 'FLOAT') && !this.hasProp(e, 'SINK'));
      if (victims.length === 0) {
        continue;
      }

      for (const sink of sinks) {
        toRemove.add(sink.id);
      }
      for (const victim of victims) {
        toRemove.add(victim.id);
      }
      events.push({ type: 'blocked', message: '沈 triggered' });
    }

    for (const id of toRemove) {
      this.entities.delete(id);
    }

    const postCells = this.buildCellMap();
    for (const occupants of postCells.values()) {
      const hasYou = occupants.some((e) => this.hasProp(e, 'YOU'));
      const hasWin = occupants.some((e) => this.hasProp(e, 'WIN'));
      if (hasYou && hasWin) {
        this.won = true;
        events.push({ type: 'win', message: 'You Win!' });
        break;
      }
    }
  }

  private rebuildRules(events?: SimulationEvent[]): void {
    this.activeRules = this.parseRules();
    this.activeProps = new Map();
    this.activeTransforms = new Map();

    for (const rule of this.activeRules) {
      if (rule.kind === 'transform') {
        if (!this.activeTransforms.has(rule.noun)) {
          this.activeTransforms.set(rule.noun, rule.targetNoun);
        }
        continue;
      }
      let props = this.activeProps.get(rule.noun);
      if (!props) {
        props = new Set<PropertyKey>();
        this.activeProps.set(rule.noun, props);
      }
      props.add(rule.property);
    }

    this.applyTransformsFromRules(events);
  }

  private parseRules(): ParsedRule[] {
    const rules: ParsedRule[] = [];
    const byCell = this.buildCellMap();
    const seen = new Set<string>();

    const nounTextsAt = (x: number, y: number) => (byCell.get(this.cellKey(x, y)) ?? []).filter((e) => {
        const def = this.getDef(e.defId);
        return def.kind === 'text' && def.textRole === 'noun' && !!def.nounKey;
      });
    const topicAt = (x: number, y: number) => (byCell.get(this.cellKey(x, y)) ?? []).some((e) => {
        const def = this.getDef(e.defId);
        return def.kind === 'text' && def.textRole === 'connector' && def.connectorKey === 'TOPIC';
      });
    const propertyTextsAt = (x: number, y: number) => (byCell.get(this.cellKey(x, y)) ?? []).filter((e) => {
        const def = this.getDef(e.defId);
        return def.kind === 'text' && def.textRole === 'property' && !!def.propertyKey;
      });
    const andAt = (x: number, y: number) => (byCell.get(this.cellKey(x, y)) ?? []).some((e) => {
      const def = this.getDef(e.defId);
      return def.kind === 'text' && def.textRole === 'operator' && def.operatorKey === 'AND';
    });

    const tryAxis = (x: number, y: number, dx: number, dy: number, axis: 'horizontal' | 'vertical') => {
      const nouns = nounTextsAt(x, y);
      if (nouns.length === 0 || !topicAt(x + dx, y + dy)) {
        return;
      }

      for (const nounEntity of nouns) {
        const nounDef = this.getDef(nounEntity.defId);
        if (!nounDef.nounKey) {
          continue;
        }

        let offset = 2;
        while (true) {
          const tx = x + dx * offset;
          const ty = y + dy * offset;
          if (!this.isInBounds(tx, ty)) {
            break;
          }

          const propTerms = propertyTextsAt(tx, ty);
          const nounTerms = nounTextsAt(tx, ty);
          let emittedAnyTerm = false;

          for (const propEntity of propTerms) {
            const propDef = this.getDef(propEntity.defId);
            if (!propDef.propertyKey) {
              continue;
            }
            emittedAnyTerm = true;
            const sig = `p:${nounDef.nounKey}:${propDef.propertyKey}`;
            if (seen.has(sig)) {
              continue;
            }
            seen.add(sig);
            rules.push({
              kind: 'property',
              noun: nounDef.nounKey,
              property: propDef.propertyKey,
              axis,
              cells: [[x, y], [x + dx, y + dy], [tx, ty]],
            });
          }

          for (const targetEntity of nounTerms) {
            const targetDef = this.getDef(targetEntity.defId);
            if (!targetDef.nounKey) {
              continue;
            }
            emittedAnyTerm = true;
            const sig = `n:${nounDef.nounKey}:${targetDef.nounKey}`;
            if (seen.has(sig)) {
              continue;
            }
            seen.add(sig);
            rules.push({
              kind: 'transform',
              noun: nounDef.nounKey,
              targetNoun: targetDef.nounKey,
              axis,
              cells: [[x, y], [x + dx, y + dy], [tx, ty]],
            });
          }

          if (!emittedAnyTerm) {
            break;
          }

          const andX = x + dx * (offset + 1);
          const andY = y + dy * (offset + 1);
          if (!this.isInBounds(andX, andY) || !andAt(andX, andY)) {
            break;
          }
          offset += 2;
        }
      }
    };

    for (let y = 0; y < this.level.height; y += 1) {
      for (let x = 0; x < this.level.width; x += 1) {
        if (x + 2 < this.level.width) {
          tryAxis(x, y, 1, 0, 'horizontal');
        }
        if (y + 2 < this.level.height) {
          tryAxis(x, y, 0, 1, 'vertical');
        }
      }
    }

    return rules;
  }

  private applyTransformsFromRules(events?: SimulationEvent[]): void {
    if (this.activeTransforms.size === 0) {
      return;
    }

    const summary = new Map<string, { message: string; cells: [number, number][]; x: number; y: number }>();

    for (const entity of this.entities.values()) {
      const def = this.getDef(entity.defId);
      if (def.kind !== 'object' || !def.nounKey) {
        continue;
      }
      const targetNoun = this.activeTransforms.get(def.nounKey);
      if (!targetNoun || targetNoun === def.nounKey) {
        continue;
      }
      const targetDefId = OBJECT_DEF_BY_NOUN[targetNoun];
      if (!targetDefId) {
        continue;
      }
      const targetDef = this.getDef(targetDefId);
      entity.defId = targetDefId;

      if (events) {
        const key = `${def.nounKey}:${targetNoun}`;
        const existing = summary.get(key);
        if (existing) {
          existing.cells.push([entity.x, entity.y]);
        } else {
          summary.set(key, {
            message: `${def.glyph} → ${targetDef.glyph}`,
            cells: [[entity.x, entity.y]],
            x: entity.x,
            y: entity.y,
          });
        }
      }
    }

    if (events) {
      for (const item of summary.values()) {
        const countSuffix = item.cells.length > 1 ? ` x${item.cells.length}` : '';
        events.push({
          type: 'transform',
          message: `${item.message}${countSuffix}`,
          x: item.x,
          y: item.y,
          cells: [...item.cells],
        });
      }
    }
  }

  private hasProp(entity: EntityState, property: PropertyKey): boolean {
    const def = this.getDef(entity.defId);

    if (def.defaultProps?.includes(property)) {
      return true;
    }

    // v1 rule semantics: noun rules apply to world objects, not text tiles.
    // This prevents `人 は 遊` from making the `人` text block controllable.
    if (def.kind === 'text') {
      return false;
    }

    if (!def.nounKey) {
      return false;
    }

    return this.activeProps.get(def.nounKey)?.has(property) ?? false;
  }

  private isPushable(entity: EntityState): boolean {
    const def = this.getDef(entity.defId);
    if (def.defaultPushable) {
      return true;
    }
    return this.hasProp(entity, 'PUSH');
  }

  private isBlocking(entity: EntityState): boolean {
    const def = this.getDef(entity.defId);
    if (this.isPushable(entity)) {
      return true;
    }
    if (def.defaultStop) {
      return true;
    }
    return this.hasProp(entity, 'STOP');
  }

  private findRecipe(a: NounKey, b: NounKey): FusionRecipe | undefined {
    return FUSION_RECIPES.find((recipe) => {
      const [r1, r2] = recipe.inputs;
      if (recipe.ordered) {
        return a === r1 && b === r2;
      }
      return (a === r1 && b === r2) || (a === r2 && b === r1);
    });
  }

  private getOccupants(x: number, y: number): EntityState[] {
    if (!this.isInBounds(x, y)) {
      return [];
    }
    const results: EntityState[] = [];
    for (const entity of this.entities.values()) {
      if (entity.x === x && entity.y === y) {
        results.push(entity);
      }
    }
    return results;
  }

  private buildCellMap(): Map<string, EntityState[]> {
    const map = new Map<string, EntityState[]>();
    for (const entity of this.entities.values()) {
      const key = this.cellKey(entity.x, entity.y);
      const arr = map.get(key);
      if (arr) {
        arr.push(entity);
      } else {
        map.set(key, [entity]);
      }
    }
    return map;
  }

  private cellKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  private isInBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.level.width && y < this.level.height;
  }

  private spawnEntity(defId: string, x: number, y: number): void {
    const id = `e${this.nextId++}`;
    this.entities.set(id, { id, defId, x, y });
  }

  private captureHistorySnapshot(): HistorySnapshot {
    return {
      entities: [...this.entities.values()].map((e) => ({ ...e })),
      moveCount: this.moveCount,
      won: this.won,
    };
  }

  private restoreHistorySnapshot(snapshot: HistorySnapshot): void {
    this.entities.clear();
    let max = 0;
    for (const entity of snapshot.entities) {
      this.entities.set(entity.id, { ...entity });
      const numeric = Number.parseInt(entity.id.replace(/^e/, ''), 10);
      if (Number.isFinite(numeric)) {
        max = Math.max(max, numeric);
      }
    }
    this.nextId = max + 1;
    this.moveCount = snapshot.moveCount;
    this.won = snapshot.won;
  }

  private cloneEntityPositions(): Map<string, { x: number; y: number }> {
    const snapshot = new Map<string, { x: number; y: number }>();
    for (const [id, entity] of this.entities.entries()) {
      snapshot.set(id, { x: entity.x, y: entity.y });
    }
    return snapshot;
  }

  private restoreEntityPositions(snapshot: Map<string, { x: number; y: number }>): void {
    for (const [id, pos] of snapshot.entries()) {
      const entity = this.entities.get(id);
      if (entity) {
        entity.x = pos.x;
        entity.y = pos.y;
      }
    }
  }

  private ruleSignature(rules: ParsedRule[]): string {
    return rules
      .map((rule) => (rule.kind === 'property'
        ? `p:${rule.noun}:${rule.property}`
        : `n:${rule.noun}:${rule.targetNoun}`))
      .sort()
      .join('|');
  }
}
