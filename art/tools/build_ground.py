"""Monta o tileset do chão (public/assets/sprites/ground.png).

Grama e terra são geradas por código (as texturas do Gemini eram lisas e ficavam sem vida), e as
bordas do autotile (grama encontrando terra) têm uma divisa levemente ondulada + linha de sombra dos
dois lados. Assim as bordas sempre encaixam, o que a IA não garante.

Layout (16 colunas de 16 px), o mesmo que src/game/map.ts usa:
  linha 0: tl t tr grassBR grassBL      linha 3: 16 variações de grama
  linha 1: l  c  r  grassTR grassTL     linha 4: 16 variações de grama florida
  linha 2: bl b  br                     linha 5: 16 variações de terra
Uso: python art/tools/build_ground.py            |  python art/tools/build_ground.py --selftest
"""
import math
import random
import sys
from pathlib import Path

from PIL import Image


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


# Grama feita por código: a textura do Gemini era lisa e ficava cinza na paleta. Aqui cada tile tem
# base fresca + pontinhos claros/escuros + tufos com ponta iluminada; os floridos ganham trevos e flores.
# Nada cruza a borda do tile com variação de base, então qualquer vizinho emenda.
GRASS = {"base": (147, 204, 143), "dark": (111, 174, 121), "deep": (79, 143, 99), "light": (181, 224, 166), "tip": (214, 240, 192)}
FLOWERS = [(247, 220, 211), (242, 184, 198), (247, 217, 160), (200, 189, 230)]
TUFT = [(1, -2, "tip"), (0, -1, "dark"), (1, -1, "light"), (2, -1, "dark"), (0, 0, "deep"), (1, 0, "dark"), (2, 0, "deep")]
FLOWER = [(1, 0, None), (0, 1, None), (2, 1, None), (1, 2, None), (1, 1, "tip")]  # 4 pétalas + miolo


def grass_tile(seed: int, flowers: bool) -> Image.Image:
    rnd = random.Random(seed)
    tile = Image.new("RGBA", (T, T), (*GRASS["base"], 255))
    px = tile.load()
    for _ in range(rnd.randint(7, 11)):
        px[rnd.randrange(T), rnd.randrange(T)] = (*GRASS["light"], 255)
    for _ in range(rnd.randint(4, 7)):
        px[rnd.randrange(T), rnd.randrange(T)] = (*GRASS["dark"], 255)
    for _ in range(rnd.randint(0, 2)):
        x, y = rnd.randrange(1, T - 4), rnd.randrange(3, T - 1)
        for dx, dy, c in TUFT:
            px[x + dx, y + dy] = (*GRASS[c], 255)
    if flowers:
        for _ in range(rnd.randint(1, 2)):
            x, y, col = rnd.randrange(0, T - 3), rnd.randrange(0, T - 3), rnd.choice(FLOWERS)
            for dx, dy, c in FLOWER:
                px[x + dx, y + dy] = (*(GRASS[c] if c else col), 255)
    return tile


# Terra no mesmo esquema: base quente, pontinhos, pedrinhas com sombra embaixo e rachadinhas.
DIRT = {"base": (190, 154, 124), "dark": (166, 130, 104), "deep": (132, 100, 84), "light": (212, 180, 148), "stone": (228, 212, 192), "stone_dark": (150, 128, 116)}
PEBBLE = [(0, 0, "stone"), (1, 0, "stone"), (0, 1, "stone_dark"), (1, 1, "stone_dark")]
CRACK = [(0, 0), (1, 0), (2, 1), (3, 1)]


def dirt_tile(seed: int) -> Image.Image:
    rnd = random.Random(seed)
    tile = Image.new("RGBA", (T, T), (*DIRT["base"], 255))
    px = tile.load()
    for _ in range(rnd.randint(6, 10)):
        px[rnd.randrange(T), rnd.randrange(T)] = (*DIRT["light"], 255)
    for _ in range(rnd.randint(6, 10)):
        px[rnd.randrange(T), rnd.randrange(T)] = (*DIRT["dark"], 255)
    for _ in range(rnd.randint(0, 2)):
        x, y = rnd.randrange(0, T - 2), rnd.randrange(0, T - 2)
        for dx, dy, c in PEBBLE:
            px[x + dx, y + dy] = (*DIRT[c], 255)
    if rnd.random() < 0.3:
        x, y = rnd.randrange(0, T - 4), rnd.randrange(0, T - 2)
        for dx, dy in CRACK:
            px[x + dx, y + dy] = (*DIRT["deep"], 255)
    return tile


def grass_texture(flowers: bool) -> Image.Image:
    """128x128 de tiles independentes, no mesmo formato que build() recorta."""
    tex = Image.new("RGBA", (128, 128))
    for i in range(64):
        tex.paste(grass_tile(i + (1000 if flowers else 0), flowers), ((i % 8) * T, (i // 8) * T))
    return tex


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
    rim_g, rim_d = GRASS["deep"], DIRT["deep"]  # divisa um tom abaixo de cada chão
    grass, flowers = grass_texture(False), grass_texture(True)
    dirt = Image.new("RGBA", (128, 128))
    for i in range(64):
        dirt.paste(dirt_tile(2000 + i), ((i % 8) * T, (i // 8) * T))
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
    t = grass_tile(1, True)
    assert t.size == (T, T) and t.getchannel("A").getextrema() == (255, 255), "tile de grama com buraco"
    assert grass_tile(5, False).tobytes() == grass_tile(5, False).tobytes(), "grama não é determinística"
    print("selftest ok")


if __name__ == "__main__":
    if sys.argv[1:] == ["--selftest"]:
        selftest()
    else:
        out = ROOT / "public/assets/sprites/ground.png"
        build().save(out)
        print(f"{out.relative_to(ROOT)} pronto")
