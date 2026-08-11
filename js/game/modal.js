/* ============================================================
Modal — janela simples com as infos do personagem.
============================================================ */

const Modal = {
  el: null,

  init(el) {
    this.el = el;
    el.addEventListener('click', (e) => {
      if (e.target === el) this.close();
    });
  },

  open(character) {
    const doll = catalog[character.id]
    const attbts = joinAttributes(doll.attbtLife, doll.attbtDamage)

    this.el.innerHTML = `
      <div class="modal-card">
        <button class="modal-close" data-sfx-click="click" aria-label="Fechar">&#10005;</button>
        <div class="modal-visual"></div>
        <h2 class="modal-name">${character.name}</h2>
        <h2 class="modal-group"><i>${doll.group}<i></h2>
          <div class="modal-stats">
            <span class="stat ${definyStyle('life',character.id)}Vida: ${character.life}</span>
              <span class="stat ${definyStyle('attack',character.id)}Ataque: ${character.attack}</span>
          </div>
          ${attbts.length || doll.power.description !== '' ? "<hr style='opacity: 0.3;'>": ''}
          <h2 class="modal-attributes">${getHTMLattributes(attbts,doll.rageDamage)}</h2>
          <br>
          <h2 class="modal-power">${doll.power.description.replace('[','<i><strong><u>').replace(']','</i></strong></u>')}</h2>

          ${doll.affinities.length ? "<br><hr style='opacity: 0.3;'>": ''}

          <h2 class="modal-affinities">${doll.affinities.map(item => `&#9903;${item}   `).join('')}</h2>
      </div>
    `;
    this.el.querySelector('.modal-visual').appendChild(CardRenderer.createModalVisual(character));
    this.el.querySelector('.modal-close').addEventListener('click', () => this.close());
    this.el.classList.add('modal-overlay--visible');

    // Prévia sonora do atributo principal do boneco (rage, drill, guardian...).
    // Quando o sistema de combate real existir, chame AudioManager.Sfx.dollEffect()
    // no momento do golpe de verdade — isso aqui é só a ficha sendo aberta.
    AudioManager.Sfx.dollEffect(attbts[0] || 'default');
  },

  close() {
    this.el.classList.remove('modal-overlay--visible');
  },

};
