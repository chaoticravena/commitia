import { test } from "node:test";
import assert from "node:assert/strict";
import { build, demolish, houses, itemStatus, nextKind, plant, flowers } from "./world.ts";

test("construir e demolir reescrevem casas.txt em ordem de lote", () => {
  let f = build({}, 3, "padaria");
  f = build(f, 1, "madeira");
  assert.equal(f["casas.txt"], "lote 1: madeira\nlote 3: padaria");
  f = demolish(f, 1);
  assert.equal(f["casas.txt"], "lote 3: padaria");
  assert.deepEqual([...houses(f)], [[3, "padaria"]]);
});

test("jardim é independente das casas", () => {
  const f = plant(build({}, 0, "pedra"), 4, "girassol");
  assert.deepEqual([...flowers(f)], [[4, "girassol"]]);
  assert.equal(houses(f).size, 1);
});

test("status por objeto: mod, stg, ok e fantasma", () => {
  const m = (...e: [number, string][]) => new Map(e);
  assert.equal(itemStatus(m([1, "a"]), m(), m(), 1), "mod");
  assert.equal(itemStatus(m([1, "a"]), m([1, "a"]), m(), 1), "stg");
  assert.equal(itemStatus(m([1, "a"]), m([1, "a"]), m([1, "a"]), 1), "ok");
  assert.equal(itemStatus(m([1, "b"]), m([1, "a"]), m([1, "a"]), 1), "mod");
  assert.equal(itemStatus(m(), m([1, "a"]), m([1, "a"]), 1), "ghost");
});

test("Espaço num lote percorre vazio, pedra, madeira, padaria e volta ao vazio", () => {
  assert.deepEqual([undefined, "pedra", "madeira", "padaria"].map(nextKind), ["pedra", "madeira", "padaria", null]);
});
