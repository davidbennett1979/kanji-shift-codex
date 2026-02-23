import Phaser from 'phaser';
import { Simulation } from '../../core/engine/Simulation';
import { ENTITY_DEFS, INK_COLOR } from '../../core/content/kanjiDefs';
import type {
  ActiveRuleView,
  Direction,
  EntityDef,
  EntityState,
  LevelData,
  LevelEntityPlacement,
  NounKey,
  PropertyKey,
  SimulationEvent,
  SimulationSnapshot,
} from '../../core/model/Types';
import { TUTORIAL_LEVELS } from '../../content/levels/tutorialLevels';
import { UIScene } from './UIScene';
import { ensureRuntimeAssets, RUNTIME_TEX } from '../../render/RuntimeAssets';
import { SfxManager } from '../../render/SfxManager';

type EntityView = {
  shadow: Phaser.GameObjects.Rectangle;
  body: Phaser.GameObjects.Rectangle;
  glyph: Phaser.GameObjects.Text;
  gloss: Phaser.GameObjects.Text;
  badge: Phaser.GameObjects.Text;
};

type CellCoord = { x: number; y: number };

const TILE = 64;
const BOARD_TOP = 96;
const BOARD_LEFT = 20;
const RIGHT_PANEL_W = 260;

export class LevelScene extends Phaser.Scene {
  private currentLevel = this.cloneLevel(this.getLevelOrThrow(0));
  private simulation = new Simulation(this.currentLevel);
  private levelIndex = 0;
  private gridGraphics?: Phaser.GameObjects.Graphics;
  private hoverGraphics?: Phaser.GameObjects.Graphics;
  private fxLayer?: Phaser.GameObjects.Container;
  private paperBg?: Phaser.GameObjects.TileSprite;
  private entityViews = new Map<string, EntityView>();
  private debugEnabled = false;
  private editorEnabled = false;
  private editorPalette = Object.keys(ENTITY_DEFS)
    .filter((id) => id !== 'txt-topic' || true)
    .sort();
  private editorSelectionIndex = 0;
  private hoverCell?: CellCoord;
  private exportStatus?: string;
  private lastSnapshot?: SimulationSnapshot;
  private eventHistory: string[] = [];
  private showGloss = false;
  private highContrast = false;
  private reducedMotion = false;
  private audioMuted = false;
  private moveCooldownUntil = 0;
  private queuedMove?: Direction;
  private readonly sfx = new SfxManager();

  constructor() {
    super('LevelScene');
  }

  create(): void {
    ensureRuntimeAssets(this);
    this.cameras.main.setBackgroundColor(0x15120f);
    this.drawBackdrop();
    this.gridGraphics = this.add.graphics();
    this.hoverGraphics = this.add.graphics();
    this.fxLayer = this.add.container(0, 0);

    this.input.mouse?.disableContextMenu();
    this.bindKeys();
    this.bindPointer();
    this.scale.on('resize', this.onResize, this);

    this.renderSnapshot(this.simulation.getSnapshot(), false);
  }

  update(_time: number, delta: number): void {
    if (this.paperBg) {
      this.paperBg.tilePositionX += delta * 0.004;
      this.paperBg.tilePositionY += delta * 0.002;
    }
    if (this.hoverGraphics && this.editorEnabled && this.hoverCell) {
      const alpha = 0.18 + (Math.sin(this.time.now / 180) + 1) * 0.06;
      this.hoverGraphics.clear();
      this.hoverGraphics.lineStyle(2, 0xc7a24a, 0.95);
      this.hoverGraphics.fillStyle(0xc7a24a, alpha);
      const x = BOARD_LEFT + this.hoverCell.x * TILE;
      const y = BOARD_TOP + this.hoverCell.y * TILE;
      this.hoverGraphics.fillRoundedRect(x + 3, y + 3, TILE - 6, TILE - 6, 10);
      this.hoverGraphics.strokeRoundedRect(x + 3, y + 3, TILE - 6, TILE - 6, 10);
    }

    if (this.queuedMove && this.time.now >= this.moveCooldownUntil) {
      const dir = this.queuedMove;
      this.queuedMove = undefined;
      this.executeMove(dir);
    }
  }

