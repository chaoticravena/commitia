// Layout da vila e autotile do chão. Puro (sem Phaser) pra poder testar.

export const T = 16; // tamanho do tile em pixels
export const MAP_W = 30;
export const MAP_H = 20;

// Índices no TilesetFloor.png (22 colunas). Terra sobre grama.
const DIRT = {
  tl: 154, t: 155, tr: 156,
  l: 176, c: 177, r: 178,
  bl: 198, b: 199, br: 200,
  // canto interno: terra em volta, grama sobrando num canto
  grassBR: 181, grassBL: 182, grassTR: 203, grassTL: 204,
};
const GRASS = [264, 264, 264, 264, 265, 266, 267, 268]; // mais lisa que com tufos

export type Rect = { x: number; y: number; w: number; h: number };

// Áreas de terra: praça, estrada até a borda sul e os lotes das casas.
export const PLAZA: Rect = { x: 11, y: 9, w: 8, h: 5 };
export const ROAD: Rect = { x: 14, y: 13, w: 2, h: 7 };
export const LOTS: Rect[] = [
  { x: 3, y: 3, w: 4, h: 4 },
  { x: 9, y: 3, w: 4, h: 4 },
  { x: 17, y: 3, w: 4, h: 4 },
  { x: 23, y: 3, w: 4, h: 4 },
];
export const PATHS: Rect[] = [PLAZA, ROAD, { x: 4, y: 7, w: 22, h: 2 }]; // a rua dos lotes encosta na praça

const inside = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

export function dirtGrid(paths: Rect[] = PATHS): boolean[][] {
  return Array.from({ length: MAP_H }, (_, y) => Array.from({ length: MAP_W }, (_, x) => paths.some(r => inside(r, x, y))));
}

// Escolhe o tile de cada célula olhando os 8 vizinhos. Fora do mapa conta como terra
// pra estrada "sair" pela borda sem fechar a curva.
export function autotile(dirt: boolean[][], seed = 1): number[][] {
  const at = (x: number, y: number) => (y < 0 || y >= dirt.length || x < 0 || x >= dirt[0].length ? true : dirt[y][x]);
  let s = seed;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return dirt.map((row, y) => row.map((d, x) => {
    if (!d) return GRASS[Math.floor(rand() * GRASS.length)];
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
    return DIRT.c;
  }));
}

export const TILES = { DIRT, GRASS };
