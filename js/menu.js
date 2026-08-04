/* ============================================================
   MENU — tela de login e busca de partida.
   Único responsável por: nome + ID do jogador, botão "Jogar",
   estado de espera, e entregar os dados da sala pronta pro
   jogo (via window.Game / globais de index.html) quando o
   segundo jogador entrar.
============================================================ */

// 1) Import: adicione endTurn e autoAdvanceTurn
import { findOrCreateRoom, listenRoom, cancelRoom, isFirebaseConfigured, placeDoll, endTurn, autoAdvanceTurn } from "./matchmaking.js";

window.Matchmaking = { placeDoll, endTurn, autoAdvanceTurn };
// Testando com duas abas do MESMO navegador? localStorage é
// compartilhado entre elas, então as duas puxariam o mesmo ID.
// Abrindo a segunda aba como "?slot=2" (ou qualquer valor), essa
// aba passa a guardar seu próprio ID/nome, separado da primeira —
// sem afetar o uso normal (sem o parâmetro, tudo é como antes).
const TEST_SLOT = new URLSearchParams(window.location.search).get("slot");
const KEY_SUFFIX = TEST_SLOT ? `_${TEST_SLOT}` : "";
const STORAGE_ID_KEY = `anop_player_id${KEY_SUFFIX}`;
const STORAGE_NAME_KEY = `anop_player_name${KEY_SUFFIX}`;
const CATALOG_URL = "json/catalog.json";

function getOrCreatePlayerId() {
  let id = localStorage.getItem(STORAGE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_ID_KEY, id);
  }
  return id;
}

function shortId(id) {
  return id.slice(0, 8).toUpperCase();
}

export const Menu = {
  els: {},
  player: null,
  catalog: null,
  matchStarted: false,
  roomId: null,
  unsubscribe: null,

  async init() {
    this.els = {
      screen: document.getElementById("menu-screen"),
      loginCard: document.getElementById("login-card"),
      waitingCard: document.getElementById("waiting-card"),
      input: document.getElementById("input-username"),
      idTag: document.getElementById("player-id-tag"),
      playBtn: document.getElementById("btn-play"),
      cancelBtn: document.getElementById("btn-cancel"),
      error: document.getElementById("menu-error"),
      waitingText: document.getElementById("waiting-text"),
    };

    const id = getOrCreatePlayerId();
    this.els.idTag.textContent = TEST_SLOT
      ? `Nº ${shortId(id)} · aba ${TEST_SLOT}`
      : `Nº ${shortId(id)}`;

    const savedName = localStorage.getItem(STORAGE_NAME_KEY) || "";
    this.els.input.value = savedName;

    this.els.playBtn.addEventListener("click", () => this.handlePlay());
    this.els.cancelBtn.addEventListener("click", () => this.handleCancel());
    this.els.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.handlePlay();
    });

    if (!isFirebaseConfigured) {
      this.setError(
        "Firebase ainda não configurado — preencha js/firebase-config.js pra habilitar o Jogar."
      );
    }

    // catálogo é carregado em paralelo, só é necessário no
    // momento de gerar os baralhos (quando a sala fecha).
    this.catalog = fetch(CATALOG_URL).then((r) => r.json());
  },

  setError(msg) {
    this.els.error.textContent = msg || "";
  },

async handlePlay() {
  if (!isFirebaseConfigured) {
    this.setError(
      "Firebase ainda não configurado — preencha js/firebase-config.js pra habilitar o Jogar."
    );
    return;
  }

  const name = this.els.input.value.trim();
  if (!name) {
    this.setError("Diga seu nome antes de entrar no palco.");
    this.els.input.focus();
    return;
  }

  localStorage.setItem(STORAGE_NAME_KEY, name);
  this.setError("");
  this.player = { id: getOrCreatePlayerId(), name };
  this.matchStarted = false;

  this.els.playBtn.disabled = true;
  this.showWaiting("Procurando um oponente...");

  try {
    const catalog = await this.catalog;
    const { roomId, role } = await findOrCreateRoom(this.player, catalog);
    this.roomId = roomId;

    if (role === "owner") {
      this.showWaiting("Sala criada. Aguardando outro jogador entrar...");
    }

    // Um único listener cobre tudo: primeiro detecta a sala fechando
    // (state === 'playing'), dispara startMatch() uma vez só, e depois
    // vira o canal de sincronia do tabuleiro/reserva durante a partida.

  this.unsubscribe = listenRoom(roomId, (data) => {
    if (!data) {
      this.unsubscribe?.();
      this.unsubscribe = null;
      const wasPlaying = this.matchStarted;
      this.matchStarted = false;
      this.roomId = null;
      if (wasPlaying) {
        window.Game.handleRoomClosed();
      }
      this.setError(
        wasPlaying
          ? "A sala foi encerrada por inatividade."
          : "A sala expirou. Tente novamente."
      );
      this.showLogin();
      return;
    }

    if (!this.matchStarted && data.state === "playing" && data.guest) {
      this.matchStarted = true;
      this.startMatch(data);
      return;
    }

    if (this.matchStarted) {
      window.Game.syncRoom(data);
    }
  });
  } catch (err) {
    console.error("[Menu] falha ao entrar em uma sala:", err);
    this.setError("Não foi possível entrar agora. Tente de novo.");
    this.showLogin();
  }
},

  async handleCancel() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.roomId && this.player) {
      await cancelRoom(this.roomId, this.player).catch(() => {});
    }
    this.roomId = null;
    this.showLogin();
  },

  showWaiting(text) {
    this.els.loginCard.hidden = true;
    this.els.waitingCard.hidden = false;
    this.els.waitingText.textContent = text;
  },

  showLogin() {
    this.els.waitingCard.hidden = true;
    this.els.loginCard.hidden = false;
    this.els.playBtn.disabled = false;
    this.els.screen.classList.remove("menu-screen--hidden");
  },

  // Entrega os dados da sala fechada pro jogo já em execução em
  // index.html (globais: state, Board, Reserve, PlayerNames,
  // createCharacter — todos definidos no script principal).
  startMatch(roomData) {
    const me = this.player.id;
    const isOwner = roomData.ower.ID === me;
    const opponent = isOwner ? roomData.guest : roomData.ower;
    const opponentReserve = roomData.p?.[opponent.ID]?.reserve || [];
    const myReserve = roomData.p?.[me]?.reserve || [];

  // 4) startMatch(roomData) precisa repassar o turno pro Game:
  window.Game.startMatch({
    roomId: this.roomId,
    me: { id: me, name: this.player.name },
    opponent: { id: opponent.ID, name: opponent.name },
    myReserve,
    opponentReserve,
    role: isOwner ? 'owner' : 'guest',
    turn: roomData.turn, // <-- novo
  });

    this.els.screen.classList.add("menu-screen--hidden");
  },
};

document.addEventListener("DOMContentLoaded", () => Menu.init());