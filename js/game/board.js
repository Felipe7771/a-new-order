/* ============================================================
   Board — constrói e mantém o tabuleiro.
   setSlot()/clearSlot() são o jeito "certo" de mexer na matriz
   porque já cuidam do re-render. Mas nada impede de mexer direto
   em state.board e chamar renderSlot()/renderAll() depois (é
   assim que uma sincronização do Firebase vai funcionar).
============================================================ */
const Board = {
  slotEls: [],
  slotAnim: [], // [row][col] = 'entering' | 'settled' | undefined

  // Coluna LÓGICA (a mesma pra sempre, é o índice usado em
  // state.board / no documento do Firestore) -> coluna de EXIBIÇÃO
  // (onde ela realmente aparece na tela). Pro ower não muda nada.
  // Pro guest, espelha a fileira inteira (borda continua borda, meio
  // continua meio, só troca de lado) — assim o próprio lado do guest
  // sempre cai na esquerda, igual acontece pro ower.
  displayColOf(col) {
    const totalCols = CONFIG.slotsPerSide * 2;
    return CONFIG.myRole === 'guest' ? (totalCols - 1 - col) : col;
  },

  build(container) {
    container.innerHTML = '';
    this.slotEls = [];
    this.slotAnim = Array.from({ length: CONFIG.corridors }, () =>
      Array(CONFIG.slotsPerSide * 2).fill(undefined)
    );

    const totalCols = CONFIG.slotsPerSide * 2;
    // Ordem de construção dos slots: sempre em ordem crescente de
    // coluna de EXIBIÇÃO (não de coluna lógica), pra que o append
    // no DOM já saia na posição visual correta da esquerda pra
    // direita, sem precisar de CSS extra pra reordenar.
    const colsByDisplayOrder = Array.from({ length: totalCols }, (_, c) => c)
      .sort((a, b) => this.displayColOf(a) - this.displayColOf(b));

    for (let row = 0; row < CONFIG.corridors; row++) {
      const corridorEl = document.createElement('div');
      corridorEl.className = 'corridor';

      const leftEl = document.createElement('div');
      leftEl.className = 'corridor-side corridor-side--left';
      const rightEl = document.createElement('div');
      rightEl.className = 'corridor-side corridor-side--right';
      const gapEl = document.createElement('div');
      gapEl.className = 'corridor-gap';

      const rowSlots = new Array(totalCols);

      for (const col of colsByDisplayOrder) {
        const slotEl = document.createElement('div');
        slotEl.className = 'slot board-slot';
        slotEl.dataset.row = row;
        slotEl.dataset.col = col; // coluna LÓGICA — é o que DragDrop/state usam
        slotEl.tabIndex = 0;
        slotEl.setAttribute('role', 'button');
        if (!isMyColumn(col)) slotEl.classList.add('board-slot--enemy');

        DragDrop.attachDropTarget(slotEl);
        DragDrop.attachBoardDragSource(slotEl, row, col);
        slotEl.addEventListener('click', () => this.handleSlotClick(row, col));
        slotEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') this.handleSlotClick(row, col);
        });

        const displayCol = this.displayColOf(col);
        (displayCol < CONFIG.slotsPerSide ? leftEl : rightEl).appendChild(slotEl);
        rowSlots[col] = slotEl;
      }

      corridorEl.append(leftEl, gapEl, rightEl);
      container.appendChild(corridorEl);
      this.slotEls.push(rowSlots);
    }
  },

  renderAll() {
    state.board.forEach((row, r) => row.forEach((_, c) => this.renderSlot(r, c)));
  },

    // Só liga/desliga draggable+classe, sem tocar no vídeo/imagem em
  // andamento. Roda SEMPRE (inclusive com o slot em 'entering') —
  // MOBS não deveria depender da animação de entrada ter terminado.
  updateDraggability(row, col) {
    const el = this.slotEls[row]?.[col];
    const character = state.board[row][col];
    if (!el || !character) return;
    const movable = character.owner === 'ally' && state.mobs.ally > 0;
    el.draggable = movable;
    el.classList.toggle('board-slot--movable', movable);

    console.log(`Condições: É aliado? ${character.owner === 'ally'}, MOBS > 0? ${state.mobs.ally > 0}`);
    console.log(`[Trincheira] slot [${row},${col}] ${movable ? 'agora' : 'não mais'} arrastável (MOBS=${state.mobs.ally})`);
  },

  // Renderização "estável": nunca reinicia um vídeo de entrada em
  // andamento. Se o slot ainda não tem estado registrado e já vem
  // preenchido (ex: reconexão no meio da partida), assume 'settled'
  // direto — não é uma entrada de verdade, então não tem replay.
  renderSlot(row, col) {
    const character = state.board[row][col];

    if (!character) {
      this.slotAnim[row][col] = undefined;
      CardRenderer.render(this.slotEls[row][col], null);
      return;
    }

    if (this.slotAnim[row][col] === 'entering') {
      this.updateDraggability(row, col); // atualiza mesmo com o vídeo ainda tocando
      return;
    }

    this.slotAnim[row][col] = 'settled';
    CardRenderer.render(this.slotEls[row][col], character, { showStats: true, variant: 'board' });
    this.updateDraggability(row, col);
  },

    // Chamado pelo Game.syncRoom SÓ para os slots que acabaram de
  // ficar ocupados nesse snapshot (mesmo diff que já dispara o
  // EntranceFX). Toca arena_entrance; ao 'ended', troca pra
  // arena_default via renderSlot normal.
  playEntrance(row, col, character) {
      const el = this.slotEls[row][col];
      if (!el) return;

      const entranceSrc = getAnimationAsset(character.id, 'board', 'entrance');
      if (!entranceSrc) {
        this.slotAnim[row][col] = 'settled';
        this.renderSlot(row, col);
        return;
      }

      this.slotAnim[row][col] = 'entering';
      el.innerHTML = '';
      el.classList.remove('slot--empty');
      el.classList.add('slot--filled');
      el.setAttribute('aria-label', character.name);

      const visual = document.createElement('div');
      visual.className = 'card-visual card-visual--board';
      visual.appendChild(createMediaElement(entranceSrc, character, {
        loop: false,
        onEnded: () => {
          this.slotAnim[row][col] = 'settled';
          this.renderSlot(row, col);
        },
        // Sem isso, um .webm que falha/404 nunca dispara 'ended' e o
        // slot fica preso em 'entering' pra sempre — e enquanto isso,
        // renderSlot() nem chega a marcar draggable=true (ver o guard
        // logo no topo de renderSlot). É esse travamento que deixava
        // os bonecos "intocáveis" mesmo com MOBS > 0.
        onError: () => {
          console.warn(`[Trincheira] vídeo de entrada falhou (${entranceSrc}) — assentando slot direto.`);
          this.slotAnim[row][col] = 'settled';
          this.renderSlot(row, col);
        },
      }));

      const sideAttrs = CardRenderer.buildSideAttributes(character);
      if (sideAttrs) visual.appendChild(sideAttrs);

      el.appendChild(visual);
      el.appendChild(CardRenderer.buildStats(character));
      this.updateDraggability(row, col); // <- adicionar esta linha
    },

  handleSlotClick(row, col) {
    const character = state.board[row][col];
    if (character) Modal.open(character);
  },

  setSlot(row, col, character) {
    state.board[row][col] = character;
    if (!character) this.slotAnim[row][col] = undefined;
    this.renderSlot(row, col);
  },

  clearSlot(row, col) {
    this.setSlot(row, col, null);
  },
};