  private bindKeys(): void {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (key === 'e') {
        this.editorEnabled = !this.editorEnabled;
        this.exportStatus = undefined;
        this.pushHud(this.lastSnapshot ?? this.simulation.getSnapshot());
        return;
      }

      if (key === 'g') {
        this.showGloss = !this.showGloss;
        this.renderSnapshot(this.simulation.getSnapshot(), false, false);
        return;
      }

      if (key === 'h') {
        this.highContrast = !this.highContrast;
        this.renderSnapshot(this.simulation.getSnapshot(), false, false);
        return;
      }

      if (key === 't') {
        this.reducedMotion = !this.reducedMotion;
        this.pushHud(this.lastSnapshot ?? this.simulation.getSnapshot());
        return;
      }

      if (key === 'm') {
        this.audioMuted = !this.audioMuted;
        this.sfx.setMuted(this.audioMuted);
        this.pushHud(this.lastSnapshot ?? this.simulation.getSnapshot());
        return;
      }

      if (this.editorEnabled && (key === '[' || key === ']')) {
        this.editorSelectionIndex = Phaser.Math.Wrap(
          this.editorSelectionIndex + (key === ']' ? 1 : -1),
          0,
          this.editorPalette.length,
        );
        this.pushHud(this.lastSnapshot ?? this.simulation.getSnapshot());
        return;
      }

      if (this.editorEnabled && key === 'p') {
        void this.exportCurrentLevelJson();
        return;
      }

      if (key === 'arrowup' || key === 'w') {
        this.applyMove('up');
      } else if (key === 'arrowdown' || key === 's') {
        this.applyMove('down');
      } else if (key === 'arrowleft' || key === 'a') {
        this.applyMove('left');
      } else if (key === 'arrowright' || key === 'd') {
        this.applyMove('right');
      } else if (key === 'z') {
        this.simulation.undo();
        this.renderSnapshot(this.simulation.getSnapshot(), true);
      } else if (key === 'r') {
        this.reloadCurrentLevel();
      } else if (key === 'n') {
        this.loadNextLevel();
      } else if (event.key === '~' || event.key === '`') {
        this.debugEnabled = !this.debugEnabled;
        this.pushHud(this.lastSnapshot ?? this.simulation.getSnapshot());
        this.renderSnapshot(this.simulation.getSnapshot(), false, false);
      }
    });
  }

  private bindPointer(): void {
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.hoverCell = this.pointerToCell(pointer);
      if (!this.editorEnabled && this.hoverGraphics) {
        this.hoverGraphics.clear();
      }
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.editorEnabled) {
        return;
      }
      const cell = this.pointerToCell(pointer);
      if (!cell) {
        return;
      }
      const rightClick = pointer.rightButtonDown() || pointer.button === 2;
      this.applyEditorEdit(cell, rightClick ? 'erase' : 'place');
    });
  }

  private applyMove(direction: Direction): void {
    if (this.editorEnabled) {
      return;
    }
    if (this.time.now < this.moveCooldownUntil) {
      this.queuedMove = direction;
      return;
    }
    this.executeMove(direction);
  }

  private executeMove(direction: Direction): void {
    this.simulation.move(direction);
    this.moveCooldownUntil = this.time.now + (this.reducedMotion ? 10 : 110);
    this.renderSnapshot(this.simulation.getSnapshot(), !this.reducedMotion);
  }

  private loadNextLevel(): void {
    this.levelIndex = (this.levelIndex + 1) % TUTORIAL_LEVELS.length;
    this.currentLevel = this.cloneLevel(this.getLevelOrThrow(this.levelIndex));
    this.queuedMove = undefined;
    this.moveCooldownUntil = 0;
    this.simulation.loadLevel(this.currentLevel);
    this.clearEntityViews();
    this.renderSnapshot(this.simulation.getSnapshot(), false);
  }

  private reloadCurrentLevel(): void {
    this.queuedMove = undefined;
    this.moveCooldownUntil = 0;
    this.simulation.loadLevel(this.cloneLevel(this.currentLevel));
    this.clearEntityViews();
    this.renderSnapshot(this.simulation.getSnapshot(), false);
  }

  private getLevelOrThrow(index: number): LevelData {
    const level = TUTORIAL_LEVELS[index];
    if (!level) {
      throw new Error(`Missing level at index ${index}`);
    }
    return level;
  }

  private cloneLevel(level: LevelData): LevelData {
    return {
      ...level,
      entities: level.entities.map((e) => ({ ...e })),
    };
  }

  private renderSnapshot(snapshot: SimulationSnapshot, animate: boolean, reactToEvents = true): void {
    const prevSnapshot = this.lastSnapshot;
    this.lastSnapshot = snapshot;
    this.drawGrid(snapshot.width, snapshot.height);
    this.syncEntities(snapshot, animate);
    if (reactToEvents) {
      this.appendEventHistory(snapshot);
      this.emitEventFx(snapshot.lastEvents, snapshot, prevSnapshot);
      this.sfx.playEvents(snapshot.lastEvents);
    }
    this.pushHud(snapshot);
  }

  private pushHud(snapshot: SimulationSnapshot): void {
    const ui = this.scene.get('UIScene') as UIScene;
    const selectedDef = this.getSelectedEditorDef();
    ui.updateState({
      snapshot,
      formattedRules: snapshot.activeRules.map((rule) => this.simulation.formatRule(rule)),
      debugEnabled: this.debugEnabled,
      eventLog: this.eventHistory,
      settings: {
        gloss: this.showGloss,
        highContrast: this.highContrast,
        reducedMotion: this.reducedMotion,
        muted: this.audioMuted,
      },
      editor: {
        enabled: this.editorEnabled,
        selectedLabel: selectedDef.label,
        selectedGlyph: selectedDef.glyph,
        exportStatus: this.exportStatus,
      },
    });
  }

  private appendEventHistory(snapshot: SimulationSnapshot): void {
    if (snapshot.lastEvents.length === 0) {
      return;
    }
    const resetLog = snapshot.lastEvents.some((e) => e.type === 'level-load' || e.type === 'restart');
    if (resetLog) {
      this.eventHistory = [];
    }
    for (const event of snapshot.lastEvents) {
      if (event.type === 'move' && snapshot.lastEvents.length > 1) {
        continue;
      }
      this.eventHistory.push(`${String(snapshot.moveCount).padStart(2, '0')}  ${event.message}`);
    }
    if (this.eventHistory.length > 7) {
      this.eventHistory = this.eventHistory.slice(-7);
    }
  }

  private drawBackdrop(): void {
    const { width, height } = this.scale;
    const bg = this.highContrast ? 0x100f0e : 0x171310;

    this.add.rectangle(0, 0, width, height, bg, 1).setOrigin(0, 0);
    this.paperBg = this.add.tileSprite(0, 0, width, height, RUNTIME_TEX.paper).setOrigin(0, 0).setAlpha(this.highContrast ? 0.12 : 0.28);
    this.add.rectangle(12, 86, width - (RIGHT_PANEL_W + 24), height - 98, 0x1f1a17, this.highContrast ? 0.25 : 0.38).setOrigin(0, 0);

    for (let i = 0; i < 8; i += 1) {
      this.add.ellipse(160 + i * 110, 160 + (i % 3) * 100, 260, 80, 0x5c7a5a, 0.025);
      this.add.ellipse(120 + i * 130, 220 + (i % 4) * 80, 240, 70, 0xc44b2b, 0.012);
    }
  }

  private drawGrid(cols: number, rows: number): void {
    if (!this.gridGraphics) {
      return;
    }

    const g = this.gridGraphics;
    g.clear();
    const boardWidth = cols * TILE;
    const boardHeight = rows * TILE;

    g.fillStyle(0xf2e8d5, this.highContrast ? 0.08 : 0.05);
    g.fillRoundedRect(BOARD_LEFT, BOARD_TOP, boardWidth, boardHeight, 14);

    g.lineStyle(2, 0x000000, this.highContrast ? 0.15 : 0.08);
    g.strokeRoundedRect(BOARD_LEFT, BOARD_TOP, boardWidth, boardHeight, 14);

    g.lineStyle(1, 0xf2e8d5, this.highContrast ? 0.14 : 0.085);
    for (let x = 0; x <= cols; x += 1) {
      g.lineBetween(BOARD_LEFT + x * TILE, BOARD_TOP, BOARD_LEFT + x * TILE, BOARD_TOP + boardHeight);
    }
    for (let y = 0; y <= rows; y += 1) {
      g.lineBetween(BOARD_LEFT, BOARD_TOP + y * TILE, BOARD_LEFT + boardWidth, BOARD_TOP + y * TILE);
    }
  }

  private syncEntities(snapshot: SimulationSnapshot, animate: boolean): void {
    const entities = snapshot.entities;
    const byCell = new Map<string, EntityState[]>();
    for (const entity of entities) {
      const key = `${entity.x},${entity.y}`;
      const stack = byCell.get(key);
      if (stack) {
        stack.push(entity);
      } else {
        byCell.set(key, [entity]);
      }
    }

    const activeProps = this.buildActivePropertyMap(snapshot.activeRules);
    const activeIds = new Set(entities.map((e) => e.id));
    for (const [id, view] of this.entityViews.entries()) {
      if (!activeIds.has(id)) {
        this.tweens.add({
          targets: [view.body, view.shadow, view.glyph, view.gloss, view.badge],
          alpha: 0,
          scaleX: 0.8,
          scaleY: 0.8,
          duration: 120,
          onComplete: () => {
            view.shadow.destroy();
            view.body.destroy();
            view.glyph.destroy();
            view.gloss.destroy();
            view.badge.destroy();
          },
        });
        this.entityViews.delete(id);
      }
    }

    for (const entity of entities) {
      const stack = byCell.get(`${entity.x},${entity.y}`) ?? [];
      const stackIndex = stack.findIndex((e) => e.id === entity.id);
      const def = ENTITY_DEFS[entity.defId];
      if (!def) {
        continue;
      }

      let view = this.entityViews.get(entity.id);
      if (!view) {
        view = this.createEntityView(def.glyph, def.tint);
        this.entityViews.set(entity.id, view);
        view.body.alpha = 0;
        view.glyph.alpha = 0;
        view.shadow.alpha = 0;
        view.gloss.alpha = 0;
        view.badge.alpha = 0;
        this.tweens.add({ targets: [view.body, view.glyph, view.shadow, view.gloss, view.badge], alpha: 1, duration: 120 });
      }

      const nounProps = def.nounKey ? activeProps.get(def.nounKey) : undefined;
      const style = this.getVisualStyle(def, nounProps);
      const pos = this.cellToWorld(entity.x, entity.y, Math.max(0, stackIndex));
      const fontSize = this.debugEnabled ? 18 : def.glyph.length > 1 ? 24 : 32;
      const youPulse = nounProps?.has('YOU') && !this.reducedMotion ? 0.14 * (Math.sin(this.time.now / 140) + 1) : 0;

      view.body.setFillStyle(style.fill, style.fillAlpha);
      view.body.setStrokeStyle(style.strokeWidth, style.stroke, style.strokeAlpha);
      view.shadow.setFillStyle(0x000000, Math.min(0.45, style.shadowAlpha + youPulse * 0.25));
      view.glyph.setColor(style.glyphColor).setFontSize(fontSize);

      const glyphText = this.debugEnabled ? `${def.glyph}\n${entity.x},${entity.y}` : def.glyph;
      view.glyph.setText(glyphText);

      const depth = 100 + entity.y * 10 + stackIndex;
      view.shadow.setDepth(depth);
      view.body.setDepth(depth + 1);
      view.glyph.setDepth(depth + 2);
      view.gloss.setDepth(depth + 3);
      view.badge.setDepth(depth + 4);

      if (animate) {
        this.tweens.add({ targets: [view.body, view.glyph], x: pos.x, y: pos.y, duration: 130, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: view.shadow, x: pos.x + 2, y: pos.y + 4, duration: 130, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: [view.body, view.glyph], scaleX: 1.03, scaleY: 0.98, yoyo: true, duration: 70 });
      } else {
        view.shadow.setPosition(pos.x + 2, pos.y + 4);
        view.body.setPosition(pos.x, pos.y);
        view.glyph.setPosition(pos.x, pos.y);
      }

      const badgeText = this.getBadgeText(nounProps);
      view.badge
        .setText(badgeText)
        .setVisible(badgeText.length > 0)
        .setAlpha(badgeText.length > 0 ? 0.92 : 0)
        .setPosition(pos.x + 17, pos.y - 19);

      const glossText = this.showGloss && !this.debugEnabled ? this.getGlossLabel(def) : '';
      view.gloss
        .setText(glossText)
        .setVisible(glossText.length > 0)
        .setAlpha(glossText.length > 0 ? 0.85 : 0)
        .setPosition(pos.x, pos.y + 19);
    }
  }

  private getVisualStyle(def: EntityDef, nounProps?: Set<PropertyKey>) {
    let stroke = INK_COLOR;
    let strokeWidth = 2;
    let strokeAlpha = 0.8;
    let fill = def.tint;
    let fillAlpha = 0.96;
    let glyphColor = '#1f1a17';
    let shadowAlpha = 0.18;

    if (nounProps?.has('YOU')) {
      stroke = 0xc7a24a;
      strokeWidth = this.highContrast ? 5 : 4;
      strokeAlpha = 1;
      shadowAlpha = 0.28;
      fillAlpha = 1;
    }
    if (nounProps?.has('WIN')) {
      stroke = 0x5fbf71;
      strokeWidth = Math.max(strokeWidth, 3);
      strokeAlpha = 0.95;
      fillAlpha = 0.99;
    }
    if (nounProps?.has('HOT')) {
      fill = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(def.tint),
        Phaser.Display.Color.ValueToColor(0xd96a3a),
        100,
        24,
      ).color;
    }
    if (nounProps?.has('SINK')) {
      glyphColor = '#214651';
      stroke = 0x4f91a5;
      strokeWidth = Math.max(strokeWidth, 3);
    }
    if (this.highContrast) {
      strokeAlpha = Math.max(0.95, strokeAlpha);
      fillAlpha = Math.max(fillAlpha, 0.99);
    }

    return { stroke, strokeWidth, strokeAlpha, fill, fillAlpha, glyphColor, shadowAlpha };
  }

  private buildActivePropertyMap(rules: ActiveRuleView[]): Map<NounKey, Set<PropertyKey>> {
    const map = new Map<NounKey, Set<PropertyKey>>();
    for (const rule of rules) {
      if (rule.kind !== 'property' || !rule.property) {
        continue;
      }
      let props = map.get(rule.noun);
      if (!props) {
        props = new Set<PropertyKey>();
        map.set(rule.noun, props);
      }
      props.add(rule.property);
    }
    return map;
  }

  private createEntityView(glyph: string, tint: number): EntityView {
    const shadow = this.add.rectangle(0, 0, TILE - 10, TILE - 10, 0x000000, 0.18).setOrigin(0.5);
    const body = this.add.rectangle(0, 0, TILE - 10, TILE - 10, tint, 0.96).setOrigin(0.5);
    body.setStrokeStyle(2, INK_COLOR, 0.8);
    const glyphText = this.add.text(0, 0, glyph, {
      fontFamily: 'serif',
      fontSize: '32px',
      color: '#1f1a17',
      align: 'center',
    }).setOrigin(0.5);
    const gloss = this.add.text(0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#1f1a17',
      align: 'center',
      backgroundColor: '#f2e8d5cc',
      padding: { left: 3, right: 3, top: 0, bottom: 0 },
    }).setOrigin(0.5).setVisible(false);
    const badge = this.add.text(0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#f2e8d5',
      backgroundColor: '#1f1a17cc',
      padding: { left: 3, right: 3, top: 0, bottom: 0 },
    }).setOrigin(0.5).setVisible(false);

    return { shadow, body, glyph: glyphText, gloss, badge };
  }

  private getBadgeText(nounProps?: Set<PropertyKey>): string {
    if (!nounProps || nounProps.size === 0) {
      return '';
    }
    if (nounProps.has('YOU')) return 'YOU';
    if (nounProps.has('WIN')) return 'WIN';
    if (nounProps.has('HOT')) return 'HOT';
    if (nounProps.has('SINK')) return 'SINK';
    if (nounProps.has('STOP')) return 'STOP';
    return '';
  }

  private getGlossLabel(def: EntityDef): string {
    const label = def.label
      .replace(/\s+text$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    return label.length > 11 ? `${label.slice(0, 10)}…` : label;
  }

  private emitEventFx(events: SimulationEvent[], snapshot: SimulationSnapshot, prevSnapshot?: SimulationSnapshot): void {
    if (!this.fxLayer || events.length === 0) {
      return;
    }

    const center = {
      x: BOARD_LEFT + (snapshot.width * TILE) / 2,
      y: BOARD_TOP + (snapshot.height * TILE) / 2,
    };

    for (const event of events) {
      if (event.type === 'fusion') {
        const pos = (typeof event.x === 'number' && typeof event.y === 'number')
          ? this.cellCenter(event.x, event.y)
          : center;
        this.spawnRingFx(pos.x, pos.y, 0xc7a24a);
        this.spawnSpecks(pos.x, pos.y, 0xd96a3a, 12);
        if (event.cells) {
          this.highlightCells(event.cells, 0xc7a24a);
        }
      } else if (event.type === 'transform') {
        const pos = (typeof event.x === 'number' && typeof event.y === 'number')
          ? this.cellCenter(event.x, event.y)
          : center;
        this.spawnRingFx(pos.x, pos.y, 0x88b7c7, 0.9);
        this.spawnSpecks(pos.x, pos.y, 0x88b7c7, 8);
        if (event.cells) {
          this.highlightCells(event.cells, 0x88b7c7);
        }
      } else if (event.type === 'win') {
        this.spawnRingFx(center.x, center.y, 0x5fbf71, 1.6);
        this.spawnSpecks(center.x, center.y, 0x5fbf71, 20);
        this.cameras.main.shake(140, 0.003);
      } else if (event.type === 'blocked') {
        this.cameras.main.shake(30, 0.0015);
      } else if (event.type === 'rule-change') {
        this.spawnRingFx(center.x, center.y, 0x88b7c7, 1.15);
        const newRuleCells = this.findNewRuleCells(prevSnapshot, snapshot);
        if (newRuleCells.length > 0) {
          this.highlightCells(newRuleCells, 0x88b7c7);
        }
      }
    }

    if (prevSnapshot && !events.some((e) => e.type === 'transform')) {
      this.highlightTransformDiffs(prevSnapshot, snapshot);
    }
  }

  private spawnRingFx(x: number, y: number, tint: number, scale = 1): void {
    const ring = this.add.image(x, y, RUNTIME_TEX.ring).setTint(tint).setAlpha(0.85).setScale(scale * 0.7).setDepth(900);
    this.fxLayer?.add(ring);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      scaleX: scale * 2.1,
      scaleY: scale * 2.1,
      duration: 240,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private spawnSpecks(x: number, y: number, tint: number, count: number): void {
    for (let i = 0; i < count; i += 1) {
      const speck = this.add.image(x, y, RUNTIME_TEX.speck).setTint(tint).setAlpha(0.9).setDepth(901);
      this.fxLayer?.add(speck);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.Between(18, 70);
      this.tweens.add({
        targets: speck,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: Phaser.Math.Between(180, 320),
        ease: 'Quad.easeOut',
        onComplete: () => speck.destroy(),
      });
    }
  }

  private highlightCells(cells: [number, number][], tint: number): void {
    for (const [x, y] of cells) {
      const world = this.cellCenter(x, y);
      const rect = this.add.rectangle(world.x, world.y, TILE - 12, TILE - 12, tint, 0.18).setDepth(899);
      this.fxLayer?.add(rect);
      this.tweens.add({
        targets: rect,
        alpha: 0,
        scaleX: 1.08,
        scaleY: 1.08,
        duration: this.reducedMotion ? 40 : 180,
        ease: 'Quad.easeOut',
        onComplete: () => rect.destroy(),
      });
    }
  }

  private highlightTransformDiffs(prevSnapshot: SimulationSnapshot, snapshot: SimulationSnapshot): void {
    const prevById = new Map(prevSnapshot.entities.map((e) => [e.id, e] as const));
    for (const entity of snapshot.entities) {
      const prev = prevById.get(entity.id);
      if (!prev) {
        continue;
      }
      if (prev.defId !== entity.defId) {
        this.highlightCells([[entity.x, entity.y]], 0x88b7c7);
      }
    }
  }

  private findNewRuleCells(prevSnapshot: SimulationSnapshot | undefined, snapshot: SimulationSnapshot): [number, number][] {
    if (!prevSnapshot) {
      return [];
    }
    const prevKeys = new Set(prevSnapshot.activeRules.map((rule) => this.ruleViewKey(rule)));
    const cells: [number, number][] = [];
    for (const rule of snapshot.activeRules) {
      if (prevKeys.has(this.ruleViewKey(rule))) {
        continue;
      }
      if (rule.cells) {
        cells.push(...rule.cells);
      }
    }
    return cells;
  }

  private ruleViewKey(rule: ActiveRuleView): string {
    const right = rule.kind === 'property' ? rule.property : rule.targetNoun;
    const cells = (rule.cells ?? []).map(([x, y]) => `${x},${y}`).join(';');
    return `${rule.kind}:${rule.noun}:${String(right)}:${cells}`;
  }

  private cellCenter(x: number, y: number): { x: number; y: number } {
    return {
      x: BOARD_LEFT + x * TILE + TILE / 2,
      y: BOARD_TOP + y * TILE + TILE / 2,
    };
  }

  private pointerToCell(pointer: Phaser.Input.Pointer): CellCoord | undefined {
    const snapshot = this.lastSnapshot ?? this.simulation.getSnapshot();
    const localX = pointer.worldX - BOARD_LEFT;
    const localY = pointer.worldY - BOARD_TOP;
    if (localX < 0 || localY < 0) {
      return undefined;
    }
    const x = Math.floor(localX / TILE);
    const y = Math.floor(localY / TILE);
    if (x < 0 || y < 0 || x >= snapshot.width || y >= snapshot.height) {
      return undefined;
    }
    return { x, y };
  }

  private applyEditorEdit(cell: CellCoord, mode: 'place' | 'erase'): void {
    this.syncCurrentLevelEntitiesFromSnapshot();
    const next: LevelEntityPlacement[] = this.currentLevel.entities.map((e) => ({ ...e }));

    if (mode === 'erase') {
      for (let i = next.length - 1; i >= 0; i -= 1) {
        const item = next[i];
        if (item && item.x === cell.x && item.y === cell.y) {
          next.splice(i, 1);
          break;
        }
      }
    } else {
      const def = this.getSelectedEditorDef();
      next.push({ defId: def.id, x: cell.x, y: cell.y });
    }

    this.currentLevel = { ...this.currentLevel, entities: next };
    this.queuedMove = undefined;
    this.moveCooldownUntil = 0;
    this.simulation.loadLevel(this.cloneLevel(this.currentLevel));
    this.clearEntityViews();
    this.renderSnapshot(this.simulation.getSnapshot(), false);
  }

  private getSelectedEditorDef(): EntityDef {
    const id = this.editorPalette[this.editorSelectionIndex];
    if (!id) {
      throw new Error('Editor palette is empty');
    }
    const def = ENTITY_DEFS[id];
    if (!def) {
      throw new Error(`Missing editor def ${id}`);
    }
    return def;
  }

  private async exportCurrentLevelJson(): Promise<void> {
    this.syncCurrentLevelEntitiesFromSnapshot();
    const payload = JSON.stringify(this.currentLevel, null, 2);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
        this.exportStatus = 'JSON copied';
      } else {
        this.exportStatus = 'Clipboard unavailable';
      }
    } catch {
      this.exportStatus = 'Copy failed (see console)';
    }

    console.log('Kanji Shift level export:', payload);
    const ui = this.scene.get('UIScene') as UIScene;
    ui.notify(`Level JSON exported (${this.currentLevel.entities.length} placements)`);
    this.pushHud(this.lastSnapshot ?? this.simulation.getSnapshot());
  }

  private cellToWorld(x: number, y: number, stackIndex: number): { x: number; y: number } {
    return {
      x: BOARD_LEFT + x * TILE + TILE / 2 + stackIndex * 3,
      y: BOARD_TOP + y * TILE + TILE / 2 - stackIndex * 3,
    };
  }

  private clearEntityViews(): void {
    for (const view of this.entityViews.values()) {
      view.shadow.destroy();
      view.body.destroy();
      view.glyph.destroy();
      view.gloss.destroy();
      view.badge.destroy();
    }
    this.entityViews.clear();
  }

  private onResize(gameSize: Phaser.Structs.Size): void {
    this.paperBg?.setSize(gameSize.width, gameSize.height);
  }

  private syncCurrentLevelEntitiesFromSnapshot(): void {
    const snapshot = this.lastSnapshot ?? this.simulation.getSnapshot();
    this.currentLevel = {
      ...this.currentLevel,
      width: snapshot.width,
      height: snapshot.height,
      entities: snapshot.entities.map((e) => ({ defId: e.defId, x: e.x, y: e.y })),
    };
  }
}
