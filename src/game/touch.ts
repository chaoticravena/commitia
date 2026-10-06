// Controles de toque (celular/tablet): direcional de 8 direções à esquerda, botão A à direita e
// pausa no alto. HTML por cima do canvas (multitoque nativo, nítido em qualquer tela). Só aparecem
// em telas de toque e dentro da vila; o resto do jogo continua lendo teclado normalmente.

const CSS = `
#touch { position: fixed; inset: 0; pointer-events: none; z-index: 8; font-family: "Press Start 2P", monospace; }
#touch[hidden] { display: none; }
#touch .pad, #touch button { pointer-events: auto; touch-action: none; -webkit-user-select: none; user-select: none; }
#touch .pad { position: absolute; left: calc(env(safe-area-inset-left) + 16px); bottom: 16px; width: 132px; height: 132px; }
#touch .pad span { position: absolute; width: 44px; height: 44px; background: #e0b98fdd; border: 3px solid #5e4a4a; box-sizing: border-box; }
#touch .pad .u { left: 44px; top: 0; } #touch .pad .d { left: 44px; bottom: 0; }
#touch .pad .l { left: 0; top: 44px; } #touch .pad .r { right: 0; top: 44px; }
#touch .pad .c { left: 44px; top: 44px; background: #c79c7add; }
#touch .pad span::after { content: ""; position: absolute; inset: 0; margin: auto; width: 0; height: 0; border: 7px solid transparent; }
#touch .pad .u::after { border-bottom-color: #5e4a4a; top: -7px; } #touch .pad .d::after { border-top-color: #5e4a4a; top: 7px; }
#touch .pad .l::after { border-right-color: #5e4a4a; left: -7px; } #touch .pad .r::after { border-left-color: #5e4a4a; left: 7px; }
#touch .pad.on span { background: #f7d9a0dd; }
#touch button { position: absolute; background: #e0b98fdd; border: 3px solid #5e4a4a; color: #443c53; font: inherit; }
#touch .a { right: calc(env(safe-area-inset-right) + 24px); bottom: 40px; width: 64px; height: 64px; border-radius: 50%; font-size: 16px; }
#touch .a:active, #touch .pause:active { background: #f7d9a0; }
#touch .pause { right: calc(env(safe-area-inset-right) + 12px); top: 12px; width: 44px; height: 44px; font-size: 12px; }
`;

const coarse = () => matchMedia("(pointer: coarse)").matches;

class Touch {
  dx = 0;
  dy = 0;
  onA?: () => void;
  onPause?: () => void;
  private el?: HTMLDivElement;

  // existe tela de toque? (usado também pra reposicionar o botão do grimório)
  get enabled() { return coarse(); }

  private mount() {
    if (this.el) return;
    document.head.append(Object.assign(document.createElement("style"), { textContent: CSS }));
    this.el = Object.assign(document.createElement("div"), { id: "touch", hidden: true });
    this.el.innerHTML = `<div class="pad"><span class="u"></span><span class="l"></span><span class="c"></span><span class="r"></span><span class="d"></span></div>
      <button class="a" aria-label="A">A</button><button class="pause" aria-label="Pausa">II</button>`;
    document.body.append(this.el);
    const pad = this.el.querySelector<HTMLDivElement>(".pad")!;
    // direção pela posição do dedo em relação ao centro do direcional: 8 setores de 45°
    const aim = (e: PointerEvent) => {
      const r = pad.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
      if (Math.hypot(x, y) < 14) { this.dx = this.dy = 0; return; } // zona morta no meio
      const a = Math.atan2(y, x), s = Math.round(a / (Math.PI / 4)); // -4..4
      this.dx = Math.round(Math.cos(s * Math.PI / 4));
      this.dy = Math.round(Math.sin(s * Math.PI / 4));
      pad.classList.add("on");
    };
    let held: number | null = null; // dedo que está no direcional
    const release = (e: PointerEvent) => { if (e.pointerId !== held) return; held = null; this.dx = this.dy = 0; pad.classList.remove("on"); };
    pad.addEventListener("pointerdown", e => {
      held = e.pointerId;
      try { pad.setPointerCapture(e.pointerId); } catch { /* sem captura, o arrasto ainda funciona dentro do direcional */ }
      aim(e);
    });
    pad.addEventListener("pointermove", e => { if (e.pointerId === held) aim(e); });
    pad.addEventListener("pointerup", release);
    pad.addEventListener("pointercancel", release);
    this.el.querySelector(".a")!.addEventListener("pointerdown", e => { e.preventDefault(); this.onA?.(); });
    this.el.querySelector(".pause")!.addEventListener("pointerdown", e => { e.preventDefault(); this.onPause?.(); });
  }

  show(on: boolean) {
    if (!coarse()) return;
    this.mount();
    this.el!.hidden = !on;
    if (!on) { this.dx = this.dy = 0; }
  }
}

export const touch = new Touch();
