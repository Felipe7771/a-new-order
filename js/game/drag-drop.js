/* ============================================================
   DragDrop — arrastar da reserva pra um slot vazio do tabuleiro,
   OU arrastar um boneco JÁ EM CAMPO pra outro slot vazio do
   mesmo lado (reposicionamento via MOBS).
   Usa a API nativa de drag&drop, sem libs.
============================================================ */
const DragDrop = {
  attachDragSource(el, reserveIndex) {
    el.addEventListener('dragstart', (e) => {
      const character = state.reserves.ally[reserveIndex];
      if (!character) { e.preventDefault(); return; }
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({ reserveIndex }));
    });
  },

  // Fonte de arrasto pra um slot do TABULEIRO (reposicionamento).
  // A checagem de "pode arrastar?" acontece aqui, no dragstart, e
  // não só no atributo draggable do elemento — assim reflete
  // sempre o estado mais atual (mobs pode ter mudado desde o
  // último render).
  attachBoardDragSource(el, row, col) {
    el.addEventListener('dragstart', (e) => {
      const character = state.board[row][col];
      const canMove = character && character.owner === 'ally' && state.mobs.ally > 0;
      if (!canMove) { e.preventDefault(); return; }
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({ fromRow: row, fromCol: col }));
    });
  },

  attachDropTarget(el) {
    const row = () => Number(el.dataset.row);
    const col = () => Number(el.dataset.col);
    // slot vazio E dentro do próprio campo — vale tanto pra soltar
    // um boneco da reserva quanto pra reposicionar um boneco que já
    // está na arena (nunca pode soltar no campo inimigo).
    const canDropHere = () => state.board[row()][col()] === null && isMyColumn(col());

    el.addEventListener('dragover', (e) => {
      if (canDropHere()) {
        e.preventDefault();
        el.classList.add('slot--dragover');
      }
      // Se não pode soltar aqui, NÃO chama preventDefault() — isso faz
      // o navegador mostrar o cursor de "não permitido" sozinho, sem
      // precisar de CSS/JS extra pra isso.
    });

    el.addEventListener('dragleave', () => el.classList.remove('slot--dragover'));

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('slot--dragover');
      if (!canDropHere()) return; // reforça a checagem (o campo inimigo nunca entra aqui)

      let payload;
      try { payload = JSON.parse(e.dataTransfer.getData('text/plain')); }
      catch { return; }

      // Reposicionamento na arena (gasta 1 MOBS) — payload traz
      // fromRow/fromCol em vez de reserveIndex.
      if (Number.isInteger(payload?.fromRow) && Number.isInteger(payload?.fromCol)) {
        if (payload.fromRow === row() && payload.fromCol === col()) return; // soltou na própria origem
        window.Game.moveDoll(payload.fromRow, payload.fromCol, row(), col());
        return;
      }

      // Colocação vinda da reserva (fluxo original).
      const character = state.reserves.ally[payload.reserveIndex];
      if (!character) return;

      // Não mexe em state.board/state.reserves aqui — quem manda agora
      // é o Firestore. O onSnapshot (Game.syncRoom) redesenha tudo pros
      // dois lados quando a confirmação da escrita voltar.
      window.Game.placeDoll(row(), col(), payload.reserveIndex);
    });
  },
};