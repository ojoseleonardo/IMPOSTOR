(function () {
  const socket = io();

  const telaEntrada = document.getElementById('tela-entrada');
  const telaEspera = document.getElementById('tela-espera');
  const telaRevelacao = document.getElementById('tela-revelacao');
  const msgErro = document.getElementById('msg-erro');
  const codigoSalaDisplay = document.getElementById('codigo-sala');
  const listaJogadores = document.getElementById('lista-jogadores');
  const numJogadores = document.getElementById('num-jogadores');
  const textoPapel = document.getElementById('texto-papel');
  const textoCategoria = document.getElementById('texto-categoria');
  const textoPalavra = document.getElementById('texto-palavra');
  const textoReinicio = document.getElementById('texto-reinicio');
  const btnReiniciar = document.getElementById('btn-reiniciar');
  const categoriaCriar = document.getElementById('categoria-criar');
  const categoriaSalaDisplay = document.getElementById('categoria-sala-display');
  const categoriaSala = document.getElementById('categoria-sala');

  let pediuReinicio = false;

  socket.emit('pedir_categorias');

  function mostrarTela(id) {
    telaEntrada.classList.add('oculta');
    telaEspera.classList.add('oculta');
    telaRevelacao.classList.add('oculta');
    document.getElementById(id).classList.remove('oculta');
    msgErro.textContent = '';
  }

  function mostrarErro(texto) {
    msgErro.textContent = texto;
  }

  socket.on('categorias_disponiveis', (lista) => {
    categoriaCriar.innerHTML = lista.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  });

  document.getElementById('btn-criar').addEventListener('click', () => {
    const nome = document.getElementById('nome-criar').value.trim() || 'Jogador';
    const categoria = categoriaCriar.value || categoriaCriar.options[0]?.value;
    socket.emit('criar_sala', { nome, categoria });
  });

  document.getElementById('btn-entrar').addEventListener('click', () => {
    const codigo = document.getElementById('codigo-entrar').value.trim().toUpperCase();
    const nome = document.getElementById('nome-entrar').value.trim() || 'Jogador';
    if (!codigo) {
      mostrarErro('Digite o código da sala.');
      return;
    }
    socket.emit('entrar_sala', { salaId: codigo, nome });
  });

  socket.on('sala_criada', (salaId) => {
    codigoSalaDisplay.textContent = salaId;
    mostrarTela('tela-espera');
  });

  socket.on('atualizar_espera', (data) => {
    mostrarTela('tela-espera');
    if (data.codigo) codigoSalaDisplay.textContent = data.codigo;
    document.getElementById('codigo-sala-display').style.display = data.codigo ? 'block' : 'none';
    if (data.categoria) {
      categoriaSala.textContent = data.categoria;
      categoriaSalaDisplay.style.display = 'block';
    } else {
      categoriaSalaDisplay.style.display = 'none';
    }
    numJogadores.textContent = data.total;
    listaJogadores.innerHTML = data.jogadores
      .map(j => `<li>${escapeHtml(j.nome)}</li>`)
      .join('');
  });

  socket.on('revelar_papel', (data) => {
    mostrarTela('tela-revelacao');
    textoPapel.textContent = data.mensagem;
    if (data.palavra) {
      if (data.categoria) {
        textoCategoria.textContent = 'Categoria: ' + data.categoria;
        textoCategoria.classList.remove('oculta');
      } else {
        textoCategoria.classList.add('oculta');
      }
      textoPalavra.textContent = 'Palavra: ' + data.palavra;
      textoPalavra.classList.remove('oculta');
      telaRevelacao.classList.add('inocente');
      telaRevelacao.classList.remove('impostor');
    } else {
      textoCategoria.classList.add('oculta');
      textoPalavra.classList.add('oculta');
      telaRevelacao.classList.add('impostor');
      telaRevelacao.classList.remove('inocente');
    }
    atualizarUIReinicio(0, 2);
    pediuReinicio = false;
  });

  function atualizarUIReinicio(quantos, necessario) {
    textoReinicio.textContent = quantos >= necessario
      ? 'Reiniciando...'
      : quantos === 0
        ? 'Pelo menos 2 jogadores precisam apertar para reiniciar.'
        : quantos + '/' + necessario + ' jogadores querem reiniciar.';
    btnReiniciar.disabled = pediuReinicio;
    btnReiniciar.textContent = pediuReinicio ? 'Você já pediu reinício' : 'Reiniciar jogo';
  }

  btnReiniciar.addEventListener('click', () => {
    if (pediuReinicio) return;
    socket.emit('pedir_reinicio');
    pediuReinicio = true;
    atualizarUIReinicio(1, 2);
  });

  socket.on('atualizar_reinicio', (data) => {
    if (data.quantos === 0) {
      pediuReinicio = false;
    }
    atualizarUIReinicio(data.quantos, data.necessario);
  });

  socket.on('erro', (texto) => {
    mostrarErro(texto);
  });

  function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
  }
})();
