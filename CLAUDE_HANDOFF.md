# BlueNav Play — continuidade em 11/10/2026

## Decisão do usuário

Manter os nomes BlueNav no catálogo. Melhorar as mecânicas dos jogos próprios,
inspiradas em Gorilla Tag, BONELAB, Job Simulator, Pavlov VR e Beat Saber. Não
apresentar estes protótipos como versões oficiais ou equivalentes completas.

## Implementado nesta sequência de trabalho

- Catálogo com 19 jogos, três páginas de alvos grandes e instruções para uma ou
  duas mãos. Caminhada por joystick WebXR, controle Bluetooth e teclado no VR Box.
- Rastreamento MediaPipe em worker quando disponível, mãos nativas WebXR,
  separação anatômica das juntas para gestos, toque direto em botões com o
  indicador e linha visual alinhada ao raio de seleção. Gemini calibra em
  segundo plano, em intervalos; não processa cada quadro da renderização.
- Física AABB com passo fixo em `rigidWorld.js`, objetos que podem ser pegos e
  lançados em Laboratório Sandbox e Oficina de Trabalho, além do kit opcional
  de objetos físicos. Isso não dá colisão física a toda geometria dos 19 jogos.
- Selva Livre usa impulso das mãos sobre chão, troncos e galhos. Arena exige
  contato da espada para causar dano. Treino Tático tem cobertura, alvos,
  munição e recarga. Ritmo de Luz tem duas cores, oito direções, bombas,
  paredes, Expert, música local e ajuste de sincronização.
- Ritmo de Luz importa mapas locais Beat Saber v2/v3 e os elementos básicos de
  v4 (`.dat`/`.json`): notas, bombas e paredes por índice de metadados. O
  importador valida limites de tamanho, formato e quantidade. Paredes respeitam
  duração, altura e camada, incluindo paredes de agachar, com limite de 16
  batidas/8 segundos por parede. Em v4, BPM inicial ainda é manual.
- Oficina de Trabalho agora pede carimbar documentos, pesar pacotes e encher
  copos antes da entrega na bandeja certa. O item precisa repousar na estação;
  depois o usuário toca no botão da operação. Entregas exigem soltura e
  estabilidade; erros devolvem o objeto. Etiquetas e instruções ficaram
  legíveis na cena.
- Guia do Ritmo de Luz mostra comandos e feedback curtos, sem cortar frases no
  visor estéreo. A ajuda inicial recolhe quando termina a contagem regressiva;
  o aviso atual aparece acima da pista, e o botão `?` continua disponível.
- Blocos e sabres agora usam vermelho na esquerda e azul na direita, conforme
  os índices de cor dos mapas importados. A velocidade de corte vem do trecho
  da lâmina que encostou no bloco; girar a lâmina com a ponta quase parada
  continua valendo como corte.
- Mapas v3 aplicam `bpmEvents` e mapas v2 aplicam eventos `_type: 100` às notas,
  bombas e paredes. O seletor usa o BPM do evento no beat 0 quando o usuário
  não preenche o campo manual. Sem mãos rastreadas no VR Box, paredes não
  penalizam o ponteiro de olhar. Com mãos rastreadas, a colisão continua ativa.
- O atalho inicial de Ritmo de Luz agora carrega o jogo diretamente. Antes,
  abria o lobby primeiro; durante a espera, a seleção por olhar podia iniciar
  outro jogo (`gameId: jungle` foi observado), causando falha intermitente.

- Sabres por hand tracking no estilo Quest (`handSaber.js`): por padrão a mão
  fechada segura um cabo virtual e a lâmina sai do lado do polegar, inclinada
  para frente. Juntas passam por filtro One Euro (mais leve nas mãos nativas
  do Quest). Se o rastreamento cair por até 0,2 s num golpe rápido, a lâmina
  fica parada no lugar, sem cortar. O botão "Sabre: mão fechada/dedos" alterna
  para o modo antigo e a escolha fica salva no navegador.
