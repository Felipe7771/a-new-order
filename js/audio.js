/* ============================================================
   AudioManager — sistema de áudio do jogo (A NEW ORDER)

   Estrutura de pastas esperada na raiz do projeto:

   audio/
     background/          -> músicas de fundo, em loop
       menu.mp3
       board.mp3
     sound/                -> efeitos sonoros (um tiro só)
       click.mp3
       hover.mp3
       type.mp3
       effects/            -> efeitos por atributo de boneco
         guardian.mp3
         implacable.mp3
         drill.mp3
         mortal.mp3
         rage.mp3
         area.mp3
         entire_arena.mp3
         default.mp3       -> fallback pra atributo sem som próprio

   Como usar (liga/desliga fácil, por categoria):

     AudioManager.setCategoryEnabled('hover', false)   // desliga só o hover
     AudioManager.setCategoryEnabled('click', true)    // liga de volta
     AudioManager.setVolume('music', 0.3)              // ajusta volume
     AudioManager.muteAll() / AudioManager.unmuteAll()  // tudo de uma vez

   Carregue este arquivo ANTES do script inline do index.html e
   ANTES do js/menu.js — ele expõe window.AudioManager, que tanto
   scripts normais quanto módulos ES (menu.js) conseguem acessar.
============================================================ */

