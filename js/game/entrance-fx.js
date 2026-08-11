/* ============================================================
   EntranceFX — telão de entrada quando um boneco pisa no tabuleiro.
   Nome grande em vermelho, grupo pequeno embaixo, e (se o boneco
   tiver poder) a descrição em branco. Toca audio/entrance/{grupo}.mp3
   e some sozinho depois de um tempo — é só um flash informativo.
============================================================ */
const EntranceFX = {
  el: null,
  hideTimeout: null,

  init(el) {
    this.el = el;
  },

  show(character, row, col) {
    if (!this.el) return;
    const doll = catalog[character.id];
    if (!doll) return;

    clearTimeout(this.hideTimeout);

    // IMPORTANTE: usa a coluna de EXIBIÇÃO (pós-espelhamento pro
    // guest), não a coluna lógica — senão o texto de entrada nasce
    // do lado errado da tela pro jogador convidado.
    const isLeftSide = Board.displayColOf(col) < CONFIG.slotsPerSide;
    this.el.classList.toggle('entrance-overlay--from-left', isLeftSide);
    this.el.classList.toggle('entrance-overlay--from-right', !isLeftSide);

    // Posiciona o texto grudado no slot: se o boneco caiu do lado
    // esquerdo do corredor, o texto nasce à direita do slot (e vice-
    // versa), pra nunca ficar cortado pela borda do tabuleiro.
    const slotEl = Board.slotEls[row]?.[col];
    if (slotEl) {
      const rect = slotEl.getBoundingClientRect();
      const top = rect.top + rect.height / 2;
      this.el.style.top = `${top}px`;
      this.el.style.left = isLeftSide ? `${rect.right}px` : `${rect.left}px`;
    }

    this.el.innerHTML = `
      <div class="entrance-card">
        <h2 class="entrance-name">${character.name}</h2>
        <p class="entrance-group">${doll.group}</p>
        ${doll.power?.has
          ? `<p class="entrance-power">${doll.power.description.replace('[', '<i><strong><u>').replace(']', '</u></strong></i>')}</p>`
          : ''}
      </div>
    `;

    // reinicia a animação (senão dois disparos seguidos ficam parados)
    this.el.classList.remove('entrance-overlay--visible');
    void this.el.offsetWidth; // força reflow
    this.el.classList.add('entrance-overlay--visible');

    AudioManager.Sfx.entrance(doll.group);

    this.hideTimeout = setTimeout(() => {
      this.el.classList.remove('entrance-overlay--visible');
    }, 3200);
  },
};
