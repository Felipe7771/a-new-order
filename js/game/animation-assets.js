/* ============================================================
   Animation assets — resolve as mídias do catalog.animation
   por personagem/contexto, com fallback em cascata até o emoji.
============================================================ */
function getAnimationAsset(characterId, context, key) {
  const doll = catalog?.[characterId];
  const src = doll?.animation?.[context]?.[key];
  return src && String(src).trim() ? src : null;
}

const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v)(\?.*)?$/i;
function isVideoSrc(src) {
  return VIDEO_EXT_RE.test(src);
}

// loop=true pra reserve_default/arena_default (idle);
// loop=false + onEnded só é usado pra arena_entrance.
function createMediaElement(src, character, { loop = true, onEnded = null, onError = null } = {}) {
  if (isVideoSrc(src)) {
    const video = document.createElement('video');
    video.className = 'card-media';
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.loop = loop;
    if (onEnded) video.addEventListener('ended', onEnded, { once: true });
    if (onError) video.addEventListener('error', onError, { once: true });
    video.src = src;
    video.play().catch(() => {});
    return video;
  }
  const img = document.createElement('img');
  img.alt = character.name;
  img.className = 'card-media';
  if (onError) img.addEventListener('error', onError, { once: true });
  img.src = src;
  return img;
}

// Alterna a classe 'slot--media-loaded' no SLOT (não na mídia em si):
// quando o vídeo/imagem real termina de carregar (pronto pra tocar
// sem travar, no caso de vídeo), escondemos a "caixinha" (borda +
// fundo) do slot — só o boneco vazando aparece. Se der erro, a
// classe nunca entra (ou sai), e a caixinha volta a servir de
// fallback visual. Usado tanto no visual padrão (CardRenderer)
// quanto no vídeo de ENTRADA (Board/Reserve.playEntrance).
function watchSlotMediaLoad(media, slotEl) {
  if (!media || !slotEl) return;

  const markLoaded = () => slotEl.classList.add('slot--media-loaded');
  const markError = () => slotEl.classList.remove('slot--media-loaded');

  if (media.tagName === 'VIDEO') {
    if (media.readyState >= 4) markLoaded(); // HAVE_ENOUGH_DATA — já carregado
    media.addEventListener('loadeddata', markLoaded, { once: true });
    media.addEventListener('error', markError, { once: true });
  } else if (media.tagName === 'IMG') {
    if (media.complete && media.naturalWidth > 0) markLoaded();
    media.addEventListener('load', markLoaded, { once: true });
    media.addEventListener('error', markError, { once: true });
  }
  // <span> de fallback (emoji) não é mídia real — caixinha fica visível.
}