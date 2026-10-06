// Estado único do jogo: o workspace (mundo + repositório) e um canal de eventos
// que a cena do Phaser e a interface HTML escutam.
import { run, type Result } from "../git/commands.ts";
import { blobContent, headCommit, treeOf, type Files, type Workspace } from "../git/repo.ts";

export type GameEvent =
  | { type: "world" } // o mundo mudou (construiu, plantou, demoliu)
  | { type: "git"; command: string; result: Result } // rodou um comando git
  | { type: "say"; who: "professora" | "voce"; lines: string[] }; // fala de personagem

class Store extends EventTarget {
  ws: Workspace = { work: {}, repo: null };
  history: string[] = [];

  emit(e: GameEvent) { this.dispatchEvent(new CustomEvent("e", { detail: e })); }
  on(fn: (e: GameEvent) => void) { this.addEventListener("e", ev => fn((ev as CustomEvent<GameEvent>).detail)); }

  setWork(work: Files) { this.ws.work = work; this.emit({ type: "world" }); }

  git(raw: string): Result {
    this.history.push(raw);
    const result = run(this.ws, raw);
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
