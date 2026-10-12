# Véspera em VR

Abra `vespera-rpg2/` em HTTPS num navegador WebXR. Comece ou continue a aventura e escolha **Entrar em VR**. O modo espacial lê o mesmo estado do RPG: posição, terreno, construções, monstros, NPCs e outros jogadores. Árvores, rochas, água, paredes, construções e criaturas aparecem como geometria 3D. O canvas original fica disponível como um pequeno mapa na cena, preservando a arte ilustrada. A missão atual aparece acima da visão.

Com hand tracking, aponte e pince os botões virtuais. A pinça da mão esquerda move o personagem conforme o deslocamento da mão; solte para parar. Aponte e pince com a direita para atacar ou interagir. Em controles XR, o analógico esquerdo move na direção do olhar, o gatilho seleciona botões ou alvos, a empunhadura esquerda usa habilidade e a direita esquiva. O × ao lado da missão fecha seu painel durante a sessão VR. O motor 2D original continua responsável por colisões, combate, progresso, salvamento e multiplayer; o modo 3D representa esse estado, sem criar uma segunda simulação divergente.

**Limites verificados:** o mundo espacial é uma representação estilizada do estado 2D, com terreno local e figuras tridimensionais. Ele ainda não reproduz cada edifício, equipamento ou animação da arte original em 3D. O gesto e o conforto precisam de teste em um headset WebXR real. O multiplayer do Véspera usa o sistema PeerJS próprio: a conectividade pela internet depende do serviço de sinalização e das condições de rede.

O Espectro das Dunas e o Cão da Geada foram adicionados com atributos, aparências em canvas e presença nos biomas correspondentes.
