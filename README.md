# BlueNav Play

Salas por código e exigências para hospedagem: [NETWORK.md](NETWORK.md). Universe Sandbox compartilha sua simulação na sala; os outros jogos têm níveis diferentes de integração e a maioria sincroniza apenas presença e posição.

Objetivo atual: criar jogos próprios que reproduzam o melhor possível as mecânicas
de Gorilla Tag, BONELAB sandbox, Job Simulator, Pavlov VR e Beat Saber, com interface
organizada, física e controles VR precisos. O catálogo principal contém jogos BlueNav.
Esses modos ainda são protótipos, não reproduções completas dos jogos comerciais.
Arte, mapas, áudio e código comerciais não foram copiados.

Na Oficina de Trabalho, solte cada item na estação correspondente e toque no
botão: carimbe documentos, pese pacotes e encha copos. Depois solte o item na bandeja com a
etiqueta certa. Entregas sem preparo e estações erradas não contam. O modo pode
ser jogado com uma ou duas mãos.

**Praça BlueNav** (jogo social próprio, mecânicas no estilo de redes sociais VR
como Rec Room, sem nome, arte ou mapas deles): dormitório com espelho que copia
suas mãos, guarda-roupa (pele, roupa, chapéu, rosto) e garagem (4 carros, 12
pinturas, 5 adesivos). Navegador com **500 salas geradas por semente**, sempre
iguais por número: Corrida (3 voltas por anéis contra 3 carros com IA),
Paintball (3×3 com bots, primeiro a 10), Parkour (plataformas fixas e móveis,
braços estilo gorila, Espaço ou toque pula) e Encontro (praça com objetos
físicos, pista de dança, visitantes e carro para dirigir). Concluir salas dá
fichas para liberar visuais; tudo fica salvo no navegador. Em sala online, os
amigos veem seu avatar e o anfitrião escolhe a sala para todos. Relógio na
cintura volta ao dormitório ou recomeça a sala.

Atualização de 11/10/2026: catálogo com 20 jogos. Novidades:

- **Complexo**: aventura física inspirada nas mecânicas de BONEWORKS, com conteúdo
  próprio. Tem sala de descanso, museu com balança e borda para escalar, e pátio
  com inimigos ragdoll. A pistola fica na mão depois da pinça; outra pinça atira.
  Mão bem aberta solta a arma. Pince no quadril para tirar um carregador, encaixe
  na base da arma e puxe o ferrolho com a outra mão. Há cano e cassetete. Socos e
  objetos arremessados derrubam inimigos. Caixas viram escada; bordas podem ser
  escaladas com a pinça.
- **Pega-pega VR**: locomoção só com os braços, no estilo Gorilla Tag. A mão fica
  presa onde toca; o corpo se move. Ao soltar, a velocidade média vira salto
  (x1,1, até 6,5 m/s). Mapa com casa na árvore de dois andares, troncos, pedras e
  galhos. Quem pega fica cor de lava.
- **Piloto**: corrida de 3 voltas contra 3 carros, com largada por semáforo,
  posição, aderência por piso, derrapagem, batidas entre carros, muro de pneus e
  cones físicos. Carros com carroceria curva (extrusão com chanfro).
- **Ritmo de Luz**: palco no estilo dos jogos de ritmo do Quest, com lasers,
  túnel de anéis, faixas da pista e painéis de combo e multiplicador. O bloco se
  divide na direção do corte e as metades caem com física.
- **Física em todos os jogos**: objetos soltos temáticos (barris, potes que
  quebram, latas, cocos, pedras, troncos, frutas, dados). Eles colidem com os
  móveis do próprio jogo, são empurrados pela mão, pegos com a pinça de perto e
  atingidos por balas e flechas. Corpos redondos colidem como esferas.
- **Geometria arredondada**: toda caixa alinhada vira caixa com bordas
  arredondadas, exceto em Mundo de Blocos e Reinos, que são de cubos.

Atualização VR de 10/10/2026: catálogo com 19 jogos, incluindo Laboratório Sandbox,
Oficina de Trabalho e Treino Tático VR. A biblioteca curva usa três páginas de
até nove jogos, para manter os alvos maiores e legíveis em VR.

Joystick esquerdo anda nos jogos com caminhada; direito gira 30°. Um controle
WebXR sozinho também permite andar. VR Box: pareie o controle no Bluetooth do
aparelho; modo gamepad usa joystick/A, modo teclado usa ↑/↓ para andar, ←/→ para
girar e Enter para selecionar. Compatibilidade real depende do controle/navegador.

