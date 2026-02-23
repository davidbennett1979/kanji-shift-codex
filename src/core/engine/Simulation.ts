import { ENTITY_DEFS } from '../content/kanjiDefs';
import { FUSION_RECIPES } from '../content/fusionRecipes';
import { accumulateRule } from './RuleEvaluatorRegistry';
import { parseRulesFromBoard } from '../parser/RuleParser';
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
  focusYouId?: string;
  focusWinId?: string;
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
  PULL: '引',
  STOP: '止',
  WIN: '勝',
  FLOAT: '浮',
  SINK: '沈',
  HOT: '熱',
  MELT: '溶',
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
  private focusYouId?: string;
  private focusWinId?: string;
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
    this.focusYouId = undefined;
    this.focusWinId = undefined;

    for (const placement of level.entities) {
      this.spawnEntity(placement.defId, placement.x, placement.y);
    }

    this.rebuildRules();
    this.refreshFocusRoles();
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
    this.refreshFocusRoles();
    this.lastEvents = [{ type: 'undo', message: 'Undo' }];
  }

  move(direction: Direction): void {
    if (this.won) {
      this.lastEvents = [{ type: 'blocked', message: 'Level already cleared. Press N for next level.' }];
      return;
    }

    const before = this.captureHistorySnapshot();
    const beforeRules = this.activeRules.map((rule) => ({ ...rule, cells: [...rule.cells] }));
    const beforeRuleSig = this.ruleSignature(this.activeRules);
    const events: SimulationEvent[] = [];
    this.refreshFocusRoles();
    const roleOrigins = this.captureFocusOrigins();
    const moved = this.applyMovement(direction, events);

    if (!moved) {
      this.lastEvents = events.length > 0 ? events : [{ type: 'blocked', message: 'Blocked' }];
      return;
    }

    this.history.push(before);
    this.moveCount += 1;

    this.applyFusion(events);
    this.rebuildRules(events);
    this.applyRoleAssignmentsFromNewRules(beforeRules, roleOrigins.beforePositions, events);
    this.applyRoleAssignmentsFromNounSlotTriggers(roleOrigins.beforePositions, events);
    this.refreshFocusRoles();

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
      focusRoles: {
        playerEntityId: this.focusYouId,
        winEntityId: this.focusWinId,
      },
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
    this.refreshFocusRoles();
    if (!this.focusYouId) {
      events.push({ type: 'blocked', message: 'No controllable object (need 人 は 遊)' });
      return false;
    }
    const focused = this.entities.get(this.focusYouId);
    if (!focused) {
      events.push({ type: 'blocked', message: 'No controllable object' });
      this.refreshFocusRoles();
      return false;
    }

    const { dx, dy } = DIR_VECTORS[direction];
    let anyMoved = false;
    const checkpoint = this.cloneEntityPositions();
    const movedIds = new Set<string>();
    const ok = this.moveEntityRecursive(focused.id, dx, dy, new Set<string>(), movedIds);
    if (!ok) {
      this.restoreEntityPositions(checkpoint);
      events.push({ type: 'blocked', message: 'Blocked' });
      return false;
    }
    anyMoved = movedIds.has(focused.id);

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

    const ox = entity.x;
    const oy = entity.y;
    const tx = ox + dx;
    const ty = oy + dy;
    if (!this.isInBounds(tx, ty)) {
      return false;
    }

    const occupants = this.getOccupants(tx, ty)
      .filter((o) => o.id !== entityId)
      .sort((a, b) => a.id.localeCompare(b.id));

    for (const occ of occupants) {
      // Touching a WIN target should be allowed to overlap so the win can trigger,
      // even if that target would otherwise be pushable/blocking.
      if (entityId === this.focusYouId && this.isWinContactTarget(occ)) {
        continue;
      }

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

    const behindX = ox - dx;
    const behindY = oy - dy;
    const pullers = this.getOccupants(behindX, behindY)
      .filter((o) => o.id !== entityId)
      .filter((o) => this.hasProp(o, 'PULL'))
      .sort((a, b) => a.id.localeCompare(b.id));

    for (const puller of pullers) {
      const pulled = this.moveEntityRecursive(puller.id, dx, dy, visiting, movedIds);
      if (!pulled) {
        visiting.delete(entityId);
        return false;
      }
    }

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

    let postCells = this.buildCellMap();

    const melted = new Set<string>();
    for (const occupants of postCells.values()) {
      const hots = occupants.filter((e) => this.hasProp(e, 'HOT'));
      if (hots.length === 0) {
        continue;
      }
      const meltVictims = occupants.filter((e) => this.hasProp(e, 'MELT') && hots.some((h) => h.id !== e.id));
      if (meltVictims.length === 0) {
        continue;
      }
      for (const victim of meltVictims) {
        melted.add(victim.id);
      }
      events.push({ type: 'blocked', message: '熱 melted 溶' });
    }
    for (const id of melted) {
      this.entities.delete(id);
    }

    postCells = this.buildCellMap();
    this.refreshFocusRoles();

    if (this.focusYouId) {
      const you = this.entities.get(this.focusYouId);
      if (you) {
        const occupants = postCells.get(this.cellKey(you.x, you.y)) ?? [];
        const touchingWin = occupants.some((e) => e.id !== you.id && this.isWinContactTarget(e));
        if (touchingWin) {
          this.won = true;
          events.push({ type: 'win', message: 'You Win!', x: you.x, y: you.y, cells: [[you.x, you.y]] });
          return;
        }
      }
    }

    for (const occupants of postCells.values()) {
      const youEntities = occupants.filter((e) => this.hasProp(e, 'YOU'));
      if (youEntities.length === 0) {
        continue;
      }
      const hasDistinctWinTarget = occupants.some((e) =>
        youEntities.every((you) => you.id !== e.id) && this.isWinContactTarget(e),
      );
      if (!hasDistinctWinTarget) {
        continue;
      }

      this.won = true;
      const winner = youEntities[0] ?? occupants[0];
      events.push({ type: 'win', message: 'You Win!', x: winner?.x, y: winner?.y, cells: winner ? [[winner.x, winner.y]] : undefined });
      break;
    }
  }

  private rebuildRules(events?: SimulationEvent[]): void {
    this.activeRules = this.parseRules();
    this.activeProps = new Map();
    this.activeTransforms = new Map();

    for (const rule of this.activeRules) {
      accumulateRule(rule, {
        activeProps: this.activeProps,
        activeTransforms: this.activeTransforms,
      });
    }

    this.applyTransformsFromRules(events);
  }

  private parseRules(): ParsedRule[] {
    return parseRulesFromBoard(this.level.width, this.level.height, this.entities.values(), this.getDef.bind(this));
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

  private hasRuleProp(entity: EntityState, property: PropertyKey): boolean {
    const def = this.getDef(entity.defId);
    if (!def.nounKey) {
      return false;
    }
    return this.activeProps.get(def.nounKey)?.has(property) ?? false;
  }

  private isWinContactTarget(entity: EntityState): boolean {
    if (entity.id === this.focusWinId) {
      return true;
    }
    if (this.hasProp(entity, 'WIN')) {
      return true;
    }
    // For touch-to-win semantics, noun text carriers participating in a WIN rule
    // should be valid targets even though text tiles do not generally receive noun props.
    return this.hasRuleProp(entity, 'WIN');
  }

  private isPushable(entity: EntityState): boolean {
    const def = this.getDef(entity.defId);
    if (def.defaultPushable) {
      return true;
    }
    // In this design, controllable objects should remain interactable/movable.
    // Treat active YOU-carriers as implicitly pushable.
    if (this.hasProp(entity, 'YOU')) {
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
      focusYouId: this.focusYouId,
      focusWinId: this.focusWinId,
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
    this.focusYouId = snapshot.focusYouId;
    this.focusWinId = snapshot.focusWinId;
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

  private refreshFocusRoles(): void {
    const hasYouRule = this.hasAnyActivePropertyRule('YOU');
    const hasWinRule = this.hasAnyActivePropertyRule('WIN');

    if (!hasYouRule) {
      this.focusYouId = undefined;
    }
    if (!hasWinRule) {
      this.focusWinId = undefined;
    }

    if (this.focusYouId && !this.entities.has(this.focusYouId)) {
      this.focusYouId = undefined;
    }
    if (this.focusWinId && !this.entities.has(this.focusWinId)) {
      this.focusWinId = undefined;
    }

    if (hasYouRule && !this.focusYouId) {
      this.focusYouId = this.pickFirstRuleCarrier('YOU');
    }
    if (hasWinRule && !this.focusWinId) {
      this.focusWinId = this.pickFirstRuleCarrier('WIN');
    }
  }

  private hasAnyActivePropertyRule(property: 'YOU' | 'WIN'): boolean {
    return this.activeRules.some((rule) => rule.kind === 'property' && rule.property === property);
  }

  private pickFirstRuleCarrier(property: 'YOU' | 'WIN'): string | undefined {
    const relevantRuleCells = new Set<string>();
    const anyRuleCells = new Set<string>();
    for (const rule of this.activeRules) {
      for (const [x, y] of rule.cells) {
        anyRuleCells.add(`${x},${y}`);
      }
      if (rule.kind === 'property' && rule.property === property) {
        for (const [x, y] of rule.cells) {
          relevantRuleCells.add(`${x},${y}`);
        }
      }
    }

    const candidates = [...this.entities.values()]
      .filter((entity) => this.isRoleCarrierCandidate(entity) && this.hasRuleProp(entity, property));

    const score = (entity: EntityState): number => {
      const def = this.getDef(entity.defId);
      let s = 0;
      if (def.kind !== 'object') s += 100; // prefer world objects over text by default
      if (relevantRuleCells.has(`${entity.x},${entity.y}`)) s += 20; // prefer off the active rule line
      if (anyRuleCells.has(`${entity.x},${entity.y}`)) s += 5; // then prefer not sitting on any rule text
      return s;
    };

    candidates.sort((a, b) => {
      const delta = score(a) - score(b);
      if (delta !== 0) return delta;
      return a.id.localeCompare(b.id);
    });

    return candidates[0]?.id;
  }

  private captureFocusOrigins(): {
    player?: { id: string; x: number; y: number };
    win?: { id: string; x: number; y: number };
    beforePositions: Map<string, { x: number; y: number }>;
  } {
    const beforePositions = this.cloneEntityPositions();
    const player = this.focusYouId ? this.entities.get(this.focusYouId) : undefined;
    const win = this.focusWinId ? this.entities.get(this.focusWinId) : undefined;
    return {
      player: player ? { id: player.id, x: player.x, y: player.y } : undefined,
      win: win ? { id: win.id, x: win.x, y: win.y } : undefined,
      beforePositions,
    };
  }

  private applyRoleAssignmentsFromNewRules(
    beforeRules: ParsedRule[],
    beforePositions: Map<string, { x: number; y: number }>,
    events: SimulationEvent[],
  ): void {
    const beforeSet = new Set(
      beforeRules
        .filter((rule) => rule.kind === 'property')
        .map((rule) => `p:${rule.noun}:${rule.property}:${rule.cells.map(([x, y]) => `${x},${y}`).join(';')}`),
    );

    const newPropRules = this.activeRules.filter((rule): rule is Extract<ParsedRule, { kind: 'property' }> => {
      if (rule.kind !== 'property') {
        return false;
      }
      const key = `p:${rule.noun}:${rule.property}:${rule.cells.map(([x, y]) => `${x},${y}`).join(';')}`;
      return !beforeSet.has(key);
    });

    for (const rule of newPropRules) {
      if (rule.property === 'YOU') {
        const picked = this.pickFocusCarrierForRule(rule, beforePositions);
        if (picked && this.focusYouId !== picked.id) {
          this.focusYouId = picked.id;
          events.push({
            type: 'role-shift',
            message: `Player captured by ${this.getDef(picked.defId).glyph} (遊)`,
            x: picked.x,
            y: picked.y,
            cells: [[picked.x, picked.y], ...rule.cells],
          });
        }
      }

      if (rule.property === 'WIN') {
        const picked = this.pickFocusCarrierForRule(rule, beforePositions, this.focusYouId);
        if (picked && this.focusWinId !== picked.id) {
          this.focusWinId = picked.id;
          events.push({
            type: 'role-shift',
            message: `Goal captured by ${this.getDef(picked.defId).glyph} (勝)`,
            x: picked.x,
            y: picked.y,
            cells: [[picked.x, picked.y], ...rule.cells],
          });
        }
      }
    }
  }

  private pickFocusCarrierForRule(
    rule: Extract<ParsedRule, { kind: 'property' }>,
    beforePositions: Map<string, { x: number; y: number }>,
    excludeId?: string,
  ): EntityState | undefined {
    const targetObjects = [...this.entities.values()]
      .filter((entity) => {
        const def = this.getDef(entity.defId);
        return this.isRoleCarrierCandidate(entity) && def.nounKey === rule.noun && entity.id !== excludeId;
      })
      .sort((a, b) => a.id.localeCompare(b.id));

    if (targetObjects.length === 0) {
      return undefined;
    }

    const nounCell = rule.cells[0];
    const propCell = rule.cells[rule.cells.length - 1];
    const connectorCell = rule.cells[1];
    const ruleCellKeys = new Set(rule.cells.map(([x, y]) => `${x},${y}`));

    const matchesCell = (entity: EntityState, cell?: [number, number]) => {
      if (!cell) {
        return false;
      }
      return entity.x === cell[0] && entity.y === cell[1];
    };

    const movedThisTurn = (entity: EntityState) => {
      const prev = beforePositions.get(entity.id);
      return !prev || prev.x !== entity.x || prev.y !== entity.y;
    };

    return (
      targetObjects.find((entity) => matchesCell(entity, propCell) && movedThisTurn(entity)) ??
      targetObjects.find((entity) => matchesCell(entity, propCell)) ??
      targetObjects.find((entity) => matchesCell(entity, nounCell) && movedThisTurn(entity)) ??
      targetObjects.find((entity) => matchesCell(entity, nounCell)) ??
      targetObjects.find((entity) => matchesCell(entity, connectorCell) && movedThisTurn(entity)) ??
      targetObjects.find((entity) => ruleCellKeys.has(`${entity.x},${entity.y}`) && movedThisTurn(entity)) ??
      targetObjects.find((entity) => movedThisTurn(entity)) ??
      targetObjects[0]
    );
  }

  private applyRoleAssignmentsFromNounSlotTriggers(
    beforePositions: Map<string, { x: number; y: number }>,
    events: SimulationEvent[],
  ): void {
    const movedThisTurn = (entity: EntityState): boolean => {
      const prev = beforePositions.get(entity.id);
      return !prev || prev.x !== entity.x || prev.y !== entity.y;
    };

    const chooseFromNounSlot = (
      property: 'YOU' | 'WIN',
      currentFocusId: string | undefined,
      setFocus: (id: string) => void,
      options?: { excludeCurrentPlayer?: boolean },
    ) => {
      const activeRulesForRole = this.activeRules.filter(
        (rule): rule is Extract<ParsedRule, { kind: 'property' }> =>
          rule.kind === 'property' && rule.property === property,
      );
      if (activeRulesForRole.length === 0) {
        return;
      }

      const anchor = (this.focusYouId && this.entities.get(this.focusYouId)) ?? (currentFocusId ? this.entities.get(currentFocusId) : undefined);

      type Choice = {
        rule: Extract<ParsedRule, { kind: 'property' }>;
        movedIn: EntityState;
        replacement: EntityState;
        fallback: boolean;
        distance: number;
      };

      const choices: Choice[] = [];

      for (const rule of activeRulesForRole) {
        const nounCell = rule.cells[0];
        if (!nounCell) {
          continue;
        }

        const movedIntoNounSlot = this.getOccupants(nounCell[0], nounCell[1])
          .filter((entity) => this.isRoleCarrierCandidate(entity))
          .filter((entity) => this.getDef(entity.defId).nounKey === rule.noun)
          .filter((entity) => movedThisTurn(entity));

        for (const movedIn of movedIntoNounSlot) {
          const others = [...this.entities.values()]
            .filter((entity) => this.isRoleCarrierCandidate(entity))
            .filter((entity) => this.getDef(entity.defId).nounKey === rule.noun)
            .filter((entity) => entity.id !== movedIn.id)
            .filter((entity) => !(options?.excludeCurrentPlayer && entity.id === this.focusYouId));

          others.sort((a, b) => {
            const ad = anchor ? Math.abs(a.x - anchor.x) + Math.abs(a.y - anchor.y) : 0;
            const bd = anchor ? Math.abs(b.x - anchor.x) + Math.abs(b.y - anchor.y) : 0;
            if (ad !== bd) return ad - bd;
            return a.id.localeCompare(b.id);
          });

          let replacement = others[0];
          let fallback = false;
          if (!replacement) {
            if (options?.excludeCurrentPlayer && movedIn.id === this.focusYouId) {
              continue;
            }
            replacement = movedIn;
            fallback = true;
          }
          if (!replacement) {
            continue;
          }

          const distance = anchor ? Math.abs(replacement.x - anchor.x) + Math.abs(replacement.y - anchor.y) : 0;
          choices.push({ rule, movedIn, replacement, fallback, distance });
        }
      }

      if (choices.length === 0) {
        return;
      }

      choices.sort((a, b) => {
        if (a.fallback !== b.fallback) return a.fallback ? 1 : -1;
        if (a.distance !== b.distance) return a.distance - b.distance;
        return a.replacement.id.localeCompare(b.replacement.id);
      });

      const chosen = choices[0];
      if (!chosen || chosen.replacement.id === currentFocusId) {
        return;
      }

      setFocus(chosen.replacement.id);
      events.push({
        type: 'role-shift',
        message: `${property === 'YOU' ? 'Player' : 'Goal'} shifts to ${this.getDef(chosen.replacement.defId).glyph} (noun slot trigger)`,
        x: chosen.replacement.x,
        y: chosen.replacement.y,
        cells: [[chosen.replacement.x, chosen.replacement.y], ...chosen.rule.cells],
      });
    };

    chooseFromNounSlot('YOU', this.focusYouId, (id) => { this.focusYouId = id; });
    chooseFromNounSlot('WIN', this.focusWinId, (id) => { this.focusWinId = id; }, { excludeCurrentPlayer: true });
  }

  private isRoleCarrierCandidate(entity: EntityState): boolean {
    const def = this.getDef(entity.defId);
    if (!def.nounKey) {
      return false;
    }
    if (def.kind === 'object') {
      return true;
    }
    return def.kind === 'text' && def.textRole === 'noun';
  }

}
