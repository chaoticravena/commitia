import { test } from "node:test";
import assert from "node:assert/strict";
import { autotile, TILES } from "./map.ts";

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
