# BlueNav Play

## VR Box: música, mãos e acessos

- Na tela inicial, **Ritmo de Luz · escolher música** entra em tela dividida e abre o seletor. Escolha uma faixa sintetizada ou um arquivo local MP3/WAV/OGG compatível com o navegador, até 25 MB e 5 minutos. O arquivo não é enviado para um servidor. Informe BPM se o mapa automático não acompanhar bem as batidas.
- Ritmo de Luz é um jogo próprio de sabres: blocos com setas, cortes por movimento, duas cores, combo e pausa. É inspirado no gênero de Beat Saber; não inclui o jogo ou seu catálogo de músicas. Se houver uma mão, ela corta as duas cores.
- As mãos virtuais acompanham MediaPipe; selecionar, arrastar, tocar com indicador, gesto de palma para menu e recentralização seguem convenções próximas ao Meta. Webcam monocular não tem a precisão ou a profundidade dos sensores de um Quest. Use HTTPS, boa iluminação e mantenha as mãos no campo de visão da câmera traseira.
- A barra universal tem **Jogos externos** e **Security**. Esses painéis usam toque na tela; configure antes de colocar os óculos. A simulação e as seleções da cena pausam enquanto o painel está aberto.
- YouTube tem busca, catálogo e **Abrir link** (link HTTPS ou ID de vídeo). A reprodução é um painel 2D duplicado para os olhos no VR Box; não é projeção imersiva de vídeo 360°/180°. A referência TikTok indicada não pôde ser acessada; a interface é própria, sem alegação de cópia exata.
- Ao escolher um vídeo, o player oficial incorporado abre dentro do site imediatamente, sem depender do carregamento da API de controles. No VR Box há um iframe por olho e apenas um com som. Se o navegador bloquear autoplay, toque em **Reproduzir / ativar som** ou no player. Vídeos privados, removidos ou com incorporação desativada pelo autor não podem ser reproduzidos aqui. Fechar remove os iframes e interrompe o som.

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

`npm install` e `npm test` verificam gestos, colisões, mapas e integrações. No Windows com política de PowerShell restritiva, use `npm.cmd`. Para os testes de navegador, inicie `python -m http.server 8080 --bind 127.0.0.1` e execute `node tests/vrbox-flow.mjs`. O fluxo usa WAV local e resposta Gemini simulada; não valida disponibilidade da chave, câmera real ou desempenho no celular. `node tests/render-audit.mjs current mobile` verifica renderização dos 16 jogos com Chromium/SwiftShader, sem medir FPS de aparelho real.

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
| Piloto | gire o volante com as duas | mão para os lados |
| Selva / Escalada | agarre com uma e depois com a outra para subir | pince e puxe |
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
| Apontar o indicador para o chão + pinçar | Teleporte (segurar apontando 0,65s também funciona) |

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
| `src/games/` | Os 16 jogos, cada um carregado só quando é aberto |

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

- Testes automatizados: `npm ci` e `npm test`. Cobrem rastreamento, contato, Gemini simulado, cadência e lógica/geometria dos 16 jogos com uma ou duas mãos. Canvas e áudio usam dublês nos testes de jogos; estes não validam imagem final, câmera física, WebXR ou FPS real. Use `?auto=flat&fakehand=two&game=rhythm&debug` para inspeção e F2 para FPS, inferência e estado Gemini. Valide câmera/FPS no aparelho com HTTPS.

- O player do YouTube é um iframe. O navegador não deixa desenhá-lo dentro da cena 3D, então ele abre numa camada por cima (lado a lado no modo papelão). No modo WebXR imersivo o vídeo não aparece.
- Carregamento inicial: cerca de 40 KB do app + 166 KB do Three.js (gzip), ou seja, uns 206 KB. O modelo do MediaPipe (alguns MB) é baixado depois, só se o rastreamento de mãos estiver ligado.

## Controles de mãos e validação

- Os 16 jogos mostram instruções para uma ou duas mãos e o gesto atual. O botão `?` oculta ou mostra o guia.
- O toque direto detecta o percurso do dedo entre quadros. Cada contato gera um clique, com confirmação verde e som. Retire o dedo para clicar novamente.
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
