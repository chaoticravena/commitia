import { test } from "node:test";
import assert from "node:assert/strict";
import { autotile, BRIDGE, MAP_W, riverGrid, TILES, WATER_SET } from "./map.ts";

const { DIRT, GRASS, DIRT_FILL } = TILES;
const grid = (rows: string[]) => rows.map(r => [...r].map(c => c === "#"));

test("retângulo de terra: cantos, bordas e centro", () => {
  const t = autotile(grid([
    ".....",
    ".###.",
    ".###.",
    ".###.",
    ".....",
  ]));
  assert.deepEqual([t[1][1], t[1][2], t[1][3]], [DIRT.tl, DIRT.t, DIRT.tr]);
  assert.deepEqual([t[2][1], t[2][3]], [DIRT.l, DIRT.r]);
  assert.ok(DIRT_FILL.includes(t[2][2])); // centro: uma das variações de terra
  assert.deepEqual([t[3][1], t[3][2], t[3][3]], [DIRT.bl, DIRT.b, DIRT.br]);
  assert.ok(GRASS.includes(t[0][0]));
});

test("junção em L usa canto interno com a grama no lugar certo", () => {
  const t = autotile(grid([
    "......",
    ".####.",
    ".####.",
    ".##...",
    ".##...",
    "......",
  ]));
  // em (2,2) a terra continua pra cima, esquerda e baixo, mas o vizinho sudeste é grama
  assert.equal(t[2][2], DIRT.grassBR);
});

test("borda do mapa conta como terra: a estrada sai pela borda aberta", () => {
  const t = autotile(grid([
    ".....",
    ".##..",
    ".##..",
  ]));
  assert.deepEqual([t[2][1], t[2][2]], [DIRT.l, DIRT.r]);
});

test("rio atravessa o mapa inteiro e é reto onde fica a ponte", () => {
  const river = riverGrid();
  for (let x = 0; x < MAP_W; x++) assert.ok(river.some(row => row[x]), `coluna ${x} sem água`);
  for (let x = BRIDGE.x; x < BRIDGE.x + BRIDGE.w; x++)
    for (let y = BRIDGE.y; y < BRIDGE.y + BRIDGE.h; y++) assert.ok(river[y][x], `ponte fora da água em ${x},${y}`);
});

test("camada de água: fora do rio fica vazia, dentro usa tiles de água", () => {
  const t = autotile(riverGrid(), 1, WATER_SET);
  assert.equal(t[0][0], -1);
  assert.ok(TILES.WATER_FILL.includes(t[BRIDGE.y + 1][BRIDGE.x]));
  assert.equal(t[BRIDGE.y][BRIDGE.x], TILES.WATER.t);
});
