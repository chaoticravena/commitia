"""Limpa folhas 4x4 de personagem (1024x1024) geradas por IA, lendo um pixel por bloco do grid.

O Gemini desenha cada folha com um tamanho de pixel diferente (Helena ~10 px, Professora ~5 px).
Lemos todas no mesmo grid de 10,24 px (100 blocos na folha = 25 por quadro), achando a fase do grid
pelas bordas da imagem. Assim cada pixel da arte vira exatamente um pixel do jogo, sem borrão.
Depois: tira a franja magenta, alinha os pés (fix_walk) e conserta linhas laterais trocadas.

Uso: python art/tools/clean_sheet.py helena-andando [--mirror-right] [--swap-sides] [--side-col3]
     (lê art/inbox/<nome>.jpeg, grava art/clean/<nome>.png e public/assets/sprites/<nome>.png)
     python art/tools/clean_sheet.py --selftest
"""
import argparse
from collections import Counter
from pathlib import Path

from PIL import Image, ImageOps
def is_background(c):
    # perto do magenta puro; roxo e rosa de verdade ficam longe o bastante
    return (c[0] - 255) ** 2 + c[1] ** 2 + (c[2] - 255) ** 2 < 110 ** 2
from fix_walk import align

ROOT = Path(__file__).resolve().parents[2]


def edges(img):
    im = img.convert("L"); px = im.load(); W, H = im.size
    hx = [0] * W; hy = [0] * H
    for y in range(0, H, 2):
        for x in range(1, W):
            if abs(px[x, y] - px[x - 1, y]) > 30: hx[x] += 1
    for x in range(0, W, 2):
        for y in range(1, H):
            if abs(px[x, y] - px[x, y - 1]) > 30: hy[y] += 1
    return hx, hy


def phase(h, p):
    best = (0, 0)
    for o10 in range(int(p * 10)):
        o = o10 / 10
        s = sum(v for i, v in enumerate(h) if abs(((i - o + p / 2) % p) - p / 2) <= 1)
        best = max(best, (s, o))
    return best[1]


def sample(img, p, ox, oy, cols, rows, colors=31):
    """Lê um pixel de arte por bloco do grid (cor mais comum no miolo do bloco)."""
    raw = img.load()
    # o fundo não entra na redução de cores: senão o contorno escuro se mistura com o magenta e vira roxo
    fg = img.copy(); fp = fg.load()
    common = Counter(raw[x, y] for y in range(0, img.height, 4) for x in range(0, img.width, 4) if not is_background(raw[x, y])).most_common(1)[0][0]
    for y in range(img.height):
        for x in range(img.width):
            if is_background(raw[x, y]):
                fp[x, y] = common
    qp = fg.quantize(colors=colors, method=Image.Quantize.MEDIANCUT).convert("RGB").load()
    out = Image.new("RGBA", (cols, rows)); o = out.load()
    for ty in range(rows):
        for tx in range(cols):
            x0, y0 = ox + tx * p, oy + ty * p
            pts = [(int(x0 + p * fx), int(y0 + p * fy)) for fx in (0.3, 0.5, 0.7) for fy in (0.3, 0.5, 0.7)]
            pts = [(x, y) for x, y in pts if 0 <= x < img.width and 0 <= y < img.height]
            solid = [qp[x, y] for x, y in pts if not is_background(raw[x, y])]
            if len(solid) * 2 > len(pts):
                o[tx, ty] = (*Counter(solid).most_common(1)[0][0], 255)
    return out


