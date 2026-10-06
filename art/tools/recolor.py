"""Recolore sprites/tilesets pra paleta do jogo preservando volume.

1. Cada cor de origem vai pra uma família (rampa) da paleta, pelo matiz em OKLab.
   Cores quase sem saturação vão pra Contorno / Pedra / Pergaminho conforme a luz.
2. Dentro da família, as cores de origem são ordenadas por luminosidade e distribuídas
   pelos tons da rampa (por quantil), então sombra continua sombra e luz continua luz.

Uso: python art/tools/recolor.py <origem> <destino>
     (origem/destino podem ser pastas; recolore todos os .png mantendo a estrutura)
     python art/tools/recolor.py --selftest
"""
import math
import sys
from pathlib import Path

from PIL import Image

GPL = Path(__file__).resolve().parents[1] / "palette" / "repo-vivo.gpl"
SKIP = {"Git (interface)"}  # cores de interface, não entram no mundo
NEUTRAL_CHROMA = 0.035


def oklab(rgb):
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(c) for c in rgb)
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)


def load_ramps(path=GPL):
    ramps = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        parts = line.split("\t")
        if len(parts) != 2 or not parts[0].strip()[0].isdigit():
            continue
        rgb = tuple(int(v) for v in parts[0].split())
        name = parts[1].rsplit(" ", 1)[0]
        if name not in SKIP:
            ramps.setdefault(name, []).append(rgb)
    return ramps  # cada rampa já vem do escuro pro claro


def family(rgb, ramps, centroids):
    L, a, b = oklab(rgb)
    if math.hypot(a, b) < NEUTRAL_CHROMA:
        return "Contorno" if L < 0.33 else "Pergaminho" if L > 0.9 else "Pedra"
    hue = math.atan2(b, a)
    # verdes e verde-amarelados são vegetação: sempre Grama (a rampa Oliva fica pra detalhes escolhidos à mão)
    if 1.6 < math.degrees(hue) % 360 / 60 < 2.9:
        return "Grama / folhas"
    def dist(name):
        ca, cb = centroids[name]
        d = abs((hue - math.atan2(cb, ca) + math.pi) % (2 * math.pi) - math.pi)
        return d + 0.6 * abs(math.hypot(a, b) - math.hypot(ca, cb))  # matiz manda, saturação desempata
    return min((n for n in centroids if n not in ("Contorno", "Pedra", "Pergaminho")), key=dist)


def build_map(colors, ramps):
    """colors: {rgb: contagem} de todas as imagens juntas -> {rgb_origem: rgb_paleta}."""
    centroids = {}
    for name, ramp in ramps.items():
        labs = [oklab(c) for c in ramp]
        centroids[name] = (sum(l[1] for l in labs) / len(labs), sum(l[2] for l in labs) / len(labs))
    groups = {}
    for c in colors:
        groups.setdefault(family(c, ramps, centroids), []).append(c)
    out = {}
    for name, cs in groups.items():
        ramp = ramps[name]
        ls = [oklab(c)[0] for c in cs]
        lo, hi = min(ls), max(ls)
        for c, l in zip(cs, ls):  # faixa de luz da família -> tons da rampa (sombra continua sombra)
            t = 0.5 if hi - lo < 1e-6 else (l - lo) / (hi - lo)
            out[c] = ramp[min(len(ramp) - 1, int(t * len(ramp)))]
    return out


def recolor_tree(src: Path, dst: Path):
    files = sorted(src.rglob("*.png")) if src.is_dir() else [src]
    imgs = {f: Image.open(f).convert("RGBA") for f in files}
    counts = {}
    for im in imgs.values():
        for n, (r, g, b, a) in im.getcolors(1 << 24) or []:
            if a >= 16:
                counts[(r, g, b)] = counts.get((r, g, b), 0) + n
    cmap = build_map(counts, load_ramps())
    for f, im in imgs.items():
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = px[x, y]
                if a >= 16:
                    px[x, y] = (*cmap[(r, g, b)], a)
        out = dst / f.relative_to(src) if src.is_dir() else dst
        out.parent.mkdir(parents=True, exist_ok=True)
        im.save(out)
    print(f"{len(files)} imagens, {len(counts)} cores de origem -> {len(set(cmap.values()))} cores da paleta")


def selftest():
    ramps = load_ramps()
    cmap = build_map({(40, 140, 40): 1, (120, 220, 120): 1, (30, 90, 200): 1, (20, 20, 20): 1}, ramps)
    assert cmap[(40, 140, 40)] in ramps["Grama / folhas"] and cmap[(120, 220, 120)] in ramps["Grama / folhas"]
    assert oklab(cmap[(40, 140, 40)])[0] < oklab(cmap[(120, 220, 120)])[0], "sombra virou luz"
    assert cmap[(30, 90, 200)] in ramps["Água"]
    assert cmap[(20, 20, 20)] in ramps["Contorno"]
    print("selftest ok")


if __name__ == "__main__":
    if sys.argv[1:] == ["--selftest"]:
        selftest()
    else:
        recolor_tree(Path(sys.argv[1]), Path(sys.argv[2]))
