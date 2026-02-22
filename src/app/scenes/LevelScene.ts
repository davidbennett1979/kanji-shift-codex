import Phaser from 'phaser';
import { Simulation } from '../../core/engine/Simulation';
import { ENTITY_DEFS, INK_COLOR } from '../../core/content/kanjiDefs';
import type { Direction, EntityState, SimulationSnapshot } from '../../core/model/Types';
import { TUTORIAL_LEVELS } from '../../content/levels/tutorialLevels';
import { UIScene } from './UIScene';

type EntityView = {
  shadow: Phaser.GameObjects.Rectangle;
  body: Phaser.GameObjects.Rectangle;
  glyph: Phaser.GameObjects.Text;
};

const TILE = 64;
const BOARD_TOP = 74;
const BOARD_LEFT = 20;

export class LevelScene extends Phaser.Scene {
  private simulation = new Simulation(this.getLevelOrThrow(0));
  private levelIndex = 0;
  private gridGraphics?: Phaser.GameObjects.Graphics;
  private entityViews = new Map<string, EntityView>();
  private debugEnabled = false;
  private lastSnapshot?: SimulationSnapshot;

  constructor() {
    super('LevelScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x15120f);
    this.drawBackdrop();
    this.gridGraphics = this.add.graphics();

    this.bindKeys();
    this.renderSnapshot(this.simulation.getSnapshot(), false);
  }

  private bindKeys(): void {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
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
        this.simulation.restart();
        this.clearEntityViews();
        this.renderSnapshot(this.simulation.getSnapshot(), false);
      } else if (key === 'n') {
        this.loadNextLevel();
      } else if (event.key === '~' || event.key === '`') {
        this.debugEnabled = !this.debugEnabled;
        if (this.lastSnapshot) {
          this.pushHud(this.lastSnapshot);
        }
      }
    });
  }

  private applyMove(direction: Direction): void {
    this.simulation.move(direction);
    this.renderSnapshot(this.simulation.getSnapshot(), true);
  }

  private loadNextLevel(): void {
    this.levelIndex = (this.levelIndex + 1) % TUTORIAL_LEVELS.length;
    this.simulation.loadLevel(this.getLevelOrThrow(this.levelIndex));
    this.clearEntityViews();
    this.renderSnapshot(this.simulation.getSnapshot(), false);
  }

  private getLevelOrThrow(index: number) {
    const level = TUTORIAL_LEVELS[index];
    if (!level) {
      throw new Error(`Missing level at index ${index}`);
    }
    return level;
  }

  private renderSnapshot(snapshot: SimulationSnapshot, animate: boolean): void {
    this.lastSnapshot = snapshot;
    this.drawGrid(snapshot.width, snapshot.height);
    this.syncEntities(snapshot.entities, animate);
    this.pushHud(snapshot);
  }

  private pushHud(snapshot: SimulationSnapshot): void {
    const ui = this.scene.get('UIScene') as UIScene;
    ui.updateState({
      snapshot,
      formattedRules: snapshot.activeRules.map((rule) => this.simulation.formatRule(rule)),
      debugEnabled: this.debugEnabled,
    });
  }

  private drawBackdrop(): void {
    const g = this.add.graphics();
    const { width, height } = this.scale;

    g.fillStyle(0x1b1714, 1);
    g.fillRect(0, 0, width, height);

    g.fillStyle(0x211b17, 0.7);
    g.fillRoundedRect(12, 66, width - 284, height - 78, 16);

    for (let i = 0; i < 10; i += 1) {
      g.fillStyle(0x2a231d, 0.07);
      g.fillEllipse(120 + i * 90, 100 + (i % 3) * 120, 180, 70);
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

    g.fillStyle(0xf2e8d5, 0.05);
    g.fillRoundedRect(BOARD_LEFT, BOARD_TOP, boardWidth, boardHeight, 12);

    g.lineStyle(1, 0xf2e8d5, 0.09);
    for (let x = 0; x <= cols; x += 1) {
      g.lineBetween(BOARD_LEFT + x * TILE, BOARD_TOP, BOARD_LEFT + x * TILE, BOARD_TOP + boardHeight);
    }
    for (let y = 0; y <= rows; y += 1) {
      g.lineBetween(BOARD_LEFT, BOARD_TOP + y * TILE, BOARD_LEFT + boardWidth, BOARD_TOP + y * TILE);
    }
  }

  private syncEntities(entities: EntityState[], animate: boolean): void {
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

    const activeIds = new Set(entities.map((e) => e.id));
    for (const [id, view] of this.entityViews.entries()) {
      if (!activeIds.has(id)) {
        this.tweens.add({
          targets: [view.body, view.shadow, view.glyph],
          alpha: 0,
          scaleX: 0.8,
          scaleY: 0.8,
          duration: 120,
          onComplete: () => {
            view.shadow.destroy();
            view.body.destroy();
            view.glyph.destroy();
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
        view = this.createEntityView(def.glyph, def.tint, def.kind === 'text');
        this.entityViews.set(entity.id, view);
      }

      const pos = this.cellToWorld(entity.x, entity.y, Math.max(0, stackIndex));
      const fontSize = def.glyph.length > 1 ? 24 : 32;
      view.glyph.setText(def.glyph).setFontSize(fontSize);
      view.body.setFillStyle(def.tint, 0.96);
      view.body.setStrokeStyle(2, INK_COLOR, 0.8);
      view.glyph.setColor('#1f1a17');

      const depth = 100 + entity.y * 10 + stackIndex;
      view.shadow.setDepth(depth);
      view.body.setDepth(depth + 1);
      view.glyph.setDepth(depth + 2);

      if (animate) {
        this.tweens.add({ targets: [view.body, view.glyph], x: pos.x, y: pos.y, duration: 130, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: view.shadow, x: pos.x + 2, y: pos.y + 4, duration: 130, ease: 'Quad.easeOut' });
      } else {
        view.shadow.setPosition(pos.x + 2, pos.y + 4);
        view.body.setPosition(pos.x, pos.y);
        view.glyph.setPosition(pos.x, pos.y);
      }

      if (animate) {
        this.tweens.add({ targets: [view.body, view.glyph], scaleX: 1.03, scaleY: 0.98, yoyo: true, duration: 70 });
      }

      if (this.debugEnabled) {
        view.glyph.setText(`${def.glyph}\n${entity.x},${entity.y}`);
        view.glyph.setFontSize(18);
      }
    }
  }

  private createEntityView(glyph: string, tint: number, isText: boolean): EntityView {
    const shadow = this.add.rectangle(0, 0, TILE - 10, TILE - 10, 0x000000, 0.18).setOrigin(0.5);
    const body = this.add.rectangle(0, 0, TILE - 10, TILE - 10, tint, 0.96).setOrigin(0.5);
    body.setStrokeStyle(2, 0x1f1a17, 0.8);
    const glyphText = this.add.text(0, 0, glyph, {
      fontFamily: 'serif',
      fontSize: '32px',
      color: '#1f1a17',
      align: 'center',
    }).setOrigin(0.5);

    return { shadow, body, glyph: glyphText };
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
    }
    this.entityViews.clear();
  }
}
