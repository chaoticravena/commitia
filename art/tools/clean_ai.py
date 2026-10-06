"""Transforma pixel art "falsa" gerada por IA em sprite de verdade pro jogo.

1. Remove o fundo magenta (#FF00FF) e a franja rosada nas bordas.
2. Recorta no objeto.
3. Reduz pra largura alvo com média por área e volta às cores principais da própria imagem.
4. (opcional, --palette) força cada pixel pra cor mais próxima da paleta (OKLab).

Uso: python art/tools/clean_ai.py <entrada> <saida.png> --width 32
     python art/tools/clean_ai.py folha.png saida.png --width 128 --sheet   (4 colunas de 32px)
     python art/tools/clean_ai.py --selftest
Gera também <saida>.preview.png ampliado 8x pra conferir.
"""
import argparse
import math
from pathlib import Path

from PIL import Image, ImageFilter

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


def clean(img: Image.Image, width: int, colors: int = 32, whole: bool = False, palette: bool = False) -> Image.Image:
    """Reduz pra `width` pixels reais com média por área e depois volta pras cores principais da
    própria imagem. Cada objeto do Gemini vem num tamanho de "pixel" diferente (casa ~8,5 px,
    árvore ~4,3 px), que quase nunca divide a largura do jogo: amostrar um pixel por bloco
    desalinhava a grade e sujava contornos. A média + quantização dá contorno limpo.
    palette=True força a paleta do jogo (apaga cores vivas da arte: rosa vira bege, lilás vira cinza).
    whole=True: usa a imagem inteira em vez de recortar no objeto (folhas de animação)."""
    img = img.convert("RGB")
    W, H = img.size
    raw = img.load()
    alpha = Image.new("L", (W, H))
    ap = alpha.load()
    for y in range(H):
        for x in range(W):
            ap[x, y] = 0 if is_background(raw[x, y]) else 255
    # come 1 px da borda: a franja rosada do magenta não entra na média
    alpha = alpha.filter(ImageFilter.MinFilter(3))
    rgba = img.convert("RGBA")
    rgba.putalpha(alpha)
    if not whole:
        rgba = rgba.crop(alpha.getbbox())
    height = max(1, round(rgba.height * width / rgba.width))
    small = rgba.resize((width, height), Image.BOX)  # Pillow faz a média pré-multiplicada pelo alpha
    q = small.convert("RGB").quantize(colors=colors, method=Image.Quantize.MEDIANCUT).convert("RGB").load()
    sa = small.getchannel("A").load()
    pal, cache = palette_colors(), {}
    out = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    o = out.load()
    for y in range(height):
        for x in range(width):
            if sa[x, y] >= 128:
                o[x, y] = (*(nearest(q[x, y], pal, cache) if palette else q[x, y]), 255)
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
    assert left[3] == right[3] == 255
    assert all(abs(a - b) < 40 for a, b in zip(right, (200, 225, 215))), "franja magenta entrou na cor"
    pal = palette_colors()
    assert all(c[:3] in pal for _, c in clean(img, 4, palette=True).getcolors() if c[3])
    assert oklab(left[:3])[0] < oklab(right[:3])[0], "escuro virou claro"
    print("selftest ok")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("entrada", nargs="?")
    ap.add_argument("saida", nargs="?")
    ap.add_argument("--width", type=int, default=32, help="largura final em pixels do jogo (16 = 1 tile)")
    ap.add_argument("--colors", type=int, default=32, help="cores principais antes de mapear na paleta")
    ap.add_argument("--sheet", action="store_true", help="folha de animação: usa a imagem inteira (grade alinhada)")
    ap.add_argument("--palette", action="store_true", help="força as cores da paleta do jogo")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        selftest()
    else:
        out = clean(Image.open(a.entrada), a.width, a.colors, whole=a.sheet, palette=a.palette)
        Path(a.saida).parent.mkdir(parents=True, exist_ok=True)
        out.save(a.saida)
        out.resize((out.width * 8, out.height * 8), Image.NEAREST).save(Path(a.saida).with_suffix(".preview.png"))
        print(f"{a.saida}: {out.width}x{out.height}")
