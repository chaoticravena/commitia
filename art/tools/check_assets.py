"""Reprova arte que quebraria o visual pixel-perfeito. Roda no `npm test`.

Regras pra cada PNG do jogo (public/assets/sprites e public/assets-pastel):
- transparência só total ou nenhuma (alpha 0 ou 255): meio-transparente vira borrão;
- no máximo 32 cores por imagem (a paleta é guia de estilo, não regra: forçá-la apagava as cores da arte);
- folhas de caminhada (*-andando.png) com 4x4 quadros de 32 px.
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DIRS = [ROOT / "public/assets/sprites", ROOT / "public/assets-pastel"]


def problems(path: Path):
    im = Image.open(path).convert("RGBA")
    out = []
    colors = im.getcolors(1 << 24) or []
    if any(0 < a < 255 for _, (r, g, b, a) in colors):
        out.append("tem pixels semitransparentes")
    opaque = {(r, g, b) for _, (r, g, b, a) in colors if a == 255}
    if len(opaque) > 32:
        out.append(f"{len(opaque)} cores, máximo 32")
    if path.stem.endswith("-andando") and im.size != (128, 128):
        out.append(f"folha de caminhada deve ser 128x128, é {im.size[0]}x{im.size[1]}")
    return out


def main():
    files = [f for d in DIRS for f in sorted(d.rglob("*.png"))]
    bad = {f: p for f in files if (p := problems(f))}
    for f, ps in bad.items():
        print(f"✖ {f.relative_to(ROOT)}: {'; '.join(ps)}")
    print(f"arte: {len(files) - len(bad)}/{len(files)} ok")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
