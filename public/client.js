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
  const textoPalavra = document.getElementById('texto-palavra');

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

  document.getElementById('btn-criar').addEventListener('click', () => {
    const nome = document.getElementById('nome-criar').value.trim() || 'Jogador';
    socket.emit('criar_sala', nome);
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
    numJogadores.textContent = data.total;
    listaJogadores.innerHTML = data.jogadores
      .map(j => `<li>${escapeHtml(j.nome)}</li>`)
      .join('');
  });

  socket.on('revelar_papel', (data) => {
    mostrarTela('tela-revelacao');
    textoPapel.textContent = data.mensagem;
    if (data.palavra) {
      textoPalavra.textContent = 'Palavra: ' + data.palavra;
      textoPalavra.classList.remove('oculta');
      telaRevelacao.classList.add('inocente');
      telaRevelacao.classList.remove('impostor');
    } else {
      textoPalavra.classList.add('oculta');
      telaRevelacao.classList.add('impostor');
      telaRevelacao.classList.remove('inocente');
    }
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
