// Fábrica simples pra manter os personagens com o mesmo formato
// em todo lugar (seed local hoje, documento do Firestore amanhã).
function createCharacter({ id, name, image, life, attack, rage, guard, owner = 'ally' }) {
  return { id, name, image, life, attack, rage, guard, owner };
}

function characterFromRoomData(d, ownerRole) {
  if (!d) return null;
  return createCharacter({
    id: d.id,
    name: d.name,
    image: '🗡️',
    life: d.life,
    attack: d.damage,
    rage: d.rage,
    guard: d.guard,
    owner: ownerRole,
  });
}

function getRandomKeyDoll() {
  const keys_doll = Object.keys(catalog);

  // Pega uma chave aleatória
  return keys_doll[Math.floor(Math.random() * keys_doll.length)];
}

function getRandomDoll() {
  const key_doll = getRandomKeyDoll();
  return {id: key_doll, doll: catalog[key_doll]};
}
