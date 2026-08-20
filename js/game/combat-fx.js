/* ============================================================
   CombatFX — parte VISUAL do combate. A lógica (quem ataca, quem
   é atingido, quanto tempo dura) já vem PRONTA do servidor em
   turn.combat (ver computeCombatResolution em combat.js) — esse
   módulo só desenha em cima disso, nunca decide nada.

   Fluxo, disparado por Game.handleTurnSync() quando um turno de
   ATAQUE novo começa:
     1. Espera turn.combat.windupMs (o "personagem se preparando").
     2. Pra cada projétil: solta uma bolinha/traço na COR do tipo
        de dano, viajando do slot do atacante até a borda do lado
        inimigo, em turn.combat.projectiles[i].travelMs.
     3. Ao "chegar" (travelMs), pisca (.board-slot--hit) em TODOS
        os slots de targetIds daquele projétil ao mesmo tempo —
        é isso que representa o "estouro" de area/entire_arena,
        mesmo o traço visual só tendo percorrido o corredor do
        atacante.

   Sem asset de vídeo próprio ainda (animation.board.combat não
   existe no catalog.json) — é só CSS por enquanto. Quando os
   vídeos de attacking/hiting/bullet existirem, trocar o traço
   CSS por eles é um passo de cima pra baixo, sem mexer no motor.
============================================================ */
const CombatFX = {
  el: null,

  init(el) {
    this.el = el;
  },

  // Chamado uma vez por turno de ataque novo (ver boot.js).
  playTurn(resolution) {
    if (!this.el || !resolution || !resolution.hasAnyAction) return;

    setTimeout(() => {
      resolution.projectiles.forEach((p) => this.fireProjectile(p));
    }, resolution.windupMs);
  },

  fireProjectile(p) {
    const fromEl = Board.slotEls[p.fromCorridor]?.[p.fromCol];
    const boardEl = document.getElementById('board');
    if (!fromEl || !boardEl) {
      // sem como desenhar (layout ainda não montado) — aplica o
      // hit direto, sem enfeite, pra não travar a lógica de nada
      this.applyHitFlash(p.targetIds);
      return;
    }

    const fromRect = fromEl.getBoundingClientRect();
    const boardRect = boardEl.getBoundingClientRect();

    // Direção na TELA (já considerando o espelhamento do guest):
    // se o slot do atacante aparece do lado esquerdo, o projétil
    // viaja pra direita (em direção ao lado inimigo), senão pra
    // esquerda.
    const displayCol = Board.displayColOf(p.fromCol);
    const goesRight = displayCol < CONFIG.slotsPerSide;

    const startX = fromRect.left + fromRect.width / 2;
    const startY = fromRect.top + fromRect.height / 2;
    const endX = goesRight ? boardRect.right : boardRect.left;
    const travelDistance = endX - startX;

    const bullet = document.createElement('div');
    bullet.className = `combat-bullet combat-bullet--${p.damageType}`;
    bullet.style.top = `${startY}px`;
    bullet.style.left = `${startX}px`;
    bullet.style.setProperty('--travel-distance', `${travelDistance}px`);
    bullet.style.setProperty('--travel-ms', `${p.travelMs}ms`);
    this.el.appendChild(bullet);

    // Reaproveita os efeitos por atributo que já existem em
    // audio/sound/effects/ (drill.mp3, area.mp3, entire_arena.mp3);
    // 'normal' cai no fallback 'default' automaticamente.
    AudioManager.Sfx.dollEffect(p.damageType);

    setTimeout(() => {
      bullet.remove();
      this.applyHitFlash(p.targetIds);
    }, p.travelMs);
  },

  applyHitFlash(targetIds) {
    targetIds.forEach(({ row, col }) => {
      const el = Board.slotEls[row]?.[col];
      if (!el) return;
      el.classList.remove('board-slot--hit');
      void el.offsetWidth; // força reflow — permite repetir o flash em hits seguidos
      el.classList.add('board-slot--hit');
      setTimeout(() => el.classList.remove('board-slot--hit'), 400);
    });
  },
};
