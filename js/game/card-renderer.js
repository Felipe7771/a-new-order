/* ============================================================
   CardRenderer — desenha UM cartão dentro de um slot qualquer.
   Board e Reserve chamam essa mesma função; a única diferença
   entre os dois é a opção showStats/draggable.
============================================================ */
const CardRenderer = {
render(el, character, { showStats = false, draggable = false, variant = 'reserve' } = {}) {
    el.innerHTML = '';
    el.classList.toggle('slot--empty', !character);
    el.classList.toggle('slot--filled', !!character);
    el.classList.remove('slot--media-loaded'); // reseta a cada render
    el.draggable = false;
    el.removeAttribute('aria-label');

    if (!character) {
      el.setAttribute('aria-label', 'Slot vazio');
      return;
    }

    const visual = document.createElement('div');
    visual.className = `card-visual card-visual--${variant === 'board' ? 'board' : 'reserve'}`;
    const media = this.createVisual(character, variant);
    watchSlotMediaLoad(media, el);
    visual.appendChild(media);

    if (variant === 'board') {
      const sideAttrs = this.buildSideAttributes(character);
      if (sideAttrs) visual.appendChild(sideAttrs);
    }

    el.appendChild(visual);

    if (showStats) el.appendChild(this.buildStats(character));
    if (draggable) el.draggable = true;
    el.setAttribute('aria-label', character.name);
},

  buildStats(character) {
    const stats = document.createElement('div');
    stats.className = 'card-stats';
    stats.innerHTML =
      `<span class="stat ${definyStyle('life',character.id)}${character.life}</span>` +
      `<span class="stat ${definyStyle('attack',character.id)}${character.attack}</span>` +
      (character.rage > 0 ? `<span class="stat stat--rage">${simbol.rage}${character.rage}</span>` : '');
    return stats;
  },

  // Ícones dos atributos de vida/dano que NÃO aparecem no símbolo
  // principal (ver getExtraLifeDamageAttributes em styles.js). Só usado
  // na arena — reaproveita as classes .stat--X já coloridas, sem texto.
  buildSideAttributes(character) {
    const extra = getExtraLifeDamageAttributes(character.id);
    if (!extra.length) return null;

    const wrap = document.createElement('div');
    wrap.className = 'card-side-attrs';
    wrap.innerHTML = extra
      .map((key) => `<i class="card-side-attr stat--${key}">${simbol[key]}</i>`)
      .join('');
    return wrap;
  },

  // variant: 'reserve' -> animation.reserve_default | 'board' -> animation.arena_default
  createVisual(character, variant) {
    const context = variant === 'board' ? 'board' : 'reserve';
    const src = getAnimationAsset(character.id, context, 'default');
    if (src) return createMediaElement(src, character, { loop: true });
    return this.createImage(character);
  },
  // mantido como estava — usado pelo Modal e como fallback final
  createImage(character) {
    const looksLikeUrl = /^https?:\/\//.test(character.image) || character.image.includes('/');
    if (looksLikeUrl) {
      const img = document.createElement('img');
      img.src = character.image;
      img.alt = character.name;
      img.className = 'card-media'; // era 'card-img'
      return img;
    }
    const span = document.createElement('span');
    span.className = 'card-icon';
    span.textContent = character.image;
    return span;
  },

  // Usado só pelo Modal — sempre tenta animation.arena_default; se não
  // existir, cai no fallback antigo (URL do character.image ou emoji).
  // Sem o efeito de vazamento: aqui a imagem fica confinada na ficha.
  createModalVisual(character) {
    const src = getAnimationAsset(character.id, 'board', 'default');
    if (src) {
      const media = createMediaElement(src, character, { loop: true });
      media.classList.remove('card-media');
      media.classList.add('modal-media');
      return media;
    }
    return this.createImage(character);
  },
};
