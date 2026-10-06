// O mundo É o conteúdo dos arquivos. Este módulo traduz arquivo <-> objetos da vila. Puro e testado.
//   casas.txt  -> uma linha por lote construído:  "lote 2: palha"
//   jardim.txt -> uma linha por canteiro plantado: "canteiro 5: girassol"

import type { Files } from "../git/repo.ts";

// um tipo de casa por sprite desenhado; Espaço num lote percorre os tipos em ordem e volta ao vazio
export const HOUSE_KINDS = ["pedra", "madeira", "padaria", "floricultura", "cha", "biblioteca", "moinho"] as const;
export const FLOWER_KINDS = ["girassol", "rosa", "trevo"] as const;
export type HouseKind = (typeof HOUSE_KINDS)[number];
export type FlowerKind = (typeof FLOWER_KINDS)[number];

export const FILES = { casas: "casas.txt", jardim: "jardim.txt" } as const;

// A vila já existe quando o jogo começa, só que sem Git: depois do git init, o git status mostra tudo
// como não rastreado. O lote 2 (o cercado de corda) fica vazio pra primeira construção.
export const STARTING_FILES = { [FILES.casas]: "lote 0: pedra\nlote 1: madeira\nlote 3: padaria" };

type Slots = Map<number, string>; // número do lote/canteiro -> tipo

function parse(text: string | undefined, label: string): Slots {
  const out: Slots = new Map();
  for (const line of (text ?? "").split("\n")) {
    const m = line.match(new RegExp(`^${label} (\\d+): (\\S+)$`));
    if (m) out.set(+m[1], m[2]);
  }
  return out;
}

function serialize(slots: Slots, label: string): string {
  return [...slots].sort((a, b) => a[0] - b[0]).map(([n, k]) => `${label} ${n}: ${k}`).join("\n");
}

export const houses = (f: Files) => parse(f[FILES.casas], "lote");
export const flowers = (f: Files) => parse(f[FILES.jardim], "canteiro");

function edit(files: Files, path: string, label: string, n: number, kind: string | null): Files {
  const slots = parse(files[path], label);
  if (kind) slots.set(n, kind); else slots.delete(n);
  return { ...files, [path]: serialize(slots, label) };
}

export const build = (f: Files, lot: number, kind: HouseKind) => edit(f, FILES.casas, "lote", lot, kind);
// próximo tipo no ciclo do lote (null = vazio), pulando os que já estão em outros lotes da rua:
// nunca aparecem duas casas iguais, e a que sai de um lote volta a ficar disponível
export function nextKind(kind: string | undefined, taken: Iterable<string> = []): HouseKind | null {
  const used = new Set(taken);
  for (let i = HOUSE_KINDS.indexOf(kind as HouseKind) + 1; i < HOUSE_KINDS.length; i++)
    if (!used.has(HOUSE_KINDS[i])) return HOUSE_KINDS[i];
  return null;
}

export const demolish = (f: Files, lot: number) => edit(f, FILES.casas, "lote", lot, null);
export const plant = (f: Files, spot: number, kind: FlowerKind) => edit(f, FILES.jardim, "canteiro", spot, kind);
export const uproot = (f: Files, spot: number) => edit(f, FILES.jardim, "canteiro", spot, null);

// Status de um objeto comparando a linha dele nas três áreas do Git.
//  "mod"  = mudou no mundo e ainda não foi pro staging (vermelho piscando)
//  "stg"  = está no staging, esperando o commit (verde)
//  "ok"   = igual ao último commit
//  "ghost"= foi removido do mundo mas ainda existe no staging/commit (fantasma)
export type ItemStatus = "mod" | "stg" | "ok" | "ghost";

export function itemStatus(work: Slots, index: Slots, head: Slots, n: number): ItemStatus {
  const w = work.get(n), i = index.get(n), h = head.get(n);
  if (w === undefined) return i !== undefined || h !== undefined ? "ghost" : "ok";
  if (w !== i) return "mod";
  if (i !== h) return "stg";
  return "ok";
}
