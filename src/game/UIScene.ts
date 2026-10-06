import Phaser from "phaser";
import { centerText, loadSettings, settingsItems, sfxVolume, woodButton, type MenuItem } from "./settings.ts";
import { playMusic } from "./music.ts";
import { STEPS, currentStep } from "./act1.ts";
import { grimoire } from "./grimoire.ts";
import { store } from "./store.ts";

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

const PAUSE = {
  pt: { title: "Pausa", resume: "Continuar", toTitle: "Voltar ao título" },
  en: { title: "Paused", resume: "Continue", toTitle: "Back to title" },
};

export class UIScene extends Phaser.Scene {
  private paused = false;
  private lastToast: Phaser.GameObjects.GameObject[] = [];
  private pauseSel = 0;
  private pauseBox!: Phaser.GameObjects.Container;
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
  private goal!: Phaser.GameObjects.Text;
  private goalBg!: Phaser.GameObjects.Graphics;

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

    // objetivo atual no canto: avança sozinho a cada comando certo
    this.goalBg = this.add.graphics();
    this.goal = this.add.text(10, 9, "", FONT);
    const refresh = () => this.refreshGoal();
    store.on(refresh);
    grimoire.addEventListener("change", refresh);
    this.events.once("shutdown", () => grimoire.removeEventListener("change", refresh));
    this.refreshGoal();

    // pausa: Esc ou P (fora do diálogo e do grimório); a vila congela por baixo
    this.pauseBox = this.add.container(0, 0).setDepth(100);
    this.input.keyboard!.on("keydown", (e: KeyboardEvent) => this.pauseKey(e.key));

    this.layout();
    this.scale.on("resize", this.layout, this);
    this.events.once("shutdown", () => this.scale.off("resize", this.layout, this));
    this.input.on("pointerdown", () => { if (this.open && !this.paused) this.advance(); });
  }

  // mesmo zoom inteiro da vila; caixa centralizada embaixo
  private layout() {
    const z = Math.max(1, Math.floor(Math.min(this.scale.width / 320, this.scale.height / 180)));
    this.cameras.main.setZoom(z).setOrigin(0, 0).setRoundPixels(true);
    const W = Math.floor(this.scale.width / z), H = Math.floor(this.scale.height / z);
    this.box.setPosition(Math.round((W - BOX_W) / 2), H - BOX_H - 6);
    this.drawPause();
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

  // aviso curto no alto da tela (ex.: a linha do casas.txt que mudou)
  toast(msg: string) {
    const W = Math.floor(this.scale.width / this.cameras.main.zoom);
    this.lastToast.forEach(o => o.destroy()); // apertou de novo: o aviso novo substitui o anterior
    const bg = this.add.graphics(); // fundo antes do texto, senão cobre as letras
    const t = this.add.text(0, 0, msg, { ...FONT, color: "#fcf4ee" });
    t.setPosition(Math.round(W / 2 - t.width / 2), 28);
    bg.fillStyle(C.woodDark).fillRect(t.x - 5, t.y - 4, t.width + 10, 16);
    this.lastToast = [bg, t];
    this.tweens.add({ targets: [t, bg], alpha: 0, delay: 1400, duration: 400, onComplete: () => { t.destroy(); bg.destroy(); } });
  }

  private pauseItems(): MenuItem[] {
    const t = PAUSE[loadSettings().lang];
    return [
      { label: t.resume, act: () => this.setPaused(false) },
      ...settingsItems(this, () => this.drawPause(), () => playMusic(this, "musica-vila")),
      { label: t.toTitle, act: () => { this.setPaused(false); this.scene.get("village").scene.start("title", { skipIntro: true }); } },
    ];
  }

  private pauseKey(k: string) {
    if (grimoire.isOpen) return;
    if (!this.paused) {
      if ((k === "Escape" || k === "p" || k === "P") && !this.open) this.setPaused(true);
      return;
    }
    const items = this.pauseItems(), n = items.length;
    if (k === "Escape" || k === "p" || k === "P") return this.setPaused(false);
    if (k === "ArrowDown" || k === "s") this.pauseSel = (this.pauseSel + 1) % n;
    else if (k === "ArrowUp" || k === "w") this.pauseSel = (this.pauseSel + n - 1) % n;
    else if (k === "ArrowLeft" || k === "a" || k === "ArrowRight" || k === "d") return items[this.pauseSel].adjust?.(k === "ArrowRight" || k === "d" ? 1 : -1);
    else if (k === "Enter" || k === " ") return items[this.pauseSel].act();
    else return;
    this.drawPause();
  }

  private setPaused(on: boolean) {
    this.paused = on;
    this.pauseSel = 0;
    if (on) this.scene.pause("village"); else this.scene.resume("village");
    grimoire.showButton(!on);
    this.drawPause();
  }

  private drawPause() {
    this.pauseBox.removeAll(true);
    if (!this.paused) return;
    const z = this.cameras.main.zoom;
    const W = Math.floor(this.scale.width / z), H = Math.floor(this.scale.height / z);
    const items = this.pauseItems();
    const w = 192, h = 14, gap = 4, pw = w + 24, ph = 30 + items.length * (h + gap);
    const px = Math.round(W / 2 - pw / 2), py = Math.round(H / 2 - ph / 2);
    const g = this.add.graphics();
    g.fillStyle(0x1b1730, 0.45).fillRect(0, 0, W, H); // a vila escurece atrás
    g.fillStyle(C.woodDark).fillRect(px + 1, py, pw - 2, ph).fillRect(px, py + 1, pw, ph - 2);
    g.fillStyle(C.cream).fillRect(px + 2, py + 2, pw - 4, ph - 4);
    this.pauseBox.add([g, centerText(this, W / 2, py + 12, PAUSE[loadSettings().lang].title)]);
    items.forEach((it, i) => {
      const x = Math.round(W / 2 - w / 2), y = py + 24 + i * (h + gap);
      const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on("pointerover", () => { if (this.pauseSel !== i) { this.pauseSel = i; this.drawPause(); } });
      zone.on("pointerdown", () => it.act());
      this.pauseBox.add([woodButton(this, x, y, w, h, this.pauseSel === i), centerText(this, W / 2, y + h / 2, it.label), zone]);
    });
  }

  refreshGoal() {
    const lang = loadSettings().lang;
    const i = currentStep(store.ws, store.progress);
    const label = i < 0 ? (lang === "pt" ? "Ato 1 completo!" : "Act 1 complete!") : STEPS[i].label[lang];
    this.goal.setText(`${lang === "pt" ? "Objetivo" : "Goal"}: ${label}`);
    const w = this.goal.width + 12;
    this.goalBg.clear().fillStyle(C.woodDark).fillRect(4, 4, w + 2, 18).fillStyle(C.wood).fillRect(5, 5, w, 16).fillStyle(C.cream).fillRect(6, 6, w - 2, 14);
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
      done?.();
      return this.refreshGoal();
    }
    this.full = page;
    this.shown = 0;
    this.text.setText("");
    this.arrow.setVisible(false);
    const sfx = sfxVolume();
    this.typing = this.time.addEvent({
      delay: CHAR_MS, repeat: page.length - 1, callback: () => {
        this.shown++;
        this.text.setText(page.slice(0, this.shown));
        if (sfx && this.shown % 3 === 0 && page[this.shown - 1] !== " ") this.sound.play("blip", { volume: 0.2 * sfx });
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
