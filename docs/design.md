# Commitia · documento de design

> Um jogo de navegador pra aprender **Git inteiro**, do `init` ao `bisect`, onde o repositório é um mundo vivo que você vê mudar a cada comando.

## A ideia central

O que torna Git difícil é que ele é invisível: você digita comandos e não vê o que aconteceu. Aqui, **o conteúdo do repositório é um pequeno mundo em pixel art** (uma vila, uma ilha). Cada arquivo é uma parte do mundo (`ceu.txt`, `casas.txt`, `rio.txt`), e o conteúdo dele é desenhado na tela.

- Fez `commit`? O momento fica salvo na linha do tempo.
- Fez `switch` pra um commit antigo? **O mundo volta a ser como era.**
- Criou uma branch? Agora existem dois mundos paralelos.
- Conflito de merge? Os dois mundos pintaram a mesma casa de cores diferentes, e você escolhe.
- `reset --hard`? Você vê as casas sumirem. `reflog`? Você as traz de volta.

É isso que nenhum concorrente faz: o learnGitBranching mostra só o grafo, sem o conteúdo. Aqui você vê **o que** cada commit guarda, não só que ele existe.

## Direção visual

**RPG de vista de cima, estilo 16-bit** (Pokémon GBA, Zelda Minish Cap, Stardew). O jogador já conhece essa linguagem e sobra atenção pra aprender Git. O "8-bit" entra pela trilha chiptune e por um **filtro Game Boy** opcional (4 tons de verde).

| Elemento conhecido | Em Commitia |
|---|---|
| Andar pela vila em grade | Cada arquivo é uma área da vila (`casas.txt`, `horta.txt`, `praca.txt`) |
| Professor Carvalho | **Professora Commit**: apresenta o jogo e dá voz ao tutor de IA |
| Ponto de save | **Pedra do Tempo**: onde se faz commit |
| Mundo da Luz / Mundo das Trevas (Zelda ALttP) | **Branches**: trocar de branch troca a paleta do mundo, com transição de portal |
| "Um Pokémon selvagem apareceu!" | **"Um CONFLITO selvagem apareceu!"**: conflito de merge como tela de batalha (manter o meu / o deles / os dois) |
| Pokédex | **Gitdex**: comandos colecionados |
| Insígnias de ginásio | Uma insígnia por ato |

O terminal fica embaixo da tela como o grimório do personagem: é onde se digitam os comandos de verdade.

**Ferramentas:** Phaser 4 (MIT) · mapas no Tiled · arte e som do Ninja Adventure Asset Pack (CC0) · sprites próprios no Piskel · referência de UI estilo Pokémon: `devshareacademy/monster-tamer` (MIT).

## A tela (protótipo v0, antes da direção visual acima)

```
┌──────────────────────────┬────────────────────────┐
│   O MUNDO (pixel art)    │   LINHA DO TEMPO       │
│   = working directory    │   grafo de commits,    │
│                          │   branches, HEAD,      │
│                          │   remoto (origin)      │
├──────────┬───────────────┼────────────────────────┤
│ MODIFICADO│  STAGING     │  TERMINAL              │
│ (vermelho)│  (verde)     │  > git add casas.txt   │
│           │              │  > git commit -m "..." │
└──────────┴───────────────┴────────────────────────┘
```

As **três áreas do Git** (working directory, staging, repositório) ficam sempre visíveis. O jogador vê o arquivo pulando de uma pra outra a cada `add`, `commit` e `restore`.

## Por que prende

1. **História com algo em jogo:** você herda um projeto abandonado (a vila) e precisa reconstruí-lo. A trama acompanha o que um dev vive de verdade: sozinho → experimentando → em equipe → desastre → mantenedor.
2. **Consequência visível:** errou o comando? O mundo mostra o estrago. E o próprio Git ensina a desfazer.
3. **Personagens:** colegas (NPCs) que dão push enquanto você trabalha, uma estagiária que apaga coisas, um rival que reescreve a história.
4. **Estrelas por eficiência:** cada desafio tem um "par" de comandos (como no golfe). Dá pra rejogar até fazer no par.
5. **Grimório:** cada comando aprendido vira uma carta colecionável, que acaba formando a sua colinha de Git.
6. **Modo livre:** um sandbox com todos os comandos, pra experimentar sem medo.

## Escolha de personagem