- Laboratório Sandbox com mecânicas inspiradas em BONELAB (sem copiar assets,
  nome ou fases): mãos físicas (palma rápida empurra e gira objetos; mão lenta
  ou pinçando não empurra, para não afastar o que vai pegar), pegada que mantém
  o ponto agarrado e gira com o pulso, peso (objeto pesado atrasa e cai na mão;
  Caixote de 9 kg pede as duas mãos), pegada com duas mãos dividindo o peso,
  arremesso pela velocidade real do objeto, caixas que giram no ar e assentam
  numa face, bolas que rolam, melancias que estouram acima de 5,5 m/s, tábuas,
  torre de 8 caixas para derrubar com placar, botões Limpar/Restaurar.
  Motor em `rigidWorld.js` (`grabbable`, `trackHands`, `nearestAxisQuaternion`,
  `pointerFrame`); API antiga preservada para Oficina e kit físico. Colisão
  continua AABB: caixas giradas colidem como cubo alinhado.
- Varredura de bugs nos jogos (corrigidos):
  - `ui.js`: dedo a menos de ~16 cm de um objeto pegável virava "toque de
    botão" e bloqueava a pinça; pegar encostando a mão falhava em todos os
    jogos com objetos. Agora só alvos clicáveis recebem toque.
  - Física e Mesa de Jogos: arremessos liam `inp.handVel` (inexistente no
    ponteiro) e saíam com velocidade zero. Bola e mola seguem a mão rastreada.
  - Mesa de Jogos: baralho acabava após 26 rodadas e travava o jogo; baralho
    começava ordenado (sempre K♣ × Q♣); resultado por `setTimeout` quebrava ao
    embaralhar durante a virada e seguia após sair do jogo.
  - Escalada: chegar ao topo segurando uma pedra prendia o jogador de volta na
    parede. Mundo de Blocos: quebrar o bloco sob os pés deixava flutuando.
  - Construtor de Reinos: normal diagonal da borda arredondada colocava bloco
    na diagonal. Mergulho: braçada usava velocidade com o deslizamento do
    corpo e direção errada após giro. Cozinha: pedaço solto flutuava.
  - Arena: `feedbackTime` decrementado duas vezes. Espada usa empunhadura de
    punho com duas mãos (com uma mão, mão fechada é caminhar; fica dedos).
  - Vazamento de GPU: flechas (Arco), naves destruídas (Galáxia), peças ao
    recomeçar (Quebra-cabeça).

## Sequência de 11/10/2026

Pedido: "Boneworks que o Bit Gamer jogava", corrida, Gorilla Tag e Beat Saber no
estilo Quest, todos com hand tracking; física em todos os jogos; geometria não
quadrada. Mantida a decisão de nomes e conteúdo próprios (mecânicas inspiradas).

- `complex.js` (novo, "Complexo", 20º jogo): sala de descanso → museu (balança de
  8 kg abre a porta de cima; plataforma de 1,3 m: empilhe caixas, degrau 0,55 m,
  ou pince a borda e puxe com `GrabMover`) → pátio com 3 inimigos ragdoll →
  saída. Pistola "pegajosa": pinça pega, pinça seguinte atira, mão bem aberta
  (`isWideOpen`, 0,35 s) solta; no controle, segurar o gatilho 0,8 s solta.
  Carregador físico com contagem; vazio cai sozinho; pinça perto do quadril tira
  outro; encaixe a ~9 cm da base; ferrolho puxado 3,5 cm com a outra mão.
  Inimigos são marionetes (partes `held = 'puppet'` animadas) que viram ragdoll
  ao levar tiro forte, soco rápido, golpe de cano/cassetete ou objeto arremessado;
  levantam após 2,6 s se ainda tiverem vida. Botões para olhar: Pegar/soltar
  arma, Recarregar, Reiniciar fase.
- `gorillaMotion.js` (novo) substitui `ArmMotion` em `jungle.js` (reescrito):
  algoritmo do Gorilla Tag (mão presa no contato, corpo se move, histórico de 5
  quadros, salto x1,1 até 6,5 m/s, colisor de cabeça, corpo 0,55 m mais baixo).
  Superfícies: cápsulas (troncos, galhos, pedras) e caixas (decks). `ArmMotion`
  continua no código e nos testes.
