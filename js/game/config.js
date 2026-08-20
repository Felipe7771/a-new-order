async function carregarCatalog() {
    const resposta = await fetch('json/catalog.json');
    const catalog = await resposta.json();

    return catalog;
}


/* ============================================================
   CONFIG — mude aqui pra mudar a forma do jogo. O DOM inteiro
   é gerado a partir disso, então alterar esses números já
   reorganiza o tabuleiro/reserva sem tocar em mais nada.
============================================================ */
const CONFIG = {
  corridors: 4,      // corredores (linhas) do tabuleiro
  slotsPerSide: 3,    // slots de cada lado, por corredor
  reserveSize: 12,    // tamanho visual da mão
  playerName: null,   // preenchido pelo Menu quando a partida começa
  enemyName: null,
  // 'owner' | 'guest' — preenchido pelo Menu quando a partida começa.
  // Define TANTO o espelhamento visual do tabuleiro (cada jogador
  // sempre vê o próprio lado à esquerda) QUANTO quais colunas o
  // jogador local tem permissão de jogar (ver isMyColumn()).
  myRole: 'owner',
};

// Precisa bater com DEFENSE_TURN_MS em matchmaking.js. É só cosmético
// (desenhar o relógio) — quem manda de verdade no prazo real é o
// deadline que vem do Firestore; isso aqui só define a duração da
// "volta completa" do ponteiro de minuto.
const DEFENSE_TURN_MS_CLIENT = 60 * 1000;

// Colunas 0..slotsPerSide-1 são sempre do OWER (regra do jogo/Firestore,
// ver matchmaking.js). Colunas slotsPerSide..2*slotsPerSide-1 são
// sempre do GUEST. Isso não muda com o ponto de vista — o que muda é
// só a ORDEM em que a gente desenha essas colunas na tela (ver
// Board.build/displayColOf).
function isOwnerColumn(col) {
  return col < CONFIG.slotsPerSide;
}

// A coluna pertence ao jogador LOCAL (baseado no papel dele na sala)?
function isMyColumn(col) {
  return CONFIG.myRole === 'guest' ? !isOwnerColumn(col) : isOwnerColumn(col);
}

// O jogador LOCAL pode agir AGORA (é fase de DEFESA e é a vez dele)?
// state.turn é mantido atualizado por Game.syncRoom/handleTurnSync
// (ver boot.js) a cada snapshot da sala. Fora de uma partida real —
// ex: Game.seedDemo(), sem sistema de turno ativo — state.turn fica
// null e isso LIBERA a interação, pra não quebrar o atalho de teste.
// Único ponto de verdade sobre "posso arrastar/soltar agora?" —
// tanto drag-drop.js (início do arrasto) quanto board.js/reserve.js
// (atributo draggable/cursor) consultam essa mesma função.
function canIActNow() {
  if (!state.turn) return true;
  return state.turn.phase === 'defense' && state.turn.current === window.Game?.meId;
}

/* ============================================================
   ESTADO — a "fonte da verdade". Tudo que é desenhado na tela
   vem daqui. É nisso que o Firebase vai escrever/ler no futuro:
   um onSnapshot substitui esses arrays e chama renderAll().

   board[row][col]:
     col 0..slotsPerSide-1        -> lado esquerdo (0 = borda, cresce em direção ao meio)
     col slotsPerSide..2*sPS-1    -> lado direito   (cresce em direção à borda)
     null = slot vazio

   reserves.ally  -> mão do jogador local (renderizada)
   reserves.enemy -> mão do oponente (só dado, sem DOM — o jogo
                     ainda não deve revelar a mão do inimigo)
============================================================ */
const state = {
  board: Array.from({ length: CONFIG.corridors }, () =>
    Array(CONFIG.slotsPerSide * 2).fill(null)
  ),
  reserves: {
    ally: Array(CONFIG.reserveSize).fill(null),
    enemy: Array(CONFIG.reserveSize).fill(null),
  },
  // Mobs = quantos bonecos o jogador pode mover no turno. A lógica
  // ainda não existe — por enquanto é só um número pra PlayerStats
  // ter o que mostrar; entra de verdade junto com o sistema de turno.
  mobs: {
    ally: 0,
    enemy: 0,
  },
  // { phase: 'defense'|'attack', current: playerId } | null.
  // null = sem sistema de turno ativo (fora de partida real).
  turn: null,
  effects: {},
  winner: ''
};