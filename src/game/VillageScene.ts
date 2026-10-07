import Phaser from "phaser";
import { addAmbient, addWaterSparkles } from "./ambient.ts";
import { playMusic } from "./music.ts";
import { professora } from "./act1.ts";
import { store } from "./store.ts";
import { loadSettings, sfxVolume } from "./settings.ts";
import type { UIScene } from "./UIScene.ts";
import { grimoire } from "./grimoire.ts";
import { touch } from "./touch.ts";
import { FILES, build, demolish, houses, itemStatus, nextKind, type ItemStatus } from "./world.ts";
import { BRIDGE, LOTS, MAP_H, MAP_W, RIVER_H, RIVER_Y, ROAD, T, TILES, WATER_FRAME_B, WATER_SET, autotile, dirtGrid, riverGrid } from "./map.ts";

type Dir = "down" | "up" | "left" | "right";
const DIR_ROW: Record<Dir, number> = { down: 0, up: 1, left: 2, right: 3 }; // linha na folha 4x4 de caminhada
const STEP_MS = 180;
const PROF = { x: 19, y: 14 }; // tile da Professora Commit
const SPRITE: Record<string, string> = {
  pedra: "casa-pedra-rosa", madeira: "casa-madeira", padaria: "casa-padaria",
  floricultura: "casa-floricultura", cha: "casa-cha", biblioteca: "casa-biblioteca", moinho: "casa-moinho-corpo",
};
// centro da porta (px a partir da esquerda do sprite), medido em cada desenho
const DOOR_X: Record<string, number> = { pedra: 40.5, madeira: 48.5, padaria: 47.5, floricultura: 64.5, cha: 54.3, biblioteca: 53.3, moinho: 49.5 };
// Casa centralizada no lote e empurrada até a porta cair no centro de um tile do caminho.
function doorShift(kind: string, lotX: number, width: number) {
  const left = lotX * T, door = left + Math.round((6 * T - width) / 2) + (DOOR_X[kind] ?? width / 2);
  const center = Math.round((door - 8) / T) * T + 8;
  return Math.round(center - (left + (DOOR_X[kind] ?? width / 2)));
}
const SPRITES = "assets/sprites"; // arte própria
// ?v= muda a cada build: o navegador baixa a arte nova em vez de mostrar a do cache
const png = (name: string) => `${SPRITES}/${name}.png?v=${import.meta.env.VITE_BUILD ?? "dev"}`;

const IMAGES = [
  "arvore-grande", "arvore-florida", "casa-pedra-rosa", "casa-madeira", "casa-padaria", "torre-relogio",
  "casa-floricultura", "casa-cha", "casa-biblioteca", "casa-moinho-corpo",
  "pedra-do-tempo", "poste-lanterna", "cerca", "arbusto", "capim-alto", "caixa-correio",
  "arvore-pinheiro", "arvore-lavanda", "arbusto-hortensia", "arbusto-frutinhas", "toco-cogumelos", "pedrinhas",
  "canteiro-flores", "placa-madeira", "lote-vazio", "ponte-madeira",
];
const FLOWERING = ["arvore-florida", "arvore-lavanda"];

// personagens jogáveis: chave da textura -> nome e folha de caminhada
export const CHARS = { helena: { name: "Lena", sheet: "helena-andando" }, dudu: { name: "Dudu", sheet: "dudu-andando" } };
export type CharKey = keyof typeof CHARS;

export class VillageScene extends Phaser.Scene {
  private char: CharKey = "helena";
  private player!: Phaser.GameObjects.Sprite;
  private buddy!: Phaser.GameObjects.Sprite;
  private dirt = dirtGrid();
  private ambient!: ReturnType<typeof addAmbient>;
  private tile = { x: 15, y: 17 };
  private facing: Dir = "up";
  private moving = false;
  private solid: boolean[][] = [];
  private keys!: Record<Dir, Phaser.Input.Keyboard.Key[]>;
  private prof!: Phaser.GameObjects.Sprite;
  private lots: { objs: Phaser.GameObjects.GameObject[]; img?: Phaser.GameObjects.Image; status: ItemStatus; cells: [number, number][] }[] = [];
  private queued: Dir | null = null; // toque rápido = um passo, mesmo se a tecla soltar antes do próximo frame

  constructor() { super("village"); }

