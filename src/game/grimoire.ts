// Grimório: o terminal onde se digitam os comandos de Git. É HTML de verdade por cima do canvas
// (digitar, acentos, aspas, colar e histórico funcionam como em qualquer campo de texto), vestido de
// livro de pergaminho na mesma fonte pixelada e no mesmo tamanho de pixel do jogo.
import type { Kind } from "../git/commands.ts"; // "why" é a explicação depois do comando
import { loadSettings, uiZoom } from "./settings.ts";
import { store } from "./store.ts";
import { nextHint } from "./act1.ts";

const T = {
  pt: { title: "Grimório", hint: "Esc fecha", placeholder: "Digite aqui, ex.: git status", send: "Enviar ↵", keys: "Enter envia · ↑↓ anteriores · Tab sugestão", hello: "Aqui você escreve comandos do Git (todos começam com git). Lá fora, na vila, você vê o efeito de cada um.", button: "Grimório (G)" },
  en: { title: "Spellbook", hint: "Esc closes", placeholder: "Type here, e.g. git status", send: "Send ↵", keys: "Enter sends · ↑↓ previous · Tab suggestion", hello: "Here you write Git commands (they all start with git). Out in the village, you see what each one does.", button: "Spellbook (G)" },
};

const CSS = `
/* Fontes pra ler e aprender: Nunito nas explicações, JetBrains Mono no que é Git de verdade (comandos e
   respostas, como num terminal), e a pixelada só no título e nos botões, pra manter a cara do jogo. */
#grimoire { --read: "Nunito", system-ui, sans-serif; --code: "JetBrains Mono", ui-monospace, monospace; --pixel: "Press Start 2P", monospace;
  --fs: calc(var(--px) * 8.5); font-family: var(--read); font-size: var(--fs); line-height: 1.5; color: #443c53; }
#grimoire-btn { font-family: "Press Start 2P", monospace; font-size: var(--px8); color: #443c53; }
#grimoire { position: fixed; left: 50%; top: calc(var(--px) * 28); transform: translateX(-50%); width: min(calc(var(--px) * 380), 96vw);
  height: min(calc(var(--px) * 165), 84vh); display: flex; flex-direction: column; background: #fcf4ee;
  border: var(--px) solid #5e4a4a; box-shadow: inset 0 0 0 calc(var(--px) * 2) #e0b98f; padding: calc(var(--px) * 6); box-sizing: border-box; z-index: 10; }
#grimoire[hidden], #grimoire-btn[hidden] { display: none; }
#grimoire { transition: opacity .25s; } #grimoire.peek { opacity: .12; pointer-events: none; }
#grimoire h2 { margin: 0 0 calc(var(--px) * 4); font: var(--px8) var(--pixel); color: #5e4a4a; display: flex; justify-content: space-between; align-items: center; }
#grimoire h2 small { color: #a87d63; font: inherit; cursor: pointer; padding: 4px 0 4px 12px; }
/* "Próximo passo": cartão de destaque, o que fazer em primeiro lugar */
#grimoire-hint { background: #f2e6d0; border: var(--px) solid #c79c7a; border-left-width: calc(var(--px) * 3); padding: calc(var(--px) * 3) calc(var(--px) * 4);
  margin-bottom: calc(var(--px) * 4); font-weight: 500; }
#grimoire-hint b { color: #7a5fa8; font-weight: 800; }
#grimoire-hint code { font: 700 var(--fs) var(--code); color: #443c53; background: #fffdf9; border: var(--px) solid #e0b98f; padding: 0 calc(var(--px) * 2); }
#grimoire-hint button, #grimoire-log .code { font: var(--px8) var(--pixel); background: #e0b98f; border: var(--px) solid #5e4a4a; color: #443c53; cursor: pointer;
  padding: calc(var(--px) * 1) calc(var(--px) * 3); margin-left: calc(var(--px) * 2); vertical-align: middle; }
#grimoire-log { flex: 1; overflow-y: auto; white-space: pre-wrap; margin: 0; font: inherit; }
/* o que é Git (comando e resposta) em fonte de terminal */
#grimoire-log .cmd, #grimoire-log .ok, #grimoire-log .add, #grimoire-log .err, #grimoire-log .del, #grimoire-log .hash, #grimoire-log .info, #grimoire-log .head:not(:first-child) { font-family: var(--code); }
#grimoire-log .cmd { color: #7a5fa8; font-weight: 700; margin-top: calc(var(--px) * 3); } #grimoire-log .ok, #grimoire-log .add { color: #4f8f63; }
#grimoire-log .err, #grimoire-log .del { color: #c4557a; } #grimoire-log .hash { color: #a87d63; } #grimoire-log .head { color: #5e4a4a; }
#grimoire-log .code { font: 700 var(--fs) var(--code); margin: 0 calc(var(--px) * 2) 0 0; }
/* explicação: bloco separado com barra lateral, pra não se misturar com a resposta do Git */
#grimoire-log .why { color: #5e4a4a; background: #f7efe4; border-left: calc(var(--px) * 2) solid #c8bde6; padding: calc(var(--px) * 1) calc(var(--px) * 3);
  margin: calc(var(--px) * 1) 0 calc(var(--px) * 2); white-space: normal; opacity: 0; animation: why-in .45s steps(5) .35s forwards; }
#grimoire-log .why a { color: #7a5fa8; font-weight: 700; }
/* entra em degraus (steps): desliza e aparece como animação de pixel, não um fade liso */
@keyframes why-in { from { opacity: 0; transform: translateX(calc(var(--px) * -6)); } to { opacity: 1; transform: none; } }
/* campo de digitar com cara de campo: caixa branca, borda de madeira, roxa quando está com o cursor */
#grimoire form { display: flex; gap: calc(var(--px) * 3); margin-top: calc(var(--px) * 4); align-items: stretch; }
#grimoire input { flex: 1; min-width: 0; font: 500 var(--fs) var(--code); color: inherit; background: #fffdf9; border: var(--px) solid #c79c7a;
  outline: none; padding: calc(var(--px) * 3) calc(var(--px) * 4); }
#grimoire input:focus { border-color: #7a5fa8; box-shadow: 0 0 0 var(--px) #c8bde6; }
#grimoire input::placeholder { color: #a8977f; font-family: var(--read); }
#grimoire form button { font: var(--px8) var(--pixel); background: #e0b98f; border: var(--px) solid #5e4a4a; color: #443c53; cursor: pointer; padding: 0 calc(var(--px) * 4); }
#grimoire form button:hover { background: #f7d9a0; }
#grimoire .keys { color: #a8977f; margin-top: calc(var(--px) * 2); font-size: calc(var(--fs) * 0.85); }
#grimoire-btn { position: fixed; right: calc(var(--px) * 4); bottom: calc(var(--px) * 4); background: #e0b98f; border: var(--px) solid #5e4a4a;
  padding: calc(var(--px) * 3) calc(var(--px) * 4); cursor: pointer; z-index: 9; color: #443c53; }
#grimoire-btn:hover { background: #f7d9a0; }
/* celular: o botão A fica no canto de baixo; o grimório fica logo acima dele */
@media (pointer: coarse) { #grimoire-btn { bottom: 116px; right: 12px; min-height: 44px; } }
`;

