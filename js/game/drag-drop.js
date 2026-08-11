/* ============================================================
   DragDrop — arrastar da reserva pra um slot vazio do tabuleiro.
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

  attachDropTarget(el) {
    const row = () => Number(el.dataset.row);
    const col = () => Number(el.dataset.col);
    // slot vazio E dentro do próprio campo — as duas condições que
    // precisam valer pra soltar um boneco aqui.
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

      const character = state.reserves.ally[payload.reserveIndex];
      if (!character) return;

      // Não mexe em state.board/state.reserves aqui — quem manda agora
      // é o Firestore. O onSnapshot (Game.syncRoom) redesenha tudo pros
      // dois lados quando a confirmação da escrita voltar.
      window.Game.placeDoll(row(), col(), payload.reserveIndex);
    });
  },
};
