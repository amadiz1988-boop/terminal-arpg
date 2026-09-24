(() => {
  'use strict';

  const DEFAULT_DIALOG_AUTO_DELAY_MS = 2400;
  const inputStageTypes = new Set(['QUIZ', 'CHOICE', 'ROUTE_EVENT']);
  const stageTypeLabels = Object.freeze({
    NAVIGATION: '路線移動',
    DIALOG: 'NPC 對話',
    CHOICE: '玩家選擇',
    QUIZ: '知識測驗',
    TRIAL: '任務試煉',
    ROUTE_EVENT: '路線事件',
    DEATH: '死亡復原',
    SUPPLY: '任務補給',
    RESULT: '任務結果',
  });
  const controllerByRoot = new WeakMap();

  const text = (value) => String(value ?? '').trim();
  const dialogLineList = (value, fallbackDelay) =>
    Array.isArray(value)
      ? value
          .map((line, index) => {
            const source = typeof line === 'string' ? { text: line } : line;
            const lineText = text(source?.text);
            if (!lineText) return null;
            return Object.freeze({
              id: text(source?.id || `line-${index + 1}`),
              text: lineText,
              speaker: text(source?.speaker) || null,
              pacingMs: Math.max(
                1000,
                Math.min(8000, Number(source?.pacingMs) || fallbackDelay),
              ),
            });
          })
          .filter(Boolean)
      : [];

  function normalizeMissionInteractionStage(input = {}) {
    const type = text(input.type || 'DIALOG').toUpperCase();
    const bodyText = text(input.bodyText);
    const dialogAutoDelayMs = Math.max(
      1000,
      Math.min(
        8000,
        Number(input.dialogAutoDelayMs) || DEFAULT_DIALOG_AUTO_DELAY_MS,
      ),
    );
    const dialogLines = dialogLineList(input.dialogLines, dialogAutoDelayMs);
    if (!dialogLines.length && bodyText) {
      dialogLines.push(
        Object.freeze({
          id: 'body-text',
          text: bodyText,
          speaker: text(input.npcName) || null,
          pacingMs: dialogAutoDelayMs,
        }),
      );
    }
    const options = Array.isArray(input.options)
      ? input.options.map((option) =>
          typeof option === 'string'
            ? Object.freeze({ id: option, label: option })
            : Object.freeze({
                id: text(option?.id || option?.value || option?.label),
                label: text(option?.label || option?.text || option?.id),
              }),
        )
      : [];
    const actions = Array.isArray(input.actions)
      ? input.actions.map((action) =>
          typeof action === 'string'
            ? Object.freeze({ id: action, label: action })
            : Object.freeze({
                id: text(action?.id || action?.label),
                label: text(action?.label || action?.id),
              }),
        )
      : [];
    const requiresPlayerInput =
      input.requiresPlayerInput === true ||
      inputStageTypes.has(type) ||
      input.status === 'INPUT_REQUIRED';
    const totalSteps =
      input.totalSteps != null && Number.isSafeInteger(Number(input.totalSteps))
      ? Math.max(0, Number(input.totalSteps))
      : null;
    const currentStepNumber =
      input.currentStepNumber != null &&
      Number.isSafeInteger(Number(input.currentStepNumber))
      ? Math.max(0, Number(input.currentStepNumber))
      : null;
    return Object.freeze({
      title: text(input.title || stageTypeLabels[type] || '任務互動'),
      npcName: text(input.npcName) || null,
      npcVisual: input.npcVisual ?? null,
      npcVisualKey: text(input.npcVisualKey) || null,
      bodyText,
      dialogLines: Object.freeze(dialogLines),
      options: Object.freeze(options),
      actions: Object.freeze(actions),
      autoAdvanceAllowed:
        input.autoAdvanceAllowed === true &&
        type === 'DIALOG' &&
        !requiresPlayerInput,
      requiresPlayerInput,
      currentStep: text(input.currentStep) || null,
      currentStepNumber,
      totalSteps,
      status: text(input.status || 'READY'),
      type,
      key: text(input.interactionId || input.key) || null,
      interactionId: text(input.interactionId || input.key) || null,
      revision: Number.isSafeInteger(Number(input.revision))
        ? Number(input.revision)
        : 0,
      generation: Number.isSafeInteger(Number(input.generation))
        ? Number(input.generation)
        : 0,
      questSessionId:
        text(input.questSessionId || input.authorityIdentity?.questSessionId) || null,
      currentLine: Number.isSafeInteger(Number(input.currentLine))
        ? Math.max(
            0,
            Math.min(Number(input.currentLine), Math.max(0, dialogLines.length - 1)),
          )
        : 0,
      dialogAutoDelayMs,
    });
  }

  function cancelTimer(state) {
    if (state?.timer) clearTimeout(state.timer);
    if (state) state.timer = null;
  }

  function scheduleDialog(root, state) {
    cancelTimer(state);
    if (
      !state.model.autoAdvanceAllowed ||
      !state.autoEnabled ||
      state.lineIndex >= state.model.dialogLines.length - 1
    )
      return;
    state.timer = setTimeout(() => {
      state.lineIndex += 1;
      if (state.description)
        state.description.textContent =
          state.model.dialogLines[state.lineIndex].text;
      root.dataset.dialogLine = String(state.lineIndex + 1);
      root.dataset.dialogLineId = state.model.dialogLines[state.lineIndex].id;
      if (state.progress)
        state.progress.textContent = `${state.lineIndex + 1} / ${state.model.dialogLines.length}`;
      scheduleDialog(root, state);
    }, state.model.dialogLines[state.lineIndex]?.pacingMs ?? state.model.dialogAutoDelayMs);
  }

  function npcVisual(model) {
    const figure = document.createElement('figure');
    figure.className = 'mission-npc-visual';
    const visual = document.createElement('div');
    visual.className = 'mission-npc-placeholder';
    visual.setAttribute('aria-hidden', 'true');
    const resolved = window.NpcVisualManifest?.resolve?.(model.npcVisualKey);
    const source = model.npcVisual?.src
      ? { ...resolved, ...model.npcVisual, status: 'available' }
      : resolved;
    figure.dataset.visualKey = model.npcVisualKey || '';
    if (source?.src) {
      const image = document.createElement('img');
      image.src = source.src;
      image.alt = '';
      image.addEventListener('load', () => {
        figure.dataset.visualSource = 'asset';
        figure.dataset.visualStatus = 'loaded';
      });
      image.addEventListener('error', () => {
        image.remove();
        visual.textContent = 'NPC';
        figure.dataset.visualSource = 'fallback';
        figure.dataset.visualStatus = 'missing';
      });
      visual.append(image);
      figure.dataset.visualSource = 'asset';
      figure.dataset.visualStatus = 'loading';
    } else {
      visual.textContent = 'NPC';
      figure.dataset.visualSource = 'fallback';
      figure.dataset.visualStatus = 'missing';
    }
    const caption = document.createElement('figcaption');
    caption.textContent = model.npcName || '任務導引';
    figure.append(visual, caption);
    return figure;
  }

  function decorateMissionInteractionStage(root, input) {
    if (!(root instanceof HTMLElement))
      throw new TypeError('Mission Interaction Stage root is required');
    const model = normalizeMissionInteractionStage(input);
    const previous = controllerByRoot.get(root);
    if (isStaleInteraction(root, model)) return previous.model;
    cancelTimer(previous);
    const sameStage = Boolean(previous && previous.key === model.key);
    const state = {
      key: model.key,
      model,
      lineIndex: sameStage
        ? Math.min(previous.lineIndex, Math.max(0, model.dialogLines.length - 1))
        : model.currentLine,
      autoEnabled: sameStage ? previous.autoEnabled : true,
      description: null,
      progress: null,
      timer: null,
    };

    const originalNodes = [...root.childNodes];
    const existingDescription = root.querySelector(':scope > p');
    const header = document.createElement('header');
    header.className = 'mission-interaction-header';
    const typeLabel = document.createElement('strong');
    typeLabel.textContent = stageTypeLabels[model.type] || model.type;
    const progress = document.createElement('small');
    progress.textContent =
      model.currentStepNumber && model.totalSteps
        ? `步驟 ${model.currentStepNumber} / ${model.totalSteps}`
        : model.status;
    header.append(typeLabel, progress);

    const layout = document.createElement('div');
    layout.className = 'mission-interaction-layout';
    const content = document.createElement('div');
    content.className = 'mission-interaction-content';
    content.append(...originalNodes);
    layout.append(npcVisual(model), content);

    let description = existingDescription;
    if (!description) {
      description = document.createElement('p');
      description.textContent = model.bodyText;
      content.prepend(description);
    }
    state.description = description;
    if (model.dialogLines.length)
      description.textContent = model.dialogLines[state.lineIndex].text;

    if (model.autoAdvanceAllowed && model.dialogLines.length > 1) {
      const playback = document.createElement('div');
      playback.className = 'mission-dialog-playback';
      const lineProgress = document.createElement('small');
      lineProgress.className = 'mission-dialog-line-progress';
      lineProgress.setAttribute('aria-live', 'polite');
      lineProgress.textContent = `${state.lineIndex + 1} / ${model.dialogLines.length}`;
      state.progress = lineProgress;
      const autoLabel = document.createElement('label');
      const auto = document.createElement('input');
      auto.type = 'checkbox';
      auto.checked = state.autoEnabled;
      auto.setAttribute('aria-label', '自動播放對話');
      auto.addEventListener('change', () => {
        state.autoEnabled = auto.checked;
        scheduleDialog(root, state);
      });
      autoLabel.append(auto, document.createTextNode('自動播放'));
      const skip = document.createElement('button');
      skip.type = 'button';
      skip.textContent = '跳過';
      skip.addEventListener('click', () => {
        cancelTimer(state);
        state.lineIndex = model.dialogLines.length - 1;
        description.textContent = model.dialogLines[state.lineIndex].text;
        root.dataset.dialogLine = String(state.lineIndex + 1);
        root.dataset.dialogLineId = model.dialogLines[state.lineIndex].id;
        lineProgress.textContent = `${state.lineIndex + 1} / ${model.dialogLines.length}`;
      });
      playback.append(lineProgress, autoLabel, skip);
      content.append(playback);
    }

    root.replaceChildren(header, layout);
    root.classList.add('mission-interaction-stage');
    root.dataset.stageType = model.type;
    root.dataset.stageStatus = model.status;
    root.dataset.requiresPlayerInput = String(model.requiresPlayerInput);
    root.dataset.autoAdvance = String(model.autoAdvanceAllowed);
    root.dataset.authority = 'server';
    root.dataset.interactionId = model.interactionId || '';
    root.dataset.interactionRevision = String(model.revision);
    root.dataset.interactionGeneration = String(model.generation);
    root.dataset.staleInteraction = 'false';
    root.dataset.currentStep = model.currentStep || '';
    root.dataset.totalSteps = model.totalSteps == null ? '' : String(model.totalSteps);
    root.dataset.dialogAutoDelayMs = String(model.dialogAutoDelayMs);
    root.dataset.dialogLine = String(state.lineIndex + 1);
    root.dataset.dialogLineId = model.dialogLines[state.lineIndex]?.id || '';
    root.classList.toggle(
      'is-compact',
      !model.requiresPlayerInput && model.actions.length === 0,
    );
    controllerByRoot.set(root, state);
    scheduleDialog(root, state);
    return model;
  }

  function isStaleInteraction(root, input) {
    if (!(root instanceof HTMLElement)) return false;
    const model = input?.dialogLines
      ? normalizeMissionInteractionStage(input)
      : input;
    const previous = controllerByRoot.get(root);
    if (!previous) return false;
    const sameSession =
      !previous.model.questSessionId ||
      !model.questSessionId ||
      previous.model.questSessionId === model.questSessionId;
    const stale =
      sameSession &&
      (model.revision < previous.model.revision ||
        (model.revision === previous.model.revision &&
          model.generation < previous.model.generation));
    if (stale) root.dataset.staleInteraction = 'rejected';
    return stale;
  }

  function renderPrototype(root, input = {}) {
    const model = normalizeMissionInteractionStage(input);
    if (isStaleInteraction(root, model)) return model;
    const heading = document.createElement('h3');
    heading.textContent = model.title;
    const description = document.createElement('p');
    description.textContent = model.bodyText;
    const controls = document.createElement('div');
    controls.className = 'assassin-stage-controls';
    for (const action of model.actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'assassin-action';
      button.textContent = action.label;
      button.addEventListener('click', () => input.onAction?.(action.id));
      controls.append(button);
    }
    root.replaceChildren(heading, description, controls);
    return decorateMissionInteractionStage(root, model);
  }

  window.MissionInteractionStage = Object.freeze({
    DEFAULT_DIALOG_AUTO_DELAY_MS,
    normalize: normalizeMissionInteractionStage,
    isStale: isStaleInteraction,
    decorate: decorateMissionInteractionStage,
    renderPrototype,
  });
})();
