// Layout da vila e autotile do chão. Puro (sem Phaser) pra poder testar.

export const T = 16; // tamanho do tile em pixels
export const MAP_W = 30;
export const MAP_H = 27;

// Índices no ground.png (16 colunas), gerado por art/tools/build_ground.py. Terra sobre grama.
const DIRT = {
  tl: 0, t: 1, tr: 2,
  l: 16, c: 17, r: 18,
  bl: 32, b: 33, br: 34,
  // canto interno: terra em volta, grama sobrando num canto
  grassBR: 3, grassBL: 4, grassTR: 19, grassTL: 20,
};
const range = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i);
const GRASS = [...range(48, 16), ...range(48, 16), ...range(64, 8)]; // 1 em 5 com florzinhas
const DIRT_FILL = range(80, 16);
// água: os mesmos papéis 6 linhas abaixo; quadro A na linha 9, quadro B (ondinhas adiante) na 10
const WATER = Object.fromEntries(Object.entries(DIRT).map(([k, v]) => [k, v + 6 * 16])) as typeof DIRT;
const WATER_FILL = range(144, 16);
export const WATER_FRAME_B = 16; // somar ao índice do quadro A

export type Rect = { x: number; y: number; w: number; h: number };

// Áreas de terra: praça, estrada até a borda sul e os lotes das casas.
export const PLAZA: Rect = { x: 11, y: 11, w: 8, h: 5 };
export const ROAD: Rect = { x: 14, y: 15, w: 2, h: MAP_H - 15 };
// lotes de 6 tiles: casas com ~3 personagens de altura, proporção de RPG
export const LOTS: Rect[] = [
  { x: 1, y: 3, w: 6, h: 6 },
  { x: 8, y: 3, w: 6, h: 6 },
  { x: 16, y: 3, w: 6, h: 6 },
  { x: 23, y: 3, w: 6, h: 6 },
];
export const PATHS: Rect[] = [PLAZA, ROAD, { x: 1, y: 9, w: 28, h: 2 }]; // a rua dos lotes encosta na praça

// Rio que atravessa a vila de borda a borda, 3 tiles de altura, ondulando 1 tile pra baixo em
// alguns trechos. Na estrada fica reto, pra ponte (que tem tamanho fixo) encaixar.
export const RIVER_Y = 20;
export const RIVER_H = 3;
export const BRIDGE: Rect = { x: ROAD.x, y: RIVER_Y, w: ROAD.w, h: RIVER_H };
const riverTop = (x: number) => (x >= ROAD.x - 2 && x < ROAD.x + ROAD.w + 2 ? RIVER_Y : RIVER_Y + (Math.sin(x * 0.55) > 0.2 ? 1 : 0));

export function riverGrid(): boolean[][] {
  return Array.from({ length: MAP_H }, (_, y) => Array.from({ length: MAP_W }, (_, x) => y >= riverTop(x) && y < riverTop(x) + RIVER_H));
}

const inside = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

export function dirtGrid(paths: Rect[] = PATHS): boolean[][] {
  return Array.from({ length: MAP_H }, (_, y) => Array.from({ length: MAP_W }, (_, x) => paths.some(r => inside(r, x, y))));
}

// Escolhe o tile de cada célula olhando os 8 vizinhos. Fora do mapa conta como terra
// pra estrada "sair" pela borda sem fechar a curva.
type TileSet = { roles: typeof DIRT; fill: number[]; empty: (rand: () => number) => number };
const DIRT_SET: TileSet = { roles: DIRT, fill: DIRT_FILL, empty: rand => GRASS[Math.floor(rand() * GRASS.length)] };
export const WATER_SET: TileSet = { roles: WATER, fill: WATER_FILL, empty: () => -1 }; // -1 = sem tile (camada de cima)

export function autotile(dirt: boolean[][], seed = 1, set: TileSet = DIRT_SET): number[][] {
  const DIRT = set.roles;
  const at = (x: number, y: number) => (y < 0 || y >= dirt.length || x < 0 || x >= dirt[0].length ? true : dirt[y][x]);
  let s = seed;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return dirt.map((row, y) => row.map((d, x) => {
    if (!d) return set.empty(rand);
    const n = at(x, y - 1), s_ = at(x, y + 1), w = at(x - 1, y), e = at(x + 1, y);
    if (!n && !w) return DIRT.tl;
    if (!n && !e) return DIRT.tr;
    if (!s_ && !w) return DIRT.bl;
    if (!s_ && !e) return DIRT.br;
    if (!n) return DIRT.t;
    if (!s_) return DIRT.b;
    if (!w) return DIRT.l;
    if (!e) return DIRT.r;
    if (!at(x + 1, y - 1)) return DIRT.grassTR;
    if (!at(x - 1, y - 1)) return DIRT.grassTL;
    if (!at(x + 1, y + 1)) return DIRT.grassBR;
    if (!at(x - 1, y + 1)) return DIRT.grassBL;
    return set.fill[Math.floor(rand() * set.fill.length)];
  }));
}

export const TILES = { DIRT, GRASS, DIRT_FILL, WATER, WATER_FILL };
