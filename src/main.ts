import Phaser from "phaser";
import { StudioScene } from "./game/StudioScene.ts";
import { TitleScene } from "./game/TitleScene.ts";
import { VillageScene } from "./game/VillageScene.ts";

// Pixel art nítida: o canvas usa pixels REAIS da tela (considerando a escala do Windows, ex. 125%)
// e a câmera amplia só por números inteiros. Escala fracionada deixa pixels de tamanhos diferentes.
const devicePx = () => ({
  w: Math.floor(innerWidth * devicePixelRatio),
  h: Math.floor(innerHeight * devicePixelRatio),
});

// a fonte pixelada precisa estar carregada antes do primeiro texto, senão o Phaser desenha com a padrão
await document.fonts.load('8px "Press Start 2P"').catch(() => {});

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: "game",
  ...(({ w, h }) => ({ width: w, height: h }))(devicePx()),
  pixelArt: true,
  backgroundColor: "#1b1730",
  scale: { mode: Phaser.Scale.NONE },
  scene: [StudioScene, TitleScene, VillageScene],
});

function fit() {
  const { w, h } = devicePx();
  game.scale.resize(w, h);
  game.canvas.style.width = `${innerWidth}px`;
  game.canvas.style.height = `${innerHeight}px`;
}
addEventListener("resize", fit);
game.events.once(Phaser.Core.Events.READY, fit);

// Zoom do navegador (Ctrl +/-) e troca de monitor mudam o devicePixelRatio, nem sempre com "resize".
(function watchDpr() {
  matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener("change", () => { fit(); watchDpr(); }, { once: true });
})();

// Guarda de desenvolvimento: avisa se a imagem deixar de ser pixel-perfeita.
if (import.meta.env.DEV) {
  game.events.on(Phaser.Core.Events.POST_STEP, () => {
    const { w, h } = devicePx();
    const cam = game.scene.getScenes(true)[0]?.cameras.main;
    const bad = game.canvas.width !== w || game.canvas.height !== h || (cam && !Number.isInteger(cam.zoom));
    if (bad && !(window as any).__pixelWarned) {
      (window as any).__pixelWarned = true;
      console.error(`[pixel] escala não inteira: canvas ${game.canvas.width}x${game.canvas.height}, tela ${w}x${h}, zoom ${cam?.zoom}`);
    }
  });
}

if (import.meta.env.DEV) Object.assign(window, { game }); // inspeção no console durante o desenvolvimento
