// Estado único do jogo: o workspace (mundo + repositório) e um canal de eventos
// que a cena do Phaser e a interface HTML escutam.
import { run, type Result } from "../git/commands.ts";
import { blobContent, headCommit, treeOf, type Files, type Workspace } from "../git/repo.ts";
import type { Progress } from "./act1.ts";
import { STARTING_FILES } from "./world.ts";

export type GameEvent =
  | { type: "world" } // o mundo mudou (construiu, plantou, demoliu)
  | { type: "git"; command: string; result: Result } // rodou um comando git
  | { type: "say"; who: "professora" | "voce"; lines: string[] }; // fala de personagem

const SAVE = "commitia:save";
const fresh = () => ({ ws: { work: { ...STARTING_FILES }, repo: null } as Workspace, history: [] as string[], progress: { talked: false, visitedPast: false } as Progress });

export class Store extends EventTarget {
  ws = fresh().ws;
  history = fresh().history;
  progress = fresh().progress;
  char = "josi";

  constructor() { super(); this.load(); }

  // Jogo salvo no navegador de quem joga: mundo, repositório inteiro (os objetos são um Map, que o
  // JSON não guarda direto: vira lista de pares), progresso e personagem. Salva a cada evento.
  save() {
    const repo = this.ws.repo && { ...this.ws.repo, objects: [...this.ws.repo.objects] };
    try { localStorage.setItem(SAVE, JSON.stringify({ v: 1, char: this.char, work: this.ws.work, repo, history: this.history, progress: this.progress })); }
    catch { /* sem storage (aba anônima, bloqueado): o jogo segue, só não lembra */ }
  }

  private load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE) ?? "null");
      if (s?.v !== 1) return;
      this.ws = { work: s.work, repo: s.repo && { ...s.repo, objects: new Map(s.repo.objects) } };
      Object.assign(this, { history: s.history, progress: s.progress, char: s.char });
    } catch { /* save corrompido: começa do zero */ }
  }

  get hasSave() { try { return !!localStorage.getItem(SAVE); } catch { return false; } }

  reset() {
    Object.assign(this, fresh());
    try { localStorage.removeItem(SAVE); } catch { /* idem */ }
  }

  emit(e: GameEvent) { this.save(); this.dispatchEvent(new CustomEvent("e", { detail: e })); }
  on(fn: (e: GameEvent) => void) {
    const h = (ev: Event) => fn((ev as CustomEvent<GameEvent>).detail);
    this.addEventListener("e", h);
    return () => this.removeEventListener("e", h);
  }

  setWork(work: Files) { this.ws.work = work; this.emit({ type: "world" }); }

  git(raw: string): Result {
    this.history.push(raw);
    const result = run(this.ws, raw);
    if (this.ws.repo && "detached" in this.ws.repo.head) this.progress.visitedPast = true; // a missão lembra que você foi ao passado
    this.emit({ type: "git", command: result.command ?? "", result });
    return result;
  }

  // Conteúdo dos arquivos no staging e no último commit, pra comparar objeto a objeto.
  indexFiles(): Files { return this.read(this.ws.repo?.index ?? {}); }
  headFiles(): Files { const r = this.ws.repo; return r ? this.read(treeOf(r, headCommit(r))) : {}; }
  private read(tree: Record<string, string>): Files {
    const r = this.ws.repo;
    return r ? Object.fromEntries(Object.entries(tree).map(([p, h]) => [p, blobContent(r, h)])) : {};
  }
}

export const store = new Store();
