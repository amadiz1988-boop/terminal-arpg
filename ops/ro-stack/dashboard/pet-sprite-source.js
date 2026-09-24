(() => {
  const localDebug = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const storageKey = 'debug.pet.rendererSource';
  const changeEvent = 'pet-sprite-source-change';
  const defaultSource = 'grok-v1';
  const species = Object.freeze({
    bulbasaur: Object.freeze({
      id: 'bulbasaur',
      displayName: '妙蛙種子',
      symbol: '🌱',
      includesShadow: false,
      animations: Object.freeze({
        idle: '/assets/pets/bulbasaur/idle.webp',
        walk: '/assets/pets/bulbasaur/walk.webp',
        happy: '/assets/pets/bulbasaur/happy.webp',
      }),
    }),
    terasoid: Object.freeze({
      id: 'terasoid',
      displayName: '帖拉所伊朵',
      symbol: '⚙️',
      includesShadow: true,
      animations: Object.freeze({
        idle: '/assets/pets/terasoid/idle.webp',
        walk: '/assets/pets/terasoid/walk.webp',
        run: '/assets/pets/terasoid/walk.webp',
        pant: '/assets/pets/terasoid/idle.webp',
        sleep: '/assets/pets/terasoid/idle.webp',
        happy: '/assets/pets/terasoid/happy.webp',
      }),
      animationMeta: Object.freeze({
        walk: [6, 1000, 'loop'],
        run: [6, 600, 'loop'],
      }),
    }),
    baphomet: Object.freeze({
      id: 'baphomet', displayName: '巴風特', symbol: '🐐', includesShadow: false,
      rendererSource: 'ro-official',
      animations: Object.freeze(Object.fromEntries(['idle', 'walk', 'happy', 'run', 'pant', 'sleep'].map((animation) => [animation, `/assets/pets/baphomet/${animation}.webp`]))),
      animationMeta: Object.freeze({ idle: [8, 800, 'loop'], walk: [8, 800, 'loop'], happy: [8, 800, 'once'], run: [8, 496, 'loop'], pant: [6, 600, 'once'], sleep: [5, 500, 'hold'] }),
    }),
    angeling: Object.freeze({
      id: 'angeling', displayName: '天使波利', symbol: '😇', includesShadow: false,
      rendererSource: 'ro-official',
      animations: Object.freeze(Object.fromEntries(['idle', 'walk', 'happy', 'run', 'pant', 'sleep'].map((animation) => [animation, `/assets/pets/angeling/${animation}.webp`]))),
      animationMeta: Object.freeze({ idle: [4, 400, 'loop'], walk: [22, 550, 'loop'], happy: [28, 700, 'once'], run: [22, 341, 'loop'], pant: [14, 700, 'once'], sleep: [17, 425, 'hold'] }),
    }),
    moonlight: Object.freeze({
      id: 'moonlight', displayName: '月夜貓', symbol: '🐈', includesShadow: false,
      rendererSource: 'ro-official',
      animations: Object.freeze(Object.fromEntries(['idle', 'walk', 'happy', 'run', 'pant', 'sleep'].map((animation) => [animation, `/assets/pets/moonlight/${animation}.webp`]))),
      animationMeta: Object.freeze({ idle: [6, 450, 'loop'], walk: [11, 550, 'loop'], happy: [12, 300, 'once'], run: [11, 341, 'loop'], pant: [4, 200, 'once'], sleep: [16, 1008, 'hold'] }),
    }),
    tamadora: Object.freeze({
      id: 'tamadora', displayName: 'たまドラ', symbol: '🥚', includesShadow: false,
      category: 'JRO × Puzzle & Dragons', rendererSource: 'ro-official',
      animations: Object.freeze({
        idle: '/assets/pets/tamadora-idle.webp',
        walk: '/assets/pets/tamadora-walk.webp',
        run: '/assets/pets/tamadora-walk.webp',
        happy: '/assets/pets/tamadora-happy.webp',
        pant: '/assets/pets/tamadora-idle.webp',
        sleep: '/assets/pets/tamadora-idle.webp',
      }),
      animationMeta: Object.freeze({
        idle: [6, 1200, 'loop'], walk: [6, 1200, 'loop'],
        run: [6, 744, 'loop'], happy: [8, 1600, 'once'],
        pant: [6, 1200, 'once'], sleep: [6, 1200, 'hold'],
      }),
    }),
  });
  const sources = Object.freeze({
    'local-v1': Object.freeze({}),
    'grok-preview': Object.freeze({
      bulbasaur: Object.freeze({
        idle: '/assets/pets/bulbasaur/idle.grok-preview.webp',
      }),
    }),
    'grok-v1': Object.freeze({
      bulbasaur: Object.freeze({
        idle: '/assets/pets/bulbasaur/grok-v1/idle.webp',
        walk: '/assets/pets/bulbasaur/grok-v1/walk.webp',
        happy: '/assets/pets/bulbasaur/grok-v1/happy.webp',
        run: '/assets/pets/bulbasaur/grok-v1/run.webp',
        pant: '/assets/pets/bulbasaur/grok-v1/pant.webp',
        sleep: '/assets/pets/bulbasaur/grok-v1/sleep.webp',
      }),
    }),
  });
  const requested = localDebug
    ? new URLSearchParams(location.search).get('petRendererSource')
    : null;
  let current = localDebug && Object.hasOwn(sources, requested)
    ? requested
    : localDebug
      ? (sessionStorage.getItem(storageKey) ?? defaultSource)
      : defaultSource;
  if (!Object.hasOwn(sources, current)) current = defaultSource;

  function describe(speciesId) {
    return species[speciesId] ?? species.bulbasaur;
  }

  window.PetSpriteSource = Object.freeze({
    availableSources: Object.keys(sources),
    availableSpecies: Object.keys(species),
    changeEvent,
    read: () => current,
    describe,
    sourceFor(animation, speciesId = 'bulbasaur') {
      const selected = describe(speciesId);
      return sources[current][selected.id]?.[animation]
        ? current
        : (selected.rendererSource ?? 'local-v1');
    },
    animationMeta(animation, speciesId = 'bulbasaur') {
      const values = describe(speciesId).animationMeta?.[animation];
      return values
        ? { columns: values[0], durationMs: values[1], playback: values[2] }
        : null;
    },
    resolve(animation, speciesId = 'bulbasaur') {
      const selected = describe(speciesId);
      return sources[current][selected.id]?.[animation] ?? selected.animations[animation] ?? null;
    },
    set(source) {
      if (!localDebug) throw new Error('Pet renderer debug source is available locally only');
      if (!Object.hasOwn(sources, source)) throw new Error(`Unknown pet renderer source: ${source}`);
      current = source;
      sessionStorage.setItem(storageKey, source);
      dispatchEvent(new CustomEvent(changeEvent, { detail: { source } }));
      return current;
    },
  });
})();
