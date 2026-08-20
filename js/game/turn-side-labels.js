/* ============================================================
   TurnSideLabels — os dois rótulos ao lado do relógio.

   Um lado mostra de quem é o turno ATUAL — e esse lado TROCA:
   fica na ESQUERDA quando é o meu turno, na DIREITA quando é do
   oponente. O outro lado (o que sobrar) mostra a PREVISÃO do
   próximo turno (fase + de quem), calculada por Game.predictNextTurn
   — só informativo, nunca é escrito no Firestore.

   Cada lado só refaz o fade se o conteúdo de fato mudou (guarda
   uma "assinatura" por lado) — assim um syncRoom que não mexeu no
   turno não fica re-piscando o texto à toa.
============================================================ */
const TurnSideLabels = {
  leftEl: null,
  rightEl: null,
  _leftSig: null,
  _rightSig: null,

  init(leftEl, rightEl) {
    this.leftEl = leftEl;
    this.rightEl = rightEl;
  },

  hide() {
    if (this.leftEl) this.leftEl.innerHTML = '';
    if (this.rightEl) this.rightEl.innerHTML = '';
    this._leftSig = null;
    this._rightSig = null;
  },

  // currentIsMe: quem está jogando o turno ATUAL sou eu?
  // next: { phase: 'attack'|'defense', isMe: boolean } | null
  //   (null = sem previsão possível, ex: partida ainda sem turno)
  update(currentIsMe, next) {
    if (!this.leftEl || !this.rightEl) return;

    const currentContent = {
      sig: `current:${currentIsMe}`,
      html: `<p class="turn-side-label__main">${currentIsMe ? 'SEU TURNO' : 'TURNO OPONENTE'}</p>`,
      colorClass: currentIsMe ? 'turn-side-label--blue' : 'turn-side-label--red',
    };

    const nextContent = next
      ? {
          sig: `next:${next.phase}:${next.isMe}`,
          html:
            `<p class="turn-side-label__small">PRÓXIMO TURNO</p>` +
            `<p class="turn-side-label__main">${next.phase === 'attack' ? 'OFENSIVO' : 'DEFENSIVO'}</p>`,
          colorClass: next.isMe ? 'turn-side-label--blue' : 'turn-side-label--red',
        }
      : { sig: 'next:none', html: '', colorClass: '' };

    // meu turno -> ATUAL na esquerda, PRÓXIMO na direita.
    // turno do oponente -> ATUAL na direita, PRÓXIMO na esquerda.
    if (currentIsMe) {
      this._applySide('left', currentContent);
      this._applySide('right', nextContent);
    } else {
      this._applySide('left', nextContent);
      this._applySide('right', currentContent);
    }
  },

  _applySide(side, content) {
    const el = side === 'left' ? this.leftEl : this.rightEl;
    const sigKey = side === 'left' ? '_leftSig' : '_rightSig';
    if (!el || this[sigKey] === content.sig) return; // nada mudou — sem refade à toa

    const render = () => {
      el.className = `turn-side-label turn-side-label--${side} ${content.colorClass}`;
      el.innerHTML = content.html;
      this[sigKey] = content.sig;
    };

    if (this[sigKey] === null) {
      // primeira vez que esse lado ganha conteúdo — entra direto,
      // sem fade-out de "nada" antes.
      render();
      void el.offsetWidth;
      el.classList.remove('turn-side-label--hidden');
      return;
    }

    el.classList.add('turn-side-label--hidden');
    setTimeout(() => {
      render();
      void el.offsetWidth; // força reflow — garante que o fade-in reinicia
      el.classList.remove('turn-side-label--hidden');
    }, 220); // bate com a transição .22s do CSS
  },
};