const AudioManager = (() => {

  const BASE = 'audio/';
  const PATHS = {
    background: `${BASE}background/`,
    sound: `${BASE}sound/`,
    effects: `${BASE}sound/effects/`,
  };

  // ---- configuração / estado -----------------------------------
  // Cada chave liga/desliga uma categoria inteira. "Aplicar e
  // desaplicar" um tipo de som é só trocar esse valor.
  const settings = {
    music: true,
    click: true,
    hover: true,
    type: true,
    dollEffects: true,
    volumes: {
      music: 0.5,
      click: 0.6,
      hover: 0.35,
      type: 0.3,
      dollEffects: 0.7,
    },
  };

  const musicCache = {};
  const sfxCache = {};

  let currentMusic = null;
  let currentMusicName = null;

  // ---- carregamento -----------------------------------------------
  function loadAudio(src, { loop = false } = {}) {
    const audio = new Audio(src);
    audio.loop = loop;
    audio.preload = 'auto';
    return audio;
  }

  function getMusic(name) {
    if (!musicCache[name]) {
      musicCache[name] = loadAudio(`${PATHS.background}${name}.mp3`, { loop: true });
    }
    return musicCache[name];
  }

  function getSfx(name, folder) {
    const key = folder + name;
    if (!sfxCache[key]) {
      sfxCache[key] = loadAudio(`${folder}${name}.mp3`);
    }
    return sfxCache[key];
  }

  // ---- fade (usado na troca de música) -----------------------------
  function fade(audio, from, to, duration, onDone) {
    const steps = 20;
    const stepTime = Math.max(duration / steps, 1);
    const stepValue = (to - from) / steps;
    let i = 0;
    audio.volume = Math.max(0, Math.min(1, from));
    clearInterval(audio._fadeInterval);
    audio._fadeInterval = setInterval(() => {
      i++;
      audio.volume = Math.max(0, Math.min(1, from + stepValue * i));
      if (i >= steps) {
        clearInterval(audio._fadeInterval);
        if (onDone) onDone();
      }
    }, stepTime);
  }

  // ================================================================
  // MÚSICA DE FUNDO
  // ================================================================
  const Music = {
    // name = nome do arquivo (sem extensão) dentro de audio/background/
    // fadeMs = tempo do crossfade (0 = troca seca, sem transição)
    play(name, { fadeMs = 800 } = {}) {
      if (!settings.music) return;
      if (currentMusicName === name && currentMusic && !currentMusic.paused) return;

      const next = getMusic(name);
      const targetVol = settings.volumes.music;

      if (currentMusic && !currentMusic.paused) {
        const prev = currentMusic;
        fade(prev, prev.volume, 0, fadeMs, () => prev.pause());
      }

      next.currentTime = 0;
      next.volume = fadeMs ? 0 : targetVol;
      next.play().catch(() => {}); // navegador pode bloquear até 1º gesto do usuário
      if (fadeMs) fade(next, 0, targetVol, fadeMs);

      currentMusic = next;
      currentMusicName = name;
    },

    stop({ fadeMs = 500 } = {}) {
      if (!currentMusic) return;
      const toStop = currentMusic;
      fade(toStop, toStop.volume, 0, fadeMs, () => toStop.pause());
      currentMusic = null;
      currentMusicName = null;
    },

    setEnabled(enabled) {
      settings.music = enabled;
      if (!enabled) this.stop({ fadeMs: 300 });
    },

    setVolume(v) {
      settings.volumes.music = v;
      if (currentMusic) currentMusic.volume = v;
    },
  };

  // ================================================================
  // EFEITOS SONOROS — clique, hover, digitação, bonecos
  // ================================================================
  function playOneShot(category, name, folder = PATHS.sound) {
    if (!settings[category]) return;
    const base = getSfx(name, folder);
    const instance = base.cloneNode(); // clona pra permitir sons sobrepostos
    instance.volume = settings.volumes[category];
    instance.play().catch(() => {});
  }

  const Sfx = {
    click(name = 'click') { playOneShot('click', name); },
    hover(name = 'hover') { playOneShot('hover', name); },
    type(name = 'type') { playOneShot('type', name); },

    // efeito de boneco — recebe a chave do atributo (guardian, drill,
    // rage, mortal, area, entire_arena, implacable...). Se não existir
    // arquivo pra essa chave, cai no default.mp3 automaticamente.
    dollEffect(effectKey) {
      if (!settings.dollEffects) return;
      const base = getSfx(effectKey, PATHS.effects);
      const instance = base.cloneNode();
      instance.volume = settings.volumes.dollEffects;
      instance.play().catch(() => {
        playOneShot('dollEffects', 'default', PATHS.effects);
      });
    },
  };

  // ================================================================
  // AUTO-ATTACH via delegação — liga uma vez em document e funciona
  // pra qualquer elemento (mesmo os criados dinamicamente depois,
  // como slots do tabuleiro/reserva e o botão de fechar o modal),
  // desde que tenham os atributos:
  //
  //   data-sfx-click="click"   -> toca sound/click.mp3 ao clicar
  //   data-sfx-hover="hover"   -> toca sound/hover.mp3 ao passar o mouse
  //
  // Pra "desaplicar" um som, não precisa remover listener nenhum:
  // é só desligar a categoria (setCategoryEnabled('hover', false))
  // ou tirar o atributo data-sfx-* do elemento.
  // ================================================================
  let bound = false;
  function bindUISounds(root = document) {
    if (bound) return; // idempotente — chame quantas vezes quiser
    bound = true;

    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-sfx-click]');
      if (el) Sfx.click(el.dataset.sfxClick || 'click');
    });

    let lastHoverEl = null;
    root.addEventListener('mouseover', (e) => {
      // SE O BOTÃO ESTIVER DESABILITADO, NÃO TOCA O SOM (mesmo que tenha o atributo data-sfx-hover)
      if (e.target.closest('button:disabled')) return;
      const el = e.target.closest('[data-sfx-hover]');
      if (el && el !== lastHoverEl) {
        lastHoverEl = el;
        Sfx.hover(el.dataset.sfxHover || 'hover');
      } else if (!el) {
        lastHoverEl = null;
      }
    });
  }

  // Digitação: precisa ser explícito por input (cada campo de texto
  // que deve "clicar" ao digitar). attachTypingSound/detachTypingSound
  // são o par aplicar/desaplicar pra esse caso específico.
  const typingHandlers = new WeakMap();

  function attachTypingSound(inputEl, name = 'type') {
    if (!inputEl) return;
    const handler = () => Sfx.type(name);
    inputEl.addEventListener('input', handler);
    typingHandlers.set(inputEl, handler);
  }

  function detachTypingSound(inputEl) {
    const handler = typingHandlers.get(inputEl);
    if (!handler) return;
    inputEl.removeEventListener('input', handler);
    typingHandlers.delete(inputEl);
  }

  // ================================================================
  // TRANSIÇÃO MENU <-> TABULEIRO
  // Chame exatamente no momento em que a tela muda. É só isso que
  // decide qual música toca — nada de lógica escondida.
  // ================================================================
  function enterBoard() {
    Music.play('board', { fadeMs: 900 });
  }

  function enterMenu() {
    Music.play('menu', { fadeMs: 900 });
  }

  // Autoplay dos navegadores só libera áudio depois de um gesto do
  // usuário (clique/tecla). Isso arma a música do menu pro primeiro
  // gesto, sem precisar tocar em botão nenhum manualmente.
  function primeOnFirstInteraction(name = 'menu') {
    const start = () => {
      Music.play(name);
      document.removeEventListener('pointerdown', start);
      document.removeEventListener('keydown', start);
    };
    document.addEventListener('pointerdown', start, { once: true });
    document.addEventListener('keydown', start, { once: true });
  }

  // ================================================================
  // Controles globais
  // ================================================================
  function setCategoryEnabled(category, enabled) {
    if (category === 'music') return Music.setEnabled(enabled);
    if (!(category in settings)) return;
    settings[category] = enabled;
  }

  function setVolume(category, value) {
    if (category === 'music') return Music.setVolume(value);
    if (!(category in settings.volumes)) return;
    settings.volumes[category] = Math.max(0, Math.min(1, value));
  }

  function muteAll() {
    Object.keys(settings).forEach((k) => {
      if (k !== 'volumes') settings[k] = false;
    });
    Music.stop({ fadeMs: 200 });
  }

  function unmuteAll() {
    Object.keys(settings).forEach((k) => {
      if (k !== 'volumes') settings[k] = true;
    });
  }

  function getStatus() {
    return {
      ...JSON.parse(JSON.stringify(settings)),
      currentMusic: currentMusicName,
    };
  }

  return {
    settings,
    Music,
    Sfx,
    bindUISounds,
    attachTypingSound,
    detachTypingSound,
    enterBoard,
    enterMenu,
    primeOnFirstInteraction,
    setCategoryEnabled,
    setVolume,
    muteAll,
    unmuteAll,
    getStatus,
  };
})();

window.AudioManager = AudioManager;
