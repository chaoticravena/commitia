"""Monta o tileset do chão (public/assets/sprites/ground.png) a partir das texturas do Gemini.

As texturas viram pixels reais na paleta (clean_ai), e as bordas do autotile (grama encontrando
terra) são desenhadas por código com uma divisa levemente ondulada + linha de sombra dos dois lados.
Assim as bordas sempre encaixam, o que a IA não garante.

Layout (16 colunas de 16 px), o mesmo que src/game/map.ts usa:
  linha 0: tl t tr grassBR grassBL      linha 3: 16 variações de grama
  linha 1: l  c  r  grassTR grassTL     linha 4: 16 variações de grama florida
  linha 2: bl b  br                     linha 5: 16 variações de terra
Uso: python art/tools/build_ground.py            |  python art/tools/build_ground.py --selftest
"""
import math
import sys
from pathlib import Path

from PIL import Image

from clean_ai import clean
from recolor import load_ramps, oklab

ROOT = Path(__file__).resolve().parents[2]
T = 16
COLS = 16
ROLES = {  # papel -> (coluna, linha) no tileset
    "tl": (0, 0), "t": (1, 0), "tr": (2, 0), "grassBR": (3, 0), "grassBL": (4, 0),
    "l": (0, 1), "c": (1, 1), "r": (2, 1), "grassTR": (3, 1), "grassTL": (4, 1),
    "bl": (0, 2), "b": (1, 2), "br": (2, 2),
}


def e(u: int) -> int:
    """Recuo da divisa (px) ao longo da borda. Periódico em 16 px: tiles vizinhos emendam."""
    return 4 + round(1.2 * math.sin(2 * math.pi * u / 16) + 0.8 * math.sin(2 * math.pi * 2 * u / 16 + 1))


def is_dirt(role: str, x: int, y: int) -> bool:
    top, bottom, left, right = y >= e(x), y <= 15 - e(x), x >= e(y), x <= 15 - e(y)
    return {
        "c": True,
        "t": top, "b": bottom, "l": left, "r": right,
        "tl": top and left and x + y >= 10, "tr": top and right and (15 - x) + y >= 10,
        "bl": bottom and left and x + (15 - y) >= 10, "br": bottom and right and (15 - x) + (15 - y) >= 10,
        # canto interno: terra em volta, um cantinho de grama
        "grassBR": not (not bottom and not right), "grassBL": not (not bottom and not left),
        "grassTR": not (not top and not right), "grassTL": not (not top and not left),
    }[role]


def to_ramp(img: Image.Image, ramp, shift: int, only=None) -> Image.Image:
    """Leva os pixels pra uma rampa da paleta pela luminosidade, deslocando `shift` tons.
    only: se dado, só mexe nos pixels que já são dessas cores (ex. a grama, sem tocar nas flores)."""
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0 or (only is not None and (r, g, b) not in only):
                continue
            L = oklab((r, g, b))[0]
            i = min(range(len(ramp)), key=lambda k: abs(oklab(ramp[k])[0] - L))
            px[x, y] = (*ramp[max(0, min(len(ramp) - 1, i + shift))], 255)
    return out


def texture(name: str) -> Image.Image:
    """Textura do Gemini -> pixels reais na paleta, recortada num período (128 px) que emenda."""
    src = Image.open(ROOT / f"art/inbox/{name}.jpeg")
    native = clean(src, 256, whole=True).crop((0, 0, 128, 128))  # o "pixel" dessas texturas tem 4 px
    ramps = load_ramps()
    if name.startswith("grama"):  # menta brilhante caía no tom mais claro: um tom abaixo fica menos lavado
        g = ramps["Grama / folhas"]
        return to_ramp(native, g, -1, only=set(g))
    return to_ramp(native, ramps["Madeira / terra"], 0)  # terra na rampa de madeira, não na das flores


def edge_tile(role: str, grass: Image.Image, dirt: Image.Image, rim_g, rim_d) -> Image.Image:
    out = Image.new("RGBA", (T, T))
    mask = [[is_dirt(role, x, y) for x in range(T)] for y in range(T)]
    for y in range(T):
        for x in range(T):
            near_other = any(0 <= x + dx < T and 0 <= y + dy < T and mask[y + dy][x + dx] != mask[y][x]
                             for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if mask[y][x]:
                out.putpixel((x, y), (*rim_d, 255) if near_other else dirt.getpixel((x, y)))
            else:
                out.putpixel((x, y), (*rim_g, 255) if near_other else grass.getpixel((x, y)))
    return out


def build() -> Image.Image:
    ramps = load_ramps()
    rim_g, rim_d = ramps["Grama / folhas"][1], ramps["Madeira / terra"][1]  # divisa um tom abaixo do novo chão
    grass, flowers, dirt = texture("grama-textura"), texture("grama-florida"), texture("terra-textura")
    sheet = Image.new("RGBA", (COLS * T, 6 * T))
    for role, (c, r) in ROLES.items():
        sheet.paste(edge_tile(role, grass.crop((0, 0, T, T)), dirt.crop((0, 0, T, T)), rim_g, rim_d), (c * T, r * T))
    for row, tex in ((3, grass), (4, flowers), (5, dirt)):
        for i in range(COLS):  # 16 recortes diferentes da textura = variação sem repetição visível
            x, y = (i % 8) * T, (i // 8) * T * 3
            sheet.paste(tex.crop((x, y, x + T, y + T)), (i * T, row * T))
    return sheet


def selftest():
    assert all(e(u) == e(u + 16) for u in range(16)), "divisa não é periódica"
    assert is_dirt("c", 0, 0) and not is_dirt("t", 8, 0) and is_dirt("t", 8, 15)
    assert not is_dirt("tl", 0, 0) and is_dirt("tl", 15, 15)
    assert not is_dirt("grassBR", 15, 15) and is_dirt("grassBR", 0, 0)
    print("selftest ok")


if __name__ == "__main__":
    if sys.argv[1:] == ["--selftest"]:
        selftest()
    else:
        out = ROOT / "public/assets/sprites/ground.png"
        build().save(out)
        print(f"{out.relative_to(ROOT)} pronto")
