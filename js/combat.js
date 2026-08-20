/* ============================================================
   Combat — motor de resolução do turno ofensivo.

   Duas funções, as duas puras (recebem dados, devolvem dados,
   nunca tocam Firestore nem DOM):

     computeCombatResolution(board, attackerPlayerId, attackerIsOwner)
       -> roda no INÍCIO do turno ofensivo (snapshot do board de
          ANTES de qualquer dano). Devolve a estrutura pronta pra
          gravar na sala e o client consumir pra animar (CombatFX,
          ainda não implementado).

     applyCombatDamage(board, resolution)
       -> roda no FIM do turno ofensivo (quando o timer do turno
          estoura). Aplica o dano de TODOS os projéteis de uma vez,
          varre os mortos, devolve o novo board.

   Por enquanto NÃO leva em conta power.has, guardian/implacable
   nem rage — dano é sempre doll.damage puro. Essas camadas entram
   depois, como modificadores em cima desse motor base (combinado
   com o Kleber: ignorar por agora).

   board aqui é sempre o mapa esparso "row-col" -> doll do
   Firestore (mesmo formato de data.board em matchmaking.js).
============================================================ */

export const SPEED_MS = {
  SLOW: 1000,
  NORMAL: 500,
  FAST: 250,
  HIPERFAST: 100,
};

const WINDUP_MS = 600;       // delay fixo antes de qualquer projétil sair (igual pra todos)
const EMPTY_TURN_MS = 1500;  // ninguém acerta ninguém -> turno curto, sem animação

const CORRIDORS = 4;
const SLOTS_PER_SIDE = 3;

/* ------------------------------------------------------------
   "Frente" de um lado num corredor = slot OCUPADO mais próximo
   do corredor-gap. Lado ower (0-1-2) -> maior índice primeiro.
   Lado guest (3-4-5) -> menor índice primeiro.
------------------------------------------------------------ */
function findFrontmostOccupiedSlot(board, corridor, sideIsOwner) {
  const cols = sideIsOwner ? [2, 1, 0] : [3, 4, 5];
  for (const col of cols) {
    const doll = board[`${corridor}-${col}`];
    if (doll) return { row: corridor, col, charId: doll.id, doll };
  }
  return null;
}

function allOccupiedSlots(board, corridor, sideIsOwner) {
  const cols = sideIsOwner ? [0, 1, 2] : [3, 4, 5];
  const found = [];
  for (const col of cols) {
    const doll = board[`${corridor}-${col}`];
    if (doll) found.push({ row: corridor, col, charId: doll.id, doll });
  }
  return found;
}

// drill > area > entire_arena (do mais restrito pro mais abrangente)
function resolveDamageType(attbtDamage = []) {
  const set = new Set(attbtDamage);
  if (set.has('drill')) return 'drill';
  if (set.has('area')) return 'area';
  if (set.has('entire_arena')) return 'entire_arena';
  return 'normal';
}

function collectTargets(board, damageType, corridor, attackerIsOwner) {
  const enemyIsOwner = !attackerIsOwner;

  switch (damageType) {
    case 'drill':
      // atravessa tudo do MESMO corredor, lado inimigo
      return allOccupiedSlots(board, corridor, enemyIsOwner);

    case 'area': {
      // frente do corredor mirado + frente das adjacentes (bordas
      // só têm 1 vizinho)
      const corridors = [corridor - 1, corridor, corridor + 1].filter(
        (c) => c >= 0 && c < CORRIDORS
      );
      const targets = [];
      for (const c of corridors) {
        const front = findFrontmostOccupiedSlot(board, c, enemyIsOwner);
        if (front) targets.push(front);
      }
      return targets;
    }

    case 'entire_arena': {
      // frente de TODOS os 4 corredores inimigos
      const targets = [];
      for (let c = 0; c < CORRIDORS; c++) {
        const front = findFrontmostOccupiedSlot(board, c, enemyIsOwner);
        if (front) targets.push(front);
      }
      return targets;
    }

    default: {
      const front = findFrontmostOccupiedSlot(board, corridor, enemyIsOwner);
      return front ? [front] : [];
    }
  }
}

