import Phaser from "phaser";
import { loadSettings } from "./TitleScene.ts";

// Abertura do estúdio (como a do ConcernedApe no Stardew): o gatinho estressado pisca, leva um susto
// e toma um gole de café. Qualquer tecla ou clique pula.

const png = (name: string) => `assets/sprites/${name}.png?v=${import.meta.env.VITE_BUILD ?? "dev"}`;
const FONT = { fontFamily: '"Press Start 2P", monospace', fontSize: "8px", color: "#5e4a4a" };
// quadros da tira: 0 parado, 1 piscando, 2 susto, 3 gole de café
const BEATS: [number, number][] = [[0, 600], [1, 140], [0, 500], [2, 700], [3, 1100]];

export class StudioScene extends Phaser.Scene {
  constructor() { super("studio"); }

  preload() {
    this.load.spritesheet("cat", png("stressed-whiskers-anim"), { frameWidth: 72, frameHeight: 71 });
  }

  create() {
    const z = Math.max(1, Math.floor(Math.min(this.scale.width / 320, this.scale.height / 180)));
    const W = Math.ceil(this.scale.width / z), H = Math.ceil(this.scale.height / z);
    const cam = this.cameras.main.setZoom(z).setOrigin(0, 0).setRoundPixels(true).setBackgroundColor("#fcf4ee");
    const cat = this.add.sprite(Math.round(W / 2), Math.round(H / 2) - 8, "cat", 0);
    const name = this.add.text(0, 0, "Stressed Whiskers", FONT);
    name.setPosition(Math.round(W / 2 - name.width / 2), cat.y + 42);
    const sub = this.add.text(0, 0, loadSettings().lang === "pt" ? "apresenta" : "presents", { ...FONT, color: "#a87d63" });
    sub.setPosition(Math.round(W / 2 - sub.width / 2), name.y + 14);

    let done = false;
    const next = () => {
      if (done) return;
      done = true;
      cam.fadeOut(350, 252, 244, 238);
      cam.once("camerafadeoutcomplete", () => this.scene.start("title"));
    };
    cam.fadeIn(350, 252, 244, 238);
    let t = 400;
    for (const [frame, ms] of BEATS) { this.time.delayedCall(t, () => cat.setFrame(frame)); t += ms; }
    this.time.delayedCall(t + 300, next);
    this.input.keyboard!.once("keydown", next);
    this.input.once("pointerdown", next);
  }
}
