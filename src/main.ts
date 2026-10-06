import Phaser from "phaser";
import { VillageScene } from "./game/VillageScene.ts";

// Pixel art nítida: o canvas usa pixels REAIS da tela (considerando a escala do Windows, ex. 125%)
// e a câmera amplia só por números inteiros. Escala fracionada deixa pixels de tamanhos diferentes.
const devicePx = () => ({
  w: Math.floor(innerWidth * devicePixelRatio),
  h: Math.floor(innerHeight * devicePixelRatio),
});

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: "game",
  ...(({ w, h }) => ({ width: w, height: h }))(devicePx()),
  pixelArt: true,
  backgroundColor: "#1b1730",
  scale: { mode: Phaser.Scale.NONE },
  scene: [VillageScene],
});

function fit() {
  const { w, h } = devicePx();
  game.scale.resize(w, h);
  game.canvas.style.width = `${innerWidth}px`;
  game.canvas.style.height = `${innerHeight}px`;
}
addEventListener("resize", fit);
game.events.once(Phaser.Core.Events.READY, fit);

if (import.meta.env.DEV) Object.assign(window, { game }); // inspeção no console durante o desenvolvimento
