// Ato 1 · Primeiro save. Passos da missão e falas da Professora Commit, que dependem do progresso.
import type { Workspace } from "../git/repo.ts";
import { houses, flowers } from "./world.ts";

export type Progress = { talked: boolean; visitedPast: boolean };

const commits = (ws: Workspace) => ws.repo ? [...ws.repo.objects.values()].filter(o => o.type === "commit").length : 0;
const detached = (ws: Workspace) => !!ws.repo && "detached" in ws.repo.head;
const built = (ws: Workspace) => houses(ws.work).size + flowers(ws.work).size > 0;

export const STEPS: { label: string; done: (ws: Workspace, p: Progress) => boolean }[] = [
  { label: "Fale com a Profa. Commit", done: (_, p) => p.talked },
  { label: "git init", done: ws => !!ws.repo },
  { label: "Construa algo", done: ws => built(ws) || commits(ws) > 0 },
  { label: "git add", done: ws => !!ws.repo && (Object.keys(ws.repo.index).length > 0) },
  { label: "git commit", done: ws => commits(ws) >= 1 },
  { label: "Mude e salve de novo", done: ws => commits(ws) >= 2 },
  { label: "Visite o passado", done: (ws, p) => p.visitedPast || detached(ws) },
  { label: "Volte ao presente", done: (ws, p) => p.visitedPast && !detached(ws) },
];

export const currentStep = (ws: Workspace, p: Progress) => STEPS.findIndex(s => !s.done(ws, p));

export function professora(ws: Workspace, p: Progress): string[] {
  switch (currentStep(ws, p)) {
    case 0:
    case 1:
      return [
        "Olá! Eu sou a Professora Commit. Bem-vinda a Commitia!",
        "Esta vila esqueceu tudo o que já foi. Nenhum momento dela está guardado.",
        "Vamos dar uma memória a ela. Aperte Enter pra abrir o grimório e digite: git init",
      ];
    case 2:
      return [
        "Agora a vila tem um repositório! Ele vai lembrar de cada momento que você salvar.",
        "Construa algo: chegue perto de um lote vazio ou de um canteiro e aperte Espaço.",
      ];
    case 3:
      return [
        "Viu o contorno vermelho piscando? É uma mudança que o Git ainda não guardou.",
        "Escolha o que vai entrar no próximo save com git add. Experimente: git add .",
      ];
    case 4:
      return [
        "Verde! Está no staging: a área de preparação, esperando o save.",
        "Agora guarde o momento: git commit -m \"minha primeira casa\"",
      ];
    case 5:
      return [
        "Momento salvo pra sempre! Cada commit é uma foto da vila inteira.",
        "Mude mais alguma coisa (outra casa, flores, trocar uma cor) e faça outro commit.",
      ];
    case 6:
      return [
        "Duas lembranças! Veja todas com git log --oneline.",
        "Agora a mágica: copie o código do primeiro commit e viaje até ele com git switch --detach <código>",
      ];
    case 7:
      return [
        "Você está no passado! A vila está exatamente como era naquele commit.",
        "Aqui é só pra olhar. Pra voltar ao presente: git switch main",
      ];
    default:
      return [
        "Você aprendeu o coração do Git: mudar, preparar com add, salvar com commit e viajar no tempo.",
        "O Ato 1 está completo. Logo vem o Ato 2: diff, restore e o HEAD destacado!",
      ];
  }
}
