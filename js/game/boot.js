// Arranque de Phaser.
import { MainScene } from './scene.js';
export const RES = 2; // resolución interna x2 para pantallas de alta densidad (mundo de 720x960; se muestran 720x900)
export function createGame(parent, assetBase = '', renderer = Phaser.AUTO) {
  const scene = new MainScene(); scene.assetBase = assetBase; scene.res = RES;
  const game = new Phaser.Game({
    type: renderer, parent, width: 720 * RES, height: 900 * RES, backgroundColor: '#070c24', transparent: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [scene], render: { antialias: true, pixelArt: false, maxTextures: 4 /* lotes grandes de texturas fallan en algunos WebGL */ }, input: { activePointers: 2 }, banner: false, audio: { noAudio: true },
  });
  return { game, scene };
}
