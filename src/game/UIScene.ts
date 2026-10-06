import Phaser from "phaser";

// Camada de interface por cima da vila: caixa de diálogo estilo Pokémon, escolhas e avisos.
// Roda em 640x360 sem zoom (a vila usa zoom 2), então o texto fica nítido em 2x.

const S = 2; // escala da arte da interface
const FONT = { fontFamily: "NormalFont", fontSize: "16px", color: "#3b2a3a" };
const CHAR_MS = 22;

type Speaker = { name: string; face: string };
export const SPEAKERS: Record<string, Speaker> = {
  professora: { name: "Profa. Commit", face: "face-professora" },
  voce: { name: "Você", face: "face-voce" },
  placa: { name: "Placa", face: "" },
};

export class UIScene extends Phaser.Scene {
  private box!: Phaser.GameObjects.Container;
  private text!: Phaser.GameObjects.Text;
  private nameText!: Phaser.GameObjects.Text;
  private face!: Phaser.GameObjects.Image;
  private arrow!: Phaser.GameObjects.Text;
  private queue: string[] = [];
  private typing?: Phaser.Time.TimerEvent;
  private full = "";
  private choices: string[] = [];
  private choiceIdx = 0;
  private onChoose?: (i: number | null) => void;
  private onDone?: () => void;
  private banner!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;

  constructor() { super({ key: "ui", active: false }); }

  get open() { return this.box.visible; }

  preload() {
    this.load.image("dialog", "/assets/ui/DialogBoxFaceset.png");
    this.load.image("face-professora", "/assets/chars/OldWoman/Faceset.png");
    this.load.image("face-voce", "/assets/chars/Boy/Faceset.png");
    this.load.audio("blip", "/assets/audio/blip.wav");
    this.load.audio("accept", "/assets/audio/accept.wav");
  }

  create() {
    const W = this.scale.width, H = this.scale.height;
    const bg = this.add.image(0, 0, "dialog").setOrigin(0).setScale(S);
    this.face = this.add.image(5 * S + 19 * S, 12 * S + 19 * S, "face-professora").setScale(S);
    this.nameText = this.add.text(8 * S, 0, "", { ...FONT, fontSize: "14px", color: "#fff4e0" });
    this.text = this.add.text(52 * S, 13 * S, "", { ...FONT, wordWrap: { width: 238 * S }, lineSpacing: 4 });
    this.arrow = this.add.text(288 * S, 44 * S, "▼", { ...FONT, fontSize: "12px" });
    this.tweens.add({ targets: this.arrow, y: "+=4", yoyo: true, repeat: -1, duration: 350 });
    this.box = this.add.container((W - 300 * S) / 2, H - 58 * S - 6, [bg, this.face, this.nameText, this.text, this.arrow]).setVisible(false);

    this.banner = this.add.text(10, 8, "", { ...FONT, fontSize: "14px", color: "#ffd166", backgroundColor: "#1b1730cc", padding: { x: 8, y: 4 } }).setVisible(false);
    this.toastText = this.add.text(W / 2, 40, "", { ...FONT, fontSize: "16px", color: "#1b1230", backgroundColor: "#ffd166", padding: { x: 12, y: 6 } }).setOrigin(0.5).setAlpha(0);

    const kb = this.input.keyboard!;
    kb.on("keydown", (e: KeyboardEvent) => {
      if (!this.open) return;
      if (this.choices.length && !this.typing) {
        if (e.key === "ArrowUp" || e.key === "w") this.moveChoice(-1);
        else if (e.key === "ArrowDown" || e.key === "s") this.moveChoice(1);
        else if (e.key === "Escape") this.pick(null);
        else if (e.key === " " || e.key === "Enter" || e.key === "e") this.pick(this.choiceIdx);
        return;
      }
      if (e.key === " " || e.key === "Enter" || e.key === "e" || e.key === "Escape") this.advance();
    });
  }

  // Fala em sequência; cada string é uma "página". onDone roda depois da última.
  say(who: keyof typeof SPEAKERS, lines: string[], onDone?: () => void) {
    const sp = SPEAKERS[who];
    this.nameText.setText(sp.name);
    this.face.setVisible(!!sp.face);
    if (sp.face) this.face.setTexture(sp.face);
    this.queue = [...lines];
    this.onDone = onDone;
    this.choices = [];
    this.box.setVisible(true);
    this.next();
  }

  // Pergunta com opções (setas + Espaço). onChoose recebe o índice, ou null se cancelar.
  ask(who: keyof typeof SPEAKERS, question: string, options: string[], onChoose: (i: number | null) => void) {
    this.say(who, [question]);
    this.choices = options;
    this.choiceIdx = 0;
    this.onChoose = onChoose;
  }

  private next() {
    const page = this.queue.shift();
    if (page === undefined) { this.close(); this.onDone?.(); return; }
    this.full = page;
    this.text.setText("");
    this.arrow.setVisible(false);
    let i = 0;
    this.typing?.remove();
    this.typing = this.time.addEvent({
      delay: CHAR_MS, repeat: page.length - 1,
      callback: () => {
        i++;
        this.text.setText(page.slice(0, i));
        if (i % 3 === 0 && page[i - 1] !== " ") this.sound.play("blip", { volume: 0.25 });
        if (i >= page.length) this.finishTyping();
      },
    });
  }

  private finishTyping() {
    this.typing?.remove();
    this.typing = undefined;
    this.text.setText(this.full);
    if (this.choices.length) this.renderChoices(); else this.arrow.setVisible(true);
  }

  private advance() {
    if (this.typing) { this.finishTyping(); return; }
    this.sound.play("accept", { volume: 0.3 });
    this.next();
  }

  private renderChoices() {
    this.text.setText(this.full + "\n" + this.choices.map((c, i) => `${i === this.choiceIdx ? "▶" : "  "} ${c}`).join("   "));
  }

  private moveChoice(d: number) {
    this.choiceIdx = (this.choiceIdx + d + this.choices.length) % this.choices.length;
    this.sound.play("blip", { volume: 0.3 });
    this.renderChoices();
  }

  private pick(i: number | null) {
    const cb = this.onChoose;
    this.choices = [];
    this.onChoose = undefined;
    this.sound.play("accept", { volume: 0.3 });
    this.close();
    cb?.(i);
  }

  close() { this.box.setVisible(false); this.typing?.remove(); this.typing = undefined; }

  setBanner(text: string | null) { this.banner.setText(text ?? "").setVisible(!!text); }

  toast(msg: string) {
    this.toastText.setText(msg).setAlpha(0).setY(30);
    this.tweens.chain({ targets: this.toastText, tweens: [
      { alpha: 1, y: 40, duration: 250, ease: "Back.Out" },
      { alpha: 0, duration: 400, delay: 2600 },
    ] });
  }
}
