import Phaser from "phaser";
import { LOTS, MAP_H, MAP_W, ROAD, T, autotile, dirtGrid } from "./map.ts";

type Dir = "down" | "up" | "left" | "right";
const DIR_ROW: Record<Dir, number> = { down: 0, up: 1, left: 2, right: 3 }; // linha na folha 4x4 de caminhada
const STEP_MS = 180;
// chão: pacote recolorido na paleta Soft Pastel (?pal=orig mostra as cores originais do Ninja Adventure)
const TILES = new URLSearchParams(location.search).get("pal") === "orig" ? "/assets/tiles" : "/assets-pastel/tiles";
const SPRITES = "/assets/sprites"; // arte própria, já na paleta

const IMAGES = [
  "arvore-grande", "arvore-florida", "casa-pedra-rosa", "casa-madeira", "casa-padaria", "torre-relogio",
  "pedra-do-tempo", "poste-lanterna", "cerca", "arbusto", "capim-alto", "caixa-correio", "gitinho",
];

export class VillageScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private buddy!: Phaser.GameObjects.Image;
  private tile = { x: 15, y: 15 };
  private facing: Dir = "up";
  private moving = false;
  private solid: boolean[][] = [];
  private keys!: Record<Dir, Phaser.Input.Keyboard.Key[]>;
  private queued: Dir | null = null; // toque rápido = um passo, mesmo se a tecla soltar antes do próximo frame

  constructor() { super("village"); }

  preload() {
    this.load.image("floor", `${TILES}/TilesetFloor.png`);
    for (const name of IMAGES) this.load.image(name, `${SPRITES}/${name}.png`);
    this.load.spritesheet("helena", `${SPRITES}/helena-andando.png`, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("professora", `${SPRITES}/professora-andando.png`, { frameWidth: 32, frameHeight: 32 });
  }

  create() {
    const map = this.make.tilemap({ data: autotile(dirtGrid()), tileWidth: T, tileHeight: T });
    map.createLayer(0, map.addTilesetImage("floor")!, 0, 0);
    this.solid = Array.from({ length: MAP_H }, () => new Array<boolean>(MAP_W).fill(false));

    // moldura de árvores sobrepostas (a vila é uma clareira na mata)
    const trees = ["arvore-grande", "arvore-grande", "arvore-florida"];
    let k = 0;
    for (let x = -1; x < MAP_W; x += 2) {
      this.place(trees[k++ % 3], x, 1 + (x % 4 === 1 ? 1 : 0));
      if (x + 3 <= ROAD.x || x >= ROAD.x + ROAD.w) this.place(trees[k++ % 3], x, MAP_H - 1 + (x % 4 === 1 ? 0 : 1));
    }
    for (let y = 3; y < MAP_H - 1; y += 2) { this.place(trees[k++ % 3], -1, y); this.place(trees[k++ % 3], MAP_W - 2, y); }

    // casas nos lotes (no jogo isso vem de casas.txt)
    const casas = ["casa-pedra-rosa", "casa-madeira", null, "casa-padaria"];
    LOTS.forEach((lot, i) => { if (casas[i]) this.place(casas[i]!, lot.x, lot.y + lot.h - 1, 2); });
    this.place("caixa-correio", 7, 6);
    this.place("cerca", 17, 6);

    // praça: Pedra do Tempo, torre do relógio e postes
    this.place("pedra-do-tempo", 14, 11, 2);
    this.place("torre-relogio", 21, 12, 2);
    this.place("poste-lanterna", 10, 10);
    this.place("poste-lanterna", 18, 9);

    // vegetação
    [[5, 12], [24, 15], [8, 16], [20, 17], [3, 9]].forEach(([x, y]) => this.place("arbusto", x, y));
    [[3, 14], [6, 17], [25, 11], [22, 16], [9, 13], [17, 16], [26, 17]].forEach(([x, y]) => this.place("capim-alto", x, y, 0));

    // Professora Commit
    this.add.sprite(19 * T + 8, 12 * T + T, "professora", 0).setOrigin(0.5, 1).setDepth(13 * T);
    this.solid[12][19] = true;

    // jogadora + Gitinho
    for (const [dir, row] of Object.entries(DIR_ROW)) {
      this.anims.create({ key: `walk-${dir}`, frames: this.anims.generateFrameNumbers("helena", { frames: [0, 1, 2, 3].map(c => row * 4 + c) }), frameRate: 8, repeat: -1 });
    }
    this.player = this.add.sprite(this.tile.x * T + 8, (this.tile.y + 1) * T, "helena", DIR_ROW.up * 4).setOrigin(0.5, 1);
    this.buddy = this.add.image(this.tile.x * T + 8, (this.tile.y + 2) * T, "gitinho").setOrigin(0.5, 1);
    this.tweens.add({ targets: this.buddy, scaleY: 0.85, scaleX: 1.1, yoyo: true, repeat: -1, duration: 420, ease: "Sine.InOut" });
    this.events.on("update", () => { this.player.setDepth(this.player.y); this.buddy.setDepth(this.buddy.y); });

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
  private place(key: string, x: number, bottom: number, solidRows = 1) {
    const img = this.add.image(x * T, (bottom + 1) * T, key).setOrigin(0, 1).setDepth((bottom + 1) * T);
    const w = Math.ceil(img.width / T);
    for (let yy = bottom - solidRows + 1; yy <= bottom; yy++)
      for (let xx = x; xx < x + w; xx++)
        if (yy >= 0 && yy < MAP_H && xx >= 0 && xx < MAP_W) this.solid[yy][xx] = true;
    return img;
  }

  update() {
    if (this.moving) return;
    const dir = (Object.keys(this.keys) as Dir[]).find(d => this.keys[d].some(k => k.isDown)) ?? this.queued;
    this.queued = null;
    if (!dir) { this.player.anims.stop(); this.player.setFrame(DIR_ROW[this.facing] * 4); return; }
    this.facing = dir;
    const nx = this.tile.x + (dir === "left" ? -1 : dir === "right" ? 1 : 0);
    const ny = this.tile.y + (dir === "up" ? -1 : dir === "down" ? 1 : 0);
    this.player.anims.play(`walk-${dir}`, true);
    if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || this.solid[ny][nx]) return;
    this.moving = true;
    const prev = this.tile;
    this.tile = { x: nx, y: ny };
    this.tweens.add({ targets: this.player, x: nx * T + 8, y: (ny + 1) * T, duration: STEP_MS, onComplete: () => { this.moving = false; } });
    // o Gitinho vai pra onde você estava, como um seguidor de Pokémon
    this.tweens.add({ targets: this.buddy, x: prev.x * T + 8, y: (prev.y + 1) * T, duration: STEP_MS });
  }
}
