(() => {
  const STORAGE_KEY = 'ro-pet-companion-settings-v1';
  const CHANGE_EVENT = 'petcompanion:settingschange';
  const ACTIVITY_LEVELS = Object.freeze(['quiet', 'normal', 'lively']);
  const PET_SPECIES = Object.freeze(['bulbasaur', 'terasoid', 'baphomet', 'angeling', 'moonlight', 'tamadora']);
  const SIZE_MODE_BREAKPOINTS = Object.freeze({
    desktop: Object.freeze({ normalMax: 200, largeMax: 500 }),
    mobile: Object.freeze({ normalMax: 160, largeMax: 320 }),
  });
  const PERSISTED_FIELDS = Object.freeze({
    pet_companion_enabled: Object.freeze({ api: 'petCompanionEnabled', defaultValue: true }),
    pet_companion_species: Object.freeze({ api: 'petCompanionSpecies', defaultValue: 'bulbasaur' }),
    pet_companion_size: Object.freeze({ api: 'petCompanionSize', defaultValue: 72 }),
    pet_activity_level: Object.freeze({ api: 'petActivityLevel', defaultValue: 'normal' }),
    pet_idle_sleep_enabled: Object.freeze({ api: 'petIdleSleepEnabled', defaultValue: true }),
    pet_reduce_activity_in_log: Object.freeze({ api: 'petReduceActivityInLog', defaultValue: true }),
    show_pet_in_profile: Object.freeze({ api: 'showPetInProfile', defaultValue: false }),
    show_pet_in_ranking: Object.freeze({ api: 'showPetInRanking', defaultValue: false }),
  });
  const DEFAULTS = Object.freeze(
    Object.fromEntries(
      Object.entries(PERSISTED_FIELDS).map(([key, definition]) => [key, definition.defaultValue]),
    ),
  );
  const SIZE_LABELS = new Map([
    [56, '小'],
    [72, '標準'],
    [88, '大'],
    [104, '特大'],
  ]);

  function booleanValue(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
  }

  function getPetSizeMode(size, mobile = matchMedia('(max-width: 650px)').matches) {
    const breakpoints = mobile
      ? SIZE_MODE_BREAKPOINTS.mobile
      : SIZE_MODE_BREAKPOINTS.desktop;
    if (size <= breakpoints.normalMax) return 'normal';
    if (size <= breakpoints.largeMax) return 'large';
    return 'showcase';
  }

  function normalize(input = {}, fallback = DEFAULTS) {
    const size = Number(input.pet_companion_size);
    const activity = String(input.pet_activity_level ?? '');
    const species = String(input.pet_companion_species ?? '');
    return {
      pet_companion_enabled: booleanValue(
        input.pet_companion_enabled,
        fallback.pet_companion_enabled,
      ),
      pet_companion_species: PET_SPECIES.includes(species)
        ? species
        : fallback.pet_companion_species,
      pet_companion_size: Number.isFinite(size)
        ? Math.max(48, Math.min(1200, Math.round(size)))
        : fallback.pet_companion_size,
      pet_activity_level: ACTIVITY_LEVELS.includes(activity)
        ? activity
        : fallback.pet_activity_level,
      pet_idle_sleep_enabled: booleanValue(
        input.pet_idle_sleep_enabled,
        fallback.pet_idle_sleep_enabled,
      ),
      pet_reduce_activity_in_log: booleanValue(
        input.pet_reduce_activity_in_log,
        fallback.pet_reduce_activity_in_log,
      ),
      show_pet_in_profile: booleanValue(
        input.show_pet_in_profile,
        fallback.show_pet_in_profile,
      ),
      show_pet_in_ranking: booleanValue(
        input.show_pet_in_ranking,
        fallback.show_pet_in_ranking,
      ),
    };
  }

  function loadLocal() {
    try {
      return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
    } catch {
      return { ...DEFAULTS };
    }
  }

  let state = loadLocal();

  function apiToState(preferences = {}) {
    return Object.fromEntries(
      Object.entries(PERSISTED_FIELDS)
        .filter(([, definition]) => Object.hasOwn(preferences, definition.api))
        .map(([key, definition]) => [key, preferences[definition.api]]),
    );
  }

  function toApi(settings = state) {
    return Object.fromEntries(
      Object.entries(PERSISTED_FIELDS).map(([key, definition]) => [definition.api, settings[key]]),
    );
  }

  function sizeText(size) {
    const label = SIZE_LABELS.get(size);
    return `${label ? `${label} ` : ''}${size}px`;
  }

  function syncControls() {
    const controls = {
      enabled: document.querySelector('#petCompanionToggle'),
      species: document.querySelector('#petCompanionSpecies'),
      size: document.querySelector('#petCompanionSize'),
      sizeValue: document.querySelector('#petCompanionSizeValue'),
      activity: document.querySelector('#petActivityLevel'),
      sleep: document.querySelector('#petIdleSleepToggle'),
      reduceInLog: document.querySelector('#petReduceActivityInLog'),
    };
    if (controls.enabled) controls.enabled.checked = state.pet_companion_enabled;
    if (controls.species) controls.species.value = state.pet_companion_species;
    if (controls.size) controls.size.value = String(state.pet_companion_size);
    if (controls.sizeValue) controls.sizeValue.textContent = sizeText(state.pet_companion_size);
    const showcaseNote = document.querySelector('#petShowcaseSizeNote');
    if (showcaseNote) showcaseNote.hidden = state.pet_companion_size <= SIZE_MODE_BREAKPOINTS.desktop.largeMax;
    if (controls.activity) controls.activity.value = state.pet_activity_level;
    if (controls.sleep) controls.sleep.checked = state.pet_idle_sleep_enabled;
    if (controls.reduceInLog) controls.reduceInLog.checked = state.pet_reduce_activity_in_log;
  }

  function apply(source = 'local') {
    document.documentElement.style.setProperty('--pet-size', `${state.pet_companion_size}px`);
    syncControls();
    dispatchEvent(
      new CustomEvent(CHANGE_EVENT, {
        detail: { source, settings: { ...state }, api: toApi() },
      }),
    );
  }

  function saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }

  function update(patch, source = 'user') {
    state = normalize({ ...state, ...patch }, state);
    saveLocal();
    apply(source);
    return { ...state };
  }

  function hydrateFromApi(preferences) {
    return update(apiToState(preferences), 'account');
  }

  function bindControls() {
    const enabled = document.querySelector('#petCompanionToggle');
    const species = document.querySelector('#petCompanionSpecies');
    const size = document.querySelector('#petCompanionSize');
    const activity = document.querySelector('#petActivityLevel');
    const sleep = document.querySelector('#petIdleSleepToggle');
    const reduceInLog = document.querySelector('#petReduceActivityInLog');
    if (enabled)
      enabled.addEventListener('change', (event) =>
        update({ pet_companion_enabled: event.target.checked }),
      );
    if (species)
      species.addEventListener('change', (event) =>
        update({ pet_companion_species: event.target.value }),
      );
    if (size)
      size.addEventListener('input', (event) =>
        update({ pet_companion_size: Number(event.target.value) }),
      );
    if (activity)
      activity.addEventListener('change', (event) =>
        update({ pet_activity_level: event.target.value }),
      );
    if (sleep)
      sleep.addEventListener('change', (event) =>
        update({ pet_idle_sleep_enabled: event.target.checked }),
      );
    if (reduceInLog)
      reduceInLog.addEventListener('change', (event) =>
        update({ pet_reduce_activity_in_log: event.target.checked }),
      );
  }

  window.PetCompanionSettings = Object.freeze({
    storageKey: STORAGE_KEY,
    changeEvent: CHANGE_EVENT,
    fields: PERSISTED_FIELDS,
    defaults: DEFAULTS,
    activityLevels: ACTIVITY_LEVELS,
    petSpecies: PET_SPECIES,
    sizeModeBreakpoints: SIZE_MODE_BREAKPOINTS,
    getPetSizeMode,
    read: () => ({ ...state }),
    update,
    hydrateFromApi,
    toApi,
    syncControls,
  });
  bindControls();
  apply('initial');
})();
