import Phaser from "phaser";
import { loadSettings } from "./TitleScene.ts";

// Caixa de diálogo por cima da vila, no mesmo estilo dos botões do título: painel creme com borda
// de madeira, retrato num quadrinho, plaquinha com o nome, texto letra a letra com "blip".
// Mesmo zoom inteiro da vila, então os pixels da interface têm o tamanho dos do mundo.

const FONT = { fontFamily: '"Press Start 2P", monospace', fontSize: "8px", color: "#443c53" };
const CHAR_MS = 28;
const BOX_W = 300, BOX_H = 56;
const C = { wood: 0xe0b98f, woodDark: 0x5e4a4a, cream: 0xfcf4ee, frame: 0xf2e6d0 };

export const SPEAKERS = {
  professora: { pt: "Profa. Commit", en: "Prof. Commit", face: "professora-retrato" },
};
export type Speaker = keyof typeof SPEAKERS;

export class UIScene extends Phaser.Scene {
  private box!: Phaser.GameObjects.Container;
  private text!: Phaser.GameObjects.Text;
  private name!: Phaser.GameObjects.Text;
  private face!: Phaser.GameObjects.Image;
  private arrow!: Phaser.GameObjects.Image;
  private queue: string[] = [];
  private full = "";
  private shown = 0;
  private typing?: Phaser.Time.TimerEvent;
  private onDone?: () => void;

  constructor() { super("ui"); }

  get open() { return this.box?.visible ?? false; }

  preload() {
    const v = import.meta.env.VITE_BUILD ?? "dev";
    this.load.image("professora-retrato", `assets/sprites/professora-retrato.png?v=${v}`);
    this.load.audio("blip", `assets/audio/blip.wav?v=${v}`);
  }

  create() {
    const g = this.add.graphics();
    // painel: contorno escuro de cantos "cortados", miolo creme, faixa de madeira por dentro
    g.fillStyle(C.woodDark).fillRect(1, 0, BOX_W - 2, BOX_H).fillRect(0, 1, BOX_W, BOX_H - 2);
    g.fillStyle(C.wood).fillRect(1, 1, BOX_W - 2, BOX_H - 2);
    g.fillStyle(C.cream).fillRect(3, 3, BOX_W - 6, BOX_H - 6);
    // quadro do retrato
    g.fillStyle(C.woodDark).fillRect(6, 6, 46, BOX_H - 12);
    g.fillStyle(C.frame).fillRect(7, 7, 44, BOX_H - 14);
    // plaquinha do nome, saindo por cima do painel
    const tag = this.add.graphics();
    this.face = this.add.image(29, BOX_H - 7, "professora-retrato").setOrigin(0.5, 1);
    this.name = this.add.text(10, -10, "", { ...FONT, color: "#fcf4ee" });
    this.text = this.add.text(58, 9, "", { ...FONT, wordWrap: { width: BOX_W - 68 }, lineSpacing: 5 });
    // setinha "continua" desenhada em pixels (a fonte não tem ▼)
    if (!this.textures.exists("ui-arrow")) {
      const a = this.make.graphics({}, false).fillStyle(C.woodDark).fillRect(0, 0, 5, 1).fillRect(1, 1, 3, 1).fillRect(2, 2, 1, 1);
      a.generateTexture("ui-arrow", 5, 3); a.destroy();
    }
    this.arrow = this.add.image(BOX_W - 10, BOX_H - 8, "ui-arrow").setVisible(false);
    this.time.addEvent({ delay: 400, loop: true, callback: () => this.arrow.setY(this.arrow.y === BOX_H - 8 ? BOX_H - 7 : BOX_H - 8) });
    this.box = this.add.container(0, 0, [g, tag, this.face, this.name, this.text, this.arrow]).setVisible(false);
    this.box.setData("tag", tag);

    this.layout();
    this.scale.on("resize", this.layout, this);
    this.events.once("shutdown", () => this.scale.off("resize", this.layout, this));
    this.input.on("pointerdown", () => { if (this.open) this.advance(); });
  }

  // mesmo zoom inteiro da vila; caixa centralizada embaixo
  private layout() {
    const z = Math.max(1, Math.floor(Math.min(this.scale.width / 320, this.scale.height / 180)));
    this.cameras.main.setZoom(z).setOrigin(0, 0).setRoundPixels(true);
    const W = Math.floor(this.scale.width / z), H = Math.floor(this.scale.height / z);
    this.box.setPosition(Math.round((W - BOX_W) / 2), H - BOX_H - 6);
  }

  // Fala em páginas; Espaço/Enter/clique avança (ou completa a página que está sendo digitada).
  say(who: Speaker, lines: string[], onDone?: () => void) {
    const sp = SPEAKERS[who];
    this.name.setText(sp[loadSettings().lang]);
    const tag = this.box.getData("tag") as Phaser.GameObjects.Graphics;
    const w = this.name.width + 10;
    tag.clear().fillStyle(C.woodDark).fillRect(5, -14, w + 2, 13).fillStyle(0xa87d63).fillRect(6, -13, w, 11);
    this.face.setTexture(sp.face);
    // páginas de no máximo 3 linhas: quebra as falas longas onde o texto já quebraria
    this.queue = lines.flatMap(line => {
      const rows = this.text.getWrappedText(line);
      return Array.from({ length: Math.ceil(rows.length / 3) }, (_, i) => rows.slice(i * 3, i * 3 + 3).join("\n"));
    });
    this.onDone = onDone;
    this.box.setVisible(true);
    this.next();
  }

  advance() {
    if (this.typing) return this.finish();
    this.next();
  }

  private next() {
    const page = this.queue.shift();
    if (page === undefined) {
      this.box.setVisible(false);
      const done = this.onDone; this.onDone = undefined;
      return done?.();
    }
    this.full = page;
    this.shown = 0;
    this.text.setText("");
    this.arrow.setVisible(false);
    const sfx = loadSettings().sfx;
    this.typing = this.time.addEvent({
      delay: CHAR_MS, repeat: page.length - 1, callback: () => {
        this.shown++;
        this.text.setText(page.slice(0, this.shown));
        if (sfx && this.shown % 3 === 0 && page[this.shown - 1] !== " ") this.sound.play("blip", { volume: 0.2 });
        if (this.shown >= page.length) this.finish();
      },
    });
  }

  private finish() {
    this.typing?.remove();
    this.typing = undefined;
    this.text.setText(this.full);
    this.arrow.setVisible(true);
  }
}
