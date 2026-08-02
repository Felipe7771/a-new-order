/* ============================================================
   MATCHMAKING — tudo que fala com o Firestore mora aqui.
   Segue o esquema de "salas" combinado no diagrama:

   salas/{salaId}
     ower:   { ID, name }
     guest:  { ID, name } | null
     state:  'waiting' | 'playing' | 'ended'
     turn:   { number, phase, current } | null
     p:      { [ID]: { mobs, reserve, effects } } | null
     winner: ID | null
     board:  null (por enquanto — a lógica de tabuleiro entra depois)
     createdAt: Timestamp do servidor
     expireAt:  Timestamp usado pela política de TTL do Firestore

   Este módulo só cuida de MENU + LOGIN + MATCHMAKING. A lógica
   de turno/combate ainda não mexe em "turn"/"p" além de criar
   o esqueleto inicial.
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
    // Se o índice composto ainda não existir, o Firestore devolve
    // um link no próprio erro pra criá-lo. Não travamos o fluxo
    // de matchmaking por causa disso.
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
        board: {},              // <-- novo: mapa esparso "linha-coluna" -> boneco
        turn: { number: 1, phase: "defense", current: ownerId },
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

// Procura uma sala aberta e entra nela; se não achar (ou perder
// a corrida pra outro jogador), cria uma sala nova e espera.
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

// Escuta mudanças na sala em tempo real. Devolve uma função pra
// cancelar a escuta.
export function listenRoom(roomId, onChange) {
  const roomRef = doc(getDb(), SALAS, roomId);
  return onSnapshot(
    roomRef,
    (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (err) => console.error("[Matchmaking] erro ao escutar sala:", err)
  );
}

// Cancela a procura: só apaga a sala se ela ainda não tiver
// convidado e se pertencer a este jogador.
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
   Joga um boneco da reserva no tabuleiro, de forma atômica:
   escreve em board["linha-coluna"] e zera o índice correspondente
   na reserve do jogador que jogou. Os dois clientes enxergam a
   mudança pelo mesmo onSnapshot (listenRoom) já usado no matchmaking.
------------------------------------------------------------ */
export async function placeDoll(roomId, playerId, reserveIndex, row, col) {
  const roomRef = doc(getDb(), SALAS, roomId);
  const boardKey = `${row}-${col}`;

  // Fora dos limites do tabuleiro — nem chega a olhar a sala.
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

    // Colunas 0..SLOTS_PER_SIDE-1 são sempre do ower, o resto é
    // sempre do guest (ver comentário de CONFIG.myRole em index.html).
    // Isso vale independente de quem está olhando a tela — é a MESMA
    // regra pros dois lados, então validar aqui (server-side, dentro
    // da transação) é o que garante de verdade que ninguém consegue
    // jogar no campo do adversário, mesmo chamando isso direto pelo
    // console do navegador.
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
    });
  });
}