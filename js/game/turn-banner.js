/* ============================================================
   TurnBanner — texto grande de passagem de turno. Overlay
   totalmente separado do EntranceFX/#entrance-overlay, pra nunca
   competir com o telão de entrada de boneco.
============================================================ */
const TurnBanner = {
  el: null,
  hideTimeout: null,

  init(el) {
    this.el = el;
  },

  show(playerName, phase) {
    if (!this.el) return;
    clearTimeout(this.hideTimeout);

    const isAttack = phase === 'attack';
    const label = isAttack ? 'TURNO OFENSIVO' : 'TURNO DEFENSIVO';

    this.el.innerHTML = `
      <div class="turn-banner-card">
        <h2 class="turn-banner-name">${playerName}</h2>
        <p class="turn-banner-phase">${label}</p>
      </div>
    `;

    this.el.classList.remove(
      'turn-banner--defense', 'turn-banner--attack',
      'turn-banner--visible-defense', 'turn-banner--visible-attack'
    );
    void this.el.offsetWidth; // força reflow — reinicia a animação sempre

    this.el.classList.add(isAttack ? 'turn-banner--attack' : 'turn-banner--defense');
    this.el.classList.add(isAttack ? 'turn-banner--visible-attack' : 'turn-banner--visible-defense');

    AudioManager.Sfx.entrance(isAttack ? 'turno_ofensivo' : 'turno_defensivo');

    const duration = isAttack ? 3000 : 5500;
    this.hideTimeout = setTimeout(() => {
      this.el.classList.remove('turn-banner--visible-defense', 'turn-banner--visible-attack');
    }, duration);
  },
};
