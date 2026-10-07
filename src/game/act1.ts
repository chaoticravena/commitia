// Ato 1 · Primeiro save. Passos da missão e falas da Professora Commit, que dependem do progresso.
import type { Workspace } from "../git/repo.ts";
import { FILES, STARTING_FILES, flowers } from "./world.ts";

export type Progress = { talked: boolean; visitedPast: boolean };

const commits = (ws: Workspace) => ws.repo ? [...ws.repo.objects.values()].filter(o => o.type === "commit").length : 0;
const detached = (ws: Workspace) => !!ws.repo && "detached" in ws.repo.head;
const built = (ws: Workspace) => ws.work[FILES.casas] !== STARTING_FILES[FILES.casas] || flowers(ws.work).size > 0;

export const STEPS: { label: { pt: string; en: string }; done: (ws: Workspace, p: Progress) => boolean }[] = [
  { label: { pt: "Fale com a Profa. Commit", en: "Talk to Prof. Commit" }, done: (_, p) => p.talked },
  { label: { pt: "git init", en: "git init" }, done: ws => !!ws.repo },
  { label: { pt: "Construa algo", en: "Build something" }, done: ws => built(ws) || commits(ws) > 0 },
  { label: { pt: "git add", en: "git add" }, done: ws => !!ws.repo && (Object.keys(ws.repo.index).length > 0) },
  { label: { pt: "git commit", en: "git commit" }, done: ws => commits(ws) >= 1 },
  { label: { pt: "Mude e salve de novo", en: "Change and save again" }, done: ws => commits(ws) >= 2 },
  { label: { pt: "Visite o passado", en: "Visit the past" }, done: (ws, p) => p.visitedPast || detached(ws) },
  { label: { pt: "Volte ao presente", en: "Come back to the present" }, done: (ws, p) => p.visitedPast && !detached(ws) },
];

export const currentStep = (ws: Workspace, p: Progress) => STEPS.findIndex(s => !s.done(ws, p));

// Falas por passo da missão (índice = currentStep; o último vale pra missão completa).
// Sem flexão de gênero: a Lena e o Dudu ouvem a mesma coisa.
const LINES: Record<"pt" | "en", string[][]> = {
  pt: [
    [
      "Olá! Eu sou a Professora Commit. Que bom ter você em Commitia!",
      "Esta vila esqueceu tudo o que já foi. Nenhum momento dela está guardado.",
      "Vamos dar uma memória a ela. Aperte G pra abrir o grimório e digite: git init",
    ],
    [
      "O primeiro passo é dar uma memória à vila.",
      "Aperte G pra abrir o grimório e digite: git init",
    ],
    [
      "Agora a vila tem um repositório! Ele vai lembrar de cada momento que você salvar.",
      "Construa algo: pare de frente pro lote vazio (o cercado de corda) e aperte Espaço. Apertar de novo troca a casa.",
    ],
    [
      "Viu as casas piscando? São mudanças que o Git ainda não guardou. Confira com git status.",
      "Escolha o que vai entrar no próximo save com git add. Experimente: git add .",
    ],
    [
      "Verde! Está no staging: a área de preparação, esperando o save.",
      "Agora guarde o momento: git commit -m \"minha primeira casa\"",
    ],
    [
      "Momento salvo pra sempre! Cada commit é uma foto da vila inteira.",
      "Mude mais alguma coisa e faça outro commit.",
    ],
    [
      "Duas lembranças! Veja todas com git log --oneline.",
      "Agora a mágica: copie o código do primeiro commit e viaje até ele com git switch --detach <código>",
    ],
    [
      "Você está no passado! A vila está exatamente como era naquele commit.",
      "Aqui é só pra olhar. Pra voltar ao presente: git switch main",
    ],
    [
      "Você aprendeu o coração do Git: mudar, preparar com add, salvar com commit e viajar no tempo.",
      "O Ato 1 está completo. Logo vem o Ato 2!",
    ],
  ],
  en: [
    [
      "Hello! I'm Professor Commit. So glad to have you in Commitia!",
      "This village has forgotten everything it ever was. Not a single moment is saved.",
      "Let's give it a memory. Press G to open the spellbook and type: git init",
    ],
    [
      "The first step is giving the village a memory.",
      "Press G to open the spellbook and type: git init",
    ],
    [
      "Now the village has a repository! It will remember every moment you save.",
      "Build something: face the empty lot (the one roped off) and press Space. Press again to swap the house.",
    ],
    [
      "See the houses blinking? Those are changes Git hasn't saved yet. Check with git status.",
      "Pick what goes into the next save with git add. Try: git add .",
    ],
    [
      "Green! It's in the staging area, waiting for the save.",
      "Now keep this moment: git commit -m \"my first house\"",
    ],
    [
      "Saved forever! Every commit is a snapshot of the whole village.",
      "Change something else and make another commit.",
    ],
    [
      "Two memories! See them all with git log --oneline.",
      "Now the magic: copy the code of the first commit and travel to it with git switch --detach <code>",
    ],
    [
      "You're in the past! The village is exactly as it was in that commit.",
      "This is just for looking. To come back to the present: git switch main",
    ],
    [
      "You learned the heart of Git: change, stage with add, save with commit and travel in time.",
      "Act 1 is complete. Act 2 is coming soon!",
    ],
  ],
};

