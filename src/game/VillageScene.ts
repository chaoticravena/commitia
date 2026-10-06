import Phaser from "phaser";
import { addAmbient } from "./ambient.ts";
import { LOTS, MAP_H, MAP_W, ROAD, T, autotile, dirtGrid } from "./map.ts";

type Dir = "down" | "up" | "left" | "right";
const DIR_ROW: Record<Dir, number> = { down: 0, up: 1, left: 2, right: 3 }; // linha na folha 4x4 de caminhada
const STEP_MS = 180;
const SPRITES = "assets/sprites"; // arte própria, já na paleta

const IMAGES = [
  "arvore-grande", "arvore-florida", "casa-pedra-rosa", "casa-madeira", "casa-padaria", "torre-relogio",
  "pedra-do-tempo", "poste-lanterna", "cerca", "arbusto", "capim-alto", "caixa-correio", "gitinho",
  "arvore-pinheiro", "arvore-lavanda", "arbusto-hortensia", "arbusto-frutinhas", "toco-cogumelos", "pedrinhas",
  "canteiro-flores", "placa-madeira", "lote-vazio",
];
const FLOWERING = ["arvore-florida", "arvore-lavanda"];

export class VillageScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private buddy!: Phaser.GameObjects.Image;
  private dirt = dirtGrid();
  private ambient!: ReturnType<typeof addAmbient>;
  private tile = { x: 15, y: 17 };
  private facing: Dir = "up";
  private moving = false;
  private solid: boolean[][] = [];
  private keys!: Record<Dir, Phaser.Input.Keyboard.Key[]>;
  private queued: Dir | null = null; // toque rápido = um passo, mesmo se a tecla soltar antes do próximo frame

  constructor() { super("village"); }

  preload() {
    this.load.image("ground", `${SPRITES}/ground.png`); // gerado por art/tools/build_ground.py
    for (const name of IMAGES) this.load.image(name, `${SPRITES}/${name}.png`);
    this.load.spritesheet("helena", `${SPRITES}/helena-andando.png`, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("professora", `${SPRITES}/professora-andando.png`, { frameWidth: 32, frameHeight: 32 });
  }

  create() {
    const map = this.make.tilemap({ data: autotile(dirtGrid()), tileWidth: T, tileHeight: T });
    map.createLayer(0, map.addTilesetImage("ground")!, 0, 0);
    this.solid = Array.from({ length: MAP_H }, () => new Array<boolean>(MAP_W).fill(false));

    // moldura de árvores sobrepostas (a vila é uma clareira na mata)
    // tamanho ímpar: as fileiras de cima e de baixo se alternam no mesmo contador, então cada uma passa por todos os tipos
    const trees = ["arvore-grande", "arvore-pinheiro", "arvore-florida", "arvore-lavanda", "arvore-grande"];
    const placed: { img: Phaser.GameObjects.Image; flowering: boolean }[] = [];
    const tree = (x: number, bottom: number) => {
      const key = trees[k++ % trees.length];
      placed.push({ img: this.place(key, x, bottom, 1, 0.6), flowering: FLOWERING.includes(key) });
    };
    let k = 0;
    for (let x = -1; x < MAP_W; x += 2) {
      tree(x, 1 + (x % 4 === 1 ? 1 : 0));
      if (x + 3 <= ROAD.x || x >= ROAD.x + ROAD.w) tree(x, MAP_H - 1 + (x % 4 === 1 ? 0 : 1));
    }
    for (let y = 3; y < MAP_H - 1; y += 2) { tree(-1, y); tree(MAP_W - 2, y); }

    // casas nos lotes (no jogo isso vem de casas.txt)
    const casas = ["casa-pedra-rosa", "casa-madeira", "lote-vazio", "casa-padaria"];
    LOTS.forEach((lot, i) => {
      const vazio = casas[i] === "lote-vazio"; // o lote da primeira casa que você vai commitar
      this.place(casas[i], lot.x, lot.y + lot.h - 1, vazio ? 0 : 2, vazio ? 0 : 0.95);
    });
    this.place("caixa-correio", 7, 8);

    // praça: Pedra do Tempo, torre do relógio e postes
    // a base da pedra é desenhada em ângulo (termina em ponta): sombra larga sob o miolo da base pra ela assentar no chão
    this.place("pedra-do-tempo", 14, 13, 2, 0);
    this.shadow(14 * T + 24, 14 * T - 3, 50);
    this.place("torre-relogio", 22, 19, 2);
    // postes espaçados (nunca em par): dois na praça, um na rua dos lotes, um na entrada da estrada
    [[10, 12], [18, 11], [4, 11], [16, 18]]
      .forEach(([x, y]) => this.place("poste-lanterna", x, y));

    // vegetação e detalhes: quase nenhum pedaço de grama fica liso
    ([[5, 14, "arbusto"], [25, 13, "arbusto-hortensia"], [8, 18, "arbusto-frutinhas"], [19, 19, "arbusto-hortensia"],
      [3, 12, "arbusto-frutinhas"], [20, 16, "arbusto"]] as const).forEach(([x, y, key]) => this.place(key, x, y));
    [[3, 16], [6, 19], [26, 12], [9, 15], [17, 18], [27, 18]].forEach(([x, y]) => this.place("capim-alto", x, y, 0, 0));
    [[2, 11], [8, 11], [20, 11], [27, 11], [10, 17], [4, 18], [26, 16], [12, 19], [21, 13]]
      .forEach(([x, y]) => this.place("canteiro-flores", x, y, 0, 0));
    [[7, 14], [25, 17], [11, 20], [17, 16]].forEach(([x, y]) => this.place("pedrinhas", x, y));
    [[2, 14], [26, 14]].forEach(([x, y]) => this.place("toco-cogumelos", x, y));
    this.place("placa-madeira", 12, 17);
    this.place("cerca", 5, 16);

    // Professora Commit
    this.add.sprite(19 * T + 8, 14 * T + T, "professora", 0).setOrigin(0.5, 1).setDepth(15 * T);
    this.shadow(19 * T + 8, 15 * T - 1, 12);
    this.solid[14][19] = true;

    // jogadora + Gitinho
    for (const [dir, row] of Object.entries(DIR_ROW)) {
      this.anims.create({ key: `walk-${dir}`, frames: this.anims.generateFrameNumbers("helena", { frames: [0, 1, 2, 3].map(c => row * 4 + c) }), frameRate: 8, repeat: -1 });
    }
    this.player = this.add.sprite(this.tile.x * T + 8, (this.tile.y + 1) * T, "helena", DIR_ROW.up * 4).setOrigin(0.5, 1);
    this.buddy = this.add.image(this.tile.x * T + 8, (this.tile.y + 2) * T, "gitinho").setOrigin(0.5, 1);
    // "respira" quicando 1 pixel; nunca escala fracionada (distorce os pixels)
    this.buddy.setData("bob", 0);
    this.time.addEvent({ delay: 400, loop: true, callback: () => this.buddy.setData("bob", this.buddy.getData("bob") ? 0 : 1) });
    const shadows = [this.shadow(0, 0, 12), this.shadow(0, 0, 10)];
    this.events.on("update", () => {
      shadows[0].setPosition(this.player.x, this.player.y - 1);
      shadows[1].setPosition(this.buddy.x, this.buddy.y - 1);
      this.player.setDepth(this.player.y);
      this.buddy.setDepth(this.buddy.y);
      this.buddy.setDisplayOrigin(this.buddy.width / 2, this.buddy.height + this.buddy.getData("bob"));
    });

    this.ambient = addAmbient(this, placed, new Phaser.Geom.Rectangle(2 * T, 3 * T, (MAP_W - 4) * T, (MAP_H - 6) * T));

    // luz quente das lanternas e bordas da tela levemente escurecidas
    this.children.list.filter(o => (o as Phaser.GameObjects.Image).texture?.key === "poste-lanterna").forEach(o => {
      const post = o as Phaser.GameObjects.Image;
      const glow = this.add.image(post.x + 12, post.y - post.height + 10, this.glowTexture()).setBlendMode(Phaser.BlendModes.ADD).setDepth(post.depth + 1);
      this.tweens.add({ targets: glow, alpha: 0.75, duration: 900 + Math.random() * 600, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    });
    this.cameras.main.filters.external.addVignette(0.5, 0.5, 0.75, 0.15, 0x9a8fb0, Phaser.BlendModes.MULTIPLY); // escurece ~17% nos cantos, nada no centro

    this.cameras.main.setBounds(0, 0, MAP_W * T, MAP_H * T).startFollow(this.player, true).setRoundPixels(true);
    // zoom inteiro que mostra pelo menos 320x180 pixels do mundo
    const zoom = () => this.cameras.main.setZoom(Math.max(1, Math.floor(Math.min(this.scale.width / 320, this.scale.height / 180))));
    zoom();
    this.scale.on("resize", zoom);

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: [kb.addKey(K.UP), kb.addKey(K.W)], down: [kb.addKey(K.DOWN), kb.addKey(K.S)],
      left: [kb.addKey(K.LEFT), kb.addKey(K.A)], right: [kb.addKey(K.RIGHT), kb.addKey(K.D)],
    };
    for (const [dir, ks] of Object.entries(this.keys)) ks.forEach(key => key.on("down", () => { this.queued = dir as Dir; }));
  }

  // Põe um sprite com a base na linha `bottom` (em tiles), a partir da coluna x, e marca `solidRows` linhas da base como sólidas.
  // shadow: largura da sombra de contato como fração da largura do sprite (0 = sem sombra).
  private place(key: string, x: number, bottom: number, solidRows = 1, shadow = 0.8) {
    const img = this.add.image(x * T, (bottom + 1) * T, key).setOrigin(0, 1).setDepth((bottom + 1) * T);
    if (shadow) {
      this.castShadow(img);
      this.shadow(img.x + img.width / 2, img.y - 1, Math.round(img.width * shadow));
    }
    const w = Math.ceil(img.width / T);
    for (let yy = bottom - solidRows + 1; yy <= bottom; yy++)
      for (let xx = x; xx < x + w; xx++)
        if (yy >= 0 && yy < MAP_H && xx >= 0 && xx < MAP_W) this.solid[yy][xx] = true;
    return img;
  }

  // Sombra de contato: elipse em pixels inteiros, meio transparente, logo acima do chão.
  private shadow(x: number, y: number, w: number) {
    const key = `shadow${w}`;
    const h = Math.max(3, Math.round(w / 5));
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({}, false).fillStyle(0x443c53);
      for (let row = 0; row < h; row++) {
        const dy = (row + 0.5 - h / 2) / (h / 2);
        const half = Math.round((w / 2) * Math.sqrt(1 - dy * dy));
        g.fillRect(Math.round(w / 2) - half, row, half * 2, 1);
      }
      g.generateTexture(key, w, h);
      g.destroy();
    }
    return this.add.image(Math.round(x), Math.round(y), key).setOrigin(0.5, 0.5).setAlpha(0.28).setDepth(1);
  }

  // Sombra projetada: a silhueta do sprite deitada no chão, com metade da altura e inclinada 45° pra
  // trás e pra direita (sol vindo da frente-esquerda). Só desloca pixels inteiros: nada de escala fracionada.
  private castShadow(img: Phaser.GameObjects.Image) {
    const key = `cast-${img.texture.key}`;
    const w = img.width, h = img.height, sh = Math.ceil(h / 2);
    if (!this.textures.exists(key)) {
      const src = document.createElement("canvas");
      src.width = w; src.height = h;
      const sctx = src.getContext("2d")!;
      sctx.drawImage(img.texture.getSourceImage() as CanvasImageSource, 0, 0);
      const a = sctx.getImageData(0, 0, w, h).data;
      const tex = this.textures.createCanvas(key, w + sh, sh)!;
      const ctx = tex.getContext();
      ctx.fillStyle = "#443c53";
      for (let y = 0; y < h; y++) {
        const k = Math.floor((h - 1 - y) / 2); // altura acima da base -> recuo na sombra
        for (let x = 0; x < w; x++) if (a[(y * w + x) * 4 + 3]) ctx.fillRect(x + k, sh - 1 - k, 1, 1);
      }
      tex.refresh();
    }
    return this.add.image(img.x, img.y, key).setOrigin(0, 1).setAlpha(0.18).setDepth(1);
  }

  // Halo das lanternas em anéis de pixel (degraus duros, nada de gradiente borrado).
  private glowTexture() {
    if (!this.textures.exists("glow")) {
      const R = 18;
      const g = this.make.graphics({}, false);
      [[R, 0.07], [12, 0.1], [7, 0.16]].forEach(([r, a]) => {
        g.fillStyle(0xf7d9a0, a);
        for (let y = -r; y < r; y++) {
          const half = Math.round(Math.sqrt(r * r - (y + 0.5) ** 2));
          g.fillRect(R - half, R + y, half * 2, 1);
        }
      });
      g.generateTexture("glow", R * 2, R * 2);
      g.destroy();
    }
    return "glow";
  }

  update() {
    if (this.moving) return;
    // teclas seguradas somam: W+A anda na diagonal; opostas se anulam
    const held = (d: Dir) => this.keys[d].some(k => k.isDown);
    let dx = (held("right") ? 1 : 0) - (held("left") ? 1 : 0);
    let dy = (held("down") ? 1 : 0) - (held("up") ? 1 : 0);
    if (!dx && !dy && this.queued) { dx = this.queued === "right" ? 1 : this.queued === "left" ? -1 : 0; dy = this.queued === "down" ? 1 : this.queued === "up" ? -1 : 0; }
    this.queued = null;
    if (!dx && !dy) { this.player.anims.stop(); this.player.setFrame(DIR_ROW[this.facing] * 4); return; }
    // a folha só tem 4 direções: na diagonal o corpo vira pro lado
    this.facing = dx ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    this.player.anims.play(`walk-${this.facing}`, true);
    const free = (x: number, y: number) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && !this.solid[y][x];
    const { x, y } = this.tile;
    // diagonal não corta quina de obstáculo; se bater, desliza pelo eixo que estiver livre
    if (dx && dy && !(free(x + dx, y + dy) && free(x + dx, y) && free(x, y + dy))) {
      if (free(x + dx, y)) dy = 0; else if (free(x, y + dy)) dx = 0; else return;
    }
    const nx = x + dx, ny = y + dy;
    if (!free(nx, ny)) return;
    this.moving = true;
    const prev = this.tile;
    this.tile = { x: nx, y: ny };
    const ms = dx && dy ? Math.round(STEP_MS * Math.SQRT2) : STEP_MS; // mesma velocidade em qualquer direção
    this.tweens.add({ targets: this.player, x: nx * T + 8, y: (ny + 1) * T, duration: ms, onComplete: () => { this.moving = false; } });
    if (this.dirt[ny][nx]) this.ambient.stepDust(nx * T + 8, (ny + 1) * T);
    // o Gitinho vai pra onde você estava, como um seguidor de Pokémon
    this.tweens.add({ targets: this.buddy, x: prev.x * T + 8, y: (prev.y + 1) * T, duration: ms });
  }
}