// Depois de cada comando que deu certo: uma frase sobre o que mudou no Git + link pra documentação.
// Curta de propósito: liga o comando ao conceito sem virar leitura.
const WHY: Record<string, { pt: string; en: string }> = {
  init: { pt: "Criou o repositório: o Git passou a vigiar a vila.", en: "Created the repository: Git now watches the village." },
  status: { pt: "Só olhou: compara a vila, o staging e o último commit.", en: "Just a look: compares the village, staging and the last commit." },
  add: { pt: "Pôs a mudança no staging: separada pro próximo commit.", en: "Put the change in staging: set aside for the next commit." },
  commit: { pt: "Guardou uma foto do staging pra sempre, com um hash.", en: "Saved a snapshot of staging forever, with a hash." },
  log: { pt: "Só olhou: a lista de commits, do mais novo ao mais antigo.", en: "Just a look: the list of commits, newest first." },
  diff: { pt: "Só olhou: - saiu, + entrou.", en: "Just a look: - removed, + added." },
  switch: { pt: "Trocou a vila pela de outro commit. Nada se perdeu.", en: "Swapped the village for another commit's. Nothing was lost." },
  checkout: { pt: "Trocou a vila pela de outro commit (nome antigo do switch).", en: "Swapped the village for another commit's (old name of switch)." },
  restore: { pt: "Desfez a mudança que ainda não estava salva.", en: "Undid a change that wasn't saved yet." },
};

