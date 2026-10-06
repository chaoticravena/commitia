import Phaser from "phaser";
import { LOTS, MAP_H, MAP_W, ROAD, T, autotile, dirtGrid } from "./map.ts";

type Dir = "down" | "up" | "left" | "right";
const DIR_COL: Record<Dir, number> = { down: 0, up: 1, left: 2, right: 3 }; // coluna na SpriteSheet do personagem
const STEP_MS = 180;

// Recortes (x, y, w, h) nas folhas do Ninja Adventure.
const FRAMES = {
  house: { casaLaranja: [0, 0, 64, 48], casaPalha: [64, 0, 64, 48], casaLaranja2: [128, 0, 64, 48], casaVermelha: [192, 0, 64, 48] },
  nature: {
    arvoreGrande: [48, 288, 48, 48], arvoreRosa: [0, 288, 48, 48], arvoreLaranja: [144, 288, 48, 48],
    arvore: [0, 0, 32, 32], pedra: [256, 80, 64, 48],
    flor1: [16, 176, 16, 16], flor2: [32, 176, 16, 16], flor3: [48, 176, 16, 16],
  },
} as const;

export class VillageScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private tile = { x: 15, y: 15 };
  private facing: Dir = "up";
  private moving = false;
  private solid: boolean[][] = [];
  private keys!: Record<Dir, Phaser.Input.Keyboard.Key[]>;
  private queued: Dir | null = null; // toque rápido = um passo, mesmo se a tecla soltar antes do próximo frame

  constructor() { super("village"); }

  preload() {
    this.load.image("floor", "/assets/tiles/TilesetFloor.png");
    this.load.image("house", "/assets/tiles/TilesetHouse.png");
    this.load.image("nature", "/assets/tiles/TilesetNature.png");
    this.load.spritesheet("boy", "/assets/chars/Boy/SpriteSheet.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("oldwoman", "/assets/chars/OldWoman/SpriteSheet.png", { frameWidth: 16, frameHeight: 16 });
    this.load.image("shadow", "/assets/chars/Shadow.png");
  }

  create() {
    for (const [sheet, frames] of Object.entries(FRAMES)) {
      const tex = this.textures.get(sheet);
      for (const [name, [x, y, w, h]] of Object.entries(frames)) tex.add(name, 0, x, y, w, h);
    }

    // chão
    const map = this.make.tilemap({ data: autotile(dirtGrid()), tileWidth: T, tileHeight: T });
    map.createLayer(0, map.addTilesetImage("floor")!, 0, 0);
    this.solid = Array.from({ length: MAP_H }, () => new Array<boolean>(MAP_W).fill(false));

    // moldura de árvores (a vila é uma clareira)
    const border = ["arvoreGrande", "arvoreGrande", "arvoreRosa", "arvoreGrande", "arvoreLaranja"];
    let k = 0;
    for (let x = -1; x < MAP_W; x += 3) {
      this.prop("nature", border[k++ % 5], x, -1, 3, 3);
      if (x + 3 <= ROAD.x || x >= ROAD.x + ROAD.w) this.prop("nature", border[k++ % 5], x, MAP_H - 2, 3, 3);
    }
    for (let y = 2; y < MAP_H - 2; y += 3) { this.prop("nature", border[k++ % 5], -1, y, 3, 3); this.prop("nature", border[k++ % 5], MAP_W - 2, y, 3, 3); }

    // casas nos lotes (no jogo isso vem de casas.txt)
    const casas = ["casaLaranja", "casaPalha", null, "casaVermelha"];
    LOTS.forEach((lot, i) => { if (casas[i]) this.prop("house", casas[i]!, lot.x, lot.y + lot.h - 3, 4, 3); });

    // Pedra do Tempo no centro da praça
    this.prop("nature", "pedra", 13, 9, 4, 3);
    // flores
    [[21, 11], [22, 12], [23, 11], [8, 12], [7, 11], [24, 15], [6, 15]].forEach(([x, y], i) => this.add.image(x * T, y * T, "nature", `flor${(i % 3) + 1}`).setOrigin(0));

    // Professora Commit
    this.add.image(19 * T + 8, 12 * T + 15, "shadow");
    this.add.sprite(19 * T + 8, 12 * T + 8, "oldwoman", 0).setDepth(12 * T);
    this.solid[12][19] = true;

    // jogadora
    this.anims.create({ key: "idle-down", frames: [{ key: "boy", frame: 0 }] });
    for (const [dir, col] of Object.entries(DIR_COL)) {
      this.anims.create({ key: `walk-${dir}`, frames: this.anims.generateFrameNumbers("boy", { frames: [0, 1, 2, 3].map(r => r * 4 + col) }), frameRate: 10, repeat: -1 });
    }
    const shadow = this.add.image(0, 0, "shadow");
    this.player = this.add.sprite(this.tile.x * T + 8, this.tile.y * T + 8, "boy", DIR_COL.up);
    this.events.on("update", () => { shadow.setPosition(this.player.x, this.player.y + 7); this.player.setDepth(this.player.y); shadow.setDepth(this.player.y - 1); });

    this.cameras.main.setBounds(0, 0, MAP_W * T, MAP_H * T).startFollow(this.player, true).setRoundPixels(true);

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: [kb.addKey(K.UP), kb.addKey(K.W)], down: [kb.addKey(K.DOWN), kb.addKey(K.S)],
      left: [kb.addKey(K.LEFT), kb.addKey(K.A)], right: [kb.addKey(K.RIGHT), kb.addKey(K.D)],
    };
    for (const [dir, ks] of Object.entries(this.keys)) ks.forEach(key => key.on("down", () => { this.queued = dir as Dir; }));
  }

  // Coloca um objeto ancorado no canto superior esquerdo da área (x, y, w, h) em tiles e marca a base como sólida.
  private prop(sheet: string, frame: string, x: number, y: number, w: number, h: number) {
    const img = this.add.image(x * T, (y + h) * T, sheet, frame).setOrigin(0, 1);
    img.setDepth((y + h) * T);
    for (let yy = Math.max(0, y + h - 2); yy < Math.min(MAP_H, y + h); yy++)
      for (let xx = Math.max(0, x); xx < Math.min(MAP_W, x + w); xx++) this.solid[yy][xx] = true;
    return img;
  }

  update() {
    if (this.moving) return;
    const dir = (Object.keys(this.keys) as Dir[]).find(d => this.keys[d].some(k => k.isDown)) ?? this.queued;
    this.queued = null;
    if (!dir) { this.player.anims.stop(); this.player.setFrame(DIR_COL[this.facing]); return; }
    this.facing = dir;
    const nx = this.tile.x + (dir === "left" ? -1 : dir === "right" ? 1 : 0);
    const ny = this.tile.y + (dir === "up" ? -1 : dir === "down" ? 1 : 0);
    this.player.anims.play(`walk-${dir}`, true);
    if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || this.solid[ny][nx]) return;
    this.moving = true;
    this.tile = { x: nx, y: ny };
    this.tweens.add({
      targets: this.player, x: nx * T + 8, y: ny * T + 8, duration: STEP_MS,
      onComplete: () => { this.moving = false; },
    });
  }
}
