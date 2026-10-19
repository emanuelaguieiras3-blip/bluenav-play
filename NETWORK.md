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

O arquivo `render.yaml` prepara um serviço Node no Render com verificação em `/health`. Ao criar o serviço, configure `NETWORK_ORIGINS` com a origem exata do site (por exemplo, `https://seu-site.vercel.app`). Depois use a URL pública do serviço com `/room`, por exemplo `wss://seu-servico.onrender.com/room`. O nome real e a URL só existem após o deploy. Salas continuam temporárias; um serviço que adormece ou reinicia encerra as partidas.

O deploy estático da Vercel não mantém esse servidor WebSocket vivo. Sem um serviço persistente e endereço `wss://`, salas pela internet não funcionam.

## Estado da integração

O **Universe Sandbox** compartilha corpos, órbitas, impactos e marés: o anfitrião simula, valida comandos dos convidados e envia o estado a cada 0,2 s. A praça possui sincronização própria de mapas e aparência. Nos demais jogos, esta etapa sincroniza **presença e posição**; pontuação, física, inimigos, objetivos e inventário ainda não formam partidas compartilhadas. Para cada um, será necessário definir autoridade e validar ações. O protocolo aceita eventos nomeados, mas cada jogo deve validar os dados recebidos.

Salas são temporárias e ficam só na memória do processo. Reiniciar o servidor encerra todas as salas. Não há conta, autenticação, reconexão ou TURN nesta versão.
