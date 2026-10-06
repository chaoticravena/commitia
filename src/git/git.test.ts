import { test } from "node:test";
import assert from "node:assert/strict";
import { diffLines, log, status, treeOf, headCommit, type Workspace } from "./repo.ts";
import { run, tokenize } from "./commands.ts";

const world = (): Workspace => ({ work: { "casas.txt": "casa vermelha", "ceu.txt": "dia" }, repo: null });
const git = (ws: Workspace, cmd: string) => run(ws, cmd);
const text = (ws: Workspace, cmd: string) => git(ws, cmd).lines.map(l => l.text).join("\n");

test("sem init, comandos falham como no Git", () => {
  const r = git(world(), "git status");
  assert.equal(r.ok, false);
  assert.match(r.lines[0].text, /não é um repositório git/);
});

test("ciclo básico: untracked -> staged -> commit -> limpo", () => {
  const ws = world();
  git(ws, "git init");
  assert.deepEqual(status(ws).untracked, ["casas.txt", "ceu.txt"]);

  git(ws, "git add casas.txt");
  assert.deepEqual(status(ws).staged, [{ path: "casas.txt", kind: "novo" }]);
  assert.deepEqual(status(ws).untracked, ["ceu.txt"]);

  const r = git(ws, 'git commit -m "primeira casa"');
  assert.ok(r.ok);
  assert.match(r.lines[0].text, /^\[main [0-9a-f]{7}\] primeira casa$/);
  assert.deepEqual(Object.keys(treeOf(ws.repo!, headCommit(ws.repo!))), ["casas.txt"]);
});

test("modificar, diff, diff --staged e log em ordem", () => {
  const ws = world();
  git(ws, "git init"); git(ws, "git add ."); git(ws, 'git commit -m "inicio"');

  ws.work["casas.txt"] = "casa vermelha\ncasa azul";
  assert.deepEqual(status(ws).unstaged, [{ path: "casas.txt", kind: "modificado" }]);
  assert.equal(text(ws, "git diff"), "diff --git a/casas.txt b/casas.txt\n casa vermelha\n+casa azul");
  assert.equal(text(ws, "git diff --staged"), "");

  git(ws, "git add .");
  assert.equal(text(ws, "git diff"), "");
  assert.match(text(ws, "git diff --staged"), /\+casa azul/);

  git(ws, 'git commit -m "casa azul"');
  assert.deepEqual(log(ws).map(e => e.commit.message), ["casa azul", "inicio"]);
  assert.match(text(ws, "git status"), /árvore de trabalho limpa/);
});

test("erros: commit sem nada, add de arquivo inexistente, mensagem faltando", () => {
  const ws = world();
  git(ws, "git init");
  assert.match(text(ws, 'git commit -m "x"'), /nada adicionado ao commit/);
  assert.match(text(ws, "git add nada.txt"), /não corresponde a nenhum arquivo/);
  git(ws, "git add ."); git(ws, 'git commit -m "a"');
  assert.match(text(ws, 'git commit -m "b"'), /nada para commitar/);
  assert.match(text(ws, "git commit"), /use: git commit -m/);
  assert.match(text(ws, "git log"), /a$/m);
});

test("apagar arquivo: status, add . e commit registram a remoção", () => {
  const ws = world();
  git(ws, "git init"); git(ws, "git add ."); git(ws, 'git commit -m "a"');
  delete ws.work["ceu.txt"];
  assert.deepEqual(status(ws).unstaged, [{ path: "ceu.txt", kind: "apagado" }]);
  git(ws, "git add .");
  assert.deepEqual(status(ws).staged, [{ path: "ceu.txt", kind: "apagado" }]);
  git(ws, 'git commit -m "sem ceu"');
  assert.deepEqual(Object.keys(treeOf(ws.repo!, headCommit(ws.repo!))), ["casas.txt"]);
});

test("hashes determinísticos: mesma história, mesmos hashes", () => {
  const play = () => { const ws = world(); git(ws, "git init"); git(ws, "git add ."); git(ws, 'git commit -m "a"'); return headCommit(ws.repo!); };
  assert.equal(play(), play());
});

test("tokenize respeita aspas", () => {
  assert.deepEqual(tokenize(`git commit -m "duas palavras"`), ["git", "commit", "-m", "duas palavras"]);
  assert.deepEqual(tokenize(`git commit -m 'oi'`), ["git", "commit", "-m", "oi"]);
});

test("diffLines: LCS mínimo", () => {
  assert.deepEqual(diffLines("a\nb\nc", "a\nx\nc"), [
    { op: " ", text: "a" }, { op: "-", text: "b" }, { op: "+", text: "x" }, { op: " ", text: "c" },
  ]);
  assert.deepEqual(diffLines("", "novo"), [{ op: "+", text: "novo" }]);
});

test("viagem no tempo: switch --detach mostra o passado e switch main volta", () => {
  const ws = world();
  git(ws, "git init"); git(ws, "git add ."); git(ws, 'git commit -m "uma casa"');
  const first = headCommit(ws.repo!)!;
  ws.work["casas.txt"] = "casa vermelha\ncasa azul";
  git(ws, "git add ."); git(ws, 'git commit -m "duas casas"');

  const r = git(ws, `git switch --detach ${first.slice(0, 7)}`);
  assert.ok(r.ok, r.lines.map(l => l.text).join("\n"));
  assert.equal(ws.work["casas.txt"], "casa vermelha");
  assert.deepEqual(ws.repo!.head, { detached: first });

  git(ws, "git switch main");
  assert.equal(ws.work["casas.txt"], "casa vermelha\ncasa azul");
  assert.match(ws.repo!.reflog[0].action, /para main/);
});

test("switch recusa com mudanças pendentes e com commit sem --detach", () => {
  const ws = world();
  git(ws, "git init"); git(ws, "git add ."); git(ws, 'git commit -m "a"');
  const h = headCommit(ws.repo!)!.slice(0, 7);
  assert.match(text(ws, `git switch ${h}`), /git switch --detach/);
  ws.work["ceu.txt"] = "noite";
  assert.match(text(ws, `git switch --detach ${h}`), /seriam sobrescritas/);
  assert.ok(git(ws, `git checkout ${h}`).ok === false);
});

test("restore descarta do working dir; restore --staged tira do staging", () => {
  const ws = world();
  git(ws, "git init"); git(ws, "git add ."); git(ws, 'git commit -m "a"');
  ws.work["ceu.txt"] = "noite";
  git(ws, "git add ceu.txt");
  git(ws, "git restore --staged ceu.txt");
  assert.deepEqual(status(ws).staged, []);
  assert.equal(ws.work["ceu.txt"], "noite"); // --staged não mexe no mundo
  git(ws, "git restore ceu.txt");
  assert.equal(ws.work["ceu.txt"], "dia");
  assert.match(text(ws, "git status"), /limpa/);
});

test("comando desconhecido e fora do git", () => {
  assert.match(text(world(), "git voar"), /não é um comando git/);
  assert.match(text(world(), "ls"), /comando não encontrado/);
});
