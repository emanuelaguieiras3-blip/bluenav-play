# Salas online BlueNav

O painel **Sala online** cria ou entra em uma sala por código. Até quatro pessoas podem se conectar ao mesmo jogo. O servidor retransmite posição dos jogadores e eventos nomeados. O cliente mostra avatares remotos.

## Executar localmente

```powershell
$env:PORT='8799'
$env:HOST='127.0.0.1'
npm.cmd run server:network
```

Sirva o site por HTTP local. No painel, informe `ws://127.0.0.1:8799/room`. Abra o mesmo jogo nos dois navegadores. Crie a sala no primeiro e entre com o código no segundo.

## Hospedar na internet

Hospede `server/network.mjs` em um serviço Node com conexões WebSocket persistentes. Use TLS e um endereço `wss://.../room`. Configure `PORT` e, se quiser restringir a origem do site, `NETWORK_ORIGINS` com uma lista separada por vírgula. Defina `CONFIG.NETWORK_URL` em `config.js` ou informe o endereço no painel.

O deploy estático da Vercel não mantém esse servidor WebSocket vivo. Sem um serviço persistente e endereço `wss://`, salas pela internet não funcionam.

## Estado da integração

Esta etapa sincroniza **presença e posição**. Os jogos ainda executam suas próprias regras em cada navegador: pontuação, física, inimigos, objetivos e inventário não formam uma partida compartilhada. Para tornar cada jogo multiplayer, é necessário escolher autoridade de estado, validar ações no host ou servidor e implementar adaptação para cada mecânica. O protocolo já aceita eventos nomeados, mas nenhum jogo deve tratá-los como fonte confiável sem validação.

Salas são temporárias e ficam só na memória do processo. Reiniciar o servidor encerra todas as salas. Não há conta, autenticação, reconexão ou TURN nesta versão.
