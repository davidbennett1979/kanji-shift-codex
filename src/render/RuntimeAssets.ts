import Phaser from 'phaser';

export const RUNTIME_TEX = {
  paper: 'rt-paper-bg',
  speck: 'rt-speck',
  ring: 'rt-ring',
} as const;

export function ensureRuntimeAssets(scene: Phaser.Scene): void {
  ensurePaper(scene);
  ensureSpeck(scene);
  ensureRing(scene);
}

function ensurePaper(scene: Phaser.Scene): void {
  if (scene.textures.exists(RUNTIME_TEX.paper)) {
    return;
  }
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  ctx.fillStyle = '#201a16';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 1800; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const a = 0.02 + Math.random() * 0.04;
    const s = 1 + Math.random() * 2;
    ctx.fillStyle = `rgba(242,232,213,${a.toFixed(3)})`;
    ctx.fillRect(x, y, s, s);
  }

  for (let i = 0; i < 120; i += 1) {
    ctx.strokeStyle = `rgba(90,78,67,${(0.04 + Math.random() * 0.05).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const y = Math.random() * size;
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 32) {
      ctx.lineTo(x, y + (Math.random() * 6 - 3));
    }
    ctx.stroke();
  }

  scene.textures.addCanvas(RUNTIME_TEX.paper, canvas);
}

function ensureSpeck(scene: Phaser.Scene): void {
  if (scene.textures.exists(RUNTIME_TEX.speck)) {
    return;
  }
  const g = scene.add.graphics({ x: 0, y: 0 });
  g.fillStyle(0xffffff, 1);
  g.fillCircle(4, 4, 3);
  g.generateTexture(RUNTIME_TEX.speck, 8, 8);
  g.destroy();
}

function ensureRing(scene: Phaser.Scene): void {
  if (scene.textures.exists(RUNTIME_TEX.ring)) {
    return;
  }
  const g = scene.add.graphics({ x: 0, y: 0 });
  g.lineStyle(2, 0xffffff, 1);
  g.strokeCircle(16, 16, 12);
  g.generateTexture(RUNTIME_TEX.ring, 32, 32);
  g.destroy();
}