- `racing.js` reescrito: `stepCar` (bicicleta com limite de aderência e
  derrapagem), `collideCars`, 3 rivais com IA de linha e frenagem por curvatura,
  semáforo, 3 voltas, posição, muro de pneus, zebras, cones em `RigidWorld`.
  `carModel.js` gera carros com extrusão chanfrada.
- `rhythmStage.js` (novo): lasers, anéis, faixas e painel de fundo que pulsam
  com o BPM e piscam na cor do corte. Metades do bloco saem na direção do corte.
- `sceneProps.js` (novo): objetos temáticos em 9 jogos, criados por `app.js`
  após o jogo. Colisores vêm das malhas do cenário (até 70 caixas, atualizadas a
  cada 0,25 s). Pinça de perto pega; `impact()` recebe balas (Treino Tático) e
  flechas (Arqueiro). `rigidWorld.js`: colisão esfera × caixa e
  `grabbable(..., { register: false })` com `body.grab`.
- `roundGeometry.js` (novo): `app.js` troca `BoxGeometry` alinhada por
  `RoundedBoxGeometry` do mesmo tamanho, menos em `blocks`/`kingdom` e em
  instâncias com mais de 48 cópias.
- Chão de Pega-pega, Sobrevivência e Piloto agora é subdividido: no Chrome com
  SwiftShader, triângulos gigantes atrás da câmera eram desenhados na frente dos
  objetos (cortava bots e árvores). Pode valer o mesmo em GPU real; não testado.

## Trabalho do Codex (commits 96665ce e 7359f88, 11/10/2026)

O Codex commitou o trabalho acima e acrescentou, sem registrar neste arquivo:
- `trails.js` com `ski.js` (Descida Alpina) e `motorbike.js` (Moto de Trilha):
  12 portões, vitória com 9; mãos inclinadas viram, pinça freia.
- `shiftworld.js` (Mundo Transformado): restaurar 3 âncoras e entrar no portal.
- Salas online: `server/network.mjs`, `src/core/network.js`, `NETWORK.md`.
  Sincroniza só presença e posição; regras dos jogos não são compartilhadas.
- `GAME_OBJECTIVES` em `index.js` e objetivo na tela. Catálogo: 23 jogos.

## Continuação do Claude (11/10/2026, depois do Codex)

- Mundo Transformado: uma árvore nascia dentro da cabeça do jogador (x = 0,
  z = -0,2). Árvores agora ficam a 3,4 m ou mais do centro da trilha. Teste novo.
- Esqui/Moto: estacas dos portões têm física de mola (`stepPole`, `hitPole`);
  encostar derruba a estaca, que volta a ficar em pé. Teste novo.
- Esqui/Moto: árvores e pedras instanciadas: 292 → 70 draw calls.
- Mundo Transformado ganhou objetos físicos soltos (`SCENE_PROPS.shiftworld`).
- `upgrade-flow` agora captura também ski, motorbike e shiftworld.

## Praça BlueNav (11/10/2026, pedido "faça o Rec Room igual")

O usuário pediu o Rec Room "igual, não similar", com 500 mapas e skins. Copiar
nome, marca, avatares ou mapas do Rec Room não foi feito (propriedade da Rec
Room Inc.); entregue jogo próprio com as mesmas mecânicas. 24 jogos no catálogo.

- `plaza.js` + `plaza/`: `maps.js` gera 500 salas determinísticas (10 temas × 4
  modos, nomes únicos, validadores puros); `cosmetics.js` (`Wardrobe`: 56 itens,
  fichas, compras, recompensa maior na 1ª conclusão, `localStorage`
  `bluenav.plaza`); `avatar.js` (avatar flutuante, acessórios, carros com
  variante, pintura, adesivo, volante no cockpit); `freeCar.js` (carro livre
  com aderência, derrapagem, colisão e IA de waypoint).
- Cenário temático instanciado por tema (prédios, pinheiros, palmeiras, torres,
  cúpulas, cactos, rochas) com colisão pela caixa do bloco.
