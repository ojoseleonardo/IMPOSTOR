# Impostor - Jogo multiplayer em tempo real

Exatamente 3 jogadores por sala. Um é sorteado como impostor; os outros dois são inocentes e recebem uma palavra em segredo. O impostor não vê a palavra.

## Como rodar

1. Instale as dependências:
   ```
   npm install
   ```

2. Inicie o servidor:
   ```
   npm start
   ```

3. Abra no navegador: **http://localhost:3000**

4. Um jogador cria a sala e vê o código. Os outros dois entram com o código e o nome. Quando os 3 estiverem na sala, o jogo começa e cada um vê apenas o próprio papel (e a palavra, se for inocente).

## Tecnologias

- **Backend:** Node.js, Express, Socket.IO (WebSocket)
- **Frontend:** HTML, CSS e JavaScript (Socket.IO client)
- Lista de palavras e sorteio de papéis ficam apenas no servidor; o cliente só exibe o que recebe em mensagens privadas.
