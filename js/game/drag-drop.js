/* ============================================================
   DragDrop — arrastar da reserva pra um slot vazio do tabuleiro,
   OU arrastar um boneco JÁ EM CAMPO pra outro slot vazio do
   mesmo lado (reposicionamento via MOBS).

   Fluxo OTIMISTA: ao soltar num lugar válido, o boneco já
   aparece no destino (e some da origem) antes da confirmação do
   Firestore. Se a escrita falhar, tudo volta pro lugar (rollback
   automático + som de retorno). Se soltar no mesmo slot de
   origem ou em lugar inválido, o boneco só volta — sem NUNCA
   chamar o banco nesses casos.
============================================================ */

const DRAG_IMAGE_SCALE = 1.52; // mesma escala de .card-visual--reserve .card-media (152%)

const DragDrop = {
  _dragState: null, // { origin: {type,...}, character, resolved }

  /* ---------- imagem de arrasto: substitui o "fantasma" feio do
     navegador por um render 100% opaco + sombra, sempre a partir
     de animation.reserve.default do boneco ---------- */
  /* ---------- imagem de arrasto: substitui o "fantasma" feio do
     navegador por um render 100% opaco + sombra, sempre a partir
     de animation.reserve.default do boneco. Usa o tamanho REAL do
     slot de origem, pra não ficar menor que o card original. ---------- */

buildDragImage(character, sourceEl) {
  const rect = sourceEl.getBoundingClientRect();
  const width = (rect.width || 90) * DRAG_IMAGE_SCALE;
  const height = (rect.height || 120) * DRAG_IMAGE_SCALE;

  const wrap = document.createElement('div');
  wrap.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: ${width}px;
    height: ${height}px;
    pointer-events: none;
  `;

  // sombra no mesmo ponto onde o card-media real assenta
  // (bottom:0 do slot ORIGINAL, não do wrapper ampliado)
  const shadow = document.createElement('div');
  shadow.style.cssText = `
    position: absolute;
    left: 50%;
    bottom: 4%;
    width: 55%;
    height: 14%;
    transform: translateX(-50%);
    background: radial-gradient(ellipse at center, rgba(0,0,0,.92) 0%, rgba(0,0,0,.6) 45%, transparent 75%);
    filter: blur(4px);
    z-index: 0;
  `;
  wrap.appendChild(shadow);

  const src = getAnimationAsset(character.id, 'reserve', 'default');
  let mediaEl;
  if (src) {
    mediaEl = document.createElement('img');
    mediaEl.src = src;
    // preenche 100% do wrapper (que JÁ é a caixa de 152%) —
    // igual ao card-media real, sem sobra transparente extra
    mediaEl.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      z-index: 1;
      filter: drop-shadow(0 6px 10px rgba(0,0,0,.9)) drop-shadow(0 2px 4px rgba(0,0,0,.95));
    `;
  } else {
    mediaEl = document.createElement('span');
    mediaEl.textContent = character.image || '🗡️';
    mediaEl.style.cssText = `
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${height * 0.32}px;
      z-index: 1;
      filter: drop-shadow(0 6px 10px rgba(0,0,0,.9));
    `;
  }
  wrap.appendChild(mediaEl);

  document.body.appendChild(wrap);
  return { el: wrap, width, height };
},

  /* ---------- marca/desmarca o X vermelho no slot de origem ---------- */
  markOrigin(origin, on) {
    const el = origin.type === 'reserve'
      ? Reserve.slotEls[origin.index]
      : Board.slotEls[origin.row]?.[origin.col];
    el?.classList.toggle('slot--drag-origin', on);
  },

  /* ---------- início do arrasto: some visualmente da origem,
     guarda os dados do boneco (pra não perder stats), marca o X
     e toca o som de "pegar" o boneco ---------- */
  startDrag(character, origin) {
    this._dragState = { origin, character, resolved: false };
    this.markOrigin(origin, true);
    AudioManager.Sfx.dragDoll();

    if (origin.type === 'reserve') {
      Reserve.setSlot(origin.index, null);
    } else {
      Board.setSlot(origin.row, origin.col, null);
    }
  },

  /* ---------- arrasto termina sem destino válido: devolve o
     boneco pro slot de origem e toca o som de retorno ---------- */
  revertDrag() {
    const st = this._dragState;
    if (!st || st.resolved) return;
    st.resolved = true;
    this.markOrigin(st.origin, false);

    if (st.origin.type === 'reserve') {
      Reserve.setSlot(st.origin.index, st.character);
    } else {
      Board.setSlot(st.origin.row, st.origin.col, st.character);
    }

    AudioManager.Sfx.returnDoll();
    this._dragState = null;
  },

  /* ---------- drop válido: só encerra o estado de arrasto (quem
     chamou já desenhou o destino) ---------- */
  resolveDragSuccess() {
    const st = this._dragState;
    if (!st) return;
    st.resolved = true;
    this.markOrigin(st.origin, false);
    this._dragState = null;
  },

  /* ---------- se a escrita no Firestore falhar DEPOIS do drop
     otimista: limpa o destino, devolve a origem, toca o retorno ---------- */
  revertAfterFailure(dragState, destRow, destCol) {
    Board.clearSlot(destRow, destCol);
    if (dragState.origin.type === 'reserve') {
      Reserve.setSlot(dragState.origin.index, dragState.character);
    } else {
      Board.setSlot(dragState.origin.row, dragState.origin.col, dragState.character);
    }
    AudioManager.Sfx.returnDoll();
  },

  attachDragSource(el, reserveIndex) {
    el.addEventListener('dragstart', (e) => {
      const character = state.reserves.ally[reserveIndex];
      if (!character) { e.preventDefault(); return; }

      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({ reserveIndex }));

      const drag = this.buildDragImage(character, el);
      e.dataTransfer.setDragImage(drag.el, drag.width / 2, drag.height / 2);
      setTimeout(() => drag.el.remove(), 0);

      this.startDrag(character, { type: 'reserve', index: reserveIndex });
    });

    el.addEventListener('dragend', () => this.revertDrag());
  },

  // Fonte de arrasto pra um slot do TABULEIRO (reposicionamento).
  attachBoardDragSource(el, row, col) {
    el.addEventListener('dragstart', (e) => {
      const character = state.board[row][col];
      const canMove = character && character.owner === 'ally' && state.mobs.ally > 0;
      if (!canMove) { e.preventDefault(); return; }

      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({ fromRow: row, fromCol: col }));

      const drag = this.buildDragImage(character, el);
      e.dataTransfer.setDragImage(drag.el, drag.width / 2, drag.height / 2);
      setTimeout(() => drag.el.remove(), 0);

      this.startDrag(character, { type: 'board', row, col });
    });

    el.addEventListener('dragend', () => this.revertDrag());
  },

  attachDropTarget(el) {
    const row = () => Number(el.dataset.row);
    const col = () => Number(el.dataset.col);
    const canDropHere = () => state.board[row()][col()] === null && isMyColumn(col());

    el.addEventListener('dragover', (e) => {
      if (canDropHere()) {
        e.preventDefault();
        el.classList.add('slot--dragover');
      }
    });

    el.addEventListener('dragleave', () => el.classList.remove('slot--dragover'));

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('slot--dragover');

      const st = this._dragState;
      if (!st || !canDropHere()) { this.revertDrag(); return; }

      const targetRow = row();
      const targetCol = col();

      // ---- Reposicionamento na arena (MOBS) ----
      if (st.origin.type === 'board') {
        if (st.origin.row === targetRow && st.origin.col === targetCol) {
          this.revertDrag();
          return;
        }

        this.resolveDragSuccess();
        Board.setSlot(targetRow, targetCol, st.character);
        AudioManager.Sfx.mobsMove();

        window.Game.moveDoll(st.origin.row, st.origin.col, targetRow, targetCol, () => {
          this.revertAfterFailure(st, targetRow, targetCol);
        });
        return;
      }

      // ---- Colocação vinda da reserva ----
      this.resolveDragSuccess();
      state.board[targetRow][targetCol] = st.character;
      EntranceFX.show(st.character, targetRow, targetCol);
      Board.playEntrance(targetRow, targetCol, st.character);

      window.Game.placeDoll(targetRow, targetCol, st.origin.index, () => {
        this.revertAfterFailure(st, targetRow, targetCol);
      });
    });
  },
};