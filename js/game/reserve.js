/* ============================================================
   Reserve — mesma lógica do Board, só que numa fileira única.
   Só a reserva "ally" ganha DOM; "enemy" fica só no estado.
============================================================ */
const Reserve = {
  slotEls: [],

  build(container) {
    container.innerHTML = '';
    this.slotEls = [];

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

  renderSlot(i) {
    const character = state.reserves.ally[i];
    CardRenderer.render(this.slotEls[i], character, {
      showStats: false,
      draggable: !!character,
      variant: 'reserve',
    });
  },

  handleClick(i) {
    const character = state.reserves.ally[i];
    if (character) Modal.open(character);
  },

  setSlot(i, character) {
    state.reserves.ally[i] = character;
    this.renderSlot(i);
    PlayerStats.update();
  },

  clearSlot(i) {
    this.setSlot(i, null);
  },
};
