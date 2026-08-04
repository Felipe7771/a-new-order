/* ============================================================
   MATCHMAKING — tudo que fala com o Firestore mora aqui.
   Segue o esquema de "salas" combinado no diagrama:

   salas/{salaId}
     ower:   { ID, name }
     guest:  { ID, name } | null
     state:  'waiting' | 'playing' | 'ended'
     turn:   { number, phase, current, deadline, hasActed } | null
     p:      { [ID]: { mobs, reserve, effects } } | null
     winner: ID | null
     board:  mapa esparso "linha-coluna" -> boneco | null
     createdAt: Timestamp do servidor
     expireAt:  Timestamp usado pela política de TTL do Firestore

   Este módulo cuida de MENU + LOGIN + MATCHMAKING + SISTEMA DE
   TURNOS. A lógica de combate em si (o que acontece DENTRO do
   turno ofensivo) ainda não existe.
============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  runTransaction,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

const SALAS = "salas";
const RESERVE_SIZE = 12;
const ROOM_TTL_MS = 24 * 60 * 60 * 1000; // 1 dia

// Precisam bater com CONFIG.corridors/slotsPerSide em index.html —
// é o mesmo espelho que existe entre RESERVE_SIZE aqui e
// CONFIG.reserveSize lá. Usados só pra validar linha/coluna em
// placeDoll(); se o tabuleiro mudar de tamanho, atualize os dois.
const CORRIDORS = 4;
const SLOTS_PER_SIDE = 3;
const TOTAL_COLS = SLOTS_PER_SIDE * 2;

// ---- Sistema de turnos -----------------------------------------
// Defesa: 60s pra jogar pelo menos 1 boneco. Ataque: por enquanto
// não tem ação nenhuma implementada, então é só um mínimo de 5s
// antes de devolver a vez (isso vai virar "tempo baseado na
// animação/ação do boneco" quando o combate existir).
const DEFENSE_TURN_MS = 60 * 1000;
const ATTACK_TURN_MS = 5 * 1000;

let db = null;
function getDb() {
  if (!db) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
  return db;
}

export { isFirebaseConfigured };

/* ------------------------------------------------------------
   Geração de baralho — 12 bonecos aleatórios do catálogo,
   no mesmo formato que CardRenderer/createCharacter esperam.
------------------------------------------------------------ */
function pickRandomDollId(catalog) {
  const keys = Object.keys(catalog);
  return keys[Math.floor(Math.random() * keys.length)];
}

function buildDeck(catalog, ownerId) {
  const deck = [];
  for (let i = 0; i < RESERVE_SIZE; i++) {
    const id = pickRandomDollId(catalog);
    const doll = catalog[id];
    deck.push({
      id,
      name: doll.name,
      owner: ownerId,
      life: doll.stats.baseLife,
      damage: doll.stats.baseDamage,
      rage: doll.rageDamage,
      guard: new Set(doll.attbtLife).has("guardian"),
    });
  }
  return deck;
}

/* ------------------------------------------------------------
   Turnos — construção de fases e regra de transição.

   Ciclo: Defesa(X) -> Ataque(adversário de X, SE ele tiver bonecos
   em campo, senão pula direto) -> Defesa(mesmo adversário) ->
   Ataque(X, com a mesma checagem) -> Defesa(X) -> ...

   Ou seja: depois de uma DEFESA, quem age é sempre o ADVERSÁRIO
   (em ataque, ou pulando pra defesa dele se não tiver bonecos).
   Depois de um ATAQUE, quem defende em seguida é o MESMO jogador
   que acabou de atacar.
------------------------------------------------------------ */
function hasDollsOnBoard(board, playerId) {
  if (!board) return false;
  return Object.values(board).some((d) => d && d.owner === playerId);
}

function opponentOf(data, playerId) {
  return data.ower.ID === playerId ? data.guest.ID : data.ower.ID;
}

function buildDefensePhase(playerId, turnNumber) {
  return {
    number: turnNumber,
    phase: "defense",
    current: playerId,
    deadline: Timestamp.fromMillis(Date.now() + DEFENSE_TURN_MS),
    hasActed: false,
  };
}

function buildAttackPhase(playerId, turnNumber) {
  return {
    number: turnNumber,
    phase: "attack",
    current: playerId,
    deadline: Timestamp.fromMillis(Date.now() + ATTACK_TURN_MS),
    hasActed: false, // não usado em ataque, mantido só por consistência de shape
  };
}

