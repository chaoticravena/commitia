import { test } from "node:test";
import assert from "node:assert/strict";

// localStorage falso: o Store lê o save assim que o módulo carrega
const mem: Record<string, string> = {};
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; } },
});
const { Store } = await import("./store.ts");

test("salvar e carregar: o repositório Git volta inteiro (o Map de objetos sobrevive ao JSON)", () => {
  const a = new Store();
  a.reset();
  a.char = "dudu";
  a.progress.talked = true;
  a.git("git init");
  a.git("git add .");
  a.git('git commit -m "vila"');

  const b = new Store(); // lê o que o primeiro salvou
  assert.equal(b.char, "dudu");
  assert.equal(b.progress.talked, true);
  assert.ok(b.ws.repo?.objects instanceof Map);
  const log = b.git("git log --oneline");
  assert.ok(log.ok && log.lines.some(l => l.text.includes("vila")), "o commit salvo sumiu");
  assert.deepEqual(b.ws.work, a.ws.work);
});

test("save corrompido não derruba o jogo: começa do zero", () => {
  mem["commitia:save"] = "{não é json";
  const c = new Store();
  assert.equal(c.ws.repo, null);
});
