/* ============================================================
   Dados de exemplo — só pra provar que o sistema funciona.
   Troque à vontade / substitua por dados vindos do Firestore.
============================================================ */
const usedDolls = new Set();

function setRandomDoll(usedDolls) {
  const {id, doll} = getRandomDoll(usedDolls);
  usedDolls?.add(id);
  return createCharacter({ id, name: doll.name,  image: '🗡️', life: doll.stats.baseLife, attack: doll.stats.baseDamage, rage: doll.rageDamage, guard: new Set(doll.attbtLife).has('guardian')})
}

function seedDemoData() {

  // Evitar personagens repetidas no deck de aliados
  usedDolls = new Set();

  const allyDeck = [
    createCharacter(setRandomDoll(usedDolls)),
    createCharacter(setRandomDoll(usedDolls)),
    createCharacter(setRandomDoll(usedDolls)),
    createCharacter(setRandomDoll(usedDolls)),
    createCharacter(setRandomDoll(usedDolls)),
    createCharacter(setRandomDoll(usedDolls)),
    createCharacter(setRandomDoll(usedDolls)),
    createCharacter(setRandomDoll(usedDolls)),
    createCharacter(setRandomDoll(usedDolls)),
    createCharacter(setRandomDoll(usedDolls)),
    createCharacter(setRandomDoll(usedDolls)),

    // para teste, vamos predefinir Londres (boneco 095 do catalog)
    createCharacter({ id: '095londres', name: catalog['095londres'].name, image: '🗡️', life: catalog['095londres'].stats.baseLife, attack: catalog['095londres'].stats.baseDamage, rage: catalog['095londres'].rageDamage, guard: new Set(catalog['095londres'].attbtLife).has('guardian')})
  ];
  allyDeck.forEach((character, i) => { state.reserves.ally[i] = character; });

  const enemyDeck = [
    createCharacter(setRandomDoll()),
    createCharacter(setRandomDoll()),
  ];
  enemyDeck.forEach((character, i) => { state.reserves.enemy[i] = character; });
}
