# Curso Completo de Git

Um guia de referência do zero ao avançado — conceitos, comandos, notações e convenções padrão do mercado.

---

## Módulo 0 — O que é Git e o que é GitHub (não são a mesma coisa)

**Git** é um *sistema de controle de versão distribuído*. Roda na sua máquina, é um programa, e sua função é: guardar o histórico de todas as versões dos seus arquivos, permitir voltar no tempo, criar ramificações (branches) de trabalho paralelo, e depois juntar tudo de novo.

**GitHub** é um *serviço online* (site) que hospeda repositórios Git na nuvem e adiciona funcionalidades sociais/colaborativas em cima: Pull Requests, Issues, Actions (automação), páginas de projeto, etc. Existem concorrentes do GitHub que também hospedam Git: GitLab, Bitbucket, Codeberg.

Analogia: Git é o motor do carro. GitHub é a estrada, o posto de gasolina e a garagem compartilhada. Dá pra usar Git sem nunca tocar em GitHub (times pequenos, uso local). Mas GitHub sempre depende de Git por baixo.

---

## Módulo 1 — Instalação e configuração inicial

### 1.1 Instalar
- Windows/Mac/Linux: https://git-scm.com/downloads
- Confirmar instalação: `git --version`

### 1.2 Configuração de identidade (feita uma vez por máquina)
```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu-email@exemplo.com"
```
O `--global` aplica a configuração pra todos os repositórios da sua máquina. Sem `--global`, vale só pro repositório atual.

### 1.3 Ver configurações atuais
```bash
git config --list
```

### 1.4 Editor padrão (opcional, mas recomendado)
```bash
git config --global core.editor "code --wait"
```
Isso faz o VS Code abrir quando o Git precisar que você escreva algo (ex: mensagem de commit longa).

---

## Módulo 2 — Conceitos fundamentais (entenda isso e o resto flui)

Git trabalha com **três áreas** dentro de um repositório:

```
Working Directory  →  Staging Area (Index)  →  Repository (.git)
   (seus arquivos)      (git add)                 (git commit)
```

- **Working Directory**: a pasta do projeto como você vê no VS Code, com arquivos editados.
- **Staging Area** (ou *index*): uma "zona de espera". Você escolhe *quais* mudanças vão entrar no próximo commit usando `git add`. Isso permite commitar só parte do que você mexeu.
- **Repository**: o histórico permanente. `git commit` pega o que está na Staging Area e cria um "snapshot" (retrato) permanente, com um ID único (hash).

Outros termos essenciais:
- **Commit**: um snapshot do projeto num momento, com mensagem, autor, data e um hash (ex: `a1b2c3d`).
- **HEAD**: um ponteiro que indica "onde você está agora" — normalmente aponta pro último commit da branch atual.
- **Branch**: uma linha de desenvolvimento paralela. É literalmente um ponteiro móvel para um commit.
- **Remote**: uma cópia do repositório hospedada em outro lugar (ex: GitHub). O nome padrão do remoto principal é `origin`.
- **Clone**: copiar um repositório remoto inteiro pra sua máquina.

---

## Módulo 3 — Comandos do dia a dia

### 3.1 Criar ou obter um repositório
```bash
git init                    # transforma a pasta atual num repositório Git novo
git clone <url>              # baixa um repositório existente do GitHub/etc.
```

### 3.2 Ver o estado atual
```bash
git status
```
Mostra: arquivos modificados, arquivos novos (não rastreados), o que está na staging area. **Use isso o tempo todo** — é o comando mais importante do dia a dia.

### 3.3 Adicionar mudanças à staging area
```bash
git add nome-do-arquivo.js   # adiciona um arquivo específico
git add pasta/               # adiciona uma pasta inteira
git add .                    # adiciona TUDO que mudou na pasta atual pra baixo
git add -p                   # modo interativo: escolhe pedaço por pedaço (hunks)
```

### 3.4 Criar um commit
```bash
git commit -m "mensagem curta"
git commit -m "título" -m "descrição mais longa em outra linha"
git commit -am "mensagem"    # combina add + commit, MAS só pra arquivos já rastreados (não pega arquivos novos)
```

### 3.5 Ver histórico
```bash
git log                      # histórico completo
git log --oneline            # uma linha por commit (enxuto)
git log --oneline --graph --all   # visual, com ramificações
git log -p                   # mostra o diff de cada commit
git log --author="Nome"      # filtra por autor
```

### 3.6 Ver diferenças
```bash
git diff                     # o que mudou no working directory vs staging
git diff --staged            # o que está na staging area vs último commit
git diff <commit1> <commit2> # diferença entre dois commits
```