Mãos nativas WebXR alimentam os jogos quando o runtime fornece juntas. VR Box
mantém tracking por câmera. Ainda falta validar headset e controle físicos.

Ajustes rápidos → Objetos físicos oferece bancada de pegar, lançar e empilhar
em qualquer jogo. Novos modos, bola do laboratório e dados usam física compartilhada.
Isso não transforma todas as malhas antigas em colliders: a migração por jogo
continua pendente. Texturas de materiais móveis têm até 128 px.

Testes: `npm.cmd test`, `node tests/menu-touch.mjs`, `node tests/vrbox-flow.mjs`
e `node tests/upgrade-flow.mjs`. Testes de navegador exigem servidor local em
`127.0.0.1:8080` e Chrome no caminho definido nos scripts.

Estado detalhado, limitações e prompt de continuidade: [CLAUDE_HANDOFF.md](CLAUDE_HANDOFF.md).
No Claude Code aberto nesta pasta, `/continue-vr` lê esse repasse.

## VR Box: música, mãos e acessos

- Na tela inicial, **Ritmo de Luz · escolher música** entra em tela dividida e abre o seletor. Escolha uma faixa sintetizada ou arquivo local MP3/WAV/OGG compatível, até 25 MB e 5 minutos. Para usar um mapa Beat Saber v2/v3 ou os elementos básicos de v4, selecione primeiro o `.dat` (até 2 MB), informe o BPM inicial e depois selecione o áudio correspondente. Um mapa v2/v3 com evento de BPM no beat 0 dispensa o campo manual; mudanças posteriores ajustam notas, bombas e paredes. Em v4, informe o BPM manualmente porque o arquivo separado de dados de áudio ainda não é lido. Arquivos ficam no aparelho. Sem mapa, informe o BPM se a geração automática não acompanhar as batidas. O controle de sincronização adianta ou atrasa os blocos em até 200 ms. Há modos Fácil, Normal e Expert.
- Ritmo de Luz é jogo próprio de sabres: blocos com setas, cortes por movimento, duas cores, pares de notas no Expert, combo, bombas, paredes e pausa. É inspirado no gênero de Beat Saber; não inclui o jogo ou músicas comerciais. Vermelho corresponde à esquerda e azul à direita. Se houver uma mão, ela corta as duas cores. O corte usa o movimento do trecho da lâmina que tocou o bloco. Paredes de agachar e paredes de altura livre usam suas dimensões no colisor. Em VR Box com mãos, desvie com a mão; sem mãos rastreadas, paredes não causam dano inevitável ao ponteiro de olhar. Em headset 6DoF, desvie com a cabeça. Mapas importados ainda usam colisores e pontuação aproximados, sem suporte a todos os tipos de nota.
- A ajuda do Ritmo de Luz aparece na contagem regressiva e recolhe no início dos cortes para liberar a pista. O aviso de acerto, erro ou obstáculo aparece acima da pista; o botão `?` reabre a ajuda.
- As mãos virtuais acompanham MediaPipe; selecionar, arrastar, tocar com indicador, gesto de palma para menu e recentralização seguem convenções próximas ao Meta. Webcam monocular não tem a precisão ou a profundidade dos sensores de um Quest. Use HTTPS, boa iluminação e mantenha as mãos no campo de visão da câmera traseira.
- A barra universal tem **Jogos externos** e **Security**. Esses painéis usam toque na tela; configure antes de colocar os óculos. A simulação e as seleções da cena pausam enquanto o painel está aberto.
- YouTube tem busca, catálogo e **Abrir link** (link HTTPS ou ID de vídeo). A reprodução é um painel 2D duplicado para os olhos no VR Box; não é projeção imersiva de vídeo 360°/180°. A referência TikTok indicada não pôde ser acessada; a interface é própria, sem alegação de cópia exata.
- Ao escolher um vídeo, o player oficial incorporado aparece **dentro da janela flutuante**, com perspectiva e posição sincronizadas à janela em cada olho. A barra inferior permite arrastar por pinça; os botões virtuais controlam assistir/pausa, ±10 segundos, volume e parar. Minimizar esconde o player e permite voltar pelo dock. Não há camada de reprodução ocupando a tela inteira. No VR Box há um iframe por olho e apenas um com som. O navegador ainda pode exigir autorização de som por um toque real antes de colocar os óculos; a API não contorna essa regra. Vídeos privados, removidos ou com incorporação desativada pelo autor não podem ser reproduzidos aqui. Fechar remove os iframes e interrompe o som.

