// Motor de Git simulado: objetos endereçados por hash, index, refs, HEAD e reflog.
// Puro (sem DOM, sem Phaser) pra ser testável e determinístico.

export type Hash = string;
export type Files = Record<string, string>; // caminho -> conteúdo (working directory)
export type Tree = Record<string, Hash>; // caminho -> hash do blob

export type Commit = { tree: Hash; parents: Hash[]; message: string; time: number };
type GitObject =
  | { type: "blob"; content: string }
  | { type: "tree"; entries: Tree }
  | ({ type: "commit" } & Commit);

export type Head = { branch: string } | { detached: Hash };

export type Repo = {
  objects: Map<Hash, GitObject>;
  branches: Record<string, Hash>;
  head: Head;
  index: Tree;
  reflog: { hash: Hash; action: string }[];
  clock: number; // ponytail: relógio lógico em vez de Date.now(), pra hashes e testes determinísticos
};

// O jogo começa com uma pasta (o mundo) e, opcionalmente, um repositório dentro dela.
export type Workspace = { work: Files; repo: Repo | null };

export class GitError extends Error {}

// FNV-1a 64 bits: não é SHA-1, mas é determinístico e suficiente pra um repositório de jogo.
export function hashOf(text: string): Hash {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < text.length; i++) {
    h ^= BigInt(text.charCodeAt(i));
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, "0");
}

function store(repo: Repo, obj: GitObject): Hash {
  const body = obj.type === "blob" ? obj.content
    : obj.type === "tree" ? JSON.stringify(Object.entries(obj.entries).sort())
    : JSON.stringify([obj.tree, obj.parents, obj.message, obj.time]);
  const hash = hashOf(obj.type + "\0" + body);
  repo.objects.set(hash, obj);
  return hash;
}

export function requireRepo(ws: Workspace): Repo {
  if (!ws.repo) throw new GitError("fatal: não é um repositório git (nem nenhuma pasta acima)");
  return ws.repo;
}

export function getCommit(repo: Repo, hash: Hash): Commit {
  const obj = repo.objects.get(hash);
  if (obj?.type !== "commit") throw new GitError(`fatal: '${hash}' não é um commit`);
  return obj;
}

export function blobContent(repo: Repo, hash: Hash): string {
  const obj = repo.objects.get(hash);
  if (obj?.type !== "blob") throw new GitError(`fatal: '${hash}' não é um blob`);
  return obj.content;
}

export function headCommit(repo: Repo): Hash | undefined {
  return "branch" in repo.head ? repo.branches[repo.head.branch] : repo.head.detached;
}

export function treeOf(repo: Repo, commit: Hash | undefined): Tree {
  if (!commit) return {};
  const obj = repo.objects.get(getCommit(repo, commit).tree);
  return obj?.type === "tree" ? { ...obj.entries } : {};
}

// Aceita hash completo ou prefixo (mín. 4), como o Git.
export function resolveCommit(repo: Repo, ref: string): Hash {
  if (repo.branches[ref]) return repo.branches[ref];
  if (ref === "HEAD") {
    const h = headCommit(repo);
    if (h) return h;
  }
  if (ref.length >= 4) {
    const hits = [...repo.objects].filter(([h, o]) => o.type === "commit" && h.startsWith(ref));
    if (hits.length === 1) return hits[0][0];
    if (hits.length > 1) throw new GitError(`erro: o hash curto '${ref}' é ambíguo`);
  }
  throw new GitError(`fatal: argumento ambíguo '${ref}': revisão desconhecida`);
}

// ---------- comandos do v0.1 ----------

export function init(ws: Workspace): "novo" | "reinicializado" {
  if (ws.repo) return "reinicializado";
  ws.repo = { objects: new Map(), branches: {}, head: { branch: "main" }, index: {}, reflog: [], clock: 0 };
  return "novo";
}

export function add(ws: Workspace, paths: string[]): string[] {
  const repo = requireRepo(ws);
  if (!paths.length) throw new GitError("Nada especificado, nada adicionado.\ndica: talvez você quisesse 'git add .'?");
  const all = [...new Set([...Object.keys(ws.work), ...Object.keys(repo.index)])];
  const targets = paths.includes(".") ? all : paths;
  for (const p of targets) {
    if (!(p in ws.work) && !(p in repo.index)) throw new GitError(`fatal: o caminho '${p}' não corresponde a nenhum arquivo`);
  }
  for (const p of targets) {
    if (p in ws.work) repo.index[p] = store(repo, { type: "blob", content: ws.work[p] });
    else delete repo.index[p]; // arquivo apagado: o add registra a remoção
  }
  return targets;
}

