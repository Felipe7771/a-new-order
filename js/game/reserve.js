/* ============================================================
   Reserve — mesma lógica do Board, só que numa fileira única.
   Só a reserva "ally" ganha DOM; "enemy" fica só no estado.
============================================================ */
const Reserve = {
  slotEls: [],
  slotAnim: [], // [i] = 'entering' | 'settled' | undefined

  build(container) {
    container.innerHTML = '';
    this.slotEls = [];
    this.slotAnim = Array(CONFIG.reserveSize).fill(undefined);

    for (let i = 0; i < CONFIG.reserveSize; i++) {
      const slotEl = document.createElement('div');
      slotEl.className = 'slot reserve-slot';
      slotEl.dataset.index = i;
      slotEl.tabIndex = 0;
      slotEl.setAttribute('role', 'button');
      slotEl.dataset.sfxHover = 'hover';
      slotEl.dataset.sfxClick = 'click';

      DragDrop.attachDragSource(slotEl, i);
      slotEl.addEventListener('click', () => this.handleClick(i));
      slotEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') this.handleClick(i);
      });

      container.appendChild(slotEl);
      this.slotEls.push(slotEl);
    }
  },

  renderAll() {
    state.reserves.ally.forEach((_, i) => this.renderSlot(i));
  },

  // draggable agora depende de canIActNow() — antes era sempre
  // `true`, então dava pra começar a arrastar da reserva mesmo fora
  // do próprio turno de defesa (o placeDoll no servidor rejeitava a
  // transação, mas o client deixava o gesto acontecer visualmente).
  renderSlot(i) {
    const character = state.reserves.ally[i];

    if (!character) {
      this.slotAnim[i] = undefined;
      CardRenderer.render(this.slotEls[i], null);
      return;
    }

    if (this.slotAnim[i] === 'entering') return; // vídeo tocando, não mexe

    this.slotAnim[i] = 'settled';
    CardRenderer.render(this.slotEls[i], character, {
      showStats: false,
      draggable: canIActNow(),
      variant: 'reserve',
    });
  },

  // Toca reserve.entrance quando o slot passa de vazio pra ocupado
  // (sorteio inicial, ou um boneco devolvido à reserva no futuro).
  // Ao 'ended', troca pra reserve.default via renderSlot normal.
playEntrance(i, character) {
    const el = this.slotEls[i];
    if (!el) return;

    const entranceSrc = getAnimationAsset(character.id, 'reserve', 'entrance');
    if (!entranceSrc) {
      this.slotAnim[i] = 'settled';
      this.renderSlot(i);
      return;
    }

    this.slotAnim[i] = 'entering';
    el.innerHTML = '';
    el.classList.remove('slot--empty');
    el.classList.add('slot--filled');
    el.classList.remove('slot--media-loaded');
    el.draggable = canIActNow();
    el.setAttribute('aria-label', character.name);

    const visual = document.createElement('div');
    visual.className = 'card-visual card-visual--reserve';
    const media = createMediaElement(entranceSrc, character, {
      loop: false,
      onEnded: () => {
        this.slotAnim[i] = 'settled';
        this.renderSlot(i);
      },
      onError: () => {
        console.warn(`[Trincheira] vídeo de entrada (reserva) falhou (${entranceSrc}) — assentando slot direto.`);
        this.slotAnim[i] = 'settled';
        this.renderSlot(i);
      },
    });
    watchSlotMediaLoad(media, el);
    visual.appendChild(media);
    el.appendChild(visual);
  },

  // Diff-based sync (mesmo espírito do diff de Board em Game.syncRoom):
  // compara o array antigo com o novo, dispara playEntrance() nos
  // índices que passaram de vazio pra ocupado, e deixa renderAll()
  // cuidar do resto (remoções não têm animação de saída aqui).
  syncAlly(newReserve) {
    const oldReserve = state.reserves.ally;
    const enteredIdx = [];
    for (let i = 0; i < CONFIG.reserveSize; i++) {
      if (!oldReserve[i] && newReserve[i]) enteredIdx.push(i);
    }
    enteredIdx.forEach((i) => this.playEntrance(i, newReserve[i]));
    state.reserves.ally = newReserve;
    this.renderAll();
  },

  handleClick(i) {
    const character = state.reserves.ally[i];
    if (character) Modal.open(character);
  },

  setSlot(i, character) {
    state.reserves.ally[i] = character;
    if (!character) this.slotAnim[i] = undefined;
    this.renderSlot(i);
    PlayerStats.update();
  },

  clearSlot(i) {
    this.setSlot(i, null);
  },
};