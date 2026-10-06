"""Reprova arte que quebraria o visual pixel-perfeito. Roda no `npm test`.

Regras pra cada PNG do jogo (public/assets/sprites e public/assets-pastel):
- transparência só total ou nenhuma (alpha 0 ou 255): meio-transparente vira borrão;
- no máximo 32 cores por imagem (a paleta do jogo só é obrigatória no chão, ground.png);
- folhas de caminhada (*-andando.png) com 4x4 quadros de 32 px.
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DIRS = [ROOT / "public/assets/sprites", ROOT / "public/assets-pastel"]


def palette():
    cols = set()
    for line in (ROOT / "art/palette/commitia.gpl").read_text(encoding="utf-8").splitlines():
        parts = line.split("\t")[0].split()
        if len(parts) == 3 and all(p.isdigit() for p in parts):
            cols.add(tuple(int(p) for p in parts))
    return cols


def problems(path: Path, pal):
    im = Image.open(path).convert("RGBA")
    out = []
    colors = im.getcolors(1 << 24) or []
    if any(0 < a < 255 for _, (r, g, b, a) in colors):
        out.append("tem pixels semitransparentes")
    opaque = {(r, g, b) for _, (r, g, b, a) in colors if a == 255}
    if len(opaque) > 32:
        out.append(f"{len(opaque)} cores, máximo 32")
    off = opaque - pal if path.stem == "ground" else set()
    if off:
        out.append(f"{len(off)} cor(es) fora da paleta, ex. #{'%02x%02x%02x' % next(iter(off))}")
    if path.stem.endswith("-andando") and im.size != (128, 128):
        out.append(f"folha de caminhada deve ser 128x128, é {im.size[0]}x{im.size[1]}")
    return out


def main():
    pal = palette()
    files = [f for d in DIRS for f in sorted(d.rglob("*.png"))]
    bad = {f: p for f in files if (p := problems(f, pal))}
    for f, ps in bad.items():
        print(f"✖ {f.relative_to(ROOT)}: {'; '.join(ps)}")
    print(f"arte: {len(files) - len(bad)}/{len(files)} ok")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