### 3.7 Ver detalhes de um commit
```bash
git show <hash-do-commit>
```

---

## Módulo 4 — `.gitignore`: o que o Git deve ignorar

Arquivo de texto na raiz do projeto, chamado exatamente `.gitignore`. Cada linha é um padrão do que **não** deve ser rastreado.

### Notação/padrões (glob patterns)
```gitignore
node_modules/        # ignora a pasta inteira
*.log                 # ignora todo arquivo terminado em .log
.env                  # ignora arquivo específico
.env.*                # ignora .env.local, .env.production, etc.
/dist                 # ignora "dist" só na raiz (a barra no início ancora)
temp/*                # ignora conteúdo de temp/, mas não a pasta em si
!temp/manter.txt       # exceção: NÃO ignora esse arquivo específico
**/logs               # ignora "logs" em qualquer nível de profundidade
```

### Importante
- `.gitignore` só funciona pra arquivos que **ainda não foram commitados**. Se um arquivo já está sendo rastreado, adicionar ele no `.gitignore` não remove ele do histórico (veja Módulo 12 pra isso).
- Sempre crie o `.gitignore` **antes** do primeiro `git add .`.
- Existem templates prontos por linguagem/framework em https://github.com/github/gitignore

---

## Módulo 5 — Branches (ramificações)

Branch = uma linha de trabalho independente. A branch padrão hoje em dia se chama `main` (antigamente era `master`).

### 5.1 Comandos básicos
```bash
git branch                       # lista branches locais (a atual tem um *)
git branch -a                    # lista também as branches remotas
git branch nome-da-branch        # cria uma branch nova (sem mudar pra ela)
git checkout nome-da-branch       # muda pra outra branch
git checkout -b nome-da-branch    # cria E já muda pra ela (atalho mais usado)
git switch nome-da-branch         # forma mais nova de trocar de branch (substitui checkout nesse uso)
git switch -c nome-da-branch      # cria e muda (equivalente ao checkout -b)
git branch -d nome-da-branch      # deleta branch (só se já foi mesclada)
git branch -D nome-da-branch      # força deleção (mesmo sem merge)
```

### 5.2 Nomenclatura padrão de branches (convenção de mercado)
Não existe uma regra única obrigatória, mas o padrão mais adotado é:
```
feature/nome-da-funcionalidade     → feature/sistema-de-turnos
fix/nome-do-bug                    → fix/modal-nao-fecha
bugfix/nome-do-bug                 → alternativa a "fix/"
hotfix/nome-urgente                → correção urgente direto em produção
release/1.2.0                      → preparação de uma versão
docs/nome                          → mudanças só de documentação
chore/nome                         → tarefas de manutenção (configs, dependências)
refactor/nome                      → refatoração sem mudar comportamento
```
Regras de estilo:
- tudo em **minúsculas**
- palavras separadas por **hífen** (`kebab-case`), nunca espaço
- nomes curtos e descritivos: `feature/login-google`, não `feature/coisa-nova-que-eu-fiz-ontem`

### 5.3 Mesclar (merge)
```bash
git checkout main
git merge feature/sistema-de-turnos
```
Isso traz as mudanças da branch `feature/sistema-de-turnos` pra dentro de `main`.

---

## Módulo 6 — Merge vs Rebase

Dois jeitos diferentes de juntar o trabalho de uma branch em outra.

### Merge
```bash
git checkout main
git merge feature/x
```
Cria um **novo commit de merge** que junta os dois históricos. Preserva a história exatamente como aconteceu (com os desvios). Mais seguro, histórico mais "real", mas pode ficar visualmente confuso com muitos merges.

### Rebase
```bash
git checkout feature/x
git rebase main
```
Pega os commits da sua branch e os "reaplica" em cima do último estado de `main`, como se você tivesse começado a trabalhar a partir dali. Resultado: histórico **linear**, sem commits de merge extras. Mais limpo, mas **reescreve o histórico** — nunca use rebase em branches que já foram compartilhadas/enviadas pra outras pessoas, só na sua branch local antes de dar push.

Regra prática amplamente usada: *"rebase local, merge para compartilhar"*.

---

## Módulo 7 — Resolvendo conflitos de merge

Um conflito acontece quando duas branches mudaram a **mesma linha** de um arquivo de jeitos diferentes. O Git não sabe qual manter e para o processo, marcando o arquivo assim:

```
<<<<<<< HEAD
código da branch atual (onde você está)
=======
código da branch que você está trazendo
>>>>>>> feature/x
```

