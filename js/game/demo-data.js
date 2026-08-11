/* ============================================================
   Dados de exemplo — só pra provar que o sistema funciona.
   Troque à vontade / substitua por dados vindos do Firestore.
============================================================ */
function setRandomDoll() {
  const {id, doll} = getRandomDoll();
  return createCharacter({ id, name: doll.name,  image: '🗡️', life: doll.stats.baseLife, attack: doll.stats.baseDamage, rage: doll.rageDamage, guard: new Set(doll.attbtLife).has('guardian')})
}

function seedDemoData() {
  const allyDeck = [
    createCharacter(setRandomDoll()),
    createCharacter(setRandomDoll()),
    createCharacter(setRandomDoll()),
    createCharacter(setRandomDoll()),
    createCharacter(setRandomDoll()),
    createCharacter(setRandomDoll()),
    createCharacter(setRandomDoll()),
    createCharacter(setRandomDoll()),
    createCharacter(setRandomDoll()),
    createCharacter(setRandomDoll()),
    createCharacter(setRandomDoll()),
    createCharacter(setRandomDoll()),
  ];
  allyDeck.forEach((character, i) => { state.reserves.ally[i] = character; });

  const enemyDeck = [
    createCharacter(setRandomDoll()),
    createCharacter(setRandomDoll()),
  ];
  enemyDeck.forEach((character, i) => { state.reserves.enemy[i] = character; });
}
