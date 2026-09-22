import {
  CONFIG_FORM_SCHEMA,
  CONFIG_ROW_SCHEMAS,
  COMBAT_PROFILES,
  PROFILE_DEFINITIONS,
  applyProfileTemplate,
  assertCanonicalConfig,
  clone,
  defaultConfigRow,
  defaultCanonicalConfig,
  validateCanonicalConfig,
} from './config-schema.mjs';

const $ = (root, selector) => root.querySelector(selector);
const text = (value) => String(value ?? '');
const pathParts = (path) => path.split('.');

function getPath(value, path) {
  return pathParts(path).reduce((node, key) => node?.[key], value);
}

function setPath(value, path, next) {
  const parts = pathParts(path);
  const last = parts.pop();
  let cursor = value;
  for (const part of parts) {
    if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[last] = next;
}

function fieldInput(field, value) {
  if (field.type === 'select') {
    const select = document.createElement('select');
    for (const optionValue of field.options ?? []) {
      const option = document.createElement('option');
      option.value = String(optionValue);
      option.textContent = field.labels?.[field.options.indexOf(optionValue)] ?? PROFILE_DEFINITIONS[optionValue]?.label ?? String(optionValue);
      select.append(option);
    }
    select.value = String(value);
    return select;
  }
  const input = document.createElement('input');
  input.type = field.type === 'checkbox' ? 'checkbox' : field.type;
  if (field.type === 'checkbox') input.checked = value === true;
  else input.value = text(value);
  if (field.min !== undefined) input.min = String(field.min);
  if (field.max !== undefined) input.max = String(field.max);
  return input;
}

function rowField(root, state, field, onChange) {
  const label = document.createElement('label');
  label.className = `config-field${field.advanced ? ' config-advanced-field' : ''}`;
  const caption = document.createElement('span');
  caption.textContent = field.label;
  const input = fieldInput(field, getPath(state, field.path));
  input.dataset.configPath = field.path;
  if (field.fixed && field.path.endsWith('autoLoot')) {
    input.checked = true;
    input.disabled = true;
  }
  if (field.fixed && field.path.endsWith('autoStore')) {
    input.checked = false;
    input.disabled = true;
  }
  const update = () => {
    let next;
    if (field.type === 'checkbox') next = input.checked;
    else if (field.type === 'number') next = Number(input.value);
    else if (field.type === 'select' && /^-?\d+$/.test(input.value)) next = Number(input.value);
    else next = input.value;
    setPath(state, field.path, next);
  };
  input.addEventListener('input', update);
  input.addEventListener('change', () => { update(); onChange(); });
  label.append(caption, input);
  return label;
}

function arrayDefaults(kind) { return defaultConfigRow(kind); }

function arrayFieldNames(kind) {
  return (CONFIG_ROW_SCHEMAS[kind] ?? []).map((field) => [field.path, field.label, field.type, field]);
}

function makeArrayEditor(root, state, descriptor, render) {
  const section = document.createElement('details');
  section.className = 'config-array';
  section.open = !descriptor.advanced;
  const summary = document.createElement('summary');
  summary.textContent = descriptor.title;
  section.append(summary);
  const list = document.createElement('div');
  list.className = 'config-array-list';
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'secondary config-add';
  add.textContent = '新增一列';
  add.addEventListener('click', () => {
    getPath(state, descriptor.path).push(arrayDefaults(descriptor.kind));
    render();
  });
  for (const [index, item] of getPath(state, descriptor.path).entries()) {
    const row = document.createElement('div');
    row.className = 'config-array-row';
    for (const [key, label, type, descriptorField] of arrayFieldNames(descriptor.kind)) {
      const field = document.createElement('label');
      field.className = 'config-array-field';
      const caption = document.createElement('span');
      caption.textContent = label;
      const input = type === 'select' ? document.createElement('select') : document.createElement('input');
      if (type !== 'select') input.type = type;
      if (type === 'select') {
        for (const optionValue of descriptorField.options ?? []) {
          const option = document.createElement('option');
          option.value = String(optionValue);
          option.textContent = descriptorField.labels?.[descriptorField.options.indexOf(optionValue)] ?? String(optionValue);
          input.append(option);
        }
        input.value = text(getPath(item, key));
      } else if (type === 'checkbox') input.checked = getPath(item, key) === true;
      else input.value = text(getPath(item, key));
      if (descriptorField.min !== undefined) input.min = String(descriptorField.min);
      if (descriptorField.max !== undefined) input.max = String(descriptorField.max);
      if (type === 'number') input.inputMode = 'numeric';
      const update = () => {
        const next = type === 'checkbox' ? input.checked : type === 'number' ? Number(input.value) : type === 'select' && typeof descriptorField.default === 'number' ? Number(input.value) : input.value;
        setPath(item, key, next);
      };
      input.addEventListener('input', update);
      input.addEventListener('change', () => { update(); render(); });
      field.append(caption, input);
      row.append(field);
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'secondary config-remove';
    remove.textContent = '刪除';
    remove.addEventListener('click', () => {
      getPath(state, descriptor.path).splice(index, 1);
      render();
    });
    row.append(remove);
    list.append(row);
  }
  section.append(list, add);
  return section;
}

function render(root, state, context) {
  root.replaceChildren();
  const header = document.createElement('div');
  header.className = 'config-editor-header';
  const heading = document.createElement('h3');
  heading.textContent = '角色設定中心';
  const status = document.createElement('span');
  status.className = 'config-editor-status';
  status.textContent = context.status;
  header.append(heading, status);
  root.append(header);
  const tabs = document.createElement('div');
  tabs.className = 'config-tabs';
  for (const [sectionName, sectionSchema] of Object.entries(CONFIG_FORM_SCHEMA)) {
    const panel = document.createElement('section');
    panel.className = `config-panel config-${sectionName}`;
    const title = document.createElement('h4');
    title.textContent = sectionSchema.title;
    panel.append(title);
    const groups = new Map();
    for (const field of sectionSchema.fields) {
      const group = groups.get(field.group) ?? document.createElement('div');
      group.className = `config-group${field.group === '進階' ? ' config-advanced' : ''}`;
      if (!groups.has(field.group)) {
        const groupTitle = document.createElement('h5');
        groupTitle.textContent = field.group;
        group.append(groupTitle);
        groups.set(field.group, group);
        panel.append(group);
      }
      group.append(rowField(root, state, field, () => render(root, state, context)));
    }
    for (const descriptor of sectionSchema.arrays ?? []) panel.append(makeArrayEditor(root, state, descriptor, () => render(root, state, context)));
    if (sectionName === 'combat') {
      const apply = document.createElement('button');
      apply.type = 'button';
      apply.className = 'secondary config-profile-apply';
      apply.textContent = '套用目前模式的基礎行為';
      apply.addEventListener('click', () => {
        const profile = state.combat.profile;
        state.combat.attack.mode = PROFILE_DEFINITIONS[profile].attackMode;
        state.combat.attack.useWeapon = PROFILE_DEFINITIONS[profile].useWeapon;
        render(root, state, context);
      });
      panel.append(apply);
    }
    tabs.append(panel);
  }
  root.append(tabs);
  const migration = context.migration;
  if (migration) {
    const details = document.createElement('details');
    details.className = 'config-migration';
    const summary = document.createElement('summary');
    summary.textContent = `遷移對照：${migration.mappings?.length ?? 0} 項，${migration.unmapped?.length ?? 0} 項待人工確認`;
    details.append(summary);
    for (const entry of migration.mappings ?? []) {
      const line = document.createElement('p');
      line.textContent = `${entry.disposition} · ${entry.legacy} → ${entry.canonical}`;
      details.append(line);
    }
    for (const entry of migration.unmapped ?? []) {
      const line = document.createElement('p');
      line.className = 'config-warning';
      line.textContent = `UNKNOWN · ${entry}`;
      details.append(line);
    }
    root.append(details);
  }
  const actions = document.createElement('div');
  actions.className = 'controls config-editor-actions';
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'primary';
  save.textContent = context.saving ? '保存中…' : '保存角色設定';
  save.disabled = context.saving;
  save.addEventListener('click', () => context.save(state));
  actions.append(save);
  root.append(actions);
}

async function mount(root) {
  if (!root || root.dataset.configEditorMounted === '1') return;
  root.dataset.configEditorMounted = '1';
  const context = { status: '讀取設定中…', saving: false, migration: null, save: async () => {} };
  let state = defaultCanonicalConfig(0);
  render(root, state, context);
  try {
    const response = await fetch('/api/config', { credentials: 'same-origin' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? '設定讀取失敗');
    state = payload.config;
    context.migration = payload.migration;
    context.status = payload.source === 'migrated' ? '已完成舊設定遷移，請檢查後保存' : '設定已讀取';
    context.save = async () => {
      const errors = validateCanonicalConfig(state);
      if (errors.length) { context.status = `設定錯誤：${errors[0].message}`; render(root, state, context); return; }
      context.saving = true;
      context.status = '設定驗證中…';
      render(root, state, context);
      try {
        const result = await fetch('/api/config', { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ config: state, expectedRevision: state.revision }) });
        const body = await result.json();
        if (!result.ok) throw new Error(body.error ?? '設定保存失敗');
        state = body.config;
        context.migration = body.migration;
        context.status = '設定已保存，執行器套用狀態請由後端能力回報確認';
      } catch (error) {
        context.status = error.message;
      } finally {
        context.saving = false;
        render(root, state, context);
      }
    };
    render(root, state, context);
  } catch (error) {
    context.status = error.message;
    render(root, state, context);
  }
}

window.GhostIslandConfigEditor = Object.freeze({ mount });
