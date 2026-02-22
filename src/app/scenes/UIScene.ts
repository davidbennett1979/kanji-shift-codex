import Phaser from 'phaser';
import type { SimulationSnapshot } from '../../core/model/Types';

export interface HudState {
  snapshot: SimulationSnapshot;
  formattedRules: string[];
  debugEnabled: boolean;
}

export class UIScene extends Phaser.Scene {
  private topBar?: Phaser.GameObjects.Rectangle;
  private rightPanel?: Phaser.GameObjects.Rectangle;
  private levelText?: Phaser.GameObjects.Text;
  private hintText?: Phaser.GameObjects.Text;
  private rulesText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private toastBg?: Phaser.GameObjects.Rectangle;
  private toastText?: Phaser.GameObjects.Text;

  constructor() {
    super('UIScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.topBar = this.add.rectangle(0, 0, width, 62, 0x130f0d, 0.88).setOrigin(0, 0).setScrollFactor(0).setDepth(1000);
    this.rightPanel = this.add.rectangle(width - 260, 62, 260, height - 62, 0x171310, 0.86)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    this.levelText = this.add.text(16, 10, 'Kanji Shift', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#f2e8d5',
    }).setDepth(1001);

    this.statusText = this.add.text(16, 34, '', {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: '#cabfa8',
    }).setDepth(1001);

    this.hintText = this.add.text(width - 248, 74, '', {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: '#d8ceb8',
      wordWrap: { width: 232 },
    }).setDepth(1001);

    this.rulesText = this.add.text(width - 248, 148, 'Rules', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#f2e8d5',
      wordWrap: { width: 232 },
      lineSpacing: 4,
    }).setDepth(1001);

    this.toastBg = this.add.rectangle(width / 2, height - 28, Math.min(width - 32, 640), 36, 0x130f0d, 0.92)
      .setDepth(1000)
      .setVisible(false);
    this.toastText = this.add.text(width / 2, height - 28, '', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#f2e8d5',
      align: 'center',
    }).setOrigin(0.5).setDepth(1001).setVisible(false);

    this.scale.on('resize', this.onResize, this);
  }

  updateState(state: HudState): void {
    const { snapshot, formattedRules, debugEnabled } = state;

    this.levelText?.setText(snapshot.levelName);
    this.statusText?.setText(
      `Moves: ${snapshot.moveCount}  |  ${snapshot.won ? 'CLEAR' : 'Playing'}  |  Z undo / R restart / N next / ~ debug`
    );
    this.hintText?.setText(snapshot.hint ? `Hint\n${snapshot.hint}` : '');

    const debugLine = debugEnabled ? `\n\nDebug: ON\nEntities: ${snapshot.entities.length}` : '';
    this.rulesText?.setText(`Active Rules\n${formattedRules.length ? formattedRules.map((r) => `• ${r}`).join('\n') : '• (none)'}${debugLine}`);

    const toast = snapshot.lastEvents[snapshot.lastEvents.length - 1];
    if (toast) {
      this.showToast(toast.message);
    }
  }

  private showToast(message: string): void {
    if (!this.toastBg || !this.toastText) {
      return;
    }
    this.toastBg.setVisible(true);
    this.toastText.setVisible(true).setText(message);
    this.tweens.killTweensOf([this.toastBg, this.toastText]);
    this.toastBg.alpha = 0.92;
    this.toastText.alpha = 1;
    this.tweens.add({
      targets: [this.toastBg, this.toastText],
      alpha: 0.25,
      duration: 1600,
      delay: 700,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.toastBg?.setVisible(false);
        this.toastText?.setVisible(false);
      },
    });
  }

  private onResize(gameSize: Phaser.Structs.Size): void {
    const width = gameSize.width;
    const height = gameSize.height;
    this.topBar?.setSize(width, 62);
    this.rightPanel?.setPosition(width - 260, 62).setSize(260, height - 62);
    this.hintText?.setPosition(width - 248, 74).setWordWrapWidth(232);
    this.rulesText?.setPosition(width - 248, 148).setWordWrapWidth(232);
    this.toastBg?.setPosition(width / 2, height - 28).setSize(Math.min(width - 32, 640), 36);
    this.toastText?.setPosition(width / 2, height - 28);
  }
}
