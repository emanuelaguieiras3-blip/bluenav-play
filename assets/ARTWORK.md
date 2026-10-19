# Imagens da biblioteca

As 26 capas em `covers/` são capturas dos próprios jogos BlueNav, sem substituir a aparência real por arte promocional. `covers/sources.json` lista os jogos capturados. Para atualizar todas as capas, execute `node scripts/capture-covers.mjs` com o servidor local ativo. Para atualizar uma capa, passe o identificador do jogo, por exemplo `node scripts/capture-covers.mjs pingpong`. O script aceita `TEST_BASE_URL`.

As imagens dos aplicativos ficam em `apps/`, com URLs de origem em `apps/sources.json`. BONEWORKS e BONELAB usam arte publicada em suas páginas Steam. Gorilla Tag, Roblox, VRChat, YouTube e Vivecraft usam imagens publicadas nos sites correspondentes. A imagem identificada como Minecraft VR representa Vivecraft, como o destino do cartão indica. O cartão Rec Room usa uma identificação vetorial desenhada localmente; não é uma imagem oficial baixada.

As imagens são servidas pelo próprio projeto, evitando dependência de hosts externos durante a navegação. A página inicial carrega as capas fora da tela sob demanda. Os arquivos JPEG das 26 capas somam aproximadamente 1,7 MB. O menu VR usa as mesmas imagens, recortadas dentro de cada cartão, com títulos separados da fotografia.