Antes do Ato 1, uma tela de escolha com 4 personagens (sprite de caminhada + retrato pro diálogo):

1. **A Helena** (padrão): pele caramelo, cabelo longo cacheado castanho-escuro com orelhinhas de gato que saem do próprio cabelo, jardineira rosa pastel sobre camiseta azul-clara (referência: `art/ref/helena-ref.jpg`).
2. **O aventureiro de boné** (já existe: `art/clean/jogadora-andando.png`).
3. e 4. a definir.

A escolha fica salva no progresso e muda o sprite, o retrato e o nome nas falas.

## Currículo: Git inteiro em 8 atos

| Ato | Tema | Comandos | Momento da história |
|---|---|---|---|
| 1 | Primeiro save | `init`, `status`, `add`, `commit`, `log` | Você chega à vila vazia e ergue a primeira casa |
| 2 | Máquina do tempo | `diff`, `show`, `switch --detach`, `restore`, HEAD destacado | Visita a vila no passado, sem estragar o presente |
| 3 | Mundos paralelos | `branch`, `switch`, `merge` (fast-forward e 3-way) | Testa uma ponte nova sem arriscar a vila |
| 4 | Conflito | conflito de merge, marcadores, resolução | Dois construtores mexeram na mesma casa |
| 5 | Desfazer | `restore --staged`, `reset` (soft/mixed/hard), `revert`, `commit --amend`, `reflog` | A estagiária apaga metade da vila |
| 6 | Reescrever | `stash`, `cherry-pick`, `rebase`, `rebase -i` (squash, reword, drop) | Organiza a bagunça antes de mostrar pro conselho |
| 7 | Equipe | `clone`, `remote`, `fetch`, `pull`, `push`, push rejeitado, fluxo de PR | Outros construtores entram e todos mexem ao mesmo tempo |
| 8 | Detetive | `log -S`, `log --oneline --graph`, `blame`, `bisect`, `tag` | Algo quebrou a ponte, há 40 commits: quem foi? |
| Final | Incidente | tudo junto, contra o relógio | A vila tem que estar pronta pro festival |

Cada ato tem 1 missão-tutorial (guiada), 3 a 5 desafios (com par de comandos e estrelas) e desbloqueia os comandos dele no modo livre.

## Tutor (IA com propósito)

Quando o jogador erra ou trava, um tutor recebe o **estado real** (último comando, mensagem de erro, grafo, as três áreas) e explica em 2 ou 3 frases o que aconteceu e por quê. Ele não entrega a resposta, dá uma pista. A IA só interpreta: o motor do Git é a fonte da verdade.

## Técnica

- **Motor de Git próprio em TypeScript**, o coração do portfólio: objetos endereçados por hash (blob, tree, commit), index, refs, HEAD, reflog, remoto simulado, merge de 3 vias com detecção de conflito. É puro, sem interface, e coberto por testes.
- **Parser de comandos** com a sintaxe e as mensagens de erro reais do Git (em PT-BR, com o termo original entre parênteses).
- **Fases em JSON:** estado inicial, objetivo (um predicado sobre o estado), par de comandos, falas.
- **Interface:** Vite + TypeScript + Phaser 4 (mundo, personagens, transições, shaders de paleta); grafo, áreas e terminal em HTML/SVG sobre o canvas.
- **Tutor:** um endpoint mínimo em Node chamando a Claude API; a chave fica no servidor.
- **Docker:** um container serve o build estático e o endpoint do tutor; sobe com um comando.
- **Progresso** salvo no localStorage.

## Fora da v1

Contas, ranking online, editor de fases, multiplayer real, Git de verdade (o motor é simulado de propósito: é seguro, roda no navegador e é visual).

## Marcos

- `v0.1` Motor de Git: init/add/commit/log/status/diff + testes
- `v0.2` Interface: terminal + três áreas + grafo, sandbox jogável
- `v0.3` Mundo pixel art ligado ao conteúdo dos arquivos + Atos 1 e 2
- `v0.4` Branches, merge e conflito (Atos 3 e 4)
- `v0.5` Desfazer e reescrever (Atos 5 e 6)
- `v0.6` Remoto e equipe com NPCs (Ato 7)
- `v0.7` Detetive + final (Ato 8)
- `v0.8` Tutor IA
- `v1.0` Polimento, README com GIF, deploy
