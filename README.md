# BlueNav Play

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
| Indicador esticado sobre o botão + empurrar (ou parar 0,65s) | Clique com o dedo |
| Encostar a ponta do indicador no botão | Toque direto (poke) |
| Olhar a palma + pinçar | Abre/fecha o menu (barra universal + Biblioteca) |
| Olhar a palma + pinçar e segurar 1s | Recentraliza a visão |
| Apontar o indicador para o chão + pinçar | Teleporte (segurar apontando 0,65s também funciona) |

O raio sai do ombro estimado e passa entre o polegar e a base do indicador, como no Quest. Assim o cursor não pula quando você pinça. O anel do cursor se fecha conforme a força da pinça. O clique por tempo (0,65s) só vale para quem usa o olhar no papelão, sem câmera.

Para testar sem câmera, use `?auto=flat&fakehand=palm` (ou `point` / `pinch`).

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

O corretor em `src/hands/handCorrector.js` segue as regras do prompt do Gemini e roda em todo frame em menos de 1 ms:
- suavização `anterior × 0,85 + novo × 0,15`, com reforço quando a mão se move rápido, para não atrasar;
- comprimento dos ossos coerente e dedo que não dobra para trás;
- ponto fora do lugar trocado pela média dos vizinhos e do frame anterior;
- mão aberta e apontar confirmados após 0,4s estáveis; a pinça é instantânea (como no Quest), com força de 0 a 1 e histerese.

A saída tem o mesmo formato pedido: `{ pontosCorrigidos, gesto, confianca }`.

O Gemini não aguenta cerca de 30 chamadas por segundo: cada chamada leva centenas de milissegundos e há limite de uso. Por isso ele recebe uma janela de cerca de 0,5s de frames a cada `GEMINI_INTERVAL_MS`, com o prompt original. A resposta recalibra o corretor local e nunca trava a imagem. Ele vem ligado e pode ser desligado na tela inicial. Roda a cada 4 s (limite gratuito do flash-lite), com no máximo 6 quadros por chamada. O reconhecimento rápido não depende dele: a câmera roda a 60 fps e a detecção acompanha até 60 Hz quando o celular aguenta.

## Desempenho no celular

- **Mãos:** o MediaPipe roda num Web Worker (`src/hands/handWorker.js`), fora da thread de renderização. A câmera captura em 480×360 a no máximo 30 Hz, e a mão é suavizada entre as detecções.
- **Perfil de celular:**
  - limite de 60 fps em telas de 90/120 Hz;
  - sem sombras em tempo real;
  - materiais Lambert no lugar de PBR (`std()` e `phys()` em `games/common.js`);
  - janelas sem desfoque.
- **Resolução dinâmica:** cai rápido quando trava e só sobe depois de alguns segundos estáveis, sem ficar oscilando.
- **Carregamento:** cada jogo gera as texturas finais e compila os shaders com a tela escura, antes de aparecer. Assim não há travadinhas no meio da partida.
- **Menos objetos:** pedras da escalada, árvores da noite e corais do mergulho são instanciados ou mesclados. A mola do laboratório não é mais reconstruída em todo frame.

## Segurança das chaves

Tudo em `config.js` fica visível para quem abrir o site.
- **YouTube**: no Google Cloud Console, restrinja a chave por *HTTP referrer* (seu domínio) e à YouTube Data API v3.
- **Gemini**: para publicar, use um proxy (por exemplo um Cloudflare Worker) em `GEMINI_PROXY_URL` e tire a chave do arquivo.

## Limitações conhecidas

- O player do YouTube é um iframe. O navegador não deixa desenhá-lo dentro da cena 3D, então ele abre numa camada por cima (lado a lado no modo papelão). No modo WebXR imersivo o vídeo não aparece.
- Carregamento inicial: cerca de 40 KB do app + 166 KB do Three.js (gzip), ou seja, uns 206 KB. O modelo do MediaPipe (alguns MB) é baixado depois, só se o rastreamento de mãos estiver ligado.
