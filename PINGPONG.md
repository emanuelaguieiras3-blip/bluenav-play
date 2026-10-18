# Tênis de Mesa VR

Abra BlueNav Play e escolha **Tênis de mesa VR**, ou selecione **Tênis de Mesa** na biblioteca. O botão inicial entra em WebXR quando um headset compatível está disponível; nos demais aparelhos, usa o modo VR Box. Para praticar com mouse, escolha **Tela normal** e abra o jogo pela biblioteca.

Mostre uma mão ao rastreador. A raquete acompanha a palma e a orientação do pulso, sem precisar manter a pinça. **Trocar mão** escolhe direita ou esquerda. Com uma única mão visível, o jogo usa essa mão. O gatilho/pinça continua disponível para selecionar os botões da interface. **Sacar** inicia a troca; Espaço também saca no computador. Após um ponto, a próxima bola começa automaticamente quando há uma mão disponível.

A partida é solo contra um adversário virtual. A mesa mede 1,525 × 2,74 m, com superfície a 0,76 m e rede de 0,1525 m. O saque é automático e quica nas duas metades. Devolva depois de um quique. Dois quiques, devolução antecipada, rede e bola fora encerram a troca. A partida termina aos 11 pontos com dois de vantagem; o saque alterna a cada dois pontos e, no empate a partir de 10–10, a cada ponto. **Sacar** inicia outra partida após a vitória.

A física usa subpassos e colisão contínua com a raquete móvel. Perder a mão, abrir um menu ou receber uma posição descontínua não deve produzir um golpe artificial. A bola continua durante uma perda de rastreamento, mas a raquete fica desativada até a mão retornar. O menu do aplicativo pausa a partida.

O modelo é um jogo de prática: ainda não simula rotação da bola, efeito Magnus, borracha profissional, dupla ou adversário remoto. Hand tracking nativo depende do headset e do navegador. No VR Box, depende da câmera e da estimativa de profundidade existente no BlueNav; golpes rápidos precisam de validação física no aparelho.

## Validação

`npm.cmd test` verifica os jogos e a física. `node tests/pingpong-flow.mjs` verifica carregamento real, controles XR simulados, mão com 21 pontos, perda de tracking, saque, devolução legal do adversário e interface responsiva. `node tests/menu-touch.mjs` verifica toque físico nos botões do menu. Os testes de navegador usam Chrome instalado e um servidor estático; defina `TEST_BASE_URL` quando a porta não for 8080.

Prévia visual: `artifacts/play-club-desktop.png`, `artifacts/play-club-mobile.png`, `artifacts/play-club-vr-menu.png` e `artifacts/pingpong-club.png`. Testes automatizados não substituem teste em headset real.
