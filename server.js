const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

const io = new Server(server);

// Lista de palavras - APENAS no backend. O impostor nunca recebe.
const PALAVRAS = [
  'GATO', 'CACHORRO', 'SOL', 'LUA', 'MAR',
  'FLOR', 'LIVRO', 'MUSICA', 'JANELA', 'PORTA',
  'BICICLETA', 'AVIAO', 'CHOCOLATE', 'PIZZA', 'CAFE'
];

const MAX_JOGADORES_POR_SALA = 3;

// Estado: salaId -> { jogadores: [{ id, nome }], iniciado: boolean }
const salas = new Map();

// socketId -> { salaId, nome, papel, palavra? }
const jogadores = new Map();

function gerarIdSala() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function escolherPalavra() {
  return PALAVRAS[Math.floor(Math.random() * PALAVRAS.length)];
}

function embaralhar(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

io.on('connection', (socket) => {
  socket.on('criar_sala', (nome) => {
    const salaId = gerarIdSala();
    salas.set(salaId, {
      jogadores: [{ id: socket.id, nome: nome || 'Jogador' }],
      iniciado: false
    });
    jogadores.set(socket.id, { salaId, nome: nome || 'Jogador' });
    socket.join(salaId);
    socket.emit('sala_criada', salaId);
    socket.emit('atualizar_espera', {
      codigo: salaId,
      jogadores: [{ nome: nome || 'Jogador' }],
      total: 1,
      max: MAX_JOGADORES_POR_SALA
    });
  });

  socket.on('entrar_sala', ({ salaId, nome }) => {
    const sala = salas.get(salaId.toUpperCase());
    if (!sala) {
      socket.emit('erro', 'Sala não encontrada.');
      return;
    }
    if (sala.iniciado) {
      socket.emit('erro', 'O jogo nesta sala já começou.');
      return;
    }
    if (sala.jogadores.length >= MAX_JOGADORES_POR_SALA) {
      socket.emit('erro', 'Sala cheia.');
      return;
    }
    sala.jogadores.push({ id: socket.id, nome: nome || 'Jogador' });
    jogadores.set(socket.id, { salaId: salaId.toUpperCase(), nome: nome || 'Jogador' });
    socket.join(salaId.toUpperCase());

    const listaJogadores = sala.jogadores.map(j => ({ nome: j.nome }));
    const codigo = salaId.toUpperCase();
    io.to(codigo).emit('atualizar_espera', {
      codigo,
      jogadores: listaJogadores,
      total: sala.jogadores.length,
      max: MAX_JOGADORES_POR_SALA
    });

    if (sala.jogadores.length === MAX_JOGADORES_POR_SALA) {
      sala.iniciado = true;
      const palavraSorteada = escolherPalavra();
      const indicesEmbaralhados = embaralhar([0, 1, 2]);
      const indiceImpostor = indicesEmbaralhados[0];

      sala.jogadores.forEach((j, i) => {
        const ehImpostor = i === indiceImpostor;
        const payload = {
          papel: ehImpostor ? 'impostor' : 'inocente',
          mensagem: ehImpostor ? 'Você é o impostor.' : 'Você é inocente.'
        };
        if (!ehImpostor) {
          payload.palavra = palavraSorteada;
        }
        io.to(j.id).emit('revelar_papel', payload);
      });
    }
  });

  socket.on('disconnect', () => {
    const dados = jogadores.get(socket.id);
    if (dados) {
      const sala = salas.get(dados.salaId);
      if (sala && !sala.iniciado) {
        sala.jogadores = sala.jogadores.filter(j => j.id !== socket.id);
        if (sala.jogadores.length === 0) {
          salas.delete(dados.salaId);
        } else {
          io.to(dados.salaId).emit('atualizar_espera', {
            codigo: dados.salaId,
            jogadores: sala.jogadores.map(j => ({ nome: j.nome })),
            total: sala.jogadores.length,
            max: MAX_JOGADORES_POR_SALA
          });
        }
      }
      jogadores.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor em http://localhost:${PORT}`);
});
