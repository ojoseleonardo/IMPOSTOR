(function () {
  const socket = io();

  const telaEntrada = document.getElementById('tela-entrada');
  const telaEspera = document.getElementById('tela-espera');
  const telaRevelacao = document.getElementById('tela-revelacao');
  const telaJogo = document.getElementById('tela-jogo');
  const msgErro = document.getElementById('msg-erro');
  const codigoSalaDisplay = document.getElementById('codigo-sala');
  const listaJogadores = document.getElementById('lista-jogadores');
  const numJogadores = document.getElementById('num-jogadores');
  const textoPapel = document.getElementById('texto-papel');
  const textoCategoria = document.getElementById('texto-categoria');
  const textoPalavra = document.getElementById('texto-palavra');
  const categoriaCriar = document.getElementById('categoria-criar');
  const categoriaSalaDisplay = document.getElementById('categoria-sala-display');
  const categoriaSala = document.getElementById('categoria-sala');

  const placarJogo = document.getElementById('placar-jogo');
  const rodadaInfo = document.getElementById('rodada-info');
  const textoVez = document.getElementById('texto-vez');
  const boxEnviarPalavra = document.getElementById('box-enviar-palavra');
  const inputPalavra = document.getElementById('input-palavra');
  const btnEnviarPalavra = document.getElementById('btn-enviar-palavra');
  const boxVotacao = document.getElementById('box-votacao');
  const listaVotos = document.getElementById('lista-votos');
  const boxResultado = document.getElementById('box-resultado');
  const tituloResultado = document.getElementById('titulo-resultado');
  const textoResultado = document.getElementById('texto-resultado');
  const novaPartidaInfo = document.getElementById('nova-partida-info');
  const blocosJogadores = document.getElementById('blocos-jogadores');
  const boxPalavraSempre = document.getElementById('box-palavra-sempre');
  const boxIniciarVotacao = document.getElementById('box-iniciar-votacao');
  const textoVotacaoPedida = document.getElementById('texto-votacao-pedida');
  const btnIniciarVotacao = document.getElementById('btn-iniciar-votacao');

  let estadoAtual = null;
  let revelacaoRecente = false;
  let meuPapel = null;
  let minhaPalavra = null;
  let minhaCategoria = null;
  let pediuVotacao = false;

  socket.emit('pedir_categorias');

  function mostrarTela(id) {
    telaEntrada.classList.add('oculta');
    telaEspera.classList.add('oculta');
    telaRevelacao.classList.add('oculta');
    telaJogo.classList.add('oculta');
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
    pediuVotacao = false;
    meuPapel = data.palavra ? 'inocente' : 'impostor';
    minhaPalavra = data.palavra || null;
    minhaCategoria = data.categoria || null;
    mostrarTela('tela-revelacao');
    revelacaoRecente = true;
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
  });

  function renderizarTelaJogo() {
    if (!estadoAtual) return;
    const estado = estadoAtual;
    const meuId = socket.id;
    const jogadores = estado.jogadores || [];
    const placar = estado.placar || {};
    const words = estado.words || {};
    const phase = estado.phase || 'jogando';
    const round = (estado.round || 0) + 1;
    const vezDe = estado.vezDe || {};
    const playerOrder = estado.playerOrder || [0, 1, 2];
    const votacaoPedidaCount = estado.votacaoPedidaCount || 0;

    if (meuPapel === 'inocente' && minhaPalavra) {
      boxPalavraSempre.textContent = 'Palavra: ' + minhaPalavra + (minhaCategoria ? ' (' + minhaCategoria + ')' : '');
      boxPalavraSempre.className = 'box-palavra-sempre inocente';
      boxPalavraSempre.style.display = '';
    } else if (meuPapel === 'impostor') {
      boxPalavraSempre.textContent = 'Você é o impostor. (Sem palavra secreta)';
      boxPalavraSempre.className = 'box-palavra-sempre impostor';
      boxPalavraSempre.style.display = '';
    } else {
      boxPalavraSempre.style.display = 'none';
    }

    placarJogo.innerHTML = jogadores
      .map(j => `<span class="placar-item">${escapeHtml(j.nome)}: <strong>${placar[j.id] ?? 0}</strong></span>`)
      .join('');

    rodadaInfo.textContent = `Rodada ${round} de 3`;

    boxIniciarVotacao.classList.add('oculta');
    if (phase === 'jogando') {
      boxIniciarVotacao.classList.remove('oculta');
      textoVotacaoPedida.textContent = votacaoPedidaCount >= 2
        ? 'Iniciando votação...'
        : votacaoPedidaCount === 0
          ? '2 jogadores precisam apertar para iniciar a votação.'
          : votacaoPedidaCount + '/2 jogadores querem iniciar votação.';
      btnIniciarVotacao.disabled = pediuVotacao;
      btnIniciarVotacao.textContent = pediuVotacao ? 'Você já pediu votação' : 'Iniciar votação';
    }

    blocosJogadores.innerHTML = jogadores
      .map((j, idx) => {
        const ordem = playerOrder.indexOf(idx);
        const palavrasDoJogador = words[j.id] || [];
        const listItems = [0, 1, 2].map(i => {
          const p = palavrasDoJogador[i];
          return p ? `<li>${escapeHtml(p)}</li>` : '<li class="vazio">—</li>';
        });
        return `
          <div class="bloco-jogador" data-jogador-id="${escapeHtml(j.id)}">
            <div class="nome-jogador">${escapeHtml(j.nome)}</div>
            <ul class="palavras-jogador">${listItems.join('')}</ul>
          </div>`;
      })
      .join('');

    boxEnviarPalavra.classList.add('oculta');
    boxVotacao.classList.add('oculta');
    boxResultado.classList.add('oculta');

    if (phase === 'jogando') {
      textoVez.textContent = vezDe.id === meuId
        ? 'Sua vez! Envie uma palavra relacionada ao tema.'
        : `Vez de ${escapeHtml(vezDe.nome || '?')}. Aguardando...`;
      if (vezDe.id === meuId) {
        boxEnviarPalavra.classList.remove('oculta');
        inputPalavra.disabled = false;
        inputPalavra.removeAttribute('readonly');
        inputPalavra.value = '';
        inputPalavra.focus();
      } else {
        inputPalavra.disabled = true;
        inputPalavra.setAttribute('readonly', 'readonly');
        inputPalavra.value = '';
      }
      boxVotacao.classList.add('oculta');
    } else if (phase === 'votacao') {
      textoVez.textContent = 'Fase de votação.';
      boxVotacao.classList.remove('oculta');
      const outros = jogadores.filter(j => j.id !== meuId);
      listaVotos.innerHTML = outros
        .map(j => `<button type="button" data-voto-id="${escapeHtml(j.id)}">${escapeHtml(j.nome)}</button>`)
        .join('');
      listaVotos.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          const votedId = btn.getAttribute('data-voto-id');
          socket.emit('votar', votedId);
          listaVotos.querySelectorAll('button').forEach(b => { b.disabled = true; });
        });
      });
    }
  }

  socket.on('estado_jogo', (data) => {
    estadoAtual = data;
    if (revelacaoRecente) {
      revelacaoRecente = false;
      setTimeout(() => {
        mostrarTela('tela-jogo');
        renderizarTelaJogo();
      }, 2000);
    } else {
      mostrarTela('tela-jogo');
      renderizarTelaJogo();
    }
  });

  socket.on('palavra_revelada', () => {
    socket.emit('pedir_estado');
  });

  socket.on('voto_registrado', (data) => {
    if (estadoAtual && data.quantos < data.necessario) {
      textoVez.textContent = `Votos: ${data.quantos}/${data.necessario}. Aguardando todos votarem.`;
    }
  });

  socket.on('resultado_partida', (data) => {
    estadoAtual = estadoAtual || {};
    estadoAtual.placar = data.placar;
    estadoAtual.phase = 'resultado';
    mostrarTela('tela-jogo');
    renderizarTelaJogo();

    boxEnviarPalavra.classList.add('oculta');
    boxVotacao.classList.add('oculta');
    boxResultado.classList.remove('oculta');

    const impostor = data.jogadores.find(j => j.id === data.impostorId);
    const maisVotado = data.jogadores.find(j => j.id === data.maisVotadoId);

    if (data.impostorFoiMaisVotado) {
      tituloResultado.textContent = 'Impostor descoberto!';
      textoResultado.textContent = `O impostor era ${escapeHtml(impostor?.nome || '?')}. Que vergonha! Foi desmascarado na frente de todo mundo — zero talento para esconder. Inocentes +1 ponto cada.`;
    } else {
      tituloResultado.textContent = 'Impostor escapou!';
      textoResultado.textContent = `O impostor era ${escapeHtml(impostor?.nome || '?')}. Vocês erraram feio: votaram em ${escapeHtml(maisVotado?.nome || '?')} e deixaram o impostor rir da cara de vocês. Inocentes, que derrota. Impostor +5 pontos.`;
    }
    novaPartidaInfo.textContent = 'Nova partida iniciando em alguns segundos...';
    document.querySelector('.placar-label').textContent = 'Pontos:';
    placarJogo.innerHTML = (data.jogadores || [])
      .map(j => `<span class="placar-item">${escapeHtml(j.nome)}: <strong>${data.placar[j.id] ?? 0}</strong></span>`)
      .join('');
  });

  btnIniciarVotacao.addEventListener('click', () => {
    if (pediuVotacao) return;
    socket.emit('pedir_votacao');
    pediuVotacao = true;
    textoVotacaoPedida.textContent = 'Você pediu. Aguardando mais um jogador.';
    btnIniciarVotacao.disabled = true;
    btnIniciarVotacao.textContent = 'Você já pediu votação';
  });

  btnEnviarPalavra.addEventListener('click', () => {
    const palavra = inputPalavra.value.trim();
    if (!palavra) {
      mostrarErro('Digite uma palavra.');
      return;
    }
    socket.emit('enviar_palavra', palavra);
    inputPalavra.value = '';
    mostrarErro('');
  });

  inputPalavra.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnEnviarPalavra.click();
  });

  socket.on('erro', (texto) => {
    mostrarErro(texto);
  });

  function escapeHtml(texto) {
    if (texto == null) return '';
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
  }
})();
