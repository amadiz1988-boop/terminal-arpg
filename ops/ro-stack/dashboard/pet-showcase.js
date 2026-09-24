(() => {
  const SHOWCASE_ANIMATIONS = Object.freeze(['idle', 'happy']);
  const SPECIES_ASSETS = Object.freeze({
    bulbasaur: Object.freeze({
      idle: '/assets/pets/bulbasaur/idle.webp',
      happy: '/assets/pets/bulbasaur/happy.webp',
      directionRow: 0,
    }),
  });

  function normalizePet(pet) {
    if (!pet || typeof pet !== 'object') return null;
    const animation = SHOWCASE_ANIMATIONS.includes(pet.showcaseAnimation)
      ? pet.showcaseAnimation
      : 'idle';
    return Object.freeze({
      petId: pet.petId ?? null,
      species: String(pet.species ?? ''),
      evolutionStage: Math.max(1, Math.trunc(Number(pet.evolutionStage) || 1)),
      displayEnabled: pet.displayEnabled === true,
      showcaseAnimation: animation,
    });
  }

  function createCharacterShowcase(input = {}) {
    return Object.freeze({
      characterAppearance: input.characterAppearance ?? null,
      equipmentAppearance: input.equipmentAppearance ?? null,
      pet: normalizePet(input.pet),
      title: input.title ?? null,
      seasonInfo: input.seasonInfo ?? null,
    });
  }

  function render(container, showcase) {
    if (!container) return false;
    const pet = showcase?.pet;
    const assets = pet ? SPECIES_ASSETS[pet.species] : null;
    const visible = Boolean(pet?.displayEnabled && assets);
    container.hidden = !visible;
    container.dataset.petShowcaseMode = 'fixed';
    container.dataset.petShowcaseAnimation = pet?.showcaseAnimation ?? 'idle';
    container.dataset.petShowcaseSpecies = pet?.species ?? '';
    if (!visible) {
      container.style.backgroundImage = '';
      return false;
    }
    container.style.backgroundImage = `url("${assets[pet.showcaseAnimation]}")`;
    container.style.backgroundPosition = `0 ${-assets.directionRow * 48}px`;
    return true;
  }

  window.PetShowcaseMode = Object.freeze({
    mode: 'fixed-character-side',
    usesScrollChase: false,
    usesPanelAnchor: false,
    animations: SHOWCASE_ANIMATIONS,
    createCharacterShowcase,
    render,
  });
})();
