(function installRoOriginalUiKit(global) {
  'use strict';

  const sourceState = Object.freeze({
    RoWindow: 'SOURCE_VERIFIED',
    RoTitleBar: 'PROVENANCE_PENDING',
    RoButton: 'PROVENANCE_PENDING',
    RoIconButton: 'SOURCE_VERIFIED',
    RoTab: 'IMPLEMENTED',
    RoScrollbar: 'SOURCE_VERIFIED',
    RoInput: 'PROVENANCE_PENDING',
    RoSelect: 'PROVENANCE_PENDING',
    RoCheckbox: 'IMPLEMENTED',
    RoTooltip: 'PROVENANCE_PENDING',
    RoItemSlot: 'PROVENANCE_PENDING',
    RoSkillSlot: 'PROVENANCE_PENDING',
    RoEquipmentSlot: 'IMPLEMENTED',
  });
  const semanticSounds = Object.freeze({
    'ui.button.confirm': '/ro/client/sfx/official/ui_confirm.wav',
    'ui.button.cancel': '/ro/client/sfx/official/ui_cancel.wav',
    'ui.tab.change': '/ro/client/sfx/official/ui_tab.wav',
    'ui.window.open': '/ro/client/sfx/official/ui_open.wav',
    'ui.window.close': '/ro/client/sfx/official/ui_close.wav',
    'ui.status.increase': null,
  });

  function classNameFor(name) {
    return `ro-${name.slice(2).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^-/, '')}`;
  }
  function enhance(element, name) {
    if (!(element instanceof Element) || !(name in sourceState)) return element;
    element.dataset.roPrimitive = name;
    element.dataset.roSourceState = sourceState[name];
    element.classList.add('ro-ui-primitive', classNameFor(name));
    return element;
  }
  function createPrimitive(name, defaultTag) {
    return Object.freeze({
      name,
      sourceState: sourceState[name],
      create(options = {}) {
        const element = document.createElement(options.tag ?? defaultTag);
        if (options.className) element.className = options.className;
        if (options.text !== undefined) element.textContent = options.text;
        if (options.attributes)
          for (const [key, value] of Object.entries(options.attributes))
            element.setAttribute(key, String(value));
        return enhance(element, name);
      },
      enhance(element) {
        return enhance(element, name);
      },
    });
  }

  function fitStatusPanel(shell) {
    const content = shell.querySelector('.ro-status-scale-content');
    if (!content) return;
    const mobile = global.matchMedia('(max-width: 650px)').matches;
    const wideDesktop = global.matchMedia('(min-width: 1200px)').matches;
    const maximumScale = mobile ? 1.5 : wideDesktop ? 3 : 2;
    const scale = Math.min(maximumScale, shell.clientWidth / 280);
    content.style.transform = `scale(${scale})`;
    shell.style.height = `${Math.ceil(163 * scale)}px`;
    shell.dataset.mobileScale = scale.toFixed(4);
  }

  function installResponsiveStatusPanels() {
    const shells = [...document.querySelectorAll('.ro-status-scale-shell')];
    const update = () => shells.forEach(fitStatusPanel);
    update();
    if ('ResizeObserver' in global) {
      const observer = new ResizeObserver(update);
      shells.forEach((shell) => observer.observe(shell));
    } else {
      global.addEventListener('resize', update);
    }
  }

  function fitEquipmentPanel(shell) {
    const content = shell.querySelector('.ro-equipment-scale-content');
    if (!content) return;
    const mobile = global.matchMedia('(max-width: 650px)').matches;
    const wideDesktop = global.matchMedia('(min-width: 1200px)').matches;
    const maximumScale = mobile ? 1.5 : wideDesktop ? 3 : 2;
    const scale = Math.min(maximumScale, shell.clientWidth / 280);
    content.style.transform = `scale(${scale})`;
    shell.style.height = `${Math.ceil(157 * scale)}px`;
    shell.dataset.equipmentScale = scale.toFixed(4);
  }

  function installResponsiveEquipmentPanels() {
    const shells = [...document.querySelectorAll('.ro-equipment-scale-shell')];
    const update = () => shells.forEach(fitEquipmentPanel);
    update();
    if ('ResizeObserver' in global) {
      const observer = new ResizeObserver(update);
      shells.forEach((shell) => observer.observe(shell));
    } else {
      global.addEventListener('resize', update);
    }
  }

  const RoUiSound = Object.freeze({
    sourceState: 'SEMANTIC_GATE_ENFORCED',
    status(eventName) {
      if (!(eventName in semanticSounds)) return 'UNREGISTERED';
      return semanticSounds[eventName] ? 'SOURCE_VERIFIED' : 'UNRESOLVED';
    },
    play(eventName, volume = 0.4) {
      const source = semanticSounds[eventName];
      if (!source) return false;
      const audio = new Audio(source);
      audio.volume = Math.max(0, Math.min(1, Number(volume) || 0));
      audio.setAttribute('playsinline', '');
      void audio.play().catch(() => {});
      return true;
    },
  });

  // Shared RO item/equipment description presentation.
  //
  // Inventory icon != item description art. The original client ships two
  // independent asset families for ordinary items: `item/<ResourceName>.bmp`
  // (inventory icon) and `collection/<ResourceName>.bmp` (item description
  // window art). Cards additionally ship `cardbmp/<ResourceName>.bmp`.
  // Description priority is verified collection-art, then verified card-art,
  // then a bounded inventory-icon fallback. This component never invents
  // stats, slots or requirements.
  const itemCategoryLabels = Object.freeze({
    consumable: '消耗品',
    equipment: '裝備',
    card: '卡片',
    etc: '其他',
    cash: '商城道具',
  });
  const itemSlotLabels = Object.freeze({
    headTop: '頭上',
    headMid: '頭中',
    headLow: '頭下',
    armor: '鎧甲',
    rightHand: '右手',
    leftHand: '左手',
    garment: '披肩',
    robe: '披肩',
    shoes: '鞋子',
    accessoryLeft: '左飾品',
    accessoryRight: '右飾品',
    ammo: '彈藥',
  });
  const itemDetailNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

  // Player-facing view never exposes asset provenance or internal identifiers.
  // GM/debug tooling can opt in with `?debugAssets`/`?debugItems` or by setting
  // `window.RO_ITEM_DEBUG = true`; the underlying model keeps every internal
  // field regardless, so the data layer is unchanged.
  function itemMetaDebugEnabled() {
    const flag = global.RO_ITEM_DEBUG ?? global.__RO_ITEM_DEBUG__;
    if (typeof flag === 'boolean') return flag;
    const search = String(global.location?.search ?? '');
    return /[?&](?:debugAssets|debugItems)(?:[=&]|$)/.test(search);
  }

  function dedicatedArtFrom(candidate, role) {
    if (!candidate || candidate.verified !== true || !candidate.webPath) return null;
    if (candidate.assetRole !== role) return null;
    return {
      source: candidate.webPath,
      width: itemDetailNumber(candidate.sourceWidth) ?? null,
      height: itemDetailNumber(candidate.sourceHeight) ?? null,
      role,
    };
  }

  function buildItemDetailModel(item = {}, resolved = {}) {
    const runtime = item ?? {};
    const source = resolved ?? {};
    const asset = source.asset ?? null;
    const itemId = source.itemId ?? runtime.itemId ?? null;
    const name = source.name ?? runtime.name ?? '未辨識道具';
    // Description art priority: collection-art, then card-art. The inventory
    // icon is only a bounded fallback and never the normal description image.
    const collectionArt = dedicatedArtFrom(source.collectionArt, 'collection-art');
    const cardArt = dedicatedArtFrom(
      source.cardArt ?? (asset?.assetRole === 'card-art' ? asset : null),
      'card-art',
    );
    const dedicatedArt = collectionArt ?? cardArt;
    const artRole = dedicatedArt?.role ?? null;
    const fallbackIcon =
      !dedicatedArt && asset?.webPath
        ? {
            source: asset.webPath,
            width: itemDetailNumber(asset.sourceWidth) ?? 24,
            height: itemDetailNumber(asset.sourceHeight) ?? 24,
            role: asset.assetRole ?? 'item-icon',
          }
        : null;
    const stats = [];
    const addStat = (label, value) => {
      if (value === null || value === undefined || value === '') return;
      stats.push({ label, value: String(value) });
    };
    const category = source.category ?? runtime.category ?? '';
    addStat('類型', itemCategoryLabels[category] ?? (category || null));
    const attack = itemDetailNumber(source.attack ?? runtime.attack);
    if (attack !== null && attack > 0) addStat('ATK', attack);
    const defense = itemDetailNumber(source.defense ?? runtime.defense);
    if (defense !== null && defense > 0) addStat('DEF', defense);
    const slots = itemDetailNumber(source.slots ?? runtime.slots);
    if (slots !== null && slots >= 0) addStat('插槽', slots);
    const slotLabel = itemSlotLabels[source.equipSlot ?? runtime.slot];
    if (slotLabel) addStat('裝備部位', slotLabel);
    const requirements = [];
    const requiredLevel = itemDetailNumber(source.requiredLevel);
    if (requiredLevel !== null && requiredLevel > 0)
      requirements.push(`需求等級：${requiredLevel}`);
    const weight = itemDetailNumber(source.weight);
    if (weight !== null && weight > 0) requirements.push(`重量：${weight}`);
    if (source.refineable === true || source.refineable === 'true')
      requirements.push('可精煉');
    else if (source.refineable === false || source.refineable === 'false')
      requirements.push('不可精煉');
    // Equip restrictions are player language supplied by the server. They are
    // only meaningful for real equipment; consumables, materials, quest items
    // and ETC never claim to be unequippable.
    if (category === 'equipment' && runtime.equipRestriction)
      requirements.push(runtime.equipRestriction);
    const description = source.description ?? runtime.description ?? '';
    const artRoleLabel =
      artRole === 'card-art' ? '卡片美術' : artRole === 'collection-art' ? '說明美術' : fallbackIcon ? '道具圖示' : '美術待補';
    return {
      itemId,
      name,
      stats,
      requirements,
      description: description || '【資料不足，無法確認】',
      dedicatedArt,
      fallbackIcon,
      artRole,
      hasDedicatedArt: Boolean(dedicatedArt),
      artLabel:
        artRole === 'card-art'
          ? '原廠卡片說明美術'
          : artRole === 'collection-art'
            ? '原廠道具說明美術'
            : fallbackIcon
              ? '原廠道具圖示（無專屬說明美術）'
              : '原廠美術待補',
      metaText:
        itemId !== null && itemId !== undefined
          ? `Item ID：${itemId} · 原廠${artRoleLabel}`
          : `Item ID：未確認 · 原廠${artRoleLabel}`,
    };
  }

  function renderItemDetail(root, model) {
    if (!root || !model) return;
    const setText = (selector, text) => {
      const element = root.querySelector(selector);
      if (element) element.textContent = text;
    };
    setText('#cardArtPreviewTitle', model.artRole === 'card-art' ? '卡片說明' : '道具說明');
    setText('#itemDetailName', model.name);
    const art = root.querySelector('#itemDetailArt');
    const image = root.querySelector('#cardArtPreviewImage');
    const badge = root.querySelector('#itemDetailArtBadge');
    const artSource = model.dedicatedArt ?? model.fallbackIcon;
    if (art) {
      art.hidden = !artSource;
      art.classList.toggle('ro-item-detail-art--dedicated', Boolean(model.dedicatedArt));
      art.classList.toggle(
        'ro-item-detail-art--fallback',
        !model.dedicatedArt && Boolean(model.fallbackIcon),
      );
      art.classList.toggle('ro-item-detail-art--missing', !artSource);
    }
    if (image) {
      if (artSource?.source) {
        image.src = artSource.source;
        image.alt = `${model.name}${model.dedicatedArt ? '' : '道具圖示'}`;
      } else {
        image.removeAttribute('src');
        image.alt = '';
      }
      if (model.dedicatedArt) {
        image.width = model.dedicatedArt.width;
        image.height = model.dedicatedArt.height;
      } else {
        image.removeAttribute('width');
        image.removeAttribute('height');
      }
    }
    const showInternalMeta = itemMetaDebugEnabled();
    if (badge) {
      badge.textContent = showInternalMeta ? model.artLabel : '';
      badge.hidden = !showInternalMeta;
    }
    const stats = root.querySelector('#itemDetailStats');
    if (stats) {
      stats.replaceChildren(
        ...model.stats.map(({ label, value }) => {
          const entry = document.createElement('li');
          const key = document.createElement('span');
          key.textContent = label;
          const textValue = document.createElement('b');
          textValue.textContent = value;
          entry.append(key, textValue);
          return entry;
        }),
      );
      stats.hidden = !model.stats.length;
    }
    const description = root.querySelector('#cardArtPreviewDescription');
    if (description) description.textContent = model.description;
    const requirements = root.querySelector('#itemDetailRequirements');
    if (requirements) {
      requirements.replaceChildren(
        ...model.requirements.map((line) => {
          const entry = document.createElement('li');
          entry.textContent = line;
          return entry;
        }),
      );
      requirements.hidden = !model.requirements.length;
    }
    const meta = root.querySelector('#cardArtPreviewMeta');
    if (meta) {
      meta.textContent = showInternalMeta ? model.metaText : '';
      meta.hidden = !showInternalMeta;
    }
  }

  const RoItemDetail = Object.freeze({
    buildModel: buildItemDetailModel,
    render: renderItemDetail,
  });

  const kit = {
    sourceState,
    enhance,
    RoItemDetail,
    RoWindow: createPrimitive('RoWindow', 'section'),
    RoTitleBar: createPrimitive('RoTitleBar', 'header'),
    RoButton: createPrimitive('RoButton', 'button'),
    RoIconButton: createPrimitive('RoIconButton', 'button'),
    RoTab: createPrimitive('RoTab', 'button'),
    RoScrollbar: createPrimitive('RoScrollbar', 'div'),
    RoInput: createPrimitive('RoInput', 'input'),
    RoSelect: createPrimitive('RoSelect', 'select'),
    RoCheckbox: createPrimitive('RoCheckbox', 'input'),
    RoTooltip: createPrimitive('RoTooltip', 'div'),
    RoItemSlot: createPrimitive('RoItemSlot', 'button'),
    RoSkillSlot: createPrimitive('RoSkillSlot', 'button'),
    RoEquipmentSlot: createPrimitive('RoEquipmentSlot', 'button'),
    RoUiSound,
  };
  global.RoOriginalUiKit = Object.freeze(kit);
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-ro-primitive]').forEach((element) =>
      enhance(element, element.dataset.roPrimitive),
    );
    installResponsiveStatusPanels();
    installResponsiveEquipmentPanels();
  });
})(window);
