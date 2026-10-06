import Phaser from "phaser";
import { loadSettings } from "./TitleScene.ts";

// Uma música por vez, em loop, sobrevivendo às trocas de cena (o gerenciador de som é do jogo todo).
// Respeita "Música" das configurações. O navegador só libera áudio depois do primeiro clique/tecla.
export function playMusic(scene: Phaser.Scene, key: string) {
  const sound = scene.sound;
  sound.getAllPlaying().forEach(s => { if (s.key !== key) s.stop(); });
  const m = sound.get(key) ?? sound.add(key, { loop: true, volume: 0.45 });
  if (!loadSettings().music) return void m.stop();
  if (m.isPlaying) return;
  if (sound.locked) sound.once(Phaser.Sound.Events.UNLOCKED, () => m.play());
  else m.play();
}