  init(data: { char?: CharKey }) {
    this.char = data.char ?? "helena";
    this.tile = { x: 15, y: 17 };
    this.facing = "up";
    this.moving = false;
  }

  preload() {
    this.load.image("ground", png("ground")); // gerado por art/tools/build_ground.py
    for (const name of IMAGES) this.load.image(name, png(name));
    for (const [key, c] of Object.entries(CHARS)) this.load.spritesheet(key, png(c.sheet), { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("professora", png("professora-andando"), { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("helice", png("moinho-helice"), { frameWidth: 62, frameHeight: 62 });
    this.load.spritesheet("gitinho", png("gitinho-andando"), { frameWidth: 32, frameHeight: 32 });
    // passos por superfície (Kenney Impact Sounds, CC0): uma pisada por arquivo
    for (const k of ["grass", "carpet", "wood"]) for (let i = 0; i < 5; i++) this.load.audio(`passo-${k}${i}`, `assets/audio/footstep_${k}_00${i}.ogg`);
    this.load.audio("musica-vila", `assets/audio/musica-vila.mp3?v=${import.meta.env.VITE_BUILD ?? "dev"}`);
  }

  create() {
    playMusic(this, "musica-vila");
    store.char = this.char;
    store.save();
    const map = this.make.tilemap({ data: autotile(dirtGrid()), tileWidth: T, tileHeight: T });
    map.createLayer(0, map.addTilesetImage("ground")!, 0, 0);
    this.solid = Array.from({ length: MAP_H }, () => new Array<boolean>(MAP_W).fill(false));

    // rio: camada de água por cima do chão; só se atravessa pela ponte
    const river = riverGrid();
    const wmap = this.make.tilemap({ data: autotile(river, 1, WATER_SET), tileWidth: T, tileHeight: T });
    const water = wmap.createLayer(0, wmap.addTilesetImage("ground")!, 0, 0)!;
    const inBridge = (x: number, y: number) => x >= BRIDGE.x && x < BRIDGE.x + BRIDGE.w && y >= BRIDGE.y && y < BRIDGE.y + BRIDGE.h;
    const waterCells: [number, number][] = [];
    river.forEach((row, y) => row.forEach((w, x) => {
      if (w && !inBridge(x, y)) { this.solid[y][x] = true; waterCells.push([x, y]); }
    }));
    // ondinhas: alterna os tiles de água entre o quadro A e o B
    this.time.addEvent({ delay: 550, loop: true, callback: () => water.forEachTile(t => {
      if (TILES.WATER_FILL.includes(t.index)) t.index += WATER_FRAME_B;
      else if (TILES.WATER_FILL.includes(t.index - WATER_FRAME_B)) t.index -= WATER_FRAME_B;
    }) });
    addWaterSparkles(this, waterCells);
    // ponte girada 90°, passando 12 px de cada margem; fica no nível do chão (você anda por cima)
    this.add.image((BRIDGE.x + BRIDGE.w / 2) * T, RIVER_Y * T - 12, "ponte-madeira").setOrigin(0.5, 0).setDepth(2);

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
    for (let y = 3; y < MAP_H - 1; y += 2) {
      if (y >= RIVER_Y - 1 && y <= RIVER_Y + RIVER_H + 1) continue; // o rio sai pelas laterais
      tree(-1, y); tree(MAP_W - 2, y);
    }

    // casas nos lotes: desenhadas a partir do casas.txt e do estado de cada linha no Git
    this.lots = LOTS.map(() => ({ objs: [], status: "ok" as ItemStatus, cells: [] }));
    this.renderLots();
    const off = store.on(() => this.renderLots());
    let blink = false; // "mod" pisca em rosa: mudança que o Git ainda não guardou
    this.time.addEvent({ delay: 450, loop: true, callback: () => {
      blink = !blink;
      for (const l of this.lots) if (l.status === "mod") blink ? l.img?.setTint(0xffa8c0) : l.img?.clearTint();
    } });
    this.events.once("shutdown", off);
    this.place("caixa-correio", 7, 8);

    // praça: Pedra do Tempo, torre do relógio e postes
    // a base da pedra é desenhada em ângulo (termina em ponta): sombra larga sob o miolo da base pra ela assentar no chão
    // no canto esquerdo da praça: o meio (colunas 14-15) é o caminho da estrada até a rua das casas
    this.place("pedra-do-tempo", 11, 13, 2, 0);
    this.shadow(11 * T + 24, 14 * T - 3, 50);
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
    [[7, 14], [25, 17], [10, 19], [17, 16], [8, 24]].forEach(([x, y]) => this.place("pedrinhas", x, y));
    [[2, 14], [26, 14]].forEach(([x, y]) => this.place("toco-cogumelos", x, y));
    this.place("placa-madeira", 12, 17);
    this.place("cerca", 5, 16);
    // margem de baixo do rio
    [[4, 24], [23, 24], [18, 25]].forEach(([x, y]) => this.place("canteiro-flores", x, y, 0, 0));
    [[11, 25], [25, 25]].forEach(([x, y]) => this.place("capim-alto", x, y, 0, 0));

    // Professora Commit
    const prof = this.prof = this.add.sprite(PROF.x * T + 8, (PROF.y + 1) * T, "professora", 0).setOrigin(0.5, 1).setDepth(15 * T);
    this.shadow(19 * T + 8, 15 * T - 1, 12);
    this.solid[14][19] = true;
    // vida parada: respira (sobe 1 px de vez em quando) e olha em volta; se você chega perto, olha pra você
    let breath = 0;
    this.time.addEvent({ delay: 900, loop: true, callback: () => prof.setY(15 * T - (breath ^= 1)) });
    this.time.addEvent({ delay: 2600, loop: true, callback: () => {
      if (this.ui.open) return; // conversando: continua olhando pra você
      const dx = this.player.x - prof.x, dy = this.player.y - prof.y;
      const look: Dir = Math.hypot(dx, dy) < 3 * T
        ? (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up")
        : (["down", "down", "left", "right"] as Dir[])[Math.floor(Math.random() * 4)];
      prof.setFrame(DIR_ROW[look] * 4);
    } });

    // personagem escolhida + Gitinho
    for (const [dir, row] of Object.entries(DIR_ROW)) {
      for (const key of Object.keys(CHARS))
        this.anims.create({ key: `${key}-walk-${dir}`, frames: this.anims.generateFrameNumbers(key, { frames: [0, 1, 2, 3].map(c => row * 4 + c) }), frameRate: 8, repeat: -1 });
      // Gitinho pula o tempo todo, como seguidor de Pokémon: parado, agacha, no ar, aterrissa
      this.anims.create({ key: `hop-${dir}`, frames: this.anims.generateFrameNumbers("gitinho", { frames: [0, 1, 2, 3].map(c => row * 4 + c) }), frameRate: 4, repeat: -1 }); // 1 pulo por segundo
    }
    this.player = this.add.sprite(this.tile.x * T + 8, (this.tile.y + 1) * T, this.char, DIR_ROW.up * 4).setOrigin(0.5, 1);
    this.buddy = this.add.sprite(this.tile.x * T + 8, (this.tile.y + 2) * T, "gitinho").setOrigin(0.5, 1).play("hop-up");
    const shadows = [this.shadow(0, 0, 12), this.shadow(0, 0, 10)];
    const follow = () => {
      shadows[0].setPosition(this.player.x, this.player.y - 1);
      shadows[1].setPosition(this.buddy.x, this.buddy.y - 1);
      this.player.setDepth(this.player.y);
      this.buddy.setDepth(this.buddy.y);
    };
    this.events.on("update", follow);

    this.ambient = addAmbient(this, placed, new Phaser.Geom.Rectangle(2 * T, 3 * T, (MAP_W - 4) * T, (MAP_H - 6) * T));

    // luz quente das lanternas e bordas da tela levemente escurecidas
    this.children.list.filter(o => (o as Phaser.GameObjects.Image).texture?.key === "poste-lanterna").forEach(o => {
      const post = o as Phaser.GameObjects.Image;
      const glow = this.add.image(post.x + 12, post.y - post.height + 10, this.glowTexture()).setBlendMode(Phaser.BlendModes.ADD).setDepth(post.depth + 1);
      this.tweens.add({ targets: glow, alpha: 0.75, duration: 900 + Math.random() * 600, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    });
    this.cameras.main.filters.external.addVignette(0.5, 0.5, 0.75, 0.15, 0x9a8fb0, Phaser.BlendModes.MULTIPLY); // escurece ~17% nos cantos, nada no centro

    const cam = this.cameras.main.setBounds(0, 0, MAP_W * T, MAP_H * T).setRoundPixels(true).startFollow(this.player, true);
    // zoom inteiro que mostra pelo menos 320x180 pixels do mundo
    const zoom = () => cam.setZoom(Math.max(1, Math.floor(Math.min(this.scale.width / 320, this.scale.height / 180))));
    zoom();
    this.scale.on("resize", zoom);
    // a cena reinicia ao trocar de personagem: solta os ouvintes que não morrem junto com ela
    this.events.once("shutdown", () => { this.scale.off("resize", zoom); this.events.off("update", follow); });

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: [kb.addKey(K.UP), kb.addKey(K.W)], down: [kb.addKey(K.DOWN), kb.addKey(K.S)],
      left: [kb.addKey(K.LEFT), kb.addKey(K.A)], right: [kb.addKey(K.RIGHT), kb.addKey(K.D)],
    };
    for (const [dir, ks] of Object.entries(this.keys)) ks.forEach(key => key.on("down", () => { this.queued = dir as Dir; }));
    // Espaço, Enter ou E: conversar (ou avançar a fala)
    [K.SPACE, K.ENTER, K.E].forEach(k => kb.addKey(k).on("down", () => this.interact()));
    // G abre o grimório; enquanto ele está aberto, o teclado é dele (WASD vira letra, não passo)
    kb.addKey(K.G).on("down", () => { if (!this.ui.open) grimoire.open(); });
    const onGrimoire = () => { kb.enabled = !grimoire.isOpen; kb.resetKeys(); touch.show(!grimoire.isOpen); };
    grimoire.addEventListener("change", onGrimoire);
    grimoire.showButton(true);
    // celular: direcional anda, A conversa/constrói/avança a fala, II pausa
    touch.onA = () => this.interact();
    touch.onPause = () => this.ui.togglePause();
    touch.show(true);
    this.events.once("shutdown", () => { grimoire.removeEventListener("change", onGrimoire); grimoire.showButton(false); touch.show(false); this.scene.stop("ui"); });
    if (!this.scene.isActive("ui")) this.scene.launch("ui");
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

  // Redesenha os 4 lotes. Mostra o que está no mundo (working dir); uma casa demolida que o Git
  // ainda guarda aparece como fantasma. Antes do git init não há status: tudo normal.
  private renderLots() {
    const repo = store.ws.repo;
    const work = houses(store.ws.work), index = houses(store.indexFiles()), head = houses(store.headFiles());
    LOTS.forEach((lot, i) => {
      const l = this.lots[i];
      l.objs.forEach(o => o.destroy());
      // desmarca só o que esta casa marcou (casas largas passam do lote; limpar o lote inteiro deixava
      // uma coluna presa, e limpar além dele apagaria a colisão dos vizinhos)
      l.cells.forEach(([x, y]) => { this.solid[y][x] = false; });
      const wasSolid = this.solid.map(row => [...row]);
      l.status = repo ? itemStatus(work, index, head, i) : "ok";
      const kind = work.get(i) ?? (l.status === "ghost" ? index.get(i) ?? head.get(i) : undefined);
      const before = this.children.length;
      const bottom = lot.y + lot.h - 1;
      l.img = kind ? this.place(SPRITE[kind] ?? "casa-madeira", lot.x, bottom, l.status === "ghost" ? 0 : 2, 0.95)
        : this.place("lote-vazio", lot.x, bottom, 0, 0);
      // moinho: a hélice é um sprite à parte, girando no eixo (px 50,46 do corpo); X e + alternando
      if (kind === "moinho") {
        if (!this.anims.exists("helice")) this.anims.create({ key: "helice", frames: this.anims.generateFrameNumbers("helice", { frames: [0, 1] }), frameRate: 2.5, repeat: -1 });
        const sails = this.add.sprite(l.img.x + 50, l.img.y - l.img.height + 46, "helice", 0).setDepth(l.img.depth + 1);
        if (l.status !== "ghost") sails.play("helice");
      }
      l.objs = this.children.list.slice(before);
      l.cells = [];
      this.solid.forEach((row, y) => row.forEach((v, x) => { if (v && !wasSolid[y][x]) l.cells.push([x, y]); }));
      if (kind) { const dx = doorShift(kind, lot.x, l.img.width); l.objs.forEach(o => { (o as Phaser.GameObjects.Image).x += dx; }); }
      if (l.status === "stg") l.img.setTint(0xb8f0c8);
      if (l.status === "ghost") l.objs.forEach(o => { const im = o as Phaser.GameObjects.Image; im.setAlpha(im.alpha * 0.4); }); // sombras incluídas, na proporção
    });
  }

  private get ui() { return this.scene.get("ui") as UIScene; }

  private interact() {
    const ui = this.ui;
    if (ui.open) return ui.advance();
    if (this.moving) return;
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.facing];
    const fx = this.tile.x + d[0], fy = this.tile.y + d[1];
    // de frente pra um lote: troca o que tem nele (edita a linha do casas.txt)
    const lot = LOTS.findIndex(l => fx >= l.x && fx < l.x + l.w && fy >= l.y && fy < l.y + l.h);
    if (lot >= 0) {
      const street = houses(store.ws.work);
      const kind = nextKind(street.get(lot), [...street].filter(([n]) => n !== lot).map(([, k]) => k));
      store.setWork(kind ? build(store.ws.work, lot, kind) : demolish(store.ws.work, lot));
      return ui.toast(`${FILES.casas} · lote ${lot}: ${kind ?? (loadSettings().lang === "pt" ? "vazio" : "empty")}`);
    }
    if (fx !== PROF.x || fy !== PROF.y) return;
    // ela vira pra você (direção oposta à sua)
    const back: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };
    this.prof.setFrame(DIR_ROW[back[this.facing]] * 4);
    ui.say("professora", professora(store.ws, store.progress, loadSettings().lang), () => { store.progress.talked = true; store.save(); });
  }

  update() {
    if (this.ui?.open) { this.player.anims.stop(); this.player.setFrame(DIR_ROW[this.facing] * 4); return; }
    const inBridgeRow = (y: number) => y >= RIVER_Y && y < RIVER_Y + RIVER_H; // na ponte não levanta poeira
    if (this.moving) return;
    // teclas seguradas somam: W+A anda na diagonal; opostas se anulam
    const held = (d: Dir) => this.keys[d].some(k => k.isDown);
    let dx = (held("right") ? 1 : 0) - (held("left") ? 1 : 0);
    let dy = (held("down") ? 1 : 0) - (held("up") ? 1 : 0);
    if (!dx && !dy) { dx = touch.dx; dy = touch.dy; } // direcional de toque
    if (!dx && !dy && this.queued) { dx = this.queued === "right" ? 1 : this.queued === "left" ? -1 : 0; dy = this.queued === "down" ? 1 : this.queued === "up" ? -1 : 0; }
    this.queued = null;
    if (!dx && !dy) { this.player.anims.stop(); this.player.setFrame(DIR_ROW[this.facing] * 4); return; }
    // a folha só tem 4 direções: na diagonal o corpo vira pro lado
    this.facing = dx ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    this.player.anims.play(`${this.char}-walk-${this.facing}`, true);
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
    if (this.dirt[ny][nx] && !inBridgeRow(ny)) this.ambient.stepDust(nx * T + 8, (ny + 1) * T);
    // passo suave, estilo Stardew: grama farfalha, terra é um baque abafado, a ponte soa madeira.
    // Sorteia 1 de 5 por superfície e varia um tiquinho o tom pra não repetir.
    const sfx = sfxVolume();
    if (sfx) {
      const k = inBridgeRow(ny) ? "wood" : this.dirt[ny][nx] ? "carpet" : "grass";
      this.sound.play(`passo-${k}${Math.floor(Math.random() * 5)}`, {
        volume: { wood: 0.14, carpet: 0.16, grass: 0.12 }[k] * sfx, // bem de fundo: passo é textura, não destaque
        rate: 0.97 + Math.random() * 0.06,
      });
    }
    // o Gitinho vai pra onde você estava, como um seguidor de Pokémon
    const bx = prev.x * T + 8 - this.buddy.x, by = (prev.y + 1) * T - this.buddy.y;
    const bdir: Dir = Math.abs(bx) > Math.abs(by) ? (bx > 0 ? "right" : "left") : by > 0 ? "down" : "up";
    this.buddy.play(`hop-${bdir}`, true);
    this.tweens.add({ targets: this.buddy, x: prev.x * T + 8, y: (prev.y + 1) * T, duration: ms });
  }
}