### Passo a passo pra resolver
1. Abra o arquivo (o VS Code já destaca visualmente os conflitos, com botões "Accept Current/Incoming/Both").
2. Edite manualmente deixando só o código correto, removendo `<<<<<<<`, `=======`, `>>>>>>>`.
3. Salve o arquivo.
4. `git add nome-do-arquivo` (marca como resolvido).
5. `git commit` (finaliza o merge) — se foi rebase, use `git rebase --continue`.

### Para cancelar e voltar atrás
```bash
git merge --abort      # cancela um merge em andamento
git rebase --abort      # cancela um rebase em andamento
```

---

## Módulo 8 — Trabalhando com repositórios remotos (GitHub)

### 8.1 Conectar um repositório local a um remoto
```bash
git remote add origin https://github.com/usuario/repo.git
git remote -v                    # lista os remotos configurados
```

### 8.2 Enviar mudanças (push)
```bash
git push origin main             # envia a branch main pro remoto "origin"
git push -u origin main          # -u salva essa combinação como padrão
git push                         # depois do -u, basta isso
```

### 8.3 Trazer mudanças (pull e fetch)
```bash
git fetch origin        # baixa as mudanças do remoto, mas NÃO aplica no seu código
git pull origin main     # baixa E já mescla (fetch + merge) na sua branch atual
```
Diferença importante: `fetch` é seguro (só olha o que mudou), `pull` já modifica seus arquivos locais.

### 8.4 Clonar um projeto existente
```bash
git clone https://github.com/usuario/repo.git
git clone https://github.com/usuario/repo.git pasta-nova   # clona com outro nome de pasta
```

---

## Módulo 9 — Padrão de mensagens de commit (Conventional Commits)

Esse é provavelmente o item mais perguntado sobre "nomenclatura padrão". O padrão mais adotado no mercado hoje se chama **Conventional Commits**.

### Estrutura
```
<tipo>(<escopo opcional>): <descrição curta no imperativo>

<corpo opcional — explica o "porquê", não o "o quê">

<rodapé opcional — breaking changes, referência a issues>
```

### Tipos padrão
| Tipo | Quando usar |
|---|---|
| `feat` | uma funcionalidade nova |
| `fix` | correção de bug |
| `docs` | só documentação (README, comentários) |
| `style` | formatação, espaços, ponto e vírgula — sem mudar lógica |
| `refactor` | reorganização de código sem mudar comportamento |
| `perf` | melhoria de performance |
| `test` | adicionar ou corrigir testes |
| `chore` | tarefas de manutenção (deps, configs de build, etc.) |
| `build` | mudanças no sistema de build ou dependências externas |
| `ci` | mudanças em configuração de integração contínua |
| `revert` | reverte um commit anterior |

### Exemplos reais
```
feat: adiciona sistema de matchmaking via Firestore
fix(modal): corrige modal que não fechava ao clicar fora
docs: atualiza instruções de instalação no README
refactor(board): separa lógica de renderização do estado
chore: atualiza dependências do projeto
fix: impede envio de firebase-config.js real pro repositório
```

### Regras de estilo da descrição
- **Verbo no imperativo**, como se fosse uma ordem: "adiciona", "corrige", "remove" — não "adicionado", "adicionei", "correção de".
- Primeira letra minúscula (convenção comum, mas times variam).
- Sem ponto final no título.
- Até ~50-72 caracteres no título; detalhes vão no corpo.

### Breaking changes (mudança que quebra compatibilidade)
```
feat(api)!: muda formato do payload de resposta

BREAKING CHANGE: o campo "user_id" agora se chama "userId" em todas as respostas.
```
O `!` depois do tipo/escopo e a linha `BREAKING CHANGE:` no rodapé são a notação padrão.

### Por que seguir isso?
Ferramentas automáticas (como `semantic-release`) leem essas mensagens pra gerar changelog e decidir a próxima versão automaticamente (feat = minor, fix = patch, BREAKING CHANGE = major). Ver Módulo 11 sobre versionamento.

---

## Módulo 10 — Fluxos de trabalho (Workflows)

### GitHub Flow (o mais simples, ótimo pra projetos pequenos/times ágeis)
1. `main` está sempre pronta pra produção.
2. Toda mudança nova vira uma branch (`feature/x`).
3. Ao terminar, abre-se um **Pull Request**.
4. Depois de revisão/aprovação, faz merge em `main`.
5. `main` é implantada (deploy) direto.

### Git Flow (mais estruturado, times maiores, releases programadas)
Branches fixas:
- `main` — só código em produção
- `develop` — integração do próximo release
- `feature/*` — funcionalidades, saem de `develop` e voltam pra `develop`
- `release/*` — preparação de uma versão, sai de `develop`, vai pra `main` e `develop`
- `hotfix/*` — correção urgente, sai de `main`, volta pra `main` e `develop`

