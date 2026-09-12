(() => {
  const layer = document.querySelector('#petCompanion');
  const game = document.querySelector('#game');
  const pet = layer?.querySelector('.pet-companion');
  const stateLabel = layer?.querySelector('.pet-state');
  const message = layer?.querySelector('.pet-reaction-message');
  if (!layer || !game || !pet || !stateLabel || !message) return;

  const MOTION = Object.freeze({
    idleDistance: 80,
    runDistance: 300,
    pantDistance: 600,
    walkSpeed: 180,
    runSpeed: 430,
    pantDuration: 1500,
    restAfter: 30_000,
    sleepAfter: 90_000,
  });
  const interactiveSelector = [
    'button',
    'input',
    'select',
    'textarea',
    'a[href]',
    '[role="tab"]',
    '.equip-slot',
    '.inventory-item',
  ].join(',');
  const state = {
    x: -90,
    y: Math.max(8, innerHeight - 110),
    targetX: 8,
    targetY: 8,
    animation: 'idle',
    facing: 'right',
    currentAnchor: null,
  };
  let frame = 0;
  let lastFrame = 0;
  let pantOnArrival = false;
  let lastActivityAt = Date.now();
  let lastScrollInputAt = 0;
  let fastScrollUntil = 0;
  let lastScroll = { source: window, position: scrollY, at: performance.now() };
  let combatLogUntil = 0;
  let resting = false;
  let reactionTimer = 0;
  let messageTimer = 0;

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
  }

  function isVisible(rect) {
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < innerHeight &&
      rect.left < innerWidth
    );
  }

  function movementForDistance(distance, fastScroll) {
    if (fastScroll || distance > MOTION.runDistance) return 'run';
    if (distance >= MOTION.idleDistance) return 'walk';
    return 'idle';
  }

  function setAnimation(animation) {
    if (state.animation === animation) return;
    state.animation = animation;
    pet.dataset.animation = animation;
    stateLabel.textContent =
      animation === 'sleep'
        ? 'Zzz'
        : animation === 'pant'
          ? '呼…'
          : animation === 'happy'
            ? '♪'
            : '';
  }

  function renderPosition() {
    const depth = clamp((state.y + pet.offsetHeight) / innerHeight, 0, 1);
    const scale = 0.88 + depth * 0.18;
    pet.style.transform = `translate3d(${state.x}px,${state.y}px,0) scale(${scale})`;
    pet.dataset.facing = state.facing;
    pet.dataset.anchor = state.currentAnchor ?? '';
  }

  function stopMovement() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
  }

  function finishMovement() {
    stopMovement();
    if (!pantOnArrival) {
      setAnimation('idle');
      return;
    }
    pantOnArrival = false;
    setAnimation('pant');
    clearTimeout(reactionTimer);
    reactionTimer = setTimeout(() => setAnimation('idle'), MOTION.pantDuration);
  }

  function animate(now) {
    const dx = state.targetX - state.x;
    const dy = state.targetY - state.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1.5) {
      state.x = state.targetX;
      state.y = state.targetY;
      renderPosition();
      finishMovement();
      return;
    }
    const elapsed = lastFrame ? Math.min(32, now - lastFrame) : 16;
    lastFrame = now;
    const speed =
      state.animation === 'run' ? MOTION.runSpeed : MOTION.walkSpeed;
    const step = Math.min(distance, (speed * elapsed) / 1000);
    state.x += (dx / distance) * step;
    state.y += (dy / distance) * step;
    if (Math.abs(dx) > 1) state.facing = dx < 0 ? 'left' : 'right';
    renderPosition();
    frame = requestAnimationFrame(animate);
  }

  function overlapArea(left, right) {
    const width = Math.max(
      0,
      Math.min(left.right, right.right) - Math.max(left.left, right.left),
    );
    const height = Math.max(
      0,
      Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top),
    );
    return width * height;
  }

  function anchorCandidates(rect, mobile, anchorName, width, height) {
    const bottomLimit = innerHeight - height - (mobile ? 98 : 8);
    const normalize = ({ x, y }) => ({
      x: clamp(x, 8, innerWidth - width - 8),
      y: clamp(y, 8, bottomLimit),
    });
    if (mobile) {
      const nearLeft = rect.left + rect.width / 2 < innerWidth / 2;
      const preferredY = clamp(rect.bottom + 7, 8, bottomLimit);
      const scanRows = [];
      for (let y = 8; y <= bottomLimit; y += 36) scanRows.push(y);
      scanRows.push(bottomLimit);
      scanRows.sort(
        (left, right) =>
          Math.abs(left - preferredY) - Math.abs(right - preferredY),
      );
      return [
        normalize({
          x: nearLeft ? 8 : innerWidth - width - 8,
          y: preferredY,
        }),
        normalize({
          x: nearLeft ? 8 : innerWidth - width - 8,
          y: rect.top - height - 7,
        }),
        ...scanRows.flatMap((y) => [
          normalize({ x: nearLeft ? 8 : innerWidth - width - 8, y }),
          normalize({ x: nearLeft ? innerWidth - width - 8 : 8, y }),
        ]),
      ];
    }
    const candidates = [
      normalize({ x: rect.right + 10, y: rect.bottom - height }),
      normalize({ x: rect.left - width - 10, y: rect.bottom - height }),
      normalize({ x: rect.right - width, y: rect.bottom + 8 }),
      normalize({ x: rect.left, y: rect.bottom + 8 }),
      normalize({ x: rect.right - width - 8, y: rect.bottom - height - 8 }),
    ];
    let hash = 0;
    for (let index = 0; index < anchorName.length; index += 1)
      hash += anchorName.charCodeAt(index);
    const rotation = hash % candidates.length;
    return [...candidates.slice(rotation), ...candidates.slice(0, rotation)];
  }

  function safeTarget(anchor) {
    const rect = anchor.getBoundingClientRect();
    const mobile = matchMedia('(max-width: 650px)').matches;
    const width = pet.offsetWidth || (mobile ? 66 : 78);
    const height = pet.offsetHeight || (mobile ? 72 : 82);
    const controls = [...document.querySelectorAll(interactiveSelector)]
      .filter((element) => !element.closest('#petCompanion'))
      .map((element) => element.getBoundingClientRect())
      .filter(isVisible);
    const candidates = anchorCandidates(
      rect,
      mobile,
      anchor.dataset.petAnchor ?? '',
      width,
      height,
    );
    return candidates
      .map((point, index) => {
        const petRect = new DOMRect(point.x, point.y, width, height);
        return {
          point,
          index,
          overlap: controls.reduce(
            (total, control) => total + overlapArea(petRect, control),
            0,
          ),
        };
      })
      .sort(
        (left, right) =>
          left.overlap - right.overlap || left.index - right.index,
      )[0].point;
  }

  function fallbackAnchor() {
    const viewportCenter = innerHeight / 2;
    return [...document.querySelectorAll('[data-pet-anchor]')]
      .filter((element) => isVisible(element.getBoundingClientRect()))
      .sort((left, right) => {
        const leftRect = left.getBoundingClientRect();
        const rightRect = right.getBoundingClientRect();
        return (
          Math.abs(leftRect.top + leftRect.height / 2 - viewportCenter) -
          Math.abs(rightRect.top + rightRect.height / 2 - viewportCenter)
        );
      })[0];
  }

  function activeAnchor() {
    const combatLog = document.querySelector('[data-pet-anchor="combat-log"]');
    if (
      combatLog &&
      Date.now() < combatLogUntil &&
      isVisible(combatLog.getBoundingClientRect())
    )
      return combatLog;
    const panel = document.querySelector('.panel.active[data-pet-anchor]');
    if (panel && isVisible(panel.getBoundingClientRect())) return panel;
    return fallbackAnchor();
  }

  function follow(fastScroll = false) {
    if (game.classList.contains('hidden')) return;
    const anchor = activeAnchor();
    if (!anchor) return;
    const target = safeTarget(anchor);
    let distance = Math.hypot(target.x - state.x, target.y - state.y);
    if (fastScroll && distance < MOTION.runDistance) {
      state.x = target.x < innerWidth / 2 ? -pet.offsetWidth : innerWidth + 4;
      state.y = target.y;
      distance = Math.hypot(target.x - state.x, target.y - state.y);
      renderPosition();
    }
    state.targetX = target.x;
    state.targetY = target.y;
    state.currentAnchor = anchor.dataset.petAnchor ?? null;
    pantOnArrival = fastScroll || distance > MOTION.pantDistance;
    resting = false;
    pet.dataset.resting = 'false';
    clearTimeout(reactionTimer);
    stopMovement();
    const motion = movementForDistance(distance, fastScroll);
    if (
      matchMedia('(prefers-reduced-motion: reduce)').matches ||
      motion === 'idle'
    ) {
      state.x = target.x;
      state.y = target.y;
      pantOnArrival = false;
      setAnimation('idle');
      renderPosition();
      return;
    }
    setAnimation(motion);
    frame = requestAnimationFrame(animate);
  }

  function wake() {
    if (state.animation !== 'sleep' && !resting) return;
    resting = false;
    pet.dataset.resting = 'false';
    setAnimation('happy');
    clearTimeout(reactionTimer);
    reactionTimer = setTimeout(() => follow(false), 700);
  }

  function noteActivity() {
    lastActivityAt = Date.now();
    wake();
  }

  function updateInactivity() {
    const inactiveFor = Date.now() - lastActivityAt;
    if (inactiveFor >= MOTION.sleepAfter) {
      stopMovement();
      setAnimation('sleep');
      return;
    }
    if (inactiveFor >= MOTION.restAfter && state.animation === 'idle') {
      resting = true;
      pet.dataset.resting = 'true';
    }
  }

  function onScroll(event) {
    const userInitiated =
      Date.now() - lastScrollInputAt < 800 || event.target === document;
    if (!userInitiated) return;
    noteActivity();
    const now = performance.now();
    const source = event.target instanceof Element ? event.target : window;
    const position = source === window ? scrollY : source.scrollTop;
    const distance =
      lastScroll.source === source
        ? Math.abs(position - lastScroll.position)
        : Math.abs(position);
    const elapsed = Math.max(1, now - lastScroll.at);
    const fast =
      distance > 180 ||
      distance / elapsed > 1.2 ||
      Date.now() < fastScrollUntil;
    lastScroll = { source, position, at: now };
    follow(fast);
  }

  function onScrollIntent(event) {
    lastScrollInputAt = Date.now();
    noteActivity();
    const fastIntent = Math.abs(event.deltaY ?? 0) > 600;
    if (fastIntent) fastScrollUntil = Date.now() + 600;
    if (event.target.closest?.('[data-pet-anchor="combat-log"]')) {
      combatLogUntil = Date.now() + 8000;
      follow(fastIntent);
    } else if (fastIntent) {
      follow(true);
    }
  }

  pet.addEventListener('click', () => {
    noteActivity();
    stopMovement();
    clearTimeout(reactionTimer);
    clearTimeout(messageTimer);
    message.hidden = false;
    message.textContent = '妙蛙種子看起來很開心。';
    setAnimation('happy');
    reactionTimer = setTimeout(() => follow(false), 1000);
    messageTimer = setTimeout(() => {
      message.hidden = true;
      message.textContent = '';
    }, 2600);
  });

  document.addEventListener('click', (event) => {
    const tab = event.target.closest?.('[data-tab]');
    if (!tab) return;
    noteActivity();
    requestAnimationFrame(() => follow(false));
  });
  ['pointerdown', 'pointermove', 'keydown', 'touchstart'].forEach((name) =>
    addEventListener(name, noteActivity, { passive: true }),
  );
  addEventListener('wheel', onScrollIntent, { passive: true, capture: true });
  addEventListener('touchmove', onScrollIntent, {
    passive: true,
    capture: true,
  });
  addEventListener('scroll', onScroll, { passive: true, capture: true });
  addEventListener('resize', () => follow(false));

  const resizeObserver = new ResizeObserver(() => follow(false));
  document
    .querySelectorAll('[data-pet-anchor]')
    .forEach((anchor) => resizeObserver.observe(anchor));
  const activePanelObserver = new MutationObserver(() =>
    requestAnimationFrame(() => follow(false)),
  );
  activePanelObserver.observe(game, {
    attributes: true,
    attributeFilter: ['class'],
    subtree: true,
  });

  setInterval(updateInactivity, 1000);
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    window.__petCompanionTest = Object.freeze({
      setInactiveFor(milliseconds) {
        lastActivityAt = Date.now() - Math.max(0, Number(milliseconds) || 0);
        updateInactivity();
      },
      readState() {
        return { ...state, resting };
      },
    });
  }
  requestAnimationFrame(() => follow(false));
})();
