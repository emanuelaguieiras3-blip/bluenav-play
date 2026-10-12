# Véspera RPG2 em VR

Abra `index.html` por um servidor HTTPS ou por `localhost` em um navegador com WebXR `immersive-vr`. Inicie uma aventura solo ou online na tela e selecione **Entrar em VR**. O navegador solicitará `local-floor` e tentará ativar `hand-tracking` quando o headset oferecer esse recurso.

## Controles

- **Mão esquerda:** faça pinça com polegar e indicador em um ponto livre. Mova a mão em relação ao ponto onde a pinça começou para caminhar; solte para parar. Há uma pequena zona neutra para evitar deslocamento involuntário.
- **Mão direita:** aponte o indicador e faça pinça para selecionar um botão, atacar um monstro ao alcance ou interagir com um personagem próximo. Cada pinça gera uma ação.
- **Controles XR:** mova o analógico esquerdo para andar na direção do olhar. O gatilho seleciona botões ou alvos apontados; o botão de empunhadura esquerdo usa a habilidade e o direito esquiva. Os botões virtuais continuam disponíveis.
- **Objetivo:** aponte e selecione o × ao lado do painel para escondê-lo durante a sessão VR.

O mapa pintado continua visível como referência. A cena espacial, as missões, o combate, a colisão, o salvamento e a rede usam o estado do jogo existente. No modo online, o movimento e as ações VR seguem o mesmo caminho de entrada e validação da partida comum.

O código e os testes de navegador foram verificados sem headset físico. Latência, conforto e compatibilidade específica de headsets ainda precisam de uma sessão real para validação.