- `network.js`: `peerBuilder`/`rebuildPeer` para avatar personalizado; eventos
  `plaza-look` (a cada 5 s) e `plaza-map` (só aceito do anfitrião, índice
  validado).
- Bug corrigido em `disposeTree`: geometrias com `userData.shared` eram
  descartadas e, reutilizadas, deixavam de aparecer (carros invisíveis no
  Piloto ao reabrir e na Praça). Agora não são descartadas.

## Praça BlueNav: melhorias (pedido "melhore tudo, igual ao Rec Room")

Visual e mecânicas no estilo de rede social VR; arte, nomes e mapas próprios.
- Avatar refeito (`plaza/avatar.js`): tronco torneado (lathe), gola, olhos com
  brilho e piscada, sobrancelhas, bochechas, 5 bocas, 8 cabelos e 8 cores,
  mãos com dedos e polegar, sombra. `poseAvatar` liga cabeça e mãos ao jogador.
- Espelho real (`plaza/mirror.js`): câmera refletida com frustum fora do eixo
  que cobre o vidro, renderizada antes do quadro. O `Reflector` do three
  quebrava o contexto WebGL no Chrome de teste; não usar. Seu avatar fica na
  camada 5 (`SELF_LAYER`), visível só no espelho.
- Paintball: 3 armas (`plaza/weapons.js`: pistola, fuzil automático,
  escopeta de 5 bolas), modelos com depósito, recarga (R, botão no relógio ou
  pinça da outra mão no depósito), recuo, fumaça, manchas com forma, tinta no
  visor quando atingido. Bots com nome, arma, reação e mira variáveis, estados
  avançar/cobertura/espiar/empurrar, desvio quando alvejados, queda ao serem
  pintados e rota A* (`plaza/nav.js`). Bases com bandeira e mesa de armas.
- Corrida: nomes nos rivais, ritmo que mantém a disputa, barreira de pneus e
  pórtico quadriculado. Encontro: cerca, postes, fonte com água, visitantes
  com nome que acenam quando você chega perto. Parkour: arco de chegada.
- Texturas: coberturas listradas, bancos e palco de madeira, muros de pedra
  ou metal, fonte de mármore; nuvens ou estrelas no céu.

## Verificação

- `npm.cmd test`: 154/154 passaram (novos: `hand-saber.test.js`,
  `sandbox-physics.test.js`, sandbox, baralho e pinça perto do dedo em
  `games.test.js`; este último falha sem a correção de `ui.js`).
- `upgrade-flow`, `vrbox-flow`, `render-audit`, `menu-touch` e
  `hand-alignment` passaram após todas as mudanças, sem erros de console.
- `node tests/vrbox-flow.mjs`: passou de novo após a mudança dos sabres.
- NÃO testado em aparelho: empunhadura de punho, filtro One Euro e retenção
  dos sabres; sensação de peso, empurrão da palma (limiar 0,35 m/s), giro com
  o pulso e pegada em duas mãos no Sandbox. Esses valores provavelmente
  precisam de ajuste no Quest e no celular com câmera real.
- `node tests/vrbox-flow.mjs`: passou com WAV local, mapas v2/v3/v4, parede de
  agachar com duração definida, BPM automático v3, ajuste de 80 ms,
  pausa/retomada e outras telas. Confere que a parede mantém dimensões e
  duração, que o olhar sozinho não sofre dano e que uma mão simulada sofre.
  Quatro execuções seguidas passaram após corrigir a corrida do atalho inicial.
- `node tests/upgrade-flow.mjs`: passou; inclui joystick, controle desconectado,
  teclado VR Box, kit físico e carregamento de cenas.
- Capturas recentes: `artifacts/vr-upgrade/jobs.png`,
  `artifacts/vrbox/rhythm-map.png` e `artifacts/vrbox/rhythm-wall.png`.
- Testes de navegador usam Chrome headless/SwiftShader. Não medem FPS,
  temperatura, latência nem precisão em celular ou headset físico.

- 11/10/2026: `npm.cmd test` 176/176. `upgrade-flow`, `render-audit` (20 jogos,
  0 falhas de shader), `menu-touch`, `vrbox-flow` e `hand-alignment` passaram.
  Uma execução do `render-audit` travou ao carregar o Complexo e a seguinte
  passou; provável concorrência com outra execução, não reproduzido.