// Formato certo de cada comando, mostrado quando ele falha (quem está aprendendo erra a sintaxe, não o conceito)
const USAGE: Record<string, { pt: string; en: string }> = {
  commit: { pt: 'Formato: git commit -m "uma frase sobre o que mudou"', en: 'Format: git commit -m "a sentence about the change"' },
  add: { pt: "Formato: git add .   (o ponto = tudo que mudou)", en: "Format: git add .   (the dot = everything that changed)" },
  switch: { pt: "Formato: git switch main   ou   git switch --detach <código do commit>", en: "Format: git switch main   or   git switch --detach <commit code>" },
  checkout: { pt: "Formato: git checkout <código do commit>", en: "Format: git checkout <commit code>" },
  restore: { pt: "Formato: git restore casas.txt", en: "Format: git restore casas.txt" },
};
const UI = {
  pt: { next: "Próximo passo", use: "Usar", notGit: "Todo comando começa com git. Experimente: git status", pick: "toque num código pra viajar até ele" },
  en: { next: "Next step", use: "Use", notGit: "Every command starts with git. Try: git status", pick: "tap a code to travel to it" },
};

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
    this.el.innerHTML = `<h2><span></span><small></small></h2><div id="grimoire-hint"></div><pre id="grimoire-log"></pre><form><input autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="send"><button type="submit"></button></form><div class="keys"></div>`;
    this.log = this.el.querySelector("pre")!;
    this.input = this.el.querySelector("input")!;
    this.btn = Object.assign(document.createElement("button"), { id: "grimoire-btn", hidden: true });
    this.btn.onclick = () => this.open();
    document.body.append(this.el, this.btn);

    const size = () => {
      const z = uiZoom(Math.max(1, Math.floor(Math.min(innerWidth * devicePixelRatio / 320, innerHeight * devicePixelRatio / 180))));
      const px = z / devicePixelRatio; // 1 pixel do jogo em px de CSS
      document.documentElement.style.setProperty("--px", `${px}px`);
      document.documentElement.style.setProperty("--px8", `${8 * px}px`);
    };
    size();
    addEventListener("resize", size);
    // teclado do celular abre: a área visível (visualViewport) encolhe e o grimório acompanha
    const fitKeyboard = () => {
      const vv = window.visualViewport;
      if (!vv || this.el.hidden) return;
      const top = this.el.getBoundingClientRect().top;
      this.el.style.maxHeight = `${Math.max(90, vv.height + vv.offsetTop - top - 8)}px`;
    };
    window.visualViewport?.addEventListener("resize", fitKeyboard);
    this.input.addEventListener("focus", () => setTimeout(fitKeyboard, 300));

    this.el.querySelector("h2 small")!.addEventListener("click", () => this.close());
    this.el.querySelector("form")!.addEventListener("submit", e => { e.preventDefault(); this.run(this.input.value); });
    this.input.addEventListener("keydown", e => {
      e.stopPropagation(); // o jogo não anda enquanto você digita
      if (e.key === "Tab") { e.preventDefault(); this.useHint(); return; } // Tab = botão Usar
      if (e.key === "Escape") this.close();
      else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        this.cursor = Math.max(0, Math.min(this.past.length, this.cursor + (e.key === "ArrowUp" ? -1 : 1)));
        this.input.value = this.past[this.cursor] ?? "";
      }
    });
  }

  // o botão só aparece dentro da vila
  showButton(on: boolean) { this.mount(); this.btn.hidden = !on; this.btn.textContent = T[loadSettings().lang].button.replace(matchMedia("(pointer: coarse)").matches ? " (G)" : "", ""); } // sem teclado, sem "(G)"

  // Faixa do próximo passo: o que fazer em palavras simples + o comando pronto (botão Usar / Tab)
  private refreshHint() {
    const lang = loadSettings().lang, h = nextHint(store.ws, store.progress, lang);
    const box = this.el.querySelector<HTMLDivElement>("#grimoire-hint")!;
    box.replaceChildren();
    const label = Object.assign(document.createElement("b"), { textContent: `${UI[lang].next}: ` });
    box.append(label, h.text);
    if (h.cmd) {
      box.append(document.createElement("br"), Object.assign(document.createElement("code"), { textContent: h.cmd.replace("__", "...") }));
      const b = Object.assign(document.createElement("button"), { type: "button", textContent: `${UI[lang].use} ⇥` });
      b.onclick = () => this.useHint();
      box.append(b);
    }
  }

  // põe o comando sugerido no campo; se tem __ (a parte da pessoa), deixa ela selecionada pra digitar por cima
  private useHint() {
    const cmd = nextHint(store.ws, store.progress, loadSettings().lang).cmd;
    if (!cmd) return;
    const i = cmd.indexOf("__");
    this.input.value = cmd.replace("__", "  ");
    this.input.focus();
    if (i >= 0) this.input.setSelectionRange(i, i + 2); else this.input.setSelectionRange(cmd.length, cmd.length);
  }

  open() {
    this.mount();
    const t = T[loadSettings().lang];
    this.el.querySelector("h2 span")!.textContent = t.title;
    // o "Esc fecha" também é botão: no celular não tem Esc
    this.el.querySelector("h2 small")!.textContent = matchMedia("(pointer: coarse)").matches ? (loadSettings().lang === "pt" ? "Fechar ✕" : "Close ✕") : t.hint;
    this.input.placeholder = t.placeholder;
    this.el.querySelector("form button")!.textContent = t.send;
    // no celular não tem setas nem Tab: a linha de atalhos só aparece no computador
    this.el.querySelector<HTMLDivElement>(".keys")!.textContent = matchMedia("(pointer: coarse)").matches ? "" : t.keys;
    if (!this.log.childElementCount) this.print(t.hello, "head");
    this.refreshHint();
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

  private print(text: string, kind: Kind | "cmd" | "why") {
    const line = Object.assign(document.createElement("div"), { className: kind, textContent: text });
    // no git log, o código de cada commit vira botão: tocar já escreve o comando de viajar até ele
    const m = kind === "hash" ? text.match(/^([0-9a-f]{7})(.*)$/) : null;
    if (m) {
      const b = Object.assign(document.createElement("button"), { type: "button", className: "code", textContent: m[1] });
      b.onclick = () => { this.input.value = `git switch --detach ${m[1]}`; this.input.focus(); };
      line.replaceChildren(b, m[2]);
    }
    this.log.append(line);
    this.log.scrollTop = this.log.scrollHeight;
    return line;
  }

  private run(raw: string) {
    const cmd = raw.trim();
    this.input.value = "";
    if (!cmd) return;
    this.past.push(cmd);
    this.cursor = this.past.length;
    this.print(`✦ ${cmd}`, "cmd");
    if (cmd === "clear" || cmd === "limpar") { this.log.replaceChildren(); return; }
    const result = store.git(cmd);
    const lang = loadSettings().lang;
    for (const l of result.lines) this.print(l.text, l.kind);
    if (result.command === "log" && result.ok && result.lines.length) this.print(`👆 ${UI[lang].pick}`, "why");
    // errou: mostra o formato certo do comando (ou lembra que tudo começa com git)
    const help = !result.ok && (cmd.startsWith("git") ? USAGE[result.command ?? ""]?.[lang] : UI[lang].notGit);
    if (help) this.print(`💡 ${help}`, "why");
    this.refreshHint();
    // mudou a vila: o grimório fica quase transparente um instante pra pessoa ver o efeito do comando
    if (result.ok && ["add", "commit", "switch", "checkout", "restore"].includes(result.command ?? "")) {
      this.el.classList.add("peek");
      setTimeout(() => { this.el.classList.remove("peek"); this.input.focus(); }, 1600);
    }
    const why = result.ok && result.command ? WHY[result.command] : undefined;
    if (why) {
      const line = this.print(`💡 ${why[loadSettings().lang]} `, "why");
      // documentação oficial do comando, numa aba nova
      line.append(Object.assign(document.createElement("a"), { href: `https://git-scm.com/docs/git-${result.command}`, target: "_blank", rel: "noopener", textContent: "docs ↗" }));
    }
  }
}

export const grimoire = new Grimoire();
