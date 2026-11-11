// Arranque de Phaser.
import { MainScene } from './scene.js';
export function createGame(parent, assetBase = '', renderer = Phaser.AUTO) {
  const scene = new MainScene(); scene.assetBase = assetBase;
  const game = new Phaser.Game({
    type: renderer, parent, width: 800, height: 600, backgroundColor: '#1b2a6b', transparent: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [scene], render: { antialias: true, pixelArt: false, maxTextures: 4 /* lotes grandes de texturas fallan en algunos WebGL */ }, input: { activePointers: 2 }, banner: false, audio: { noAudio: true },
  });
  return { game, scene };
}
