"""Limpa tiras de animação (quadros em grade) geradas por IA: logo animada, abertura do estúdio.

Cada quadro é limpo com clean_ai (imagem inteira, pra manter o alinhamento), o halo rosado colado no
lado de fora é removido, e a folha toda ganha UMA paleta de até 32 cores (octree + k-means, que não
engole tons pequenos como a caneca verde). Sai uma tira horizontal de quadros de `largura` px.

Uso: python art/tools/clean_strip.py <nome> <colunas> <linhas> <largura>
     (lê art/inbox/<nome>.jpeg, grava art/clean/<nome>.png e public/assets/sprites/<nome>.png)
"""
import sys
from pathlib import Path

from PIL import Image

from clean_ai import clean

ROOT = Path(__file__).resolve().parents[2]


def halo(c):  # rosa-magenta do contorno "adesivo" que o Gemini pôs em volta
    r, g, b, a = c
    return a and r > 150 and b > 150 and r - g > 50 and b - g > 40


def strip_halo(img):
    """Remove só o halo rosado grudado no lado de fora (inundação a partir do transparente):
    roxos e rosas de dentro do desenho ficam, porque o contorno escuro os separa do fundo."""
    px = img.load(); W, H = img.size
    stack = [(x, y) for y in range(H) for x in range(W) if not px[x, y][3]]
    seen = set(stack)
    while stack:
        x, y = stack.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and halo(px[n]):
                seen.add(n); px[n] = (0, 0, 0, 0); stack.append(n)
    return img


def strip(src, cols, rows, width, out_name):
    im = Image.open(ROOT / f"art/inbox/{src}.jpeg").convert("RGB")
    cw, ch = im.width / cols, im.height / rows
    frames = [strip_halo(clean(im.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch))), width, colors=96, whole=True))
              for r in range(rows) for c in range(cols)]
    h = max(f.height for f in frames)
    sheet = Image.new("RGBA", (width * len(frames), h))
    for i, f in enumerate(frames):
        sheet.paste(f, (i * width, 0))
    # uma paleta só pra folha toda (<=32 cores); octree + k-means não engole tons pequenos (a caneca verde)
    alpha = sheet.getchannel("A")
    q = sheet.convert("RGB").quantize(colors=32, method=Image.Quantize.FASTOCTREE, kmeans=4).convert("RGBA")
    q.putalpha(alpha.point(lambda a: 255 if a >= 128 else 0))
    sheet = q
    for d in ("art/clean", "public/assets/sprites"):
        sheet.save(ROOT / d / f"{out_name}.png")
    print(out_name, sheet.size, "quadro", width, "x", h, "cores", len(sheet.getcolors(1 << 16)))


if __name__ == "__main__":
    nome, cols, rows, width = sys.argv[1], *map(int, sys.argv[2:5])
    strip(nome, cols, rows, width, nome)
