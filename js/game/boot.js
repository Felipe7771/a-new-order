// Carrega o catálogo assim que a página abre — precisa estar
// pronto ANTES da partida começar, porque o Modal e o styles.js
// (definyStyle) consultam a variável global `catalog`.
async function boot() {
  catalog = await carregarCatalog();
}

/* ============================================================
   Boot
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  Board.build(document.getElementById('board'));
  Reserve.build(document.getElementById('reserve-ally'));
  Modal.init(document.getElementById('modal-overlay'));
  EntranceFX.init(document.getElementById('entrance-overlay'));
  CombatFX.init(document.getElementById('combat-overlay'));
  PlayerNames.init(
    document.getElementById('player-name-ally'),
    document.getElementById('player-name-enemy')
  );
  PlayerStats.init(
    document.getElementById('player-dolls-ally'),
    document.getElementById('player-mobs-ally'),
    document.getElementById('player-dolls-enemy'),
    document.getElementById('player-mobs-enemy')
  );
  TurnBanner.init(document.getElementById('turn-banner-overlay'));
  TurnSideLabels.init(
    document.getElementById('turn-side-label-left'),
    document.getElementById('turn-side-label-right')
  );
  EndTurnButton.init(
    document.getElementById('btn-end-turn'),
    document.getElementById('turn-clock-dial'),
    document.getElementById('turn-clock-minute'),
    document.getElementById('turn-clock-hint')
  );

  boot();

  // ---- Áudio: liga tudo de uma vez, aqui no boot ----------------
  // bindUISounds cobre qualquer elemento com data-sfx-click/hover,
  // inclusive os criados depois (slots, botão de fechar modal).
  AudioManager.bindUISounds();
  AudioManager.attachTypingSound(document.getElementById('input-username'));
  // Autoplay do navegador só libera som após um gesto do usuário —
  // isso dispara a música do menu no primeiro clique/tecla.
  AudioManager.primeOnFirstInteraction('menu');

  // Botões acima da Reserva — a lógica de fato (confirmar rendição,
  // abrir painel de configurações) entra aqui quando existir.
  document.getElementById('btn-surrender').addEventListener('click', () => {
    console.log('[Trincheira] Render-se clicado — plugar lógica de rendição aqui.');
  });
  document.getElementById('btn-settings').addEventListener('click', () => {
    console.log('[Trincheira] Configurações clicado — plugar painel de configurações aqui.');
  });

  // API pública — é aqui que a integração com Firebase entra depois.
  // Ex.: onSnapshot(docRef, (doc) => Game.loadBoardState(doc.data().board))
window.Game = {
  CONFIG,
  state,
  Board,
  Reserve,
  Modal,
  PlayerNames,
  PlayerStats,
  roomId: null,
  meId: null,
  opponentId: null,
    loadBoardState(newBoard) {
      state.board = newBoard;
      Board.renderAll();
    },
    loadAllyReserveState(newReserve) {
      state.reserves.ally = newReserve;
      Reserve.renderAll();
    },
    setPlayerNames(playerName, enemyName) {
      PlayerNames.setNames(playerName, enemyName);
    },

    // Chamado pelo js/menu.js quando o Firestore fecha uma sala
    // (dono + convidado presentes, 12 bonecos já sorteados pros
    // dois lados). Só desenha o que já veio pronto — nenhuma
    // lógica de turno/combate mexe aqui ainda.
startMatch({ roomId, me, opponent, myReserve, opponentReserve, role, turn, myMobs, opponentMobs }) {
    this.roomId = roomId;
    this.meId = me.id;
    this.opponentId = opponent.id;
    this._lastMoveSeq = null; // rastreia qual "moveSeq" já foi processado (evita tocar o som de novo)

    CONFIG.myRole = role === 'guest' ? 'guest' : 'owner';

    CONFIG.playerName = me.name;
    CONFIG.enemyName = opponent.name;
    PlayerNames.setNames(me.name, opponent.name);

    // Precisa vir ANTES do Board/Reserve.renderAll() logo abaixo —
    // updateDraggability()/Reserve.renderSlot() consultam canIActNow(),
    // que lê state.turn. Se gravar depois, o primeiro render sairia
    // com o draggable calculado a partir de um turno desatualizado.
    state.turn = turn ? { phase: turn.phase, current: turn.current } : null;

    state.mobs.ally = typeof myMobs === 'number' ? myMobs : 3;
    state.mobs.enemy = typeof opponentMobs === 'number' ? opponentMobs : 3;

    Reserve.syncAlly(myReserve.map((d) => characterFromRoomData(d, 'ally')));
    state.reserves.enemy = opponentReserve.map((d) => characterFromRoomData(d, 'enemy'));

    Board.build(document.getElementById('board'));
    Board.renderAll();
    PlayerStats.update();

    AudioManager.enterBoard();
    document.getElementById('app').classList.remove('pre-match');
    this.handleTurnSync(turn, null);
  },

  // Chamado depois de startMatch() e a cada syncRoom() com o novo
// data.turn. Decide: mostra o banner (só quando o turno mudou de
// verdade), mostra/esconde o botão de encerrar, dispara a animação
// de combate (CombatFX) quando um turno de ATAQUE novo começa, e
// (re)agenda o timer local que dispara o avanço automático quando
// o prazo acaba.
handleTurnSync(turn, data) {
  clearTimeout(this._turnTimeout);

  state.turn = turn ? { phase: turn.phase, current: turn.current } : null;

  if (!turn) {
    EndTurnButton.hide();
    TurnSideLabels.hide();
    return;
  }

  const isNewTurn = this._lastTurnNumber !== turn.number;
  this._lastTurnNumber = turn.number;

  if (isNewTurn) {
    const activeName = turn.current === this.meId ? CONFIG.playerName : CONFIG.enemyName;
    TurnBanner.show(activeName, turn.phase);

    // turn.combat só existe (e só é novo) na virada pra um turno de
    // ATAQUE — computeCombatResolution já rodou no servidor com o
    // snapshot de ANTES de qualquer dano. Aqui é só desenhar em cima.
    if (turn.phase === 'attack' && turn.combat) {
      CombatFX.playTurn(turn.combat);
    }
  }

  // Rótulos ao lado do relógio: de quem é o turno ATUAL, e a
  // PREVISÃO de quem/qual fase vem a seguir. Só faz sentido mostrar
  // essa previsão durante a DEFESA — durante o ataque o próximo já
  // é sempre óbvio (o mesmo jogador cai na defesa dele em seguida),
  // então mostrar a plaquinha ali só confundiria (parece que o
  // próximo seria do oponente, o que nunca acontece nesse caso).
  const currentIsMe = turn.current === this.meId;
  const nextTurn = turn.phase === 'defense' ? this.predictNextTurn(turn) : null;
  TurnSideLabels.update(
    currentIsMe,
    nextTurn ? { phase: nextTurn.phase, isMe: nextTurn.current === this.meId } : null
  );

const isMyDefenseTurn = turn.phase === 'defense' && turn.current === this.meId;

  if (isMyDefenseTurn) {
    // Reserva vazia = não tem mais boneco pra jogar, então já libera
    // o botão de encerrar mesmo sem ter agido ainda nesse turno.
    const reserveEmpty = state.reserves.ally.filter(Boolean).length === 0;
    EndTurnButton.showActive({
      enabled: !!turn.hasActed || reserveEmpty,
      deadlineMs: turn.deadline.toMillis(),
      totalMs: DEFENSE_TURN_MS_CLIENT,
    });
  } else {
    EndTurnButton.showIdle();
  }

  // Qualquer cliente conectado pode disparar o avanço — a transação
  // em autoAdvanceTurn garante que só o primeiro a chegar processa
  // de verdade (ver checagem de turn.number em matchmaking.js).
  const remainingMs = turn.deadline.toMillis() - Date.now();
  this._turnTimeout = setTimeout(() => {
    window.Matchmaking.autoAdvanceTurn(this.roomId, turn.number).catch((err) => {
      console.warn('[Trincheira] falha ao avançar turno automaticamente:', err.message);
    });
  }, Math.max(0, remainingMs) + 250);
},

async endTurn() {
  if (!this.roomId || !this.meId) return;
  try {
    await window.Matchmaking.endTurn(this.roomId, this.meId);
  } catch (err) {
    console.error('[Trincheira] não foi possível encerrar o turno:', err);
  }
},

// Espelha afterDefense/afterAttack de matchmaking.js, só que em
// cima do estado LOCAL (state.board + meId/opponentId) — NUNCA
// escreve nada no Firestore, é só um palpite pra UI (TurnSideLabels).
// Se por alguma corrida rara divergir do que o servidor decidir de
// verdade, o próximo snapshot real corrige sozinho, sem drama.
predictNextTurn(turn) {
  if (!turn || !this.meId || !this.opponentId) return null;

  if (turn.phase === 'attack') {
    // depois do ataque, quem defende em seguida é o MESMO jogador
    return { phase: 'defense', current: turn.current };
  }

  // depois da defesa, quem age é sempre o ADVERSÁRIO — ataca se
  // tiver bonecos em campo, senão pula direto pra defesa dele
  const attackerId = turn.current === this.meId ? this.opponentId : this.meId;
  const attackerRole = attackerId === this.meId ? 'ally' : 'enemy';
  const attackerHasDolls = state.board.some((row) => row.some((c) => c && c.owner === attackerRole));

  return attackerHasDolls
    ? { phase: 'attack', current: attackerId }
    : { phase: 'defense', current: attackerId };
},

// Chamado pelo menu.js quando a sala some NO MEIO da partida
// (encerrada por inatividade). Reseta tudo e devolve pro pre-match.
handleRoomClosed() {
  clearTimeout(this._turnTimeout);
  this._lastTurnNumber = null;
  this._lastMoveSeq = null;
  this.roomId = null;
  this.meId = null;
  this.opponentId = null;
  EndTurnButton.hide();
  TurnSideLabels.hide();
  document.getElementById('app').classList.add('pre-match');
  AudioManager.enterMenu();
},

  // Chamado a cada onSnapshot depois que a partida começou.
  // Reconstrói tabuleiro + reservas a partir do documento da sala.
  // Detecta, por DIFF direto contra o state.board anterior:
  //   - quem entrou (vazio -> ocupado)          -> EntranceFX/vídeo
  //   - quem sumiu de vez (ocupado -> vazio)     -> Board.playExit
  //   - vida que diminuiu num boneco que CONTINUA -> Board.playLifeHit
  // A morte de verdade (sumir do board) só acontece na ETAPA 2 do
  // combate, 1s depois da vida cair na ETAPA 1 (ver DEATH_SWEEP_DELAY_MS
  // em matchmaking.js) — então esses dois diffs naturalmente disparam
  // em snapshots DIFERENTES, na ordem certa, sem precisar de nenhum
  // "seq" pra coordenar isso.
syncRoom(data) {
    if (!this.meId) return;

    // Mesma razão do startMatch: precisa vir ANTES do Board.renderAll()
    // mais abaixo, senão o draggable desse render sai calculado com o
    // turno do snapshot ANTERIOR (canIActNow() ficaria um passo atrasado).
    state.turn = data.turn ? { phase: data.turn.phase, current: data.turn.current } : null;

    // MOBS de cada lado vêm direto do documento — PlayerStats.update()
    // no fim do método já redesenha os dois contadores.
    state.mobs.ally = data.p?.[this.meId]?.mobs ?? state.mobs.ally;
    state.mobs.enemy = data.p?.[this.opponentId]?.mobs ?? state.mobs.enemy;

    const newBoard = Array.from({ length: CONFIG.corridors }, () =>
      Array(CONFIG.slotsPerSide * 2).fill(null)
    );

    const boardData = data.board || {};
    Object.entries(boardData).forEach(([key, dollData]) => {
      if (!dollData) return;
      const [r, c] = key.split('-').map(Number);
      if (Number.isNaN(r) || Number.isNaN(c)) return;
      const ownerRole = dollData.owner === this.meId ? 'ally' : 'enemy';
      newBoard[r][c] = characterFromRoomData(dollData, ownerRole);
    });

    // Se esse snapshot trouxe um moveSeq novo, as células lastMove.to
    // (destino) e lastMove.from (origem) são reposicionamento via
    // MOBS: não entram em enteredCells/exitCells (não é entrada nova
    // nem morte) — só o som da "mão".
    const isNewMove = !!data.lastMove && typeof data.moveSeq === 'number' && data.moveSeq !== this._lastMoveSeq;
    const moveToKey = isNewMove ? data.lastMove.to : null;
    const moveFromKey = isNewMove ? data.lastMove.from : null;
    let moveHappened = false;

    const enteredCells = [];
    const exitCells = [];
    const lifeHitCells = [];

    for (let r = 0; r < CONFIG.corridors; r++) {
      for (let c = 0; c < CONFIG.slotsPerSide * 2; c++) {
        const before = state.board[r][c];
        const after = newBoard[r][c];
        const key = `${r}-${c}`;

        if (!before && after) {
          if (moveToKey && key === moveToKey) {
            moveHappened = true;
            continue; // reposicionado — sem telão, sem vídeo de entrada
          }
          EntranceFX.show(after, r, c);
          enteredCells.push([r, c, after]);
          continue;
        }

        if (before && !after) {
          if (moveFromKey && key === moveFromKey) continue; // reposicionado, não é morte
          exitCells.push([r, c, before]); // sumiu de vez (ETAPA 2 do combate)
          continue;
        }

        if (before && after && after.life < before.life) {
          lifeHitCells.push([r, c]); // dano aplicado (ETAPA 1), boneco ainda no slot
        }
      }
    }

    if (isNewMove) this._lastMoveSeq = data.moveSeq;
    if (moveHappened) AudioManager.Sfx.mobsMove();

    // Marca 'entering'/'exiting' ANTES de trocar state.board/renderAll,
    // senão o renderAll chegaria nesses slots primeiro e já mostraria
    // o resultado final (arena_default ou vazio) sem tocar a mídia.
    enteredCells.forEach(([r, c, character]) => Board.playEntrance(r, c, character));
    exitCells.forEach(([r, c, character]) => Board.playExit(r, c, character));

    state.board = newBoard;
    Board.renderAll();

    // Só DEPOIS do renderAll — precisa da DOM já com o número novo
    // (renderizado por CardRenderer.buildStats) pra religar a
    // animação em cima dela (ver Board.playLifeHit).
    lifeHitCells.forEach(([r, c]) => Board.playLifeHit(r, c));

    const myReserveData = data.p?.[this.meId]?.reserve || [];
    const oppReserveData = data.p?.[this.opponentId]?.reserve || [];

    Reserve.syncAlly(myReserveData.map((d) => characterFromRoomData(d, 'ally')));
    state.reserves.enemy = oppReserveData.map((d) => characterFromRoomData(d, 'enemy'));

    PlayerStats.update();
    this.handleTurnSync(data.turn, data);
  },

async placeDoll(row, col, reserveIndex) {
    if (!this.roomId || !this.meId) {
      console.warn('[Trincheira] placeDoll chamado sem partida ativa.');
      return;
    }
    try {
      await window.Matchmaking.placeDoll(this.roomId, this.meId, reserveIndex, row, col);
    } catch (err) {
      console.error('[Trincheira] não foi possível jogar o boneco:', err);
    }
  },

  // Reposiciona um boneco já em campo pra outro slot vazio do mesmo
  // lado (drag&drop arena -> arena). Gasta 1 MOBS no server; se a
  // transação falhar (sem MOBS, fora do turno de defesa, etc.), o
  // onSnapshot simplesmente nunca chega a mudar nada.
  async moveDoll(fromRow, fromCol, toRow, toCol) {
    if (!this.roomId || !this.meId) {
      console.warn('[Trincheira] moveDoll chamado sem partida ativa.');
      return;
    }
    try {
      await window.Matchmaking.moveDoll(this.roomId, this.meId, fromRow, fromCol, toRow, toCol);
    } catch (err) {
      console.error('[Trincheira] não foi possível mover o boneco:', err);
    }
  },

    // Atalho pra testar a tela do jogo sem precisar do Firebase
    // configurado — abra o console e rode: Game.seedDemo()
    async seedDemo() {
      if (!catalog) catalog = await carregarCatalog();
      seedDemoData();
      Reserve.renderAll();
      Board.renderAll();
      PlayerStats.update();

      /* ══════════════════════════════════════════════════════════
         ██  TRANSIÇÃO: MENU  ➜  TABULEIRO  ██  (atalho de teste)
         Mesmo ponto de troca de música do startMatch() de verdade.
      ══════════════════════════════════════════════════════════ */
      AudioManager.enterBoard();

      document.getElementById('app').classList.remove('pre-match');
      document.getElementById('menu-screen').classList.add('menu-screen--hidden');
    },

  };
  // ---- Dev only: atalho pra testar 2 jogadores no mesmo navegador.
// Ctrl+Shift+2 abre uma segunda aba com ?slot=2
// (também disponível no console: Dev.openPlayer2())
});
window.Dev = {
openPlayer2() {
  const url = new URL(window.location.href);
  url.searchParams.set('slot', '2');
  window.open(url.toString(), '_blank');
},
};

document.addEventListener('keydown', (e) => {
  console.log('keydown', e.key, e.ctrlKey, e.shiftKey);
if (e.ctrlKey && e.shiftKey && e.key === '@') {
  e.preventDefault();
  Dev.openPlayer2();
}
});