/* ------------------------------------------------------------
   computeCombatResolution
   Roda uma vez, no início do turno ofensivo, sobre um snapshot
   fixo do board — a ordem de resolução dos projéteis nunca
   interfere no resultado (todo mundo mira em quem estava vivo
   ANTES de qualquer dano ser aplicado).
------------------------------------------------------------ */
export function computeCombatResolution(board, attackerPlayerId, attackerIsOwner) {
  const projectiles = [];

  for (let corridor = 0; corridor < CORRIDORS; corridor++) {
    const attacker = findFrontmostOccupiedSlot(board, corridor, attackerIsOwner);
    if (!attacker) continue;

    const doll = attacker.doll;
    const damageType = resolveDamageType(doll.attbtDamage);
    const targets = collectTargets(board, damageType, corridor, attackerIsOwner);
    if (targets.length === 0) continue; // esse atacante não achou ninguém

    const speedKey = SPEED_MS[doll.vel_att_attck] ? doll.vel_att_attck : 'NORMAL';

    projectiles.push({
      fromCorridor: corridor,
      fromCol: attacker.col,
      attackerCharId: doll.id,
      damageType,
      damage: doll.damage,
      speedKey,
      travelMs: SPEED_MS[speedKey],
      targetIds: targets.map((t) => ({ row: t.row, col: t.col, charId: t.charId })),
    });
  }

  if (projectiles.length === 0) {
    return {
      attackerPlayerId,
      hasAnyAction: false,
      windupMs: 0,
      totalDurationMs: EMPTY_TURN_MS,
      projectiles: [],
    };
  }

  const longestTravel = Math.max(...projectiles.map((p) => p.travelMs));

  return {
    attackerPlayerId,
    hasAnyAction: true,
    windupMs: WINDUP_MS,
    totalDurationMs: WINDUP_MS + longestTravel,
    projectiles,
  };
}

/* ------------------------------------------------------------
   applyCombatDamage
   Roda no FIM do turno ofensivo (quando o timer estoura). Soma
   o dano de TODOS os projéteis por alvo (um boneco pode ser
   atingido por mais de um projétil — ex: front pego por "area"
   de um corredor E por "entire_arena" de outro), aplica tudo de
   uma vez.

   IMPORTANTE: quem morre (vida <= 0) NÃO é removido do board
   aqui — só fica marcado `dead: true` com `life` travada em 0.
   A remoção de verdade é sweepDeadDolls(), chamada 1s depois
   (ver DEATH_SWEEP_DELAY_MS em matchmaking.js) — esse intervalo
   é o que dá tempo do jogador VER os números de vida mudando
   antes do boneco sumir/o turno virar.

   Não muta o board recebido — devolve uma cópia nova + a lista
   de quem morreu (útil só como metadado; a UI hoje detecta a
   morte/o dano direto por diff no board, não por essa lista).
------------------------------------------------------------ */
export function applyCombatDamage(board, resolution) {
  if (!resolution || !resolution.hasAnyAction) {
    return { board, deaths: [] };
  }

  const damageMap = {}; // "row-col" -> dano acumulado
  for (const p of resolution.projectiles) {
    for (const t of p.targetIds) {
      const key = `${t.row}-${t.col}`;
      damageMap[key] = (damageMap[key] || 0) + p.damage;
    }
  }

  const nextBoard = { ...board };
  const deaths = [];

  for (const [key, dmg] of Object.entries(damageMap)) {
    const doll = nextBoard[key];
    if (!doll) continue; // já não existe mais nesse snapshot (segurança)

    const rawLife = doll.life - dmg;
    const dead = rawLife <= 0;
    // vida nunca fica negativa no board — "se vida <= 0, exibir 0"
    nextBoard[key] = { ...doll, life: Math.max(0, rawLife), dead };
    if (dead) deaths.push({ key, charId: doll.id, owner: doll.owner });
  }

  return { board: nextBoard, deaths };
}

/* ------------------------------------------------------------
   sweepDeadDolls
   Remove do board qualquer boneco marcado `dead: true` por
   applyCombatDamage(). Chamada separadamente (1s depois, ver
   DEATH_SWEEP_DELAY_MS), nunca junto da aplicação de dano — é
   essa separação em duas escritas que dá o intervalo visível
   pro jogador antes do boneco sumir de vez / o turno virar.
------------------------------------------------------------ */
export function sweepDeadDolls(board) {
  const nextBoard = {};
  for (const [key, doll] of Object.entries(board)) {
    if (doll && !doll.dead) nextBoard[key] = doll;
  }
  return nextBoard;
}