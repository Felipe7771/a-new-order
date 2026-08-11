/* ============================================================
   PlayerNames — só escreve o texto nos dois cantos do topo.
   setNames() é o jeito de trocar depois (ex: quando o Firebase
   informar o nome real do oponente).
============================================================ */
const PlayerNames = {
  allyEl: null,
  enemyEl: null,

  init(allyEl, enemyEl) {
    this.allyEl = allyEl;
    this.enemyEl = enemyEl;
    this.setNames(CONFIG.playerName, CONFIG.enemyName);
  },

  setNames(playerName, enemyName) {
    if (playerName != null) this.allyEl.textContent = playerName;
    if (enemyName != null) this.enemyEl.textContent = enemyName;
  },
};
