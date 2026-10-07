import Phaser from "phaser";

// Configurações: ficam no navegador de quem joga (sem conta, sem servidor). Volumes de 0 a 10.
export type Lang = "pt" | "en";
export type Settings = { music: number; sfx: number; lang: Lang };
const KEY = "commitia:settings";
const DEFAULTS = (): Settings => ({ music: 7, sfx: 7, lang: navigator.language.startsWith("pt") ? "pt" : "en" });

export function loadSettings(): Settings {
  try {
    const s = { ...DEFAULTS(), ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
    // saves antigos guardavam liga/desliga
    if (typeof s.music === "boolean") s.music = s.music ? 7 : 0;
    if (typeof s.sfx === "boolean") s.sfx = s.sfx ? 7 : 0;
    return s;
  } catch { return DEFAULTS(); }
}
export function saveSettings(s: Settings) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* sem storage: vale só nesta sessão */ } }

// volume dos efeitos (0..1), pra multiplicar no volume de cada som
// Zoom da interface (texto, diálogo, grimório): um degrau inteiro abaixo do zoom do mundo a partir
// de 3x, pra letra não ficar enorme; continua inteiro, então os pixels seguem nítidos.
export const uiZoom = (worldZoom: number) => (worldZoom >= 3 ? worldZoom - 1 : worldZoom);

export const sfxVolume = () => loadSettings().sfx / 10;

// Peças visuais compartilhadas pelo título e pela pausa
export const FONT = { fontFamily: '"Press Start 2P", monospace', fontSize: "8px" };
export const C = { wood: 0xe0b98f, woodLight: 0xf7d9a0, woodDark: 0x5e4a4a, ink: "#443c53", cream: 0xfcf4ee };

// Botão de madeira em pixels: contorno escuro, miolo claro, linha de luz em cima e sombra embaixo.
export function woodButton(scene: Phaser.Scene, x: number, y: number, w: number, h: number, on: boolean) {
  const g = scene.add.graphics();
  g.fillStyle(C.woodDark).fillRect(x + 1, y, w - 2, h).fillRect(x, y + 1, w, h - 2);
  g.fillStyle(on ? C.woodLight : C.wood).fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle(C.cream, on ? 0.9 : 0.5).fillRect(x + 2, y + 1, w - 4, 1);
  g.fillStyle(C.woodDark, 0.35).fillRect(x + 2, y + h - 2, w - 4, 1);
  return g;
}

export function centerText(scene: Phaser.Scene, x: number, y: number, s: string, color = C.ink) {
  const t = scene.add.text(0, 0, s, { ...FONT, color });
  return t.setPosition(Math.round(x - t.width / 2), Math.round(y - t.height / 2));
}

export type MenuItem = { label: string; act: () => void; adjust?: (d: number) => void };

const STR = {
  pt: { music: "Música", sfx: "Efeitos", fullscreen: "Tela cheia", lang: "Idioma: Português", yes: "sim", no: "não" },
  en: { music: "Music", sfx: "Sound effects", fullscreen: "Fullscreen", lang: "Language: English", yes: "yes", no: "no" },
};

// Itens de configuração (título e pausa). Volumes: ← → ajustam, Enter sobe e dá a volta.
// onMusic aplica o volume novo na música que está tocando.
export function settingsItems(scene: Phaser.Scene, redraw: () => void, onMusic: () => void): MenuItem[] {
  const s = loadSettings(), t = STR[s.lang];
  const save = () => { saveSettings(s); redraw(); };
  const vol = (key: "music" | "sfx", label: string, after = () => {}): MenuItem => {
    const set = (v: number) => { s[key] = Math.max(0, Math.min(10, v)); save(); after(); };
    return { label: `${label}  < ${s[key] * 10}% >`, act: () => set(s[key] === 10 ? 0 : s[key] + 1), adjust: d => set(s[key] + d) };
  };
  return [
    vol("music", t.music, onMusic),
    vol("sfx", t.sfx),
    // tela cheia da PÁGINA (não só do canvas): o grimório, que é HTML, continua aparecendo,
    // e o ajuste de tamanho em pixels inteiros (main.ts) roda no "resize" que ela dispara
    { label: `${t.fullscreen}: ${document.fullscreenElement ? t.yes : t.no}`, act: () => {
      const req = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
      req.catch(() => {}).finally(redraw);
    } },
    { label: t.lang, act: () => { s.lang = s.lang === "pt" ? "en" : "pt"; save(); } },
  ];
}