export function professora(ws: Workspace, p: Progress, lang: "pt" | "en" = "pt"): string[] {
  const lines = LINES[lang];
  const step = currentStep(ws, p);
  return lines[step < 0 ? lines.length - 1 : step];
}

// "Próximo passo" do grimório, escrito pra quem nunca usou Git: o que fazer, em palavras simples,
// e o comando pronto pra preencher (o botão Usar põe no campo; __ marca a parte que a pessoa escreve).
export type Hint = { text: string; cmd?: string };
const HINTS: Record<"pt" | "en", Hint[]> = {
  pt: [
    { text: "Feche o grimório e fale com a Professora Commit (fique de frente pra ela e aperte Espaço)." },
    { text: "Crie o repositório: é o que faz o Git começar a cuidar da vila.", cmd: "git init" },
    { text: "Feche o grimório, fique de frente pro lote vazio (o cercado de corda) e aperte Espaço pra construir." },
    { text: "Separe as mudanças pro próximo save. O ponto quer dizer \"tudo que mudou\".", cmd: "git add ." },
    { text: "Salve o momento. Troque o texto entre aspas por uma frase sua sobre o que mudou.", cmd: 'git commit -m "__"' },
    { text: "Troque uma casa (Espaço num lote), depois repita: git add . e git commit -m \"sua frase\".", cmd: "git add ." },
    { text: "Veja a lista de saves. Depois toque no código do PRIMEIRO save (o de baixo) pra viajar até ele.", cmd: "git log --oneline" },
    { text: "Você está no passado. Pra voltar ao presente:", cmd: "git switch main" },
    { text: "Ato 1 completo! Experimente à vontade: status, log e diff só olham, não mudam nada." },
  ],
  en: [
    { text: "Close the spellbook and talk to Professor Commit (face her and press Space)." },
    { text: "Create the repository: this makes Git start looking after the village.", cmd: "git init" },
    { text: "Close the spellbook, face the empty lot (the roped one) and press Space to build." },
    { text: "Set your changes aside for the next save. The dot means \"everything that changed\".", cmd: "git add ." },
    { text: "Save this moment. Replace the text between quotes with your own sentence about the change.", cmd: 'git commit -m "__"' },
    { text: "Swap a house (Space on a lot), then repeat: git add . and git commit -m \"your sentence\".", cmd: "git add ." },
    { text: "See the list of saves. Then tap the code of the FIRST save (the bottom one) to travel to it.", cmd: "git log --oneline" },
    { text: "You're in the past. To come back to the present:", cmd: "git switch main" },
    { text: "Act 1 complete! Play around: status, log and diff only look, they never change anything." },
  ],
};

export function nextHint(ws: Workspace, p: Progress, lang: "pt" | "en"): Hint {
  const step = currentStep(ws, p);
  return HINTS[lang][step < 0 ? HINTS[lang].length - 1 : step];
}
