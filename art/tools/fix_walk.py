"""Arruma folhas de caminhada 4x4 (32px) geradas por IA.

- Alinha cada quadro: centro horizontal do corpo no meio da célula e pés na última linha.
  Sem isso o personagem "treme" de lado enquanto anda.
- Opcional: refaz uma linha lateral espelhando a outra (a IA às vezes alterna o lado do rosto).
  Linhas: 0 baixo, 1 cima, 2 esquerda, 3 direita.

Uso: python art/tools/fix_walk.py folha.png [--left-from-right | --right-from-left]
     python art/tools/fix_walk.py --selftest
"""
import sys

from PIL import Image, ImageOps

C = 32  # tamanho da célula


def align(cell: Image.Image) -> Image.Image:
    box = cell.getbbox()
    if not box:
        return cell
    part = cell.crop(box)
    out = Image.new("RGBA", (C, C), (0, 0, 0, 0))
    x = (C - part.width) // 2
    out.paste(part, (x, C - part.height), part)
    return out


def fix(sheet: Image.Image, mirror: str | None) -> Image.Image:
    cells = [[align(sheet.crop((c * C, r * C, c * C + C, r * C + C))) for c in range(4)] for r in range(4)]
    if mirror == "left-from-right":
        cells[2] = [ImageOps.mirror(c) for c in cells[3]]
    elif mirror == "right-from-left":
        cells[3] = [ImageOps.mirror(c) for c in cells[2]]
    out = Image.new("RGBA", (4 * C, 4 * C), (0, 0, 0, 0))
    for r in range(4):
        for c in range(4):
            out.paste(cells[r][c], (c * C, r * C))
    return out


def selftest():
    sheet = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    sheet.paste((10, 20, 30, 255), (3, 5, 9, 20))   # quadro (0,0) torto: x=3..8, y=5..19
    sheet.paste((10, 20, 30, 255), (20, 96, 24, 102))  # coluna 0 da linha 3 (direita); a linha 2 está vazia
    out = fix(sheet, "left-from-right")
    assert out.crop((0, 0, 32, 32)).getbbox() == (13, 17, 19, 32), out.crop((0, 0, 32, 32)).getbbox()  # centrado, pés embaixo
    assert out.crop((0, 64, 32, 96)).getbbox() is not None  # linha esquerda veio do espelho da direita
    print("selftest ok")


if __name__ == "__main__":
    if sys.argv[1:] == ["--selftest"]:
        selftest()
    else:
        path = sys.argv[1]
        mirror = next((a[2:] for a in sys.argv[2:] if a.startswith("--")), None)
        fix(Image.open(path).convert("RGBA"), mirror).save(path)
        print(f"{path}: alinhado{' + ' + mirror if mirror else ''}")
