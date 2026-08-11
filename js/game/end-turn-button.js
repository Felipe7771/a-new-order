/* ============================================================
   EndTurnButton — botão "Encerrar Turno", visível SÓ pro jogador
   que está na fase de defesa dele. A barra vermelha por trás do
   texto encolhe conforme o prazo (60s) passa.
============================================================ */
const EndTurnButton = {
  el: null,
  containerEl: null,
  clockEl: null,
  dialEl: null,
  minuteHandEl: null,
  hintEl: null,
  intervalId: null,
  lastTickSecond: -1,
  buttonVisible: false,
  _activeDeadlineMs: null,

  init(el, dialEl, minuteHandEl, hintEl) {
    this.el = el;
    this.containerEl = document.getElementById('turn-action');
    this.clockEl = document.getElementById('turn-clock');
    this.dialEl = dialEl;
    this.minuteHandEl = minuteHandEl;
    this.hintEl = hintEl;

    el.addEventListener('click', () => {
      if (el.disabled) return;
      this.hideButton();
      window.Game.endTurn();
    });

    this.setIdleVisual();
  },

  hide() {
    this.stopClock();
    this.containerEl?.classList.remove('turn-action--visible');
    this.setIdleVisual();
    this.hintEl.classList.remove('turn-clock__hint--visible');
    this.el.disabled = true;
    this.hideButton();
  },

  showIdle() {
    this.containerEl?.classList.add('turn-action--visible');
    this.stopClock();
    this.setIdleVisual();
    this.hintEl.classList.remove('turn-clock__hint--visible');
    this.el.disabled = true;
    this.hideButton();
  },

  showActive({ enabled, deadlineMs, totalMs }) {
    this.containerEl?.classList.add('turn-action--visible');
    this.el.disabled = !enabled;
    this.startClock(deadlineMs, totalMs);

    if (enabled) {
      this.hintEl.classList.remove('turn-clock__hint--visible');
      this.showButton();
    } else {
      this.hintEl.classList.add('turn-clock__hint--visible');
      this.hideButton();
    }
  },

  showButton() {
    if (this.buttonVisible) return;
    this.buttonVisible = true;
    this.el.classList.remove('end-turn-btn--rising');
    this.el.classList.add('end-turn-btn--visible', 'end-turn-btn--dropping');
  },

  hideButton() {
    if (!this.buttonVisible) {
      this.el.classList.remove('end-turn-btn--visible', 'end-turn-btn--dropping', 'end-turn-btn--rising');
      return;
    }
    this.buttonVisible = false;
    this.el.classList.remove('end-turn-btn--dropping');
    this.el.classList.add('end-turn-btn--rising');
    setTimeout(() => {
      this.el.classList.remove('end-turn-btn--visible', 'end-turn-btn--rising');
    }, 420);
  },

  // Verifica a cada 200ms, mas só ATUALIZA visual/som quando o
  // segundo cheio muda — é isso que gera o "salto brusco" em vez
  // de um deslize suave (igual um relógio mecânico de verdade).
  startClock(deadlineMs, totalMs) {
    if (this._activeDeadlineMs === deadlineMs && this.intervalId) return;

    this._activeDeadlineMs = deadlineMs;
    this.stopClock();
    this.minuteHandEl.style.transition = 'transform .18s cubic-bezier(.34,1.56,.64,1)';
    this.dialEl.style.setProperty('--clock-fill', 'var(--time)');
    this.lastTickSecond = -1;

    // pulinho de "acordou" — só nesse ponto, turno realmente novo
    this.clockEl.classList.remove('turn-clock--waking');
    void this.clockEl.offsetWidth;
    this.clockEl.classList.add('turn-clock--waking');

    const check = () => {
      const now = Date.now();
      const remaining = Math.max(0, deadlineMs - now);
      const rawElapsedMs = Math.min(totalMs, Math.max(0, totalMs - remaining));
      const wholeSecond = Math.floor(rawElapsedMs / 1000);

      if (wholeSecond !== this.lastTickSecond) {
        this.lastTickSecond = wholeSecond;
        const quantizedMs = Math.min(totalMs, wholeSecond * 1000);
        const progress = totalMs > 0 ? quantizedMs / totalMs : 1;
        const deg = progress * 360;

        this.minuteHandEl.style.transform = `rotate(${deg}deg)`;
        this.dialEl.style.setProperty('--clock-elapsed', `${deg}deg`);

        if (remaining > 0) AudioManager.Sfx.clockTick();
      }

      if (remaining <= 0) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    };

    check();
    this.intervalId = setInterval(check, 200);
  },

  stopClock() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    this._activeDeadlineMs = null;
  },

  setIdleVisual() {
    this.minuteHandEl.style.transition = 'transform .5s ease';
    this.minuteHandEl.style.transform = 'rotate(0deg)';
    this.dialEl.style.setProperty('--clock-elapsed', '0deg');
    this.dialEl.style.setProperty('--clock-fill', 'var(--clock-gray)');
  },
};