// Chamada quando a DEFESA de `playerId` termina (de propósito ou
// por timeout com hasActed=true). Quem age em seguida é sempre o
// ADVERSÁRIO — ataca se tiver bonecos em campo, ou já pula direto
// pra defesa dele se não tiver.
function afterDefense(data, playerId, turnNumber) {
  const attacker = opponentOf(data, playerId);
  if (hasDollsOnBoard(data.board, attacker)) {
    return buildAttackPhase(attacker, turnNumber);
  }
  return buildDefensePhase(attacker, turnNumber);
}

// Chamada quando o ATAQUE de `playerId` termina (timer mínimo
// estourou). Quem defende em seguida é o MESMO jogador.
function afterAttack(playerId, turnNumber) {
  return buildDefensePhase(playerId, turnNumber);
}

/* ------------------------------------------------------------
   Limpeza de salas abandonadas — apaga salas em 'waiting' com
   mais de 24h. Isso cobre o caso client-side; o ideal em produção
   é TAMBÉM ativar a política de TTL nativa do Firestore sobre o
   campo "expireAt" (Console → Firestore → aba "TTL"), que apaga
   os documentos automaticamente mesmo sem ninguém abrir o app.
------------------------------------------------------------ */
async function cleanupStaleRooms() {
  const cutoffMillis = Date.now() - ROOM_TTL_MS;
  const q = query(
    collection(getDb(), SALAS),
    where("state", "==", "waiting"),
    orderBy("createdAt"),
    limit(15)
  );

  let snap;
  try {
    snap = await getDocs(q);
  } catch (err) {
    console.warn("[Matchmaking] limpeza de salas adiada:", err.message);
    return;
  }

  const deletions = [];
  snap.forEach((docSnap) => {
    const createdAt = docSnap.data().createdAt;
    if (createdAt && createdAt.toMillis() < cutoffMillis) {
      deletions.push(deleteDoc(doc(getDb(), SALAS, docSnap.id)).catch(() => {}));
    }
  });
  await Promise.allSettled(deletions);
}

/* ------------------------------------------------------------
   Procura salas abertas (esperando oponente) que não sejam
   do próprio jogador.
------------------------------------------------------------ */
async function findOpenRoomIds(player) {
  const q = query(
    collection(getDb(), SALAS),
    where("state", "==", "waiting"),
    orderBy("createdAt"),
    limit(10)
  );
  const snap = await getDocs(q);
  const ids = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data.guest && data.ower && data.ower.ID !== player.id) {
      ids.push(docSnap.id);
    }
  });
  return ids;
}

/* ------------------------------------------------------------
   Tenta entrar como convidado numa sala específica, de forma
   atômica (transação) — evita dois jogadores entrando na mesma
   sala ao mesmo tempo. Se a sala já foi ocupada por outra
   pessoa entre a busca e a tentativa, a transação falha e
   devolvemos null pro chamador tentar a próxima candidata.
------------------------------------------------------------ */
async function tryJoinRoom(roomId, player, catalog) {
  const roomRef = doc(getDb(), SALAS, roomId);
  try {
    await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("sala-nao-existe");
      const data = snap.data();
      if (data.state !== "waiting" || data.guest) {
        throw new Error("sala-ocupada");
      }

      const ownerId = data.ower.ID;
      const ownerDeck = buildDeck(catalog, ownerId);
      const guestDeck = buildDeck(catalog, player.id);

      tx.update(roomRef, {
        guest: { ID: player.id, name: player.name },
        state: "playing",
        board: {},
        // O anfitrião sempre começa — turno 1, fase de defesa dele.
        turn: buildDefensePhase(ownerId, 1),
        p: {
          [ownerId]: { mobs: [], reserve: ownerDeck, effects: [] },
          [player.id]: { mobs: [], reserve: guestDeck, effects: [] },
        },
      });
    });
    return roomId;
  } catch (err) {
    return null;
  }
}

/* ------------------------------------------------------------
   Cria uma sala nova em estado 'waiting'.
------------------------------------------------------------ */
async function createRoom(player) {
  const roomRef = doc(collection(getDb(), SALAS));
  await setDoc(roomRef, {
    ower: { ID: player.id, name: player.name },
    guest: null,
    state: "waiting",
    turn: null,
    p: null,
    winner: null,
    board: null,
    createdAt: serverTimestamp(),
    expireAt: Timestamp.fromMillis(Date.now() + ROOM_TTL_MS),
  });
  return roomRef.id;
}

/* ------------------------------------------------------------
   API pública
------------------------------------------------------------ */

export async function findOrCreateRoom(player, catalog) {
  await cleanupStaleRooms();

  const candidateIds = await findOpenRoomIds(player);
  for (const roomId of candidateIds) {
    const joinedId = await tryJoinRoom(roomId, player, catalog);
    if (joinedId) return { roomId: joinedId, role: "guest" };
  }

  const roomId = await createRoom(player);
  return { roomId, role: "owner" };
}

