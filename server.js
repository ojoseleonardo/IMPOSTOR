const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

const io = new Server(server);

// ========== CATEGORIAS E PALAVRAS (apenas no backend) ==========
const CATEGORIAS = {
  Animais: [
    'Cachorro', 'Gato', 'Elefante', 'Leão', 'Tigre', 'Urso', 'Coelho', 'Cavalo', 'Vaca', 'Girafa',
    'Macaco', 'Panda', 'Zebra', 'Golfinho', 'Baleia', 'Águia', 'Coruja', 'Pinguim', 'Cobra', 'Formiga'
  ],
  Países: [
    'Brasil', 'França', 'Japão', 'Itália', 'Canadá', 'Austrália', 'Egito', 'Índia', 'México', 'Espanha',
    'Argentina', 'China', 'Alemanha', 'Portugal', 'Rússia', 'Inglaterra', 'Grécia', 'Holanda', 'Suécia', 'Chile'
  ],
  Filmes: [
    'Titanic', 'Matrix', 'Avatar', 'Star Wars', 'Harry Potter', 'Jurassic Park', 'Forrest Gump', 'Gladiador',
    'Inception', 'Shrek', 'Toy Story', 'O Rei Leão', 'Pulp Fiction', 'Interestelar', 'Os Vingadores'
  ],
  Objetos: [
    'Cadeira', 'Mesa', 'Lâmpada', 'Relógio', 'Televisão', 'Celular', 'Livro', 'Caneta', 'Óculos', 'Chave',
    'Garfo', 'Prato', 'Vaso', 'Espelho', 'Tesoura', 'Guarda-chuva', 'Mochila', 'Câmera', 'Fone', 'Abajur'
  ],
  Comida: [
    'Pizza', 'Hambúrguer', 'Sorvete', 'Bolo', 'Arroz', 'Feijão', 'Salada', 'Sushi', 'Chocolate', 'Maçã',
    'Banana', 'Laranja', 'Queijo', 'Pão', 'Ovo', 'Frango', 'Batata', 'Macarrão', 'Café', 'Suco'
  ],
  'Times da NBA': [
    'Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets', 'Chicago Bulls',
    'Cleveland Cavaliers', 'Dallas Mavericks', 'Denver Nuggets', 'Detroit Pistons', 'Golden State Warriors',
    'Houston Rockets', 'Indiana Pacers', 'Los Angeles Clippers', 'Los Angeles Lakers', 'Memphis Grizzlies',
    'Miami Heat', 'Milwaukee Bucks', 'Minnesota Timberwolves', 'New Orleans Pelicans', 'New York Knicks',
    'Oklahoma City Thunder', 'Orlando Magic', 'Philadelphia 76ers', 'Phoenix Suns', 'Portland Trail Blazers',
    'Sacramento Kings', 'San Antonio Spurs', 'Toronto Raptors', 'Utah Jazz', 'Washington Wizards'
  ]
};

const MAX_JOGADORES_POR_SALA = 3;
const RODADAS_POR_PARTIDA = 3;

// Estado: salaId -> { jogadores, iniciado, categoria, placar, partida? }
const salas = new Map();

// socketId -> { salaId, nome, papel?, palavra? }
const jogadores = new Map();

function gerarIdSala() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/** Sorteia uma palavra apenas da categoria informada. Categoria deve existir em CATEGORIAS. */
function escolherPalavra(categoria) {
  const palavras = CATEGORIAS[categoria];
  if (!palavras || palavras.length === 0) return null;
  return palavras[Math.floor(Math.random() * palavras.length)];
}

function getCategoriasDisponiveis() {
  return Object.keys(CATEGORIAS);
}

