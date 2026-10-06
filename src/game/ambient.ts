import Phaser from "phaser";

// Vida no ambiente: pétalas, folhas, borboletas e poeira dos passos.
// Regra pixel-perfeita: partículas são quadradinhos de 1-2 px nas cores da paleta,
// só se movem e desbotam; nunca giram nem mudam de escala.

const C = {
  petal: [0xe3a3bd, 0xf7dcd3], lilac: [0xc8bde6, 0xf7dcd3], leaf: [0x739586, 0x9dbfb0], dust: 0x947a70,
  wings: [0xfcf4ee, 0xe3a3bd, 0xebd6b5], body: 0x443c53,
};

function pixelTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({}, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function makeTextures(scene: Phaser.Scene) {
  C.petal.forEach((c, i) => pixelTexture(scene, `petal${i}`, 2, 1, g => g.fillStyle(c).fillRect(0, 0, 2, 1)));
  C.lilac.forEach((c, i) => pixelTexture(scene, `lilac${i}`, 2, 1, g => g.fillStyle(c).fillRect(0, 0, 2, 1)));
  C.leaf.forEach((c, i) => pixelTexture(scene, `leaf${i}`, 2, 2, g => g.fillStyle(c).fillRect(0, 0, 2, 1).fillRect(1, 1, 1, 1)));
  pixelTexture(scene, "dust", 1, 1, g => g.fillStyle(C.dust).fillRect(0, 0, 1, 1));
  C.wings.forEach((c, i) => {
    // asa aberta (5x3) e fechada (3x3), corpinho escuro no meio
    pixelTexture(scene, `bf${i}a`, 5, 3, g => g.fillStyle(c).fillRect(0, 0, 2, 2).fillRect(3, 0, 2, 2).fillStyle(C.body).fillRect(2, 0, 1, 3));
    pixelTexture(scene, `bf${i}b`, 5, 3, g => g.fillStyle(c).fillRect(1, 0, 1, 2).fillRect(3, 0, 1, 2).fillStyle(C.body).fillRect(2, 0, 1, 3));
  });
}

type Tree = { img: Phaser.GameObjects.Image; flowering: boolean };

export function addAmbient(scene: Phaser.Scene, trees: Tree[], area: Phaser.Geom.Rectangle) {
  makeTextures(scene);
  const TOP = 100000; // acima de tudo do mundo

  // pétalas das floridas (frequentes) e folhas das verdes (raras)
  trees.forEach(({ img, flowering }, i) => {
    if (!flowering && i % 3) return;
    const canopy = new Phaser.Geom.Rectangle(img.x + 6, img.y - img.height + 6, img.width - 12, img.height * 0.45);
    const kind = !flowering ? "leaf" : img.texture.key === "arvore-lavanda" ? "lilac" : "petal";
    scene.add.particles(0, 0, `${kind}${i % 2}`, {
      emitZone: {
        type: "random",
        source: { getRandomPoint: (pt: Phaser.Types.Math.Vector2Like) => { pt.x = canopy.x + Math.random() * canopy.width; pt.y = canopy.y + Math.random() * canopy.height; } },
      },
      frequency: flowering ? 1400 + (i % 5) * 300 : 4200 + (i % 7) * 500,
      quantity: 1,
      lifespan: 5200,
      speedY: { min: 5, max: 10 },
      speedX: { min: -5, max: 5 },
      // balanço de folha caindo: deslocamento lateral em seno ao longo da vida
      x: { onUpdate: (p, _k, t, v) => v + Math.sin(t * 9 + p.lifeCurrent * 0.001) * 0.15 },
      alpha: { start: 1, end: 0, ease: "Quad.In" },
    }).setDepth(TOP);
  });

  // borboletas: voam até um ponto aleatório da vila, param, escolhem outro
  for (let i = 0; i < 4; i++) {
    const kind = i % C.wings.length;
    const bf = scene.add.image(area.x + Math.random() * area.width, area.y + Math.random() * area.height, `bf${kind}a`).setDepth(TOP - 1);
    scene.time.addEvent({ delay: 110 + i * 15, loop: true, callback: () => bf.setTexture(bf.texture.key.endsWith("a") ? `bf${kind}b` : `bf${kind}a`) });
    const fly = () => {
      const p = area.getRandomPoint();
      scene.tweens.add({
        targets: bf, x: Math.round(p.x), y: Math.round(p.y),
        duration: 2500 + Math.random() * 2500, ease: "Sine.InOut",
        onComplete: () => scene.time.delayedCall(400 + Math.random() * 1600, fly),
      });
    };
    fly();
  }

  // poeira dos passos na terra
  const dust = scene.add.particles(0, 0, "dust", {
    emitting: false, lifespan: 350, speedX: { min: -14, max: 14 }, speedY: { min: -10, max: -2 },
    alpha: { start: 0.9, end: 0 },
  });
  return {
    stepDust(x: number, y: number) { dust.setDepth(y - 1).explode(3, x, y - 1); },
  };
}
