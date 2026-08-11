/* ============================================================
   PlayerStats — as duas linhas embaixo do nome de cada jogador:
   quantos bonecos ele tem na reserva, e quantos MOBS ele tem
   (mobs = quantos bonecos dá pra mover no turno; a contagem real
   ainda não existe, isso só desenha o número de state.mobs).
   update() é chamado sempre que a reserva ou os mobs mudam.
============================================================ */
const PlayerStats = {
  els: {},

  init(dollsAllyEl, mobsAllyEl, dollsEnemyEl, mobsEnemyEl) {
    this.els = {
      dollsAlly: dollsAllyEl,
      mobsAlly: mobsAllyEl,
      dollsEnemy: dollsEnemyEl,
      mobsEnemy: mobsEnemyEl,
    };
    this.update();
  },

  countDolls(reserve) {
    return reserve.filter(Boolean).length;
  },

  update() {
    if (!this.els.dollsAlly) return;
    this.els.dollsAlly.innerHTML = `x${this.countDolls(state.reserves.ally)}<i class="bi bi-people-fill"></i>`;
    this.els.dollsEnemy.innerHTML = `x${this.countDolls(state.reserves.enemy)}<i class="bi bi-people-fill"></i> `;
    this.els.mobsAlly.innerHTML = `x${state.mobs.ally} MOBS`;
    this.els.mobsEnemy.innerHTML = `x${state.mobs.enemy} MOBS`;
  },
};
