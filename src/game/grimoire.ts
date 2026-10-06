// Grimório: o terminal onde se digitam os comandos de Git. É HTML de verdade por cima do canvas
// (digitar, acentos, aspas, colar e histórico funcionam como em qualquer campo de texto), vestido de
// livro de pergaminho na mesma fonte pixelada e no mesmo tamanho de pixel do jogo.
import type { Kind } from "../git/commands.ts";
import { loadSettings } from "./TitleScene.ts";
import { store } from "./store.ts";

const T = {
  pt: { title: "Grimório", hint: "Esc fecha", placeholder: "git ...  (↑↓ histórico)", hello: "Escreva um feitiço. Todo feitiço começa com git.", button: "Grimório (G)" },
  en: { title: "Spellbook", hint: "Esc closes", placeholder: "git ...  (↑↓ history)", hello: "Write a spell. Every spell starts with git.", button: "Spellbook (G)" },
};

const CSS = `
#grimoire, #grimoire-btn { font-family: "Press Start 2P", monospace; font-size: var(--px8); color: #443c53; }
#grimoire { position: fixed; left: 50%; top: calc(var(--px) * 28); transform: translateX(-50%); width: min(calc(var(--px) * 300), 94vw);
  height: min(calc(var(--px) * 120), 70vh); display: flex; flex-direction: column; background: #fcf4ee;
  border: var(--px) solid #5e4a4a; box-shadow: inset 0 0 0 calc(var(--px) * 2) #e0b98f; padding: calc(var(--px) * 6); box-sizing: border-box; z-index: 10; }
#grimoire[hidden], #grimoire-btn[hidden] { display: none; }
#grimoire h2 { margin: 0 0 calc(var(--px) * 4); font-size: var(--px8); font-weight: normal; color: #5e4a4a; display: flex; justify-content: space-between; }
#grimoire h2 small { color: #a87d63; font-size: var(--px8); }
#grimoire-log { flex: 1; overflow-y: auto; white-space: pre-wrap; line-height: 1.6; margin: 0; font: inherit; }
#grimoire-log .cmd { color: #7a5fa8; } #grimoire-log .ok, #grimoire-log .add { color: #4f8f63; }
#grimoire-log .err, #grimoire-log .del { color: #c4557a; } #grimoire-log .hash { color: #a87d63; } #grimoire-log .head { color: #5e4a4a; }
#grimoire form { display: flex; gap: calc(var(--px) * 3); margin-top: calc(var(--px) * 4); border-top: var(--px) dashed #e0b98f; padding-top: calc(var(--px) * 4); }
#grimoire input::placeholder { color: #c9b59e; }
#grimoire input { flex: 1; font: inherit; color: inherit; background: none; border: none; outline: none; padding: 0; }
#grimoire-btn { position: fixed; right: calc(var(--px) * 4); bottom: calc(var(--px) * 4); background: #e0b98f; border: var(--px) solid #5e4a4a;
  padding: calc(var(--px) * 3) calc(var(--px) * 4); cursor: pointer; z-index: 9; color: #443c53; }
#grimoire-btn:hover { background: #f7d9a0; }
`;

class Grimoire extends EventTarget {
  private el!: HTMLDivElement;
  private log!: HTMLPreElement;
  private input!: HTMLInputElement;
  private btn!: HTMLButtonElement;
  private past: string[] = [];
  private cursor = 0;

  get isOpen() { return !!this.el && !this.el.hidden; }

  // monta uma vez; o tamanho do "pixel" acompanha o zoom inteiro do jogo
  mount() {
    if (this.el) return;
    document.head.append(Object.assign(document.createElement("style"), { textContent: CSS }));
    this.el = Object.assign(document.createElement("div"), { id: "grimoire", hidden: true });
    this.el.innerHTML = `<h2><span></span><small></small></h2><pre id="grimoire-log"></pre><form><span>✦</span><input autocomplete="off" spellcheck="false"></form>`;
    this.log = this.el.querySelector("pre")!;
    this.input = this.el.querySelector("input")!;
    this.btn = Object.assign(document.createElement("button"), { id: "grimoire-btn", hidden: true });
    this.btn.onclick = () => this.open();
    document.body.append(this.el, this.btn);

    const size = () => {
      const z = Math.max(1, Math.floor(Math.min(innerWidth * devicePixelRatio / 320, innerHeight * devicePixelRatio / 180)));
      const px = z / devicePixelRatio; // 1 pixel do jogo em px de CSS
      document.documentElement.style.setProperty("--px", `${px}px`);
      document.documentElement.style.setProperty("--px8", `${8 * px}px`);
    };
    size();
    addEventListener("resize", size);

    this.el.querySelector("form")!.addEventListener("submit", e => { e.preventDefault(); this.run(this.input.value); });
    this.input.addEventListener("keydown", e => {
      e.stopPropagation(); // o jogo não anda enquanto você digita
      if (e.key === "Escape") this.close();
      else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        this.cursor = Math.max(0, Math.min(this.past.length, this.cursor + (e.key === "ArrowUp" ? -1 : 1)));
        this.input.value = this.past[this.cursor] ?? "";
      }
    });
  }

  // o botão só aparece dentro da vila
  showButton(on: boolean) { this.mount(); this.btn.hidden = !on; this.btn.textContent = T[loadSettings().lang].button; }

  open() {
    this.mount();
    const t = T[loadSettings().lang];
    this.el.querySelector("h2 span")!.textContent = t.title;
    this.el.querySelector("h2 small")!.textContent = t.hint;
    this.input.placeholder = t.placeholder;
    if (!this.log.childElementCount) this.print(t.hello, "head");
    this.el.hidden = false;
    this.btn.hidden = true;
    this.input.focus();
    this.dispatchEvent(new Event("change"));
  }

  close() {
    this.el.hidden = true;
    this.btn.hidden = false;
    this.input.blur();
    this.dispatchEvent(new Event("change"));
  }

  private print(text: string, kind: Kind | "cmd") {
    const line = Object.assign(document.createElement("div"), { className: kind, textContent: text });
    this.log.append(line);
    this.log.scrollTop = this.log.scrollHeight;
  }

  private run(raw: string) {
    const cmd = raw.trim();
    this.input.value = "";
    if (!cmd) return;
    this.past.push(cmd);
    this.cursor = this.past.length;
    this.print(`✦ ${cmd}`, "cmd");
    if (cmd === "clear" || cmd === "limpar") { this.log.replaceChildren(); return; }
    for (const l of store.git(cmd).lines) this.print(l.text, l.kind);
  }
}

export const grimoire = new Grimoire();