### Caminhada e melhorias comuns aos jogos

Nos jogos com caminhada (Início, Selva, Arena, Reinos, Masmorra, Sobrevivência, Mundo de Blocos e topo da Escalada), feche a mão esquerda por 0,3 segundo para andar na direção horizontal do olhar, a 0,85 m/s. Abra para parar. Com uma mão só, ela assume essa função. Pinça, mão apontando, mão sobre UI e rastreamento de baixa confiança não são comandos de caminhada. Após abrir menus, perder a mão ou pausar, abra a mão antes de voltar a caminhar. Há verificação de caminho e margem lateral para reduzir atravessamento de obstáculos. Apontar para o chão não aciona teleporte por padrão; no Mundo de Blocos, **Teleporte** é uma ferramenta opcional selecionada na barra.

Os 19 jogos usam pausa global para menus/janelas e um relógio de simulação que não avança durante a pausa. Arrastos de objetos são soltos ao pausar. O HUD tem reinício rápido (ícone de seta circular) e ajuda **?**; a ajuda inicial recolhe após 12 segundos. Recursos compartilhados são liberados uma vez, e fechar janelas libera suas geometrias e texturas. As melhorias comuns são de interação, pausa, navegação e manutenção; corrida, natação e escalada mantêm lógica própria.

### Compatibilidade dos jogos externos

