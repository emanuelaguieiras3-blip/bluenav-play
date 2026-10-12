# Véspera RPG2 em VR

Abra `index.html` por um servidor HTTPS ou por `localhost` em um navegador com WebXR `immersive-vr`. Inicie uma aventura solo ou online na tela e selecione **Entrar em VR**. O navegador solicitará `local-floor` e tentará ativar `hand-tracking` quando o headset oferecer esse recurso.

## Controles

- **Mão esquerda:** faça pinça com polegar e indicador em um ponto livre. Mova a mão em relação ao ponto onde a pinça começou para caminhar; solte para parar. Há uma pequena zona neutra para evitar deslocamento involuntário.
- **Mão direita:** aponte o indicador e faça pinça para selecionar um botão, atacar um monstro ao alcance ou interagir com um personagem próximo. Cada pinça gera uma ação.
- **Sem rastreamento das mãos:** use os controles XR para apontar e selecionar os botões virtuais de movimento e ação.

O mapa pintado continua visível como referência. A cena espacial, as missões, o combate, a colisão, o salvamento e a rede usam o estado do jogo existente. No modo online, o movimento e as ações VR seguem o mesmo caminho de entrada e validação da partida comum.

O código e os testes de navegador foram verificados sem headset físico. Latência, conforto e compatibilidade específica de headsets ainda precisam de uma sessão real para validação.
