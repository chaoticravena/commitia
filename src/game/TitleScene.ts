import Phaser from "phaser";
import { playMusic } from "./music.ts";
import { store } from "./store.ts";
import { CHARS, type CharKey } from "./VillageScene.ts";

// Tela de título no espírito do Stardew: a câmera sobe do campo até o céu, nuvens passando,
// passarinhos, a logo cai com um quique e aparecem os botões de madeira.
// Tudo em pixels inteiros com o mesmo zoom inteiro da vila.

const SPRITES = "assets/sprites";
const png = (name: string) => `${SPRITES}/${name}.png?v=${import.meta.env.VITE_BUILD ?? "dev"}`;
const FONT = { fontFamily: '"Press Start 2P", monospace', fontSize: "8px" };
const C = {
  sky: [0xa9c9ec, 0xb9d4ef, 0xc9def0, 0xdbe6ef, 0xf2dfe6],
  far: 0xb8b3dc, near: 0x8fc79a, nearDark: 0x6fae79,
  cloud: 0xfcfcf8, cloudShade: 0xd9e3ef, bird: 0x5e5a70,
  wood: 0xe0b98f, woodLight: 0xf7d9a0, woodDark: 0x5e4a4a, ink: "#443c53", cream: 0xfcf4ee,
};

// Configurações: ficam no navegador de quem joga (sem conta, sem servidor).
export type Lang = "pt" | "en";
export type Settings = { music: boolean; sfx: boolean; lang: Lang };
const KEY = "commitia:settings";
const DEFAULTS = (): Settings => ({ music: true, sfx: true, lang: navigator.language.startsWith("pt") ? "pt" : "en" });
export function loadSettings(): Settings {
  try { return { ...DEFAULTS(), ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return DEFAULTS(); }
}

const STUDIO = "Stressed Whiskers";
const STR = {
  pt: {
    start: "Começar", resume: "Continuar", newGame: "Novo jogo", help: "Como jogar", settings: "Configurações", back: "Voltar",
    pick: "Escolha sua personagem", pickHint: "Enter escolhe · Esc volta",
    music: "Música", sfx: "Efeitos", fullscreen: "Tela cheia", lang: "Idioma: Português",
    on: "ligada", off: "desligada", onPl: "ligados", offPl: "desligados", yes: "sim", no: "não",
    by: `feito por ${STUDIO}`,
    helpText: [
      "Commitia é um jogo pra aprender Git de verdade, do primeiro commit até achar bugs no passado.",
      "Cada comando muda a vila: arquivos viram casas e jardins, commits viram história e a Pedra do Tempo leva você a versões antigas.",
      "Setas ou WASD: andar (dá pra ir na diagonal).",
      "Espaço: conversar.",
      "Fale com a Professora Commit para começar.",
    ],
  },
  en: {
    start: "Start", resume: "Continue", newGame: "New game", help: "How to play", settings: "Settings", back: "Back",
    pick: "Choose your character", pickHint: "Enter picks · Esc goes back",
    music: "Music", sfx: "Sound effects", fullscreen: "Fullscreen", lang: "Language: English",
    on: "on", off: "off", onPl: "on", offPl: "off", yes: "yes", no: "no",
    by: `developed by ${STUDIO}`,
    helpText: [
      "Commitia is a game for learning real Git, from your first commit to hunting bugs in the past.",
      "Every command changes the village: files become houses and gardens, commits become history, and the Time Stone takes you to older versions.",
      "Arrows or WASD: walk (diagonals work too).",
      "Space: talk.",
      "Talk to Professor Commit to begin.",
    ],
  },
};
function saveSettings(s: Settings) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* navegador sem storage: vale só nesta sessão */ } }

type State = "menu" | "chars" | "settings" | "help";

export class TitleScene extends Phaser.Scene {
  private W = 320;
  private H = 180;
  private state: State = "menu";
  private sel = 0;
  private ui!: Phaser.GameObjects.Container;
  private logo!: Phaser.GameObjects.Image;
  private intro = true;
  private settings = loadSettings();

  constructor() { super("title"); }

