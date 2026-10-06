"""Transforma pixel art "falsa" gerada por IA em sprite de verdade pro jogo.

1. Remove o fundo magenta (#FF00FF) e a franja rosada nas bordas.
2. Recorta no objeto.
3. Reduz pra largura alvo em pixels reais, usando a cor mais frequente de cada bloco
   (não faz média, então as bordas continuam duras).
4. Força cada pixel pra cor mais próxima da paleta (OKLab).

Uso: python art/tools/clean_ai.py <entrada> <saida.png> --width 32
     python art/tools/clean_ai.py folha.png saida.png --width 128 --sheet   (4 colunas de 32px)
     python art/tools/clean_ai.py --selftest
Gera também <saida>.preview.png ampliado 8x pra conferir.
"""
import argparse
import math
from collections import Counter
from pathlib import Path

from PIL import Image

from recolor import load_ramps, oklab


def is_background(rgb):
    r, g, b = rgb
    # magenta puro ou franja misturada com ele: vermelho e azul altos, verde bem abaixo
    return r > 150 and b > 150 and g < min(r, b) - 70


def palette_colors():
    return [c for ramp in load_ramps().values() for c in ramp]


def nearest(rgb, pal, cache):
    if rgb not in cache:
        L, a, b = oklab(rgb)
        # matiz pesa mais que luz: musgo continua verde e runa continua lilás, mesmo que o tom exato mude
        C, h = math.hypot(a, b), math.atan2(b, a)
        def d(p):
            pL, pa, pb = oklab(p)
            pC, ph = math.hypot(pa, pb), math.atan2(pb, pa)
            dh = abs((h - ph + math.pi) % (2 * math.pi) - math.pi)
            # ângulo do matiz pesa mais que a saturação: lilás vivo vira lilás acinzentado, não rosa
            return 0.5 * (pL - L) ** 2 + 0.5 * (pC - C) ** 2 + 4 * (dh * min(C, pC)) ** 2
        cache[rgb] = min(pal, key=d)
    return cache[rgb]


def clean(img: Image.Image, width: int, colors: int = 32, whole: bool = False) -> Image.Image:
    """whole=True: usa a imagem inteira em vez de recortar no objeto (folhas de animação,
    pra cada quadro continuar alinhado na sua célula da grade)."""
    img = img.convert("RGB")
    W, H = img.size
    raw = img.load()
    mask = [[not is_background(raw[x, y]) for x in range(W)] for y in range(H)]
    # reduz primeiro às cores principais da própria imagem: áreas como "musgo" viram uma cor só,
    # em vez de cada pixel oscilar entre duas cores da paleta (granulado)
    flat = img.copy()
    fp = flat.load()
    for y in range(H):
        for x in range(W):
            if not mask[y][x]:
                fp[x, y] = (255, 0, 255)
    src = flat.quantize(colors=colors + 1, method=Image.Quantize.MEDIANCUT).convert("RGB").load()
    if whole:
        x0, x1, y0, y1 = 0, W, 0, H
    else:
        xs = [x for y in range(H) for x in range(W) if mask[y][x]]
        ys = [y for y in range(H) for x in range(W) if mask[y][x]]
        x0, x1, y0, y1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
    bw = (x1 - x0) / width  # tamanho de um "pixel" do jogo na imagem de origem
    height = max(1, round((y1 - y0) / bw))
    pal, cache = palette_colors(), {}
    out = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    o = out.load()
    for ty in range(height):
        for tx in range(width):
            # amostra só o miolo do bloco, longe das bordas borradas
            sx0, sx1 = int(x0 + (tx + 0.25) * bw), max(int(x0 + (tx + 0.75) * bw), int(x0 + (tx + 0.25) * bw) + 1)
            sy0, sy1 = int(y0 + (ty + 0.25) * bw), max(int(y0 + (ty + 0.75) * bw), int(y0 + (ty + 0.25) * bw) + 1)
            cells = [(x, y) for y in range(sy0, min(sy1, H)) for x in range(sx0, min(sx1, W))]
            solid = [src[x, y] for x, y in cells if mask[y][x]]
            if len(solid) * 2 <= len(cells):
                continue  # bloco majoritariamente fundo -> transparente
            q = Counter(nearest(c, pal, cache) for c in solid)
            o[tx, ty] = (*q.most_common(1)[0][0], 255)
    return out


def selftest():
    # objeto 4x2 "pixels" de 10px cada, com fundo magenta e uma franja borrada
    img = Image.new("RGB", (60, 40), (255, 0, 255))
    for y in range(10, 30):
        for x in range(10, 50):
            img.putpixel((x, y), (40, 70, 60) if x < 30 else (200, 225, 215))
    for y in range(10, 30):
        img.putpixel((50, y), (230, 90, 230))  # franja
    out = clean(img, 4)
    assert out.size == (4, 2), out.size
    left, right = out.getpixel((0, 0)), out.getpixel((3, 1))
    pal = palette_colors()
    assert left[:3] in pal and right[:3] in pal and left[3] == right[3] == 255
    assert oklab(left[:3])[0] < oklab(right[:3])[0], "escuro virou claro"
    print("selftest ok")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("entrada", nargs="?")
    ap.add_argument("saida", nargs="?")
    ap.add_argument("--width", type=int, default=32, help="largura final em pixels do jogo (16 = 1 tile)")
    ap.add_argument("--colors", type=int, default=32, help="cores principais antes de mapear na paleta")
    ap.add_argument("--sheet", action="store_true", help="folha de animação: usa a imagem inteira (grade alinhada)")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        selftest()
    else:
        out = clean(Image.open(a.entrada), a.width, a.colors, whole=a.sheet)
        Path(a.saida).parent.mkdir(parents=True, exist_ok=True)
        out.save(a.saida)
        out.resize((out.width * 8, out.height * 8), Image.NEAREST).save(Path(a.saida).with_suffix(".preview.png"))
        print(f"{a.saida}: {out.width}x{out.height}")