export function commit(ws: Workspace, message: string): Hash {
  const repo = requireRepo(ws);
  if (!message.trim()) throw new GitError("Abortando commit por causa da mensagem vazia.");
  const parent = headCommit(repo);
  const tree = store(repo, { type: "tree", entries: { ...repo.index } });
  if (parent && getCommit(repo, parent).tree === tree) throw new GitError("nada para commitar, a árvore de trabalho está limpa");
  if (!parent && !Object.keys(repo.index).length) throw new GitError("nada adicionado ao commit (use \"git add\" pra rastrear)");
  const hash = store(repo, { type: "commit", tree, parents: parent ? [parent] : [], message, time: ++repo.clock });
  if ("branch" in repo.head) repo.branches[repo.head.branch] = hash;
  else repo.head = { detached: hash };
  repo.reflog.unshift({ hash, action: `commit${parent ? "" : " (inicial)"}: ${message}` });
  return hash;
}

export type Change = { path: string; kind: "novo" | "modificado" | "apagado" };

function compare(from: Tree, to: Tree): Change[] {
  const paths = [...new Set([...Object.keys(from), ...Object.keys(to)])].sort();
  return paths.flatMap((path): Change[] => {
    if (!(path in from)) return [{ path, kind: "novo" }];
    if (!(path in to)) return [{ path, kind: "apagado" }];
    return from[path] !== to[path] ? [{ path, kind: "modificado" }] : [];
  });
}

function workTree(ws: Workspace): Tree {
  return Object.fromEntries(Object.entries(ws.work).map(([p, c]) => [p, hashOf("blob\0" + c)]));
}

export function status(ws: Workspace) {
  const repo = requireRepo(ws);
  const staged = compare(treeOf(repo, headCommit(repo)), repo.index);
  const pending = compare(repo.index, workTree(ws));
  return {
    head: repo.head,
    hasCommits: !!headCommit(repo),
    staged,
    unstaged: pending.filter(c => c.kind !== "novo" || c.path in repo.index),
    untracked: pending.filter(c => c.kind === "novo" && !(c.path in repo.index)).map(c => c.path),
  };
}

export function log(ws: Workspace, from?: string): { hash: Hash; commit: Commit }[] {
  const repo = requireRepo(ws);
  let h = from ? resolveCommit(repo, from) : headCommit(repo);
  if (!h) throw new GitError(`fatal: sua branch atual '${"branch" in repo.head ? repo.head.branch : "HEAD"}' ainda não tem commits`);
  const out = [];
  while (h) {
    const c = getCommit(repo, h);
    out.push({ hash: h, commit: c });
    h = c.parents[0];
  }
  return out;
}

// ---------- diff ----------

export type DiffLine = { op: " " | "-" | "+"; text: string };

// LCS linha a linha. Os arquivos do jogo são pequenos, então O(n·m) é tranquilo.
export function diffLines(a: string, b: string): DiffLine[] {
  const x = a ? a.split("\n") : [], y = b ? b.split("\n") : [];
  const L = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0));
  for (let i = x.length - 1; i >= 0; i--)
    for (let j = y.length - 1; j >= 0; j--)
      L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < x.length || j < y.length) {
    if (i < x.length && j < y.length && x[i] === y[j]) { out.push({ op: " ", text: x[i] }); i++; j++; }
    else if (j < y.length && (i === x.length || L[i][j + 1] > L[i + 1][j])) out.push({ op: "+", text: y[j++] }); // empate: "-" antes de "+", como o Git
    else out.push({ op: "-", text: x[i++] });
  }
  return out;
}

export function diff(ws: Workspace, staged: boolean): { path: string; lines: DiffLine[] }[] {
  const repo = requireRepo(ws);
  const read = (t: Tree, p: string) => (p in t ? blobContent(repo, t[p]) : "");
  if (staged) {
    const head = treeOf(repo, headCommit(repo));
    return compare(head, repo.index).map(c => ({ path: c.path, lines: diffLines(read(head, c.path), read(repo.index, c.path)) }));
  }
  // sem --staged: só arquivos já rastreados, como o Git
  return compare(repo.index, workTree(ws))
    .filter(c => c.path in repo.index)
    .map(c => ({ path: c.path, lines: diffLines(read(repo.index, c.path), ws.work[c.path] ?? "") }));
}
