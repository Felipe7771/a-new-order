const simbol = {
    life:'&#10084;',
    damage:'&#9876;',
    guardian: '&#10015;',
    implacable: '<i class="bi bi-shield-shaded"></i>',
    drill: '<i class="bi bi-airplane-fill"></i>',
    mortal: '<i class="bi bi-virus2"></i>',
    rage: '<i class="bi bi-fire"></i>',
    area: '&#128165;',
    entire_arena: '&#127754;',
}
const info_attributes = {
    guardian: `<i class="stat stat--guardian">${simbol.guardian}<u>ANJO DA GUARDA</u></i>`,
    implacable: `<i class="stat stat--implacable">${simbol.implacable}<u>IMPLACÁVEL</u></i>`,
    drill: `<i class="stat stat--drill">${simbol.drill}<u>PERFURADOR</u></i>`,
    mortal: `<i class="stat stat--mortal">${simbol.mortal}<u>MORTAL</u></i>`,
    rage: (damage) => `<i class="stat stat--rage">${simbol.rage}<u>FÚRIA (${damage})</u></i>`,
    area: `<i class="stat stat--area">${simbol.area}<u>DANO EM ÁREA</u></i>`,
    entire_arena: `<i class="stat stat--entire_arena">${simbol.entire_arena}<u>CATACLISMO</u></i>`,
}

function joinAttributes(attbt_life, attbt_damage) {
    return [...attbt_life,...attbt_damage]
}

function getHTMLattributes(attbt, damage) {
    if (!attbt.length) return ''
    return attbt
        .map(element => {
            const attribute = info_attributes[element];

            if (typeof attribute === 'function') {
                return attribute(damage);
            }

            return attribute;
        })
        .join(' ');
}

// Atributos de vida/dano que NÃO estão sendo exibidos pelo símbolo
// principal (definyStyle escolhe só 1 por categoria: guardian>implacable
// pra vida, drill>mortal pra dano). Tudo que sobrar disso — incluindo
// area/entire_arena, que nunca viram símbolo principal — é retornado
// aqui pra virar ícone na lateral do boneco na arena.
function getExtraLifeDamageAttributes(id) {
    const doll = catalog[id];
    if (!doll) return [];

    const lifeAttrs = new Set(doll.attbtLife || []);
    const damageAttrs = new Set(doll.attbtDamage || []);

    let primaryLife = null;
    if (lifeAttrs.has('guardian')) primaryLife = 'guardian';
    else if (lifeAttrs.has('implacable')) primaryLife = 'implacable';

    let primaryDamage = null;
    if (damageAttrs.has('drill')) primaryDamage = 'drill';
    else if (damageAttrs.has('mortal')) primaryDamage = 'mortal';

    const extra = [];
    lifeAttrs.forEach((attr) => { if (attr !== primaryLife) extra.push(attr); });
    damageAttrs.forEach((attr) => { if (attr !== primaryDamage) extra.push(attr); });

    // rage tem seu próprio lugar no card-stats (via character.rage) —
    // não duplica aqui. Só atributos com símbolo próprio em `simbol`.
    return extra.filter((attr) => attr !== 'rage' && simbol[attr]);
}

function definyStyle(type, id) {
  if (type === 'life') {
    const list_attbt = new Set(catalog[id].attbtLife)

    if (list_attbt.has('guardian')) return `stat--guardian">${simbol.guardian}`
    else if (list_attbt.has('implacable')) return `stat--implacable">${simbol.implacable}`
    else return `stat--life">${simbol.life}`
    
  } else {

    const list_attbt = new Set(catalog[id].attbtDamage)

    if (list_attbt.has('drill')) return `stat--drill">${simbol.drill}`
    else if (list_attbt.has('mortal')) return `stat--mortal">${simbol.mortal}`
    else return `stat--attack">${simbol.damage}`

  }
}