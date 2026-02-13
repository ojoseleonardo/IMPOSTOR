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

// Estado: salaId -> { jogadores, iniciado, categoria }
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
      sala.reinicioPedido = new Set();
      const palavraSorteada = escolherPalavra(sala.categoria);
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
          payload.categoria = sala.categoria;
        }
        io.to(j.id).emit('revelar_papel', payload);
      });
    }
  });

  socket.on('pedir_reinicio', () => {
    const dados = jogadores.get(socket.id);
    if (!dados) return;
    const sala = salas.get(dados.salaId);
    if (!sala || !sala.iniciado || !sala.jogadores) return;

    sala.reinicioPedido = sala.reinicioPedido || new Set();
    sala.reinicioPedido.add(socket.id);

    const quantos = sala.reinicioPedido.size;
    const necessario = 2;
    io.to(dados.salaId).emit('atualizar_reinicio', { quantos, necessario });

    if (quantos >= necessario) {
      sala.reinicioPedido.clear();
      const palavraSorteada = escolherPalavra(sala.categoria);
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
          payload.categoria = sala.categoria;
        }
        io.to(j.id).emit('revelar_papel', payload);
      });
      io.to(dados.salaId).emit('atualizar_reinicio', { quantos: 0, necessario });
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