| Jogo/projeto | O que o BlueNav oferece | Requisito/limitação |
|---|---|---|
| Roblox | Site e configuração oficial | Cliente móvel normal; VR requer dispositivo/runtime compatível |
| [Roblox-VR-with-Webcam](https://github.com/mmbaguette/Roblox-VR-with-Webcam) | Projeto investigado, sem código importado | Python no PC, servidor e experiência Roblox R15 preparada; anima poses, não fornece VR estereoscópico no celular |
| [sauceVR](https://github.com/saucekid/sauceVR) | Projeto investigado, sem código importado | README exige executor de scripts e controles VR; não é driver para VR Box |
| Rec Room | Site oficial para verificar clientes disponíveis | Não executa dentro do navegador BlueNav |
| VRChat | Site oficial | Android e clientes VR têm requisitos distintos; sem ponte de mãos do BlueNav |
| [Vivecraft](https://github.com/Vivecraft/VivecraftMod) | Site do mod e repositório | Minecraft Java no PC; não é mod do Minecraft móvel |
| Mundo de Blocos | Jogo próprio em VR Box, dentro do BlueNav | Não é Minecraft e não executa mods do Minecraft |

### BlueNav Security

Diagnóstico local de contexto seguro, câmera e uso do Gemini. O assistente de IA recebe somente a pergunta digitada e uma instrução para atender temas de segurança digital e física em VR. A consulta é enviada ao Gemini apenas ao tocar em **Perguntar**; fechar o painel cancela a requisição. Não é antivírus, não executa comandos e não garante que a IA sempre respeite a restrição temática.

As chaves em `config.js` foram mantidas por decisão do proprietário. São públicas para qualquer visitante: restrinja a chave do YouTube por domínio e API, configure cotas e monitore uso no provedor. Calibração Gemini das mãos é uma função separada e envia pontos de rastreamento quando habilitada.

### Verificação

`npm install` e `npm test` verificam gestos, colisões, mapas e integrações. No Windows com política de PowerShell restritiva, use `npm.cmd`. Para os testes de navegador, inicie `python -m http.server 8080 --bind 127.0.0.1` e execute `node tests/vrbox-flow.mjs`. O fluxo usa WAV local e resposta Gemini simulada; não valida disponibilidade da chave, câmera real ou desempenho no celular. `node tests/render-audit.mjs current mobile` verifica renderização dos 19 jogos com Chromium/SwiftShader, sem medir FPS de aparelho real.

Ruflo foi inicializado localmente em modo mínimo; seus dados de execução ficam fora do Git. Não há swarm, agentes ou serviços Ruflo necessários para rodar o site.

Teste adicional do YouTube: `node tests/youtube-player.mjs` verifica a integração com a API simulada; `node tests/youtube-player.mjs --real` tenta reprodução real e relata estado e tempo. O teste real do Gemini retornou HTTP 401 com a chave mantida: a consulta de IA depende de corrigir a autenticação no provedor; os diagnósticos locais funcionam sem ela.

Realidade virtual no navegador (WebXR + WebGL/Three.js). Não precisa instalar nada nem de servidor próprio.

## Como rodar

Os módulos JavaScript exigem um endereço `http(s)://`. Abrir o arquivo direto (`file://`) não funciona.

```bash
python -m http.server 8080
# abra http://localhost:8080
```

No celular, a câmera e o giroscópio só funcionam com **HTTPS**. Você pode publicar a pasta no GitHub Pages, Netlify ou Cloudflare Pages, ou usar um túnel como `npx localtunnel --port 8080`.

## Modos

- **WebXR**: óculos como Quest e Pico. Os controles e o rastreamento de mãos do próprio óculos viram o ponteiro.
- **Óculos de papelão / VR Box / Shinecon**: tela dividida com giroscópio. A câmera traseira rastreia as mãos.
- **Tela normal**: clique = pinça · botão direito arrasta a visão · WASD anda · Shift + apontar para o chão = teleporte · M = menu · F2 = depuração.

## Mundo real (passthrough)

No modo óculos de celular, a câmera traseira mostra o mundo real no Início, com o menu aberto e com o YouTube ou o teclado abertos, como no Quest. Dentro de um jogo, abrir o menu ou o YouTube pausa o jogo e mostra o ambiente real. O botão com ícone de olho na barra do menu liga e desliga. A câmera é a mesma usada no rastreamento das mãos.

## Duas mãos

Cada mão tem raio, cursor e clique próprios, e as duas podem usar menus e jogos ao mesmo tempo. Se só uma mão aparecer, ela faz tudo sozinha.

| Jogo | Duas mãos | Uma mão |
|---|---|---|
| Complexo | arma numa mão; a outra pega carregador e puxa o ferrolho | arma; botão Recarregar |
| Piloto | gire o volante com as duas | mão para os lados |
| Pega-pega VR | empurre o chão e os troncos alternando os braços | empurre com uma mão |
| Escalada | agarre com uma e depois com a outra para subir | pince e puxe |
| Arena | espada na direita, escudo na esquerda | espada; o escudo flutua |
| Arqueiro | esquerda segura o arco, direita puxa a corda | pince e puxe para trás |
| Ritmo de Luz | duas esferas; a cor da mão vale bônus | uma esfera |
| Reinos / Blocos | direita coloca, esquerda quebra | botão de modo |
| Masmorra / Noite | tocha (ou lanterna) numa mão, a outra aponta para andar | tudo na mesma mão |
| Galáxia | duas armas | uma arma |
| Quebra-cabeça | uma peça em cada mão; pince o vazio com as duas para girar | uma peça |
| Mergulho | braçadas com as mãos abertas | braçada ou pince e puxe |
| Cozinheiro | faca na direita, colher na esquerda | tudo na mesma mão |
| Sala de Jogos / Física | cada mão pega um objeto | um objeto |

## Gestos (iguais aos do Meta Quest)

| Gesto | O que faz |
|---|---|
| Apontar o raio + pinçar e soltar | Selecionar (o clique acontece ao soltar, em cima do alvo) |
| Pinçar, segurar e arrastar | Rolar listas e mover janelas (pela barra embaixo da janela) |
| Indicador esticado sobre o botão + empurrar | Clique com o dedo |
| Encostar a ponta do indicador no botão | Toque direto (poke) |
| Olhar a palma + pinçar | Abre/fecha o menu (barra universal + Biblioteca) |
| Olhar a palma + pinçar e segurar 1s | Recentraliza a visão |
| Fechar a mão esquerda (ou a única mão) | Caminhar na direção do olhar; abrir para parar |

O raio parte sempre da ponta do indicador, inclusive com mão aberta ou durante a pinça. A direção segue a linha do olho até essa ponta. A linha visual usa a mesma origem e direção do raio de seleção. O anel do cursor se fecha conforme a força da pinça. O clique por tempo (0,65s) só vale para quem usa o olhar no papelão, sem câmera.

O contorno da mão acompanha o exoesqueleto rastreado: uma superfície para a palma e volumes para os dedos. O material é fosco, sem reflexo especular ou brilho de pinça, com opacidade fixa de 13% (87% de transparência). A forma é uma aproximação geométrica baseada nas articulações, não uma segmentação exata dos pixels da câmera.

Para testar sem câmera, use `?auto=flat&fakehand=palm` (ou `point` / `pinch`).

Cada jogo mostra guia com comandos para uma ou duas mãos e estado dos gestos. O botão **?** mostra/esconde a ajuda. Azul indica alvo; verde confirma clique. Perda de rastreamento pausa a simulação e impede cliques. No Ritmo de Luz, colisão contínua captura golpes rápidos e acertos precisos dão bônus. No Arqueiro, pontos mostram a trajetória prevista enquanto puxa a corda.

## Estrutura

| Pasta | O que tem |
|---|---|
| `config.js` | Chaves de API e parâmetros (tempo de clique, suavização, Gemini) |
| `src/core/` | Texturas procedurais, áudio sintetizado, tela dividida, giroscópio, entrada, resolução dinâmica |
| `src/ui/` | Tema e ícones (`theme.js`), interação estilo Quest, janelas (máx. 3), teclado, barra universal + Biblioteca curva, teleporte |
| `src/hands/` | MediaPipe Hands, corretor local (suavização, anatomia, gestos) e o assistente Gemini |
| `src/media/youtube.js` | YouTube Data API v3: em alta, 360°, 180°, recomendações e busca, mais o player |
| `src/games/` | Os 19 jogos, cada um carregado só quando é aberto |

## Rastreamento de mãos e Gemini

O corretor em `src/hands/handCorrector.js` aplica suavização, validação anatômica e reconhecimento local de gestos em cada detecção:
- suavização `anterior × 0,85 + novo × 0,15`, com reforço quando a mão se move rápido, para não atrasar;
- comprimentos calibrados, separação das bases dos dedos e limites de dobra; medidas colapsadas não recalibram os ossos;
- ponto fora do lugar trocado pela média dos vizinhos e do frame anterior;
- mão aberta e apontar confirmados após 0,4s estáveis; a pinça é instantânea (como no Quest), com força de 0 a 1 e histerese.

A saída tem o mesmo formato pedido: `{ pontosCorrigidos, gesto, confianca }`.

Gemini recebe uma janela de cerca de 0,5s de frames a cada `GEMINI_INTERVAL_MS`, com no máximo seis quadros por chamada. A resposta recalibra o corretor local em segundo plano. Latência e limites da API impedem tratar Gemini como um detector de 60 Hz. O reconhecimento rápido não depende dele: a câmera solicita até 60 fps e a detecção no worker acompanha até 60 Hz quando o aparelho permite. Na reserva sem worker, a detecção fica limitada a cerca de 30 Hz para preservar a renderização. As taxas reais precisam ser medidas no aparelho.

## Desempenho no celular

- **Mãos:** MediaPipe roda num Web Worker (`src/hands/handWorker.js`), fora da renderização. A câmera solicita 960×540 e até 60 Hz; quadros grandes são reduzidos para 480 px de largura na inferência. A detecção se adapta à carga. Na reserva pela thread principal, intervalo mínimo de 33 ms reduz disputa com a renderização. Interpolação preserva comprimentos dos dedos.
- **Perfil de celular:**
  - limite de 60 fps em telas de 90/120 Hz;
  - sem sombras em tempo real;
  - materiais Lambert no lugar de PBR (`std()` e `phys()` em `games/common.js`);
  - janelas sem desfoque.
- **Resolução dinâmica:** cai rápido quando trava e só sobe depois de alguns segundos estáveis, sem ficar oscilando.
- **Cadência:** limite mantém fase em telas de 60/90/120 Hz; contagem de FPS usa tempo real entre frames. 60 FPS é alvo, não garantia por aparelho.
- **Interface:** anel de progresso usa geometria fixa; textos reutilizam canvas/textura, e placar principal atualiza no máximo a cada 120 ms.
- **Carregamento:** cada jogo gera as texturas finais e compila os shaders com a tela escura, antes de aparecer. Assim não há travadinhas no meio da partida.
- **Menos objetos:** pedras da escalada, árvores da noite e corais do mergulho são instanciados ou mesclados. A mola do laboratório não é mais reconstruída em todo frame.

## Segurança das chaves

Tudo em `config.js` fica visível para quem abrir o site.
- **YouTube**: no Google Cloud Console, restrinja a chave por *HTTP referrer* (seu domínio) e à YouTube Data API v3.
- **Gemini**: para publicar, use um proxy (por exemplo um Cloudflare Worker) em `GEMINI_PROXY_URL` e tire a chave do arquivo.

## Limitações conhecidas

- Testes automatizados: `npm ci` e `npm test`. Cobrem rastreamento, contato, Gemini simulado, cadência e lógica/geometria do catálogo com uma ou duas mãos. Canvas e áudio usam dublês nos testes de jogos; estes não validam imagem final, câmera física, WebXR ou FPS real. Use `?auto=flat&fakehand=two&game=rhythm&debug` para inspeção e F2 para FPS, inferência e estado Gemini. Valide câmera/FPS no aparelho com HTTPS.

- O player do YouTube é um iframe. O navegador não deixa desenhá-lo dentro da cena 3D, então ele abre numa camada por cima (lado a lado no modo papelão). No modo WebXR imersivo o vídeo não aparece.
- Carregamento inicial: cerca de 40 KB do app + 166 KB do Three.js (gzip), ou seja, uns 206 KB. O modelo do MediaPipe (alguns MB) é baixado depois, só se o rastreamento de mãos estiver ligado.

## Controles de mãos e validação

- Os 25 jogos atuais mostram instruções para uma ou duas mãos e o gesto atual. O botão `?` oculta ou mostra o guia.
- O toque direto detecta o percurso do dedo entre quadros. Cada contato gera um clique, com confirmação verde e som. Retire o dedo para clicar novamente.
- A biblioteca e a barra ficam ao alcance da mão (aproximadamente 0,6 m). A profundidade é estimada com o campo de visão físico da câmera, independente da ampliação do passthrough. A perda de rastreamento exige recuar o dedo antes de um novo contato.
- Ajustes rápidos abrem dentro do VR. O botão de câmera pode abrir o feed e alternar o mundo real; o painel informa se a calibração Gemini está ativa ou indisponível.
- O clique é decidido localmente. Gemini continua como auxiliar de calibração em segundo plano; rede lenta, timeout ou erro da API não bloqueiam o toque. Não há validação automática no celular físico.
- Parar o dedo sobre um botão não clica automaticamente. O clique por tempo continua disponível no modo olhar.
- Poses inválidas e dados atrasados não geram novos cliques. O corretor preserva o comprimento dos dedos durante oclusões.
- Gemini recebe no máximo seis quadros por chamada, em segundo plano. Respostas inválidas, canceladas ou associadas a outra mão são descartadas. Há timeout de oito segundos. Gemini não executa 60 inferências por segundo.
- Ritmo usa colisão entre posições anteriores e atuais. Arqueiro mostra uma prévia da trajetória durante a puxada.
- Arena atualiza a espada antes de calcular a ponta e considera o percurso dos golpes. O guia mostra confirmação de acerto ou bloqueio.
- Galáxia dispara da origem do indicador e considera o movimento dos tiros e das mãos nas colisões. A reposição de naves acompanha o tempo do jogo, sem timers ativos depois de sair.
- A meta de renderização é 60 FPS no celular, com resolução adaptativa. O contador usa o tempo real dos quadros. Testes do limitador em telas simuladas de 60/90/120 Hz não comprovam desempenho da GPU ou da câmera.

Testes de regressão (Node.js 20+):

```bash
npm install
npm test
```

No PowerShell com scripts bloqueados, use `npm.cmd install` e `npm.cmd test`. Os testes simulam respostas do Gemini, sem chamadas à API. A validação visual com câmera e a medição de FPS precisam ocorrer no aparelho real.

## Véspera RPG2 e Universe Sandbox

O Véspera está em [`vespera-rpg2/`](vespera-rpg2/) e pode ser aberto pela página inicial. Seu modo WebXR lê a partida original e projeta terreno, árvores, edifícios, criaturas, NPCs e jogadores numa cena espacial 3D. A simulação, as missões, a arte 2D e o salvamento continuam no motor original. Veja [`vespera-rpg2/VR_README.md`](vespera-rpg2/VR_README.md) para limites e controles.

O **Universe Sandbox** começa com estrela, planeta e lua. Escolha um astro e pince para colocá-lo; os botões **Impacto** e **Maré** mostram eventos reproduzíveis. A física usa gravitação newtoniana com unidades reduzidas para uma cena VR. O impacto conserva massa e impulso, gera onda e detritos. A maré transfere matéria da estrela ao buraco negro e desenha filamentos ligados aos corpos. Isso é uma simulação estilizada e não calcula astrofísica em escala real.

O Universe Sandbox sincroniza o estado físico pela sala online com simulação no anfitrião. A hospedagem de um servidor WebSocket persistente continua necessária para jogar pela internet; `render.yaml` e [`NETWORK.md`](NETWORK.md) preparam esse deploy. Os demais jogos ainda precisam de regras multiplayer específicas.
