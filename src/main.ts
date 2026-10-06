import Phaser from "phaser";
import { VillageScene } from "./game/VillageScene.ts";

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: "game",
  width: 320,
  height: 180,
  pixelArt: true,
  backgroundColor: "#1b1730",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [VillageScene],
});

if (import.meta.env.DEV) Object.assign(window, { game }); // inspeção no console durante o desenvolvimento