- NÃO testado em aparelho: sensação da locomoção de gorila, alcance do chão com
  0,55 m de agachamento, pistola com mãos do Quest e da câmera, gesto de mão
  aberta para soltar, alcance do quadril e do ferrolho, IA dos carros em volta
  completa com jogador real, FPS do Complexo (121 draw calls no desktop).

- 11/10/2026, após o Codex: `npm.cmd test` 195/195. `upgrade-flow`,
  `render-audit` (23 jogos, 0 falhas de shader), `vrbox-flow`, `menu-touch` e
  `hand-alignment` passaram. Tudo em Chrome headless com SwiftShader.
- NÃO testado em aparelho: viradas do esqui e da moto com mãos reais, sensação
  das estacas, salas online entre dois aparelhos, servidor `wss://` hospedado.

- Praça: `npm.cmd test` 208/208 (500 mapas validados; corrida, paintball,
  parkour e encontro simulados; amostra de 72 mapas carregada). `upgrade-flow`,
  `render-audit` (Praça: 98 draw calls), `menu-touch`, `vrbox-flow` passaram;
  `hand-alignment` falhou 1 de 4 execuções (`lineVisible` falso), intermitente.
- NÃO testado em aparelho: Praça em Quest/celular, paintball com mãos reais,
  volante com duas mãos na Praça, salas online com avatar e troca de mapa.

- Melhorias da Praça: `npm.cmd test` 211/211 (A*, armas, espelho, 4 modos,
  bots marcando pontos em 10 de 10 execuções). Capturas confirmaram espelho,
  avatar e paintball. Depois, a máquina ficou com ~0,9 GB livres: o servidor
  Python caiu com `MemoryError` e o Chrome de teste perdeu o contexto WebGL
  até em jogos sem mudança (Piloto). Repetir testes de navegador com memória.

## Limitações e próximas verificações

1. Medir FPS e latência no celular/VR Box e no Quest, com câmera real,
   passthrough, mapeamento de juntas, gestos e controle Bluetooth. O limite
   de 60 FPS em celular é um teto de renderização, não garantia de 60 FPS.
2. Câmera monocular não oferece rastreamento de profundidade 6DoF do Quest.
   Oclusão e iluminação ainda podem aproximar visualmente juntas dos dedos.
3. Importação v4 cobre notas, bombas e paredes; não cobre arcs/chains, rotação
   de pista, dados de BPM em arquivo separado, gzip ou pacotes `.zip`. Um `.dat`
   isolado não contém áudio; BPM e música correspondentes são necessários.
4. Oficina continua um jogo de três operações simples. Treino Tático é treino
   local, sem multiplayer. Física usa caixas alinhadas aos eixos (esferas para
   corpos redondos); ragdoll só nos inimigos do Complexo e no boneco do Sandbox.
5. Chaves em `config.js` ficam visíveis no navegador por decisão prévia do
   proprietário. Antes de publicação, restringir por domínio/API e cotas ou
   configurar proxy.

6. Salas online: falta escolher autoridade de estado e adaptar cada jogo
   (ver `NETWORK.md`). Nenhum jogo é partida compartilhada ainda.

Mudanças desta continuação seguem no worktree, sem commit ou publicação.

## Prompt de continuidade

Leia este arquivo inteiro e `NETWORK.md`. Mantenha os nomes BlueNav e conteúdo
próprio (mecânicas inspiradas, sem copiar nomes, fases ou arte). Preserve as
mudanças existentes no worktree. Rode `npm.cmd test` e, com servidor em
`127.0.0.1:8080`, os testes `.mjs` antes e depois de mudar. Próximos passos, em
ordem: (1) se o usuário trouxer resultados do Quest ou do celular, ajuste os
valores marcados como "NÃO testado em aparelho"; (2) multiplayer real do
Pega-pega VR (host decide quem pega, posições já trafegam); (3) mantenha
draw calls abaixo de ~130 por jogo. Registre aqui o que foi validado e o que
depende de hardware real.