### Trunk-Based Development
Todo mundo commita direto (ou com branches muito curtas, de horas) numa única branch `main`/`trunk`, com integração contínua e feature flags pra esconder funcionalidades incompletas. Comum em times com deploy contínuo.

Pra um projeto solo ou pequeno como o seu, **GitHub Flow** costuma ser suficiente e menos burocrático.

---

## Módulo 11 — Tags e Versionamento Semântico (SemVer)

### Criar tags (marcar uma versão específica)
```bash
git tag v1.0.0                       # tag simples no commit atual
git tag -a v1.0.0 -m "primeira versão estável"   # tag anotada (recomendada, guarda autor/data/mensagem)
git push origin v1.0.0                # envia UMA tag específica
git push origin --tags                # envia todas as tags
```

### Notação SemVer: `MAJOR.MINOR.PATCH`
```
v2.5.1
  │ │ └── PATCH: correção de bug, sem quebrar nada
  │ └──── MINOR: funcionalidade nova, mas compatível
  └────── MAJOR: mudança que quebra compatibilidade
```
Exemplo de evolução: `v1.0.0` → corrige um bug → `v1.0.1` → adiciona funcionalidade → `v1.1.0` → muda algo incompatível → `v2.0.0`.

---

## Módulo 12 — Desfazendo coisas

Esse é o módulo que mais gera dúvida. Existem várias formas de "desfazer", dependendo de **onde** está a mudança.

### 12.1 Desfazer mudanças não commitadas (working directory)
```bash
git checkout -- nome-do-arquivo     # descarta mudanças no arquivo (volta ao último commit)
git restore nome-do-arquivo          # forma mais nova do comando acima
```

### 12.2 Tirar um arquivo da staging area (sem perder a edição)
```bash
git reset nome-do-arquivo
git restore --staged nome-do-arquivo   # forma mais nova
```

### 12.3 Desfazer o último commit
```bash
git reset --soft HEAD~1     # desfaz o commit, mantém tudo na staging area
git reset --mixed HEAD~1    # desfaz o commit E a staging area, mantém no working directory (padrão)
git reset --hard HEAD~1     # apaga TUDO — commit, staging e as mudanças em si (cuidado, é destrutivo)
```

### 12.4 Reverter um commit já enviado (push) — forma segura pra histórico compartilhado
```bash
git revert <hash-do-commit>
```
Diferente do `reset`, o `revert` **não apaga histórico** — ele cria um novo commit que desfaz as mudanças do commit indicado. É o jeito correto de desfazer algo que já foi pro GitHub e outras pessoas já podem ter baixado.

### 12.5 Guardar mudanças temporariamente sem commitar (stash)
```bash
git stash                     # guarda as mudanças atuais numa "gaveta" e limpa o working directory
git stash list                 # lista o que está guardado
git stash pop                  # traz de volta a última gaveta e a remove da lista
git stash apply                # traz de volta mas mantém na lista
git stash drop                 # descarta uma gaveta sem aplicar
```
Muito usado quando você está no meio de uma mudança e precisa trocar de branch rapidamente sem commitar nada ainda.

### 12.6 Remover um arquivo sensível que já foi commitado (caso do seu `firebase-config.js`)
Se um arquivo sensível **já foi commitado localmente mas nunca foi enviado (push)** pro GitHub:
```bash
git rm --cached js/firebase-config.js    # remove do rastreamento, mantém o arquivo na sua pasta
git commit -m "remove firebase-config.js do rastreamento"
```
Se o arquivo **já foi enviado (push)** pro GitHub, isso sozinho não apaga do histórico — nesse caso é necessário reescrever o histórico (`git filter-repo` ou recriar o repositório). Me avise se for esse o seu caso específico que eu te passo o procedimento.

---

## Módulo 13 — Cherry-pick

Pega **um commit específico** de uma branch e aplica em outra, sem trazer o resto.
```bash
git checkout main
git cherry-pick <hash-do-commit>
```
Útil quando você quer só uma correção pontual de uma branch, sem mesclar tudo.

---

## Módulo 14 — Autenticação: HTTPS vs SSH

### HTTPS (mais simples pra começar)
Ao dar `git push`, o GitHub pede login. Hoje em dia não aceita mais senha comum — é preciso um **Personal Access Token (PAT)**:
GitHub → foto de perfil → Settings → Developer settings → Personal access tokens → Generate new token. Esse token é usado no lugar da senha.