function embaralhar(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Inicializa ou reinicia uma partida na sala. */
function iniciarPartida(sala) {
  const palavraSecreta = escolherPalavra(sala.categoria);
  const indiceImpostor = embaralhar([0, 1, 2])[0];
  const playerOrder = embaralhar([0, 1, 2]);

  sala.partida = {
    indiceImpostor,
    palavraSecreta,
    phase: 'jogando',
    round: 0,
    turnIndex: 0,
    playerOrder,
    words: {},
    votes: {},
    votacaoPedida: new Set()
  };

  sala.jogadores.forEach((j, i) => {
    const ehImpostor = i === indiceImpostor;
    const payload = {
      papel: ehImpostor ? 'impostor' : 'inocente',
      mensagem: ehImpostor ? 'Você é o impostor.' : 'Você é inocente.'
    };
    if (!ehImpostor) {
      payload.palavra = palavraSecreta;
      payload.categoria = sala.categoria;
    }
    io.to(j.id).emit('revelar_papel', payload);
  });

  emitirEstadoJogo(sala);
}

function emitirEstadoJogo(sala) {
  if (!sala.codigo || !sala.partida) return;
  const partida = sala.partida;
  const vezIndice = partida.playerOrder[partida.turnIndex];
  const vezJogador = sala.jogadores[vezIndice];
  const payload = {
    phase: partida.phase,
    round: partida.round,
    turnIndex: partida.turnIndex,
    playerOrder: partida.playerOrder,
    vezDe: { id: vezJogador.id, nome: vezJogador.nome },
    words: partida.words,
    placar: sala.placar || {},
    jogadores: sala.jogadores.map(j => ({ id: j.id, nome: j.nome })),
    votacaoPedidaCount: partida.votacaoPedida ? partida.votacaoPedida.size : 0
  };
  io.to(sala.codigo).emit('estado_jogo', payload);
}

io.on('connection', (socket) => {
  socket.on('pedir_categorias', () => {
    socket.emit('categorias_disponiveis', getCategoriasDisponiveis());
  });

  socket.on('criar_sala', (payload) => {
    const nome = typeof payload === 'string' ? payload : (payload && payload.nome);
    const categoria = typeof payload === 'object' && payload && payload.categoria;
    const categoriasValidas = getCategoriasDisponiveis();
    const categoriaEscolhida = categoriasValidas.includes(categoria) ? categoria : categoriasValidas[0];

    const salaId = gerarIdSala();
    salas.set(salaId, {
      jogadores: [{ id: socket.id, nome: nome || 'Jogador' }],
      iniciado: false,
      categoria: categoriaEscolhida
    });
    jogadores.set(socket.id, { salaId, nome: nome || 'Jogador' });
    socket.join(salaId);
    socket.emit('sala_criada', salaId);
    socket.emit('atualizar_espera', {
      codigo: salaId,
      jogadores: [{ nome: nome || 'Jogador' }],
      total: 1,
      max: MAX_JOGADORES_POR_SALA,
      categoria: categoriaEscolhida
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
      max: MAX_JOGADORES_POR_SALA,
      categoria: sala.categoria
    });

    if (sala.jogadores.length === MAX_JOGADORES_POR_SALA) {
      sala.iniciado = true;
      sala.codigo = codigo;
      sala.placar = {};
      sala.jogadores.forEach(j => { sala.placar[j.id] = 0; });
      iniciarPartida(sala);
    }
  });

  socket.on('pedir_estado', () => {
    const dados = jogadores.get(socket.id);
    if (!dados) return;
    const sala = salas.get(dados.salaId);
    if (!sala || !sala.iniciado || !sala.partida) return;
    emitirEstadoJogo(sala);
  });

  socket.on('pedir_votacao', () => {
    const dados = jogadores.get(socket.id);
    if (!dados) return;
    const sala = salas.get(dados.salaId);
    if (!sala || !sala.partida) return;
    const partida = sala.partida;
    if (partida.phase !== 'jogando') return;
    partida.votacaoPedida = partida.votacaoPedida || new Set();
    partida.votacaoPedida.add(socket.id);
    const quantos = partida.votacaoPedida.size;
    if (quantos >= 2) {
      partida.votacaoPedida.clear();
      partida.phase = 'votacao';
    }
    emitirEstadoJogo(sala);
  });

  socket.on('enviar_palavra', (palavra) => {
    const dados = jogadores.get(socket.id);
    if (!dados) {
      socket.emit('erro', 'Você não está em uma sala.');
      return;
    }
    const sala = salas.get(dados.salaId);
    if (!sala || !sala.partida) {
      socket.emit('erro', 'Partida não encontrada.');
      return;
    }
    const partida = sala.partida;
    if (partida.phase !== 'jogando') {
      socket.emit('erro', 'Não é momento de enviar palavra.');
      return;
    }
    const vezIndice = partida.playerOrder[partida.turnIndex];
    const jogadorDaVez = sala.jogadores[vezIndice];
    if (socket.id !== jogadorDaVez.id) {
      socket.emit('erro', 'Não é a sua vez.');
      return;
    }
    const palavraTrim = (palavra && String(palavra).trim()) || '';
    if (!palavraTrim) {
      socket.emit('erro', 'Digite uma palavra.');
      return;
    }
    if (!partida.words[socket.id]) partida.words[socket.id] = [];
    if (partida.words[socket.id][partida.round] !== undefined) {
      socket.emit('erro', 'Você já enviou palavra nesta rodada.');
      return;
    }
    partida.words[socket.id][partida.round] = palavraTrim;

    io.to(sala.codigo).emit('palavra_revelada', {
      jogadorId: socket.id,
      jogadorNome: dados.nome,
      palavra: palavraTrim,
      round: partida.round
    });

    partida.turnIndex++;
    if (partida.turnIndex >= 3) {
      partida.turnIndex = 0;
      partida.round++;
      if (partida.round >= RODADAS_POR_PARTIDA) {
        partida.phase = 'votacao';
      }
    }
    emitirEstadoJogo(sala);
  });

  socket.on('votar', (votedId) => {
    const dados = jogadores.get(socket.id);
    if (!dados) {
      socket.emit('erro', 'Você não está em uma sala.');
      return;
    }
    const sala = salas.get(dados.salaId);
    if (!sala || !sala.partida) {
      socket.emit('erro', 'Partida não encontrada.');
      return;
    }
    const partida = sala.partida;
    if (partida.phase !== 'votacao') {
      socket.emit('erro', 'Não é fase de votação.');
      return;
    }
    if (votedId === socket.id) {
      socket.emit('erro', 'Você não pode votar em si mesmo.');
      return;
    }
    const votadoValido = sala.jogadores.some(j => j.id === votedId);
    if (!votadoValido) {
      socket.emit('erro', 'Jogador inválido.');
      return;
    }
    if (partida.votes[socket.id] !== undefined) {
      socket.emit('erro', 'Você já votou.');
      return;
    }
    partida.votes[socket.id] = votedId;

    const numVotos = Object.keys(partida.votes).length;
    io.to(sala.codigo).emit('voto_registrado', { quantos: numVotos, necessario: 3 });

    if (numVotos < 3) return;

    const votosPorJogador = {};
    sala.jogadores.forEach(j => { votosPorJogador[j.id] = 0; });
    Object.values(partida.votes).forEach(id => { votosPorJogador[id] = (votosPorJogador[id] || 0) + 1; });

    let maisVotadoId = null;
    let maxVotos = 0;
    for (const [id, count] of Object.entries(votosPorJogador)) {
      if (count > maxVotos) {
        maxVotos = count;
        maisVotadoId = id;
      }
    }
    const impostorId = sala.jogadores[sala.partida.indiceImpostor].id;
    const impostorFoiMaisVotado = maisVotadoId === impostorId;

    if (impostorFoiMaisVotado) {
      sala.jogadores.forEach(j => {
        if (j.id !== impostorId) sala.placar[j.id] = (sala.placar[j.id] || 0) + 1;
      });
    } else {
      sala.placar[impostorId] = (sala.placar[impostorId] || 0) + 5;
    }

    const resultado = {
      impostorId,
      maisVotadoId,
      impostorFoiMaisVotado,
      placar: sala.placar,
      jogadores: sala.jogadores.map(j => ({ id: j.id, nome: j.nome }))
    };
    io.to(sala.codigo).emit('resultado_partida', resultado);

    partida.phase = 'resultado';
    const codigoSala = sala.codigo;
    setTimeout(() => {
      const s = salas.get(codigoSala);
      if (!s || !s.partida || s.partida.phase !== 'resultado') return;
      iniciarPartida(s);
    }, 6000);
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
            max: MAX_JOGADORES_POR_SALA,
            categoria: sala.categoria
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