export function listenRoom(roomId, onChange) {
  const roomRef = doc(getDb(), SALAS, roomId);
  return onSnapshot(
    roomRef,
    (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (err) => console.error("[Matchmaking] erro ao escutar sala:", err)
  );
}

export async function cancelRoom(roomId, player) {
  const roomRef = doc(getDb(), SALAS, roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return;
  const data = snap.data();
  if (data.ower?.ID === player.id && !data.guest) {
    await deleteDoc(roomRef);
  }
}

/* ------------------------------------------------------------
   Joga um boneco da reserva no tabuleiro, de forma atômica.
   Agora também exige que seja a fase de DEFESA e a vez de
   `playerId` — sem isso, nem o console do navegador consegue
   forçar uma jogada fora de hora.
------------------------------------------------------------ */
export async function placeDoll(roomId, playerId, reserveIndex, row, col) {
  const roomRef = doc(getDb(), SALAS, roomId);
  const boardKey = `${row}-${col}`;

  if (
    !Number.isInteger(row) || !Number.isInteger(col) ||
    row < 0 || row >= CORRIDORS || col < 0 || col >= TOTAL_COLS
  ) {
    throw new Error("posicao-fora-do-tabuleiro");
  }

  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) throw new Error("sala-nao-existe");

    const data = snap.data();

    if (!data.turn || data.turn.phase !== "defense" || data.turn.current !== playerId) {
      throw new Error("nao-e-seu-turno-de-defesa");
    }

    const isOwner = data.ower?.ID === playerId;
    const isOwnerColumn = col < SLOTS_PER_SIDE;
    if (isOwner !== isOwnerColumn) {
      throw new Error("coluna-nao-pertence-ao-jogador");
    }

    if (data.board && data.board[boardKey]) {
      throw new Error("slot-ja-ocupado");
    }

    const playerData = data.p?.[playerId];
    if (!playerData || !Array.isArray(playerData.reserve)) {
      throw new Error("jogador-sem-reserva");
    }

    const character = playerData.reserve[reserveIndex];
    if (!character) throw new Error("boneco-nao-encontrado-na-reserva");

    const newReserve = [...playerData.reserve];
    newReserve[reserveIndex] = null;

    tx.update(roomRef, {
      [`board.${boardKey}`]: character,
      [`p.${playerId}.reserve`]: newReserve,
      "turn.hasActed": true,
    });
  });
}

/* ------------------------------------------------------------
   Encerra o turno de DEFESA voluntariamente (botão "Encerrar
   Turno"). Só funciona se for a fase de defesa de `playerId` E
   ele já tiver jogado pelo menos 1 boneco nesse turno.
------------------------------------------------------------ */
export async function endTurn(roomId, playerId) {
  const roomRef = doc(getDb(), SALAS, roomId);
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) throw new Error("sala-nao-existe");
    const data = snap.data();
    const turn = data.turn;

    if (!turn || turn.phase !== "defense" || turn.current !== playerId) {
      throw new Error("nao-e-seu-turno-de-defesa");
    }
    if (!turn.hasActed) {
      throw new Error("precisa-jogar-pelo-menos-um-boneco-antes-de-encerrar");
    }

    tx.update(roomRef, { turn: afterDefense(data, playerId, turn.number + 1) });
  });
}

/* ------------------------------------------------------------
   Avança o turno automaticamente quando o prazo estoura.
   Chamada por QUALQUER cliente conectado (o timer local roda
   nos dois lados) — a checagem de turn.number garante que só o
   primeiro a chegar realmente processa a virada, mesmo que os
   dois clientes disparem quase ao mesmo tempo.

   Regras:
   - Defesa sem hasActed -> sala é apagada (inatividade).
   - Defesa com hasActed  -> passa o turno normalmente.
   - Ataque (sempre, já que ainda não existe ação de combate)
     -> passa pra defesa do mesmo jogador.
------------------------------------------------------------ */
export async function autoAdvanceTurn(roomId, expectedTurnNumber) {
  const roomRef = doc(getDb(), SALAS, roomId);
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) return; // sala já não existe

    const data = snap.data();
    const turn = data.turn;
    if (!turn || turn.number !== expectedTurnNumber) return; // já avançou

    if (turn.phase === "defense") {
      if (!turn.hasActed) {
        tx.delete(roomRef); // ninguém jogou nada no prazo — encerra por inatividade
        return;
      }
      tx.update(roomRef, { turn: afterDefense(data, turn.current, turn.number + 1) });
      return;
    }

    tx.update(roomRef, { turn: afterAttack(turn.current, turn.number + 1) });
  });
}