  init(data: { skipIntro?: boolean; state?: State }) {
    this.intro = !data.skipIntro;
    this.state = data.state ?? "menu";
    this.sel = 0;
  }

  preload() {
    for (const n of ["logo-commitia", "arvore-grande", "arvore-florida", "arvore-pinheiro", "arvore-lavanda"]) this.load.image(n, png(n));
    this.load.audio("musica-titulo", `assets/audio/musica-titulo.mp3?v=${import.meta.env.VITE_BUILD ?? "dev"}`);
    this.load.spritesheet("ground-tiles", png("ground"), { frameWidth: 16, frameHeight: 16 });
    for (const [key, c] of Object.entries(CHARS)) this.load.spritesheet(key, png(c.sheet), { frameWidth: 32, frameHeight: 32 });
  }

  create() {
    const z = Math.max(1, Math.floor(Math.min(this.scale.width / 320, this.scale.height / 180)));
    this.W = Math.ceil(this.scale.width / z);
    this.H = Math.ceil(this.scale.height / z);
    const cam = this.cameras.main.setZoom(z).setOrigin(0, 0).setRoundPixels(true);
    const { W, H } = this;
    const meadow = Math.round(H * 0.6); // campo abaixo da linha de árvores, por onde a câmera começa

    this.sky();
    this.clouds();
    this.hills(0.62, C.far, 7, 0.9);
    this.hills(0.74, C.near, 5, 1.7);
    // campo: tiles de grama do jogo
    for (let y = Math.round(H * 0.82); y < H + meadow; y += 16)
      for (let x = 0; x < W; x += 16) this.add.image(x, y, "ground-tiles", 48 + ((x * 7 + y * 3) % 16)).setOrigin(0).setDepth(1);
    // árvores: a fileira de frente marca o fim do céu
    const trees = ["arvore-grande", "arvore-pinheiro", "arvore-florida", "arvore-lavanda"];
    for (let x = -12, i = 0; x < W; x += 26 + ((i * 7) % 9), i++)
      this.add.image(x, Math.round(H * 0.84) + (i % 2) * 6, trees[i % trees.length]).setOrigin(0, 1).setDepth(2 + (i % 2));
    this.birds();

    this.ui = this.add.container(0, 0).setDepth(10);
    const logo = this.logo = this.add.image(Math.round(W / 2), Math.round(H * 0.24), "logo-commitia").setDepth(9);
    // clicar na logo: pulinho com quique e brilhos de pixel saindo de trás dela
    if (!this.textures.exists("twinkle")) {
      const g = this.make.graphics({}, false).fillStyle(C.cream).fillRect(1, 0, 1, 3).fillRect(0, 1, 3, 1); // estrelinha 3x3
      g.generateTexture("twinkle", 3, 3); g.destroy();
    }
    const burst = this.add.particles(0, 0, "twinkle", {
      emitting: false, lifespan: 700, speed: { min: 30, max: 70 }, angle: { min: 200, max: 340 }, gravityY: 80,
      alpha: { start: 1, end: 0 }, tint: [0xfcf4ee, 0xc8bde6, 0xf2b8c6, 0xf7d9a0],
    }).setDepth(8);
    logo.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
      if (this.tweens.isTweening(logo)) return;
      const y = Math.round(H * 0.24);
      burst.explode(14, logo.x, y - 8);
      this.tweens.add({ targets: logo, y: y - 8, duration: 120, ease: "Quad.Out", onComplete: () =>
        this.tweens.add({ targets: logo, y, duration: 600, ease: "Bounce.Out" }) });
    });
    playMusic(this, "musica-titulo");
    if (this.intro) {
      cam.setScroll(0, meadow);
      logo.setY(-40);
      this.tweens.add({ targets: cam, scrollY: 0, duration: 2600, ease: "Sine.InOut" });
      this.tweens.add({ targets: logo, y: Math.round(H * 0.24), delay: 2300, duration: 1100, ease: "Bounce.Out", onComplete: () => this.draw() });
    } else this.draw();

    this.input.keyboard!.on("keydown", (e: KeyboardEvent) => this.key(e.key));
    const restart = () => this.scene.restart({ skipIntro: true, state: this.state });
    this.scale.on("resize", restart);
    this.events.once("shutdown", () => this.scale.off("resize", restart));
  }

  // céu em faixas com uma linha de pontilhado entre elas (gradiente de pixel art)
  private sky() {
    const g = this.add.graphics().setDepth(0);
    const band = Math.ceil((this.H * 0.75) / C.sky.length);
    C.sky.forEach((c, i) => {
      g.fillStyle(c).fillRect(0, i * band, this.W, band + (i === C.sky.length - 1 ? this.H : 0));
      if (i) { g.fillStyle(C.sky[i - 1]); for (let x = 0; x < this.W; x += 2) g.fillRect(x, i * band, 1, 1); }
    });
  }

  private clouds() {
    const make = (key: string, blobs: [number, number, number][], w: number, h: number) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({}, false);
      const disc = (cx: number, cy: number, r: number, color: number) => {
        g.fillStyle(color);
        for (let y = -r; y < r; y++) { const half = Math.round(Math.sqrt(r * r - (y + 0.5) ** 2)); g.fillRect(cx - half, cy + y, half * 2, 1); }
      };
      blobs.forEach(([x, y, r]) => disc(x, y + 2, r, C.cloudShade)); // sombra embaixo
      blobs.forEach(([x, y, r]) => disc(x, y, r, C.cloud));
      g.generateTexture(key, w, h);
      g.destroy();
    };
    make("cloud0", [[10, 12, 7], [20, 9, 9], [31, 12, 7]], 40, 22);
    make("cloud1", [[8, 9, 6], [17, 7, 7], [26, 9, 5]], 32, 18);
    make("cloud2", [[9, 13, 8], [21, 9, 10], [34, 11, 8], [44, 14, 6]], 52, 26);
    for (let i = 0; i < 6; i++) {
      const c = this.add.image(Math.round(Math.random() * this.W), Math.round(8 + Math.random() * this.H * 0.4), `cloud${i % 3}`).setDepth(0.5);
      const speed = 3 + Math.random() * 5; // px/s: cada nuvem no seu ritmo
      this.tweens.add({
        targets: c, x: this.W + 60, duration: ((this.W + 60 - c.x) / speed) * 1000, ease: "Linear",
        onComplete: () => {
          c.x = -60;
          this.tweens.add({ targets: c, x: this.W + 60, duration: ((this.W + 120) / speed) * 1000, ease: "Linear", repeat: -1 });
        },
      });
    }
  }

  // morro: silhueta por colunas de 1 px, altura vinda de senos (sem antisserrilhado)
  private hills(base: number, color: number, amp: number, freq: number) {
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(color);
    const y0 = this.H * base;
    for (let x = 0; x < this.W; x++) {
      const y = Math.round(y0 - amp * (Math.sin((x / this.W) * Math.PI * 2 * freq) + 0.6 * Math.sin((x / this.W) * Math.PI * 5 * freq + 1)));
      g.fillRect(x, y, 1, this.H * 2);
    }
  }

  private birds() {
    const frames = [[[0, 0], [1, 1], [2, 1], [3, 1], [4, 0]], [[0, 1], [1, 0], [2, 1], [3, 0], [4, 1]]];
    frames.forEach((px, i) => {
      if (this.textures.exists(`bird${i}`)) return;
      const g = this.make.graphics({}, false).fillStyle(C.bird);
      px.forEach(([x, y]) => g.fillRect(x, y, 1, 1));
      g.generateTexture(`bird${i}`, 5, 2);
      g.destroy();
    });
    const flock = () => {
      const y = Math.round(10 + Math.random() * this.H * 0.35);
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const b = this.add.image(-10 - i * 9, y + (i % 2) * 5, "bird0").setDepth(0.6);
        const flap = this.time.addEvent({ delay: 160, loop: true, callback: () => b.setTexture(b.texture.key === "bird0" ? "bird1" : "bird0") });
        this.tweens.add({ targets: b, x: this.W + 20, y: b.y - 10, duration: 9000, onComplete: () => { flap.remove(); b.destroy(); } });
      }
      this.time.delayedCall(4000 + Math.random() * 5000, flock);
    };
    this.time.delayedCall(2500, flock);
  }

  // ---------- menu ----------

  private get t() { return STR[this.settings.lang]; }

  private items(): { label: string; act: () => void }[] {
    const s = this.settings, t = this.t;
    const save = () => { saveSettings(s); this.draw(); };
    if (this.state === "menu") return [
      // com jogo salvo: Continuar volta pra vila do jeito que estava; Novo jogo apaga e recomeça
      ...(store.hasSave
        ? [{ label: t.resume, act: () => this.scene.start("village", { char: store.char }) },
           { label: t.newGame, act: () => { store.reset(); this.go("chars"); } }]
        : [{ label: t.start, act: () => this.go("chars") }]),
      { label: t.help, act: () => this.go("help") },
      { label: t.settings, act: () => this.go("settings") },
    ];
    if (this.state === "chars") return (Object.keys(CHARS) as CharKey[]).map(k => ({ label: CHARS[k].name, act: () => this.scene.start("village", { char: k }) }));
    if (this.state === "help") return [{ label: t.back, act: () => this.go("menu") }];
    return [
      { label: `${t.music}: ${s.music ? t.on : t.off}`, act: () => { s.music = !s.music; save(); playMusic(this, "musica-titulo"); } },
      { label: `${t.sfx}: ${s.sfx ? t.onPl : t.offPl}`, act: () => { s.sfx = !s.sfx; save(); } },
      { label: `${t.fullscreen}: ${this.scale.isFullscreen ? t.yes : t.no}`, act: () => { this.scale.toggleFullscreen(); this.time.delayedCall(300, () => this.draw()); } },
      { label: t.lang, act: () => { s.lang = s.lang === "pt" ? "en" : "pt"; save(); } },
      { label: t.back, act: () => this.go("menu") },
    ];
  }

  private go(state: State) { this.state = state; this.sel = 0; this.draw(); }

  private key(k: string) {
    if (!this.ui.length) return; // ainda na abertura
    const n = this.items().length;
    const horizontal = this.state === "chars";
    if (k === (horizontal ? "ArrowRight" : "ArrowDown") || k === (horizontal ? "d" : "s")) this.sel = (this.sel + 1) % n;
    else if (k === (horizontal ? "ArrowLeft" : "ArrowUp") || k === (horizontal ? "a" : "w")) this.sel = (this.sel + n - 1) % n;
    else if (k === "Enter" || k === " ") return this.items()[this.sel].act();
    else if (k === "Escape" && this.state !== "menu") return this.go("menu");
    else return;
    this.draw();
  }

  // carinha de gato 7x6: orelhas, olhos e focinho
  private catFace() {
    if (!this.textures.exists("cat-face")) {
      const rows = ["x.....x", "xx...xx", "xxxxxxx", "x.xxx.x", "xxx.xxx", ".xxxxx."];
      const g = this.make.graphics({}, false).fillStyle(C.cream);
      rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === "x") g.fillRect(x, y, 1, 1); }));
      g.generateTexture("cat-face", 7, 6);
      g.destroy();
    }
    return "cat-face";
  }

  // Botão de madeira em pixels: contorno escuro, miolo claro, linha de luz em cima e sombra embaixo.
  private button(x: number, y: number, w: number, h: number, on: boolean) {
    const g = this.add.graphics();
    g.fillStyle(C.woodDark).fillRect(x + 1, y, w - 2, h).fillRect(x, y + 1, w, h - 2);
    g.fillStyle(on ? C.woodLight : C.wood).fillRect(x + 1, y + 1, w - 2, h - 2);
    g.fillStyle(C.cream, on ? 0.9 : 0.5).fillRect(x + 2, y + 1, w - 4, 1);
    g.fillStyle(C.woodDark, 0.35).fillRect(x + 2, y + h - 2, w - 4, 1);
    return g;
  }

  private text(x: number, y: number, s: string) {
    const t = this.add.text(0, 0, s, { ...FONT, color: C.ink });
    return t.setPosition(Math.round(x - t.width / 2), Math.round(y - t.height / 2));
  }

  private draw() {
    this.ui.removeAll(true);
    const { W, H } = this;
    const items = this.items();
    const cy = Math.round(H * 0.62);
    const hit = (obj: Phaser.GameObjects.GameObject, i: number, w: number, h: number, x: number, y: number) => {
      const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on("pointerover", () => { if (this.sel !== i) { this.sel = i; this.draw(); } });
      zone.on("pointerdown", () => items[i].act());
      this.ui.add([obj, zone]);
    };

    this.logo.setVisible(this.state !== "help");
    if (this.state === "help") {
      // pergaminho com a finalidade do jogo e os controles
      const pw = Math.min(W - 16, 300), x = Math.round(W / 2 - pw / 2), top = 8;
      const body = this.add.text(x + 10, top + 24, this.t.helpText.join("\n\n"), { ...FONT, color: C.ink, wordWrap: { width: pw - 20 }, lineSpacing: 3 });
      const ph = Math.min(H - 16, body.height + 58);
      const g = this.add.graphics();
      g.fillStyle(C.woodDark).fillRect(x + 1, top, pw - 2, ph).fillRect(x, top + 1, pw, ph - 2);
      g.fillStyle(C.cream).fillRect(x + 2, top + 2, pw - 4, ph - 4);
      this.ui.add([g, this.text(W / 2, top + 12, this.t.help), body]);
      const bw = 64, bh = 14, bx = Math.round(W / 2 - bw / 2), by = top + ph - bh - 6;
      hit(this.button(bx, by, bw, bh, true), 0, bw, bh, bx, by);
      this.ui.add(this.text(W / 2, by + bh / 2, this.t.back));
    } else if (this.state === "menu") {
      const w = 128, h = 16, gap = 4;
      items.forEach((it, i) => {
        const x = Math.round(W / 2 - w / 2), y = cy - 8 - (items.length - 3) * 10 + i * (h + gap) - (this.sel === i ? 1 : 0); // o escolhido sobe 1 px
        hit(this.button(x, y, w, h, this.sel === i), i, w, h, x, y);
        this.ui.add(this.text(x + w / 2, y + h / 2, it.label));
      });
      // assinatura no rodapé, com uma carinha de gato em pixel
      const by = this.add.text(0, 0, this.t.by, { ...FONT, color: "#fcf4ee" });
      by.setPosition(Math.round(W - by.width - 6), H - 12);
      this.ui.add([by, this.add.image(by.x - 8, H - 8, this.catFace())]);
    } else if (this.state === "chars") {
      this.ui.add(this.text(W / 2, cy - 14, this.t.pick));
      const w = 56, h = 68, gap = 12, x0 = Math.round(W / 2 - (items.length * w + gap) / 2);
      (Object.keys(CHARS) as CharKey[]).forEach((k, i) => {
        const x = x0 + i * (w + gap), y = cy - 4;
        hit(this.button(x, y, w, h, this.sel === i), i, w, h, x, y);
        // personagem em 2x (escala inteira) andando de frente; o não escolhido fica parado
        const spr = this.add.sprite(x + w / 2, y + 50, k, 0).setOrigin(0.5, 1).setScale(2);
        if (this.sel === i) {
          if (!this.anims.exists(`${k}-title`)) this.anims.create({ key: `${k}-title`, frames: this.anims.generateFrameNumbers(k, { frames: [0, 1, 2, 3] }), frameRate: 6, repeat: -1 });
          spr.play(`${k}-title`);
        }
        this.ui.add([spr, this.text(x + w / 2, y + h - 9, CHARS[k].name)]);
      });
      this.ui.add(this.text(W / 2, H - 8, this.t.pickHint));
    } else {
      const w = 160, h = 14, gap = 4;
      items.forEach((it, i) => {
        const x = Math.round(W / 2 - w / 2), y = cy - 12 + i * (h + gap);
        hit(this.button(x, y, w, h, this.sel === i), i, w, h, x, y);
        this.ui.add(this.text(W / 2, y + h / 2, it.label));
      });
    }
  }
}