def defringe(img):
    """Tira da borda as cores raras puxadas pro magenta (sobra do fundo misturada ao contorno)."""
    px = img.load(); W, H = img.size
    freq = Counter(px[x, y][:3] for y in range(H) for x in range(W) if px[x, y][3])
    total = sum(freq.values())
    for _ in range(2):
        kill = []
        for y in range(H):
            for x in range(W):
                r, g, b, a = px[x, y]
                if not a or freq[(r, g, b)] > total * 0.01 or not (r - g > 50 and b - g > 50):
                    continue
                if any(not (0 <= x + dx < W and 0 <= y + dy < H) or not px[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    kill.append((x, y))
        for x, y in kill:
            px[x, y] = (0, 0, 0, 0)
    # contorno que veio tingido de magenta (antisserrilhado da origem) volta a ser contorno escuro
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a and g < 0.35 * min(r, b) and r + b < 330:
                px[x, y] = (43, 34, 51, 255)
    return img


def main_only(cell: Image.Image) -> Image.Image:
    """Mantém só a maior peça ligada do quadro: some com sombra e poeira que a IA desenha soltas
    (o jogo já desenha sombra própria). Chamado depois de alinhar, pra o pulo continuar no ar."""
    px = cell.load(); W, H = cell.size
    seen, best = set(), []
    for y in range(H):
        for x in range(W):
            if px[x, y][3] and (x, y) not in seen:
                comp, stack = [], [(x, y)]
                seen.add((x, y))
                while stack:
                    cx, cy = stack.pop(); comp.append((cx, cy))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            nx, ny = cx + dx, cy + dy
                            if 0 <= nx < W and 0 <= ny < H and px[nx, ny][3] and (nx, ny) not in seen:
                                seen.add((nx, ny)); stack.append((nx, ny))
                best = max(best, comp, key=len)
    keep = set(best)
    out = Image.new("RGBA", cell.size)
    for x, y in keep:
        out.putpixel((x, y), px[x, y])
    return out


def similarity(a: Image.Image, b: Image.Image) -> int:
    pa, pb = a.load(), b.load()
    return sum(1 for y in range(a.height) for x in range(a.width)
               if pa[x, y][3] and pb[x, y][3] and sum(abs(pa[x, y][i] - pb[x, y][i]) for i in range(3)) < 60)


def same_side(row: list[Image.Image]) -> list[Image.Image]:
    """Põe todos os quadros olhando pro mesmo lado: cada um fica na orientação que mais se parece com o
    1º quadro; se a maioria precisou virar, era o 1º que estava do lado errado e vira tudo de volta."""
    flips = [similarity(ImageOps.mirror(c), row[0]) > similarity(c, row[0]) for c in row]
    out = [ImageOps.mirror(c) if f else c for c, f in zip(row, flips)]
    return [ImageOps.mirror(c) for c in out] if sum(flips) * 2 > len(row) else out


def sheet(img: Image.Image, p=10.24, mirror_right=False, swap_sides=False, side_col3=False, main=False) -> Image.Image:
    img = img.convert("RGB")
    hx, hy = edges(img)
    ox, oy = phase(hx, p), phase(hy, p)
    n = round(img.width / p)
    full = defringe(sample(img, p, ox - p if ox > p / 2 else ox, oy - p if oy > p / 2 else oy, n + 1, n + 1))
    cw = img.width / 4
    out = Image.new("RGBA", (128, 128))
    cells = [[None] * 4 for _ in range(4)]
    for r in range(4):
        for c in range(4):
            x0 = round((c * cw - (ox if ox <= p / 2 else ox - p)) / p); y0 = round((r * cw - (oy if oy <= p / 2 else oy - p)) / p)
            cell = full.crop((x0, y0, x0 + round(cw / p), y0 + round(cw / p)))
            big = Image.new("RGBA", (32, 32)); big.paste(cell, (0, 0))
            cells[r][c] = main_only(align(big)) if main else align(big)
    if side_col3:  # a IA às vezes desenha o 3º quadro da lateral de frente: repete o quadro parado
        cells[2][2] = cells[2][0]
    if mirror_right:  # a IA mistura o lado do rosto dentro da mesma linha: desvira os quadros da minoria
        cells[2] = same_side(cells[2])
    if mirror_right:  # a IA às vezes repete o mesmo lado nas duas linhas laterais
        cells[3] = [ImageOps.mirror(c) for c in cells[2]]
    if swap_sides:  # linhas de esquerda e direita vieram trocadas
        cells[2], cells[3] = cells[3], cells[2]
    for r in range(4):
        for c in range(4):
            out.paste(cells[r][c], (c * 32, r * 32))
    return out


def selftest():
    # folha sintética: um quadrado 10x10 "pixels" (blocos de 10,24 px) em cada célula, fundo magenta
    img = Image.new("RGB", (1024, 1024), (255, 0, 255))
    for r in range(4):
        for c in range(4):
            x0, y0 = c * 256 + round(8 * 10.24), r * 256 + round(10 * 10.24)
            img.paste((40, 30, 50), (x0, y0, x0 + round(10 * 10.24), y0 + round(10 * 10.24)))
            img.paste((240, 180, 200), (x0 + 21, y0 + 21, x0 + round(10 * 10.24) - 21, y0 + round(10 * 10.24) - 21))
    out = sheet(img)
    cell = out.crop((0, 0, 32, 32))
    box = cell.getbbox()
    assert box[2] - box[0] == 10 and box[3] == 32, box  # 10 px de largura, pés na última linha
    assert cell.getpixel((box[0], 31))[:3] == (40, 30, 50) and cell.getpixel((box[0] + 5, 27))[:3] == (240, 180, 200)
    a = Image.new("RGBA", (32, 32)); a.paste((40, 30, 50, 255), (4, 10, 12, 30))  # bloco à esquerda
    fixed = same_side([a, a, ImageOps.mirror(a), a])
    assert all(f.tobytes() == a.tobytes() for f in fixed), "quadro espelhado não foi desvirado"
    print("selftest ok")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("nome", nargs="?")
    ap.add_argument("--mirror-right", action="store_true", help="linha da direita = espelho da esquerda")
    ap.add_argument("--swap-sides", action="store_true", help="troca as linhas de esquerda e direita")
    ap.add_argument("--side-col3", action="store_true", help="3º quadro da lateral = quadro parado")
    ap.add_argument("--main-only", action="store_true", help="tira sombra/poeira soltas desenhadas pela IA")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        selftest()
    else:
        out = sheet(Image.open(ROOT / f"art/inbox/{a.nome}.jpeg"), mirror_right=a.mirror_right, swap_sides=a.swap_sides, side_col3=a.side_col3, main=a.main_only)
        for d in ("art/clean", "public/assets/sprites"):
            out.save(ROOT / d / f"{a.nome}.png")
        print(f"{a.nome}: ok")
