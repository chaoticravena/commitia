// Terminal: transforma uma linha digitada em chamada do motor e formata a saída como o Git real.
import { GitError, add, commit, diff, init, log, restore, status, switchTo, type Workspace } from "./repo.ts";

export type Kind = "info" | "ok" | "err" | "hash" | "add" | "del" | "head";
export type Line = { text: string; kind: Kind };
export type Result = { ok: boolean; lines: Line[]; command?: string };

const L = (text: string, kind: Kind = "info"): Line => ({ text, kind });
export const short = (h: string) => h.slice(0, 7);

// Divide respeitando aspas: git commit -m "duas palavras" -> [git, commit, -m, duas palavras]
export function tokenize(raw: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  for (const m of raw.matchAll(re)) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

type Handler = (ws: Workspace, args: string[]) => Line[];

const HANDLERS: Record<string, Handler> = {
  init(ws) {
    return [L(init(ws) === "novo" ? "Repositório Git vazio inicializado ✨" : "Repositório Git existente reinicializado", "ok")];
  },

  add(ws, args) {
    add(ws, args);
    return [];
  },

  commit(ws, args) {
    const i = args.indexOf("-m");
    if (i < 0 || args[i + 1] === undefined) throw new GitError('use: git commit -m "mensagem"');
    const hash = commit(ws, args[i + 1]);
    const repo = ws.repo!;
    const where = "branch" in repo.head ? repo.head.branch : "HEAD destacado";
    return [L(`[${where} ${short(hash)}] ${args[i + 1]}`, "ok")];
  },

  status(ws) {
    const s = status(ws);
    const out: Line[] = ["branch" in s.head
      ? L(`Na branch ${s.head.branch}`, "head")
      : L(`HEAD destacado em ${short(s.head.detached)}`, "head")];
    if (!s.hasCommits) out.push(L("Ainda não há commits"));
    if (s.staged.length) {
      out.push(L("Mudanças prontas pro commit:"));
      s.staged.forEach(c => out.push(L(`    ${c.kind}: ${c.path}`, "ok")));
    }
    if (s.unstaged.length) {
      out.push(L("Mudanças fora do staging (use \"git add\"):"));
      s.unstaged.forEach(c => out.push(L(`    ${c.kind}: ${c.path}`, "err")));
    }
    if (s.untracked.length) {
      out.push(L("Arquivos não rastreados (use \"git add\"):"));
      s.untracked.forEach(p => out.push(L(`    ${p}`, "err")));
    }
    if (!s.staged.length && !s.unstaged.length && !s.untracked.length) out.push(L("nada pra commitar, árvore de trabalho limpa", "ok"));
    return out;
  },

  log(ws, args) {
    const oneline = args.includes("--oneline");
    const entries = log(ws, args.find(a => !a.startsWith("-")));
    return entries.flatMap(({ hash, commit }, i) => {
      const tag = i === 0 ? " (HEAD)" : "";
      return oneline
        ? [L(`${short(hash)}${tag} ${commit.message}`, "hash")]
        : [L(`commit ${hash}${tag}`, "hash"), L(`    ${commit.message}`), L("")];
    });
  },

  switch(ws, args) {
    const detach = args.includes("--detach") || args.includes("-d");
    const target = args.find(a => !a.startsWith("-"));
    if (!target) throw new GitError("use: git switch <branch>  ou  git switch --detach <commit>");
    const head = switchTo(ws, target, detach);
    return "branch" in head
      ? [L(`Mudou para a branch '${head.branch}'`, "ok")]
      : [L(`HEAD agora está em ${short(head.detached)} · você está vendo o mundo como ele era`, "head"),
         L("Você está em 'HEAD destacado': pode olhar à vontade. Pra voltar: git switch main")];
  },

  // checkout antigo: aceita commit (vira --detach) ou branch
  checkout(ws, args) {
    const target = args.find(a => !a.startsWith("-"));
    if (!target) throw new GitError("use: git checkout <branch|commit>");
    return HANDLERS.switch(ws, ws.repo && target in ws.repo.branches ? [target] : ["--detach", target]);
  },

  restore(ws, args) {
    restore(ws, args.filter(a => !a.startsWith("-")), args.includes("--staged"));
    return [];
  },

  diff(ws, args) {
    const files = diff(ws, args.includes("--staged") || args.includes("--cached"));
    return files.flatMap(f => [
      L(`diff --git a/${f.path} b/${f.path}`, "head"),
      ...f.lines.map(l => L(l.op + l.text, l.op === "+" ? "add" : l.op === "-" ? "del" : "info")),
    ]);
  },
};

export const COMMANDS = Object.keys(HANDLERS);

export function run(ws: Workspace, raw: string): Result {
  const [git, sub, ...args] = tokenize(raw.trim());
  if (!git) return { ok: true, lines: [] };
  if (git !== "git") return { ok: false, lines: [L(`comando não encontrado: ${git}. Aqui todo comando começa com git`, "err")] };
  if (!sub || !HANDLERS[sub]) return { ok: false, lines: [L(`git: '${sub ?? ""}' não é um comando git (ainda)`, "err")] };
  try {
    return { ok: true, lines: HANDLERS[sub](ws, args), command: sub };
  } catch (e) {
    if (e instanceof GitError) return { ok: false, lines: e.message.split("\n").map(t => L(t, "err")), command: sub };
    throw e;
  }
}