### SSH (mais prático a longo prazo, sem digitar token toda vez)
```bash
ssh-keygen -t ed25519 -C "seu-email@exemplo.com"   # gera um par de chaves
cat ~/.ssh/id_ed25519.pub                            # copia a chave pública
```
Cole essa chave pública em GitHub → Settings → SSH and GPG keys → New SSH key. A partir daí, use a URL do repositório no formato SSH (`git@github.com:usuario/repo.git`) em vez de `https://...`.

No VS Code, a extensão do GitHub costuma cuidar da autenticação via navegador automaticamente — geralmente você nem precisa configurar token manualmente.

---

## Módulo 15 — GitHub especificamente (além do Git puro)

### Pull Request (PR)
Um pedido formal de "mescle minha branch na sua". Fluxo típico:
1. Você sobe uma branch: `git push origin feature/x`
2. No GitHub, aparece um botão "Compare & pull request"
3. Escreve título/descrição, pede revisão
4. Depois de aprovado, clica em "Merge pull request"

### Issues
Sistema de "tickets" pra reportar bugs ou planejar funcionalidades, dentro do próprio repositório.

### Fork
Uma cópia completa e independente de um repositório de outra pessoa, na sua própria conta — usado pra contribuir em projetos que você não tem permissão de escrever diretamente.

### Arquivos padrão de um repositório profissional
- `README.md` — apresentação do projeto (o que é, como instalar, como rodar)
- `LICENSE` — licença de uso do código
- `CONTRIBUTING.md` — como outras pessoas podem contribuir
- `.gitignore` — já vimos no Módulo 4
- `CHANGELOG.md` — histórico de versões (muitas vezes gerado automaticamente a partir dos commits do Módulo 9)

### GitHub Actions (automação — visão geral)
Arquivos `.yml` dentro de `.github/workflows/` que rodam tarefas automaticamente (testes, deploy) a cada push ou PR. É um tópico avançado à parte, mas vale saber que existe.

---

## Módulo 16 — Boas práticas gerais

- Commits pequenos e frequentes, cada um fazendo **uma coisa só** — facilita reverter e entender o histórico.
- Nunca commitar segredos (senhas, API keys privadas, tokens) — usar `.gitignore` desde o primeiro commit.
- Sempre rodar `git status` antes de `git add .`.
- Escrever mensagens de commit pensando em "alguém vai ler isso daqui 6 meses sem contexto nenhum".
- Uma branch por funcionalidade/correção, não trabalhar direto em `main`.
- Fazer `git pull` antes de começar a trabalhar, pra evitar divergência grande.

---

## Módulo 17 — Cheat Sheet (resumo rápido)

| Ação | Comando |
|---|---|
| Iniciar repositório | `git init` |
| Clonar | `git clone <url>` |
| Ver estado | `git status` |
| Adicionar à staging | `git add .` |
| Commitar | `git commit -m "mensagem"` |
| Ver histórico | `git log --oneline --graph` |
| Criar e trocar de branch | `git switch -c nome` |
| Trocar de branch | `git switch nome` |
| Mesclar branch | `git merge nome` |
| Enviar pro remoto | `git push` |
| Baixar do remoto | `git pull` |
| Ver diferenças | `git diff` |
| Desfazer mudança não commitada | `git restore arquivo` |
| Tirar da staging | `git restore --staged arquivo` |
| Desfazer último commit (mantém mudanças) | `git reset --soft HEAD~1` |
| Reverter commit já enviado | `git revert <hash>` |
| Guardar mudanças temporariamente | `git stash` / `git stash pop` |
| Criar tag de versão | `git tag -a v1.0.0 -m "mensagem"` |

---

## Módulo 18 — Glossário rápido

- **Hash**: identificador único de um commit (ex: `a1b2c3d`), gerado a partir do conteúdo.
- **HEAD**: onde você está agora no histórico.
- **Origin**: nome padrão do repositório remoto principal.
- **Upstream**: repositório original de onde um fork foi feito; também usado pra descrever a branch remota que uma branch local acompanha.
- **Merge conflict**: quando o Git não consegue decidir sozinho como juntar duas mudanças.
- **Fast-forward**: tipo de merge simples, quando não houve divergência — só "avança o ponteiro".
- **Detached HEAD**: estado em que você está olhando um commit específico sem estar em nenhuma branch — cuidado ao commitar nesse estado, pode "perder" o commit se trocar de branch sem salvar.

---

*Guarde este arquivo como referência. Você não precisa decorar tudo de uma vez — volte aqui sempre que precisar lembrar um comando ou convenção específica.*
