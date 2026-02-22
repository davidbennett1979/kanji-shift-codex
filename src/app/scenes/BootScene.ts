import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.scene.launch('UIScene');
    this.scene.start('LevelScene');
  }
}
