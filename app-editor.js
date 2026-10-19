/*
 * Quest and chapter editor views.
 * Functions here translate project state into the sidebar, forms, and JSON preview.
 */
let lastEditorQuestKey = null;

// Render searchable texture tiles with local image previews.
function renderTextureGrid() {
  const textures = window.MINECRAFT_TEXTURE_CATALOG || [];
  const query = $('#textureSearch').value.trim().toLowerCase();
  const matched = textures.filter(texture => texture.id.toLowerCase().includes(query) || texture.file.replace(/\.png$/i, '').replace(/_/g, ' ').toLowerCase().includes(query));
  $('#textureStatus').textContent = `${matched.length.toLocaleString()} textures`;
  $('#textureGrid').innerHTML = matched.map(texture => {
    const label = texture.file.replace(/\.png$/i, '').replace(/_/g, ' ');
    return `<button class="item-option" type="button" data-texture-id="${safe(texture.id)}"><img loading="lazy" src="./Images/textures/${encodeURIComponent(texture.file)}" alt="" /><span><b>${safe(label)}</b><small>${safe(texture.id)}</small></span></button>`;
  }).join('');
  $$('#textureGrid .item-option').forEach(button => button.onclick = () => {
    $('#backgroundTexture').value = button.dataset.textureId;
    updateBackgroundTexturePreview(button.dataset.textureId);
    $('#textureDialog').close();
    changed();
  });
  $$('#textureGrid img').forEach(image => image.onerror = () => { image.style.visibility = 'hidden'; });
}

function updateBackgroundTexturePreview(value) {
  const image = $('#backgroundTexturePreview');
  const texture = window.MINECRAFT_TEXTURE_CATALOG?.find(entry => entry.id === value);
  $('#clearBackgroundTexture').disabled = !value;
  image.style.visibility = texture ? 'visible' : 'hidden';
  image.onerror = () => { image.style.visibility = 'hidden'; };
  image.onload = () => { image.style.visibility = 'visible'; };
  if (texture) image.src = `./Images/textures/${encodeURIComponent(texture.file)}`;
  else image.removeAttribute('src');
}

function syncOptionalColorControl(toggleId, inputId) {
  $(`#${inputId}`).disabled = !$(`#${toggleId}`).checked;
}

// Refresh every view that depends on the currently selected quest.
function renderAll() {
  const selectedKey = state.selected;
  const allQuestsButton = $('#viewAllQuests');
  allQuestsButton.setAttribute('aria-pressed', String(showAllQuestsMap));
  allQuestsButton.classList.toggle('active', showAllQuestsMap);
  allQuestsButton.innerHTML = `<span aria-hidden="true">${showAllQuestsMap ? '↩' : '▦'}</span> ${showAllQuestsMap ? 'Back to Quest Editor' : 'View All Quests'}`;
  $('.layout').classList.toggle('all-quests-mode', showAllQuestsMap);
  renderSidebar();
  renderEditor();
  renderGraph();
  renderPreview();
  if (showAllQuestsMap) $('#crumbQuest').textContent = 'ALL CHAPTERS MAP';
  $('#itemCount').textContent = `${state.quests.length} quests · ${state.chapters.length} chapters`;
  if (lastEditorQuestKey && selectedKey && selectedKey !== lastEditorQuestKey) {
    const editor = $('.editor-column');
    editor.classList.remove('quest-switched');
    void editor.offsetWidth;
    editor.classList.add('quest-switched');
  }
  lastEditorQuestKey = selectedKey;
}

// Draw quest and chapter navigation, with local icons for each quest.
function renderSidebar() {
  const filter = $('#search').value.toLowerCase();
  $('#chapterCount').textContent = state.chapters.length;
  if (questChapterFilter !== 'all' && !state.chapters.some(chapter => chapter.fileName === questChapterFilter)) {
    questChapterFilter = 'all';
  }
  $('#allChapters').classList.toggle('active', questChapterFilter === 'all');
  const visibleQuests = state.quests.filter(quest =>
    (questChapterFilter === 'all' || quest.chapter === questChapterFilter) &&
    `${quest.data.title} ${quest.fileName}`.toLowerCase().includes(filter)
  );
  $('#questCount').textContent = visibleQuests.length;
  $('#allChapterQuestCount').textContent = state.quests.length;

  $('#questList').innerHTML = visibleQuests.map(quest => `
    <div class="quest-row ${quest.key === state.selected ? 'active' : ''}" data-key="${quest.key}">
      <span class="quest-icon"><span aria-hidden="true">✦</span><img src="${safe(localSprite(quest.data.icon?.item || 'minecraft:book'))}" alt="" /></span>
      <span class="quest-info"><b>${safe(quest.data.title || 'Untitled quest')}</b><small>${safe(questId(quest))}</small></span>
      <button class="text-button quest-download" data-quest-download="${quest.key}" type="button" title="Download quest JSON" aria-label="Download ${safe(quest.data.title || quest.fileName)} as JSON">&#8595;</button>
      <span class="quest-arrow">›</span>
    </div>`).join('') || '<div class="empty-state">No quests match these filters.</div>';

  $$('.quest-row').forEach(row => row.onclick = () => {
    state.selected = row.dataset.key;
    renderAll();
  });
  $$('[data-quest-download]').forEach(button => button.onclick = event => {
    event.stopPropagation();
    const quest = state.quests.find(item => item.key === button.dataset.questDownload);
    if (quest) download(`${quest.fileName || 'quest'}.json`, questOutputData(quest));
  });
  $$('.quest-icon img').forEach(image => image.onerror = () => { image.style.visibility = 'hidden'; });

  $('#chapterList').innerHTML = state.chapters.map(chapter => `
    <div class="chapter-row ${questChapterFilter === chapter.fileName ? 'active' : ''}">
      <button class="chapter-icon-pick" data-chapter-icon="${chapter.key}" title="Choose chapter icon">
        <img src="${safe(localSprite(chapter.data.icon?.item || 'minecraft:book'))}" alt="" />
      </button>
      <button class="chapter-name" data-chapter-filter="${safe(chapter.fileName)}" title="Show quests in this chapter">${safe(chapter.data.name || chapter.fileName)}</button>
      <small>${state.quests.filter(quest => quest.chapter === chapter.fileName).length}</small>
      <button class="chapter-visibility-toggle ${chapter.data.hidden ? 'is-hidden' : ''}" data-chapter-visibility="${chapter.key}" type="button" role="switch" aria-checked="${!!chapter.data.hidden}" aria-label="${chapter.data.hidden ? 'Chapter hidden from UI' : 'Chapter visible in UI'}" title="${chapter.data.hidden ? 'Hidden from UI — click to show' : 'Visible in UI — click to hide'}"><i aria-hidden="true"></i></button>
      <button class="text-button chapter-edit" data-chapter-edit="${chapter.key}" title="Edit chapter">Edit</button>
      <button class="text-button chapter-download" data-chapter-download="${chapter.key}" title="Download chapter JSON">↓</button>
      <button class="text-button chapter-delete" data-chapter-delete="${chapter.key}" title="Remove chapter">×</button>
    </div>`).join('');

  $$('[data-chapter-filter]').forEach(button => {
    button.onclick = () => {
      questChapterFilter = button.dataset.chapterFilter;
      renderSidebar();
    };
  });
  $$('[data-chapter-edit]').forEach(button => button.onclick = () => editChapter(button.dataset.chapterEdit));
  $$('[data-chapter-visibility]').forEach(button => button.onclick = event => {
    event.stopPropagation();
    const chapter = state.chapters.find(item => item.key === button.dataset.chapterVisibility);
    if (!chapter) return;
    chapter.data.hidden = !chapter.data.hidden;
    persist();
    renderSidebar();
  });
  $$('[data-chapter-download]').forEach(button => button.onclick = () => {
    const chapter = state.chapters.find(item => item.key === button.dataset.chapterDownload);
    if (chapter) download(`${chapter.fileName || 'chapter'}.json`, chapter.data);
  });
  $$('[data-chapter-delete]').forEach(button => button.onclick = () => removeChapter(button.dataset.chapterDelete));
  $$('[data-chapter-icon]').forEach(button => button.onclick = () => {
    const chapter = state.chapters.find(item => item.key === button.dataset.chapterIcon);
    if (!chapter) return;
    openItemPicker(itemId => {
      chapter.data.icon = { ...(chapter.data.icon || {}), item: itemId };
      persist();
      renderAll();
    }, chapter.data.icon?.item);
  });
  $$('.chapter-icon-pick img').forEach(image => image.onerror = () => { image.style.visibility = 'hidden'; });
}
// Prompt for a chapter's display name and exported filename.
function editChapter(key) {
  const chapter = state.chapters.find(item => item.key === key);
  if (!chapter) return;
  const name = prompt('Chapter display name:', chapter.data.name || '');
  if (name === null) return;
  const filename = prompt('Chapter file name (without .json):', chapter.fileName || 'chapter');
  if (filename === null) return;
  chapter.data.name = name.trim() || 'New Chapter';
  chapter.fileName = slug(filename);
  persist();
  renderAll();
  notify('Chapter saved');
}

// Confirm chapter deletion and move its quests to another chapter when possible.
function removeChapter(key) {
  const chapter = state.chapters.find(item => item.key === key);
  if (!chapter) return;
  const assignedQuests = state.quests.filter(quest => quest.chapter === chapter.fileName);
  const remainingChapters = state.chapters.filter(item => item.key !== key);
  const destination = remainingChapters[0] || null;
  const message = assignedQuests.length
    ? `${assignedQuests.length} quest${assignedQuests.length === 1 ? '' : 's'} assigned to it will be moved to ${destination ? `“${destination.data.name || destination.fileName}”` : 'no chapter'}.`
    : '';
  if (!confirm(`Remove the “${chapter.data.name || chapter.fileName}” chapter and its chapter JSON file? ${message}\n\nThis cannot be undone from the editor.`)) return;
  state.quests.forEach(quest => {
    if (quest.chapter === chapter.fileName) quest.chapter = destination?.fileName || '';
  });
  state.chapters = remainingChapters;
  persist();
  renderAll();
  notify('Chapter removed');
}

// Populate the form from the selected quest, or clear it when no quest is selected.
function renderEditor() {
  const quest = current();
  $('#editorTitle').textContent = quest ? (quest.data.title || 'Untitled quest') : 'Create a quest';
  $('#crumbQuest').textContent = quest ? questId(quest).toUpperCase() : 'NEW QUEST';
  $('#duplicateQuest').disabled = !quest;
  $('#deleteQuest').disabled = !quest;

  if (!quest) {
    $('#title').value = '';
    $('#description').value = '';
    $('#fileName').value = '';
    $('#icon').value = '';
    setIconPreview('');
    $('#chapter').innerHTML = '';
    $('#visibility').checked = false;
    syncQuestVisibilityToggle(false);
    $('#hideWhenCompleted').checked = false;
    syncHideWhenCompletedToggle(false);
    $('#requirements').innerHTML = '';
    $('#objectives').innerHTML = '';
    $('#rewards').innerHTML = '';
    $('#descriptionFailed').value = '';
    $('#failures').innerHTML = '';
    ['textColorEnabled', 'titleColorEnabled', 'progressTextColorEnabled'].forEach(id => { $(`#${id}`).checked = false; });
    ['textColor', 'titleColor', 'progressTextColor'].forEach(id => { $(`#${id}`).value = '#ffffff'; });
    syncOptionalColorControl('textColorEnabled', 'textColor');
    syncOptionalColorControl('titleColorEnabled', 'titleColor');
    syncOptionalColorControl('progressTextColorEnabled', 'progressTextColor');
    ['leftPanelWidth', 'rightPanelWidth', 'panelHeight', 'backgroundTexture'].forEach(id => { $(`#${id}`).value = ''; });
    updateBackgroundTexturePreview('');
    $('#advancedJson').value = '{}';
    return;
  }

  $('#title').value = quest.data.title || '';
  $('#description').value = quest.data.description || '';
  $('#descriptionFailed').value = quest.data.description_failed || '';
  [['textColor', 'text_color', 'textColorEnabled'], ['titleColor', 'title_color', 'titleColorEnabled'], ['progressTextColor', 'progress_text_color', 'progressTextColorEnabled']].forEach(([inputId, key, toggleId]) => {
    const color = quest.data[key];
    $(`#${toggleId}`).checked = !!color;
    $(`#${inputId}`).value = /^#[\da-f]{6}$/i.test(color || '') ? color : '#ffffff';
    syncOptionalColorControl(toggleId, inputId);
  });
  $('#leftPanelWidth').value = quest.data.left_panel_width ?? '';
  $('#rightPanelWidth').value = quest.data.right_panel_width ?? '';
  $('#panelHeight').value = quest.data.panel_height ?? '';
  $('#backgroundTexture').value = quest.data.background_texture || '';
  updateBackgroundTexturePreview($('#backgroundTexture').value);
  $('#fileName').value = quest.fileName || '';
  $('#icon').value = quest.data.icon?.item || '';
  setIconPreview($('#icon').value);
  $('#visibility').checked = !!quest.data.hidden;
  syncQuestVisibilityToggle($('#visibility').checked);
  $('#hideWhenCompleted').checked = !!quest.data.hide_when_completed;
  syncHideWhenCompletedToggle($('#hideWhenCompleted').checked);
  $('#chapter').innerHTML = state.chapters.map(chapter =>
    `<option value="${safe(chapter.fileName)}">${safe(chapter.data.name || chapter.fileName)} (${safe(chapter.fileName)}.json)</option>`
  ).join('') + '<option value="">No chapter</option>';
  $('#chapter').value = quest.chapter || '';
  renderRequirements(quest);
  renderRepeater('objectives', quest.data.objectives || [], OBJECTIVES);
  renderRepeater('failures', quest.data.failures || [], FAILURES);
  renderRepeater('rewards', quest.data.rewards || [], REWARDS);
  $('#advancedJson').value = JSON.stringify(quest.data, null, 2);
  $('#jsonError').textContent = '';
}

// Show and update prerequisite quest selections.
function renderRequirements(quest) {
  const requirements = quest.data.requirements || [];
  $('#requirements').innerHTML = requirements.length ? requirements.map((requirement, index) => {
    const availableQuests = state.quests.filter(item => item.key !== quest.key);
    const selectedQuest = availableQuests.find(item => questId(item) === requirement.quest);
    const selectedTitle = selectedQuest?.data.title || (selectedQuest ? selectedQuest.fileName : 'External / unresolved');
    const selectedId = requirement.quest || '';
    const selectedIcon = selectedQuest?.data.icon?.item || 'minecraft:book';
    const choices = availableQuests.map(item => {
      const id = questId(item), title = item.data.title || item.fileName;
      const icon = localSprite(item.data.icon?.item || 'minecraft:book');
      return `<button type="button" class="quest-option ${id === requirement.quest ? 'selected' : ''}" data-req-choice data-req-value="${safe(id)}" role="option" aria-selected="${id === requirement.quest}"><img src="${safe(icon)}" alt="" /><span><b>${safe(title)}</b><small>${safe(id)}</small></span></button>`;
    }).join('');
    const unknownChoice = selectedQuest ? '' : `<button type="button" class="quest-option selected" data-req-choice data-req-value="${safe(selectedId)}" role="option" aria-selected="true"><img src="${safe(localSprite('minecraft:barrier'))}" alt="" /><span><b>External / unresolved</b><small>${safe(selectedId || 'No quest ID')}</small></span></button>`;
    return `<div class="repeat-item"><div class="repeat-top"><div class="quest-picker-control"><input type="hidden" data-req="${index}" class="req-select" value="${safe(selectedId)}" /><button type="button" class="quest-picker-trigger" aria-haspopup="listbox" aria-expanded="false"><img data-req-preview src="${safe(localSprite(selectedIcon))}" alt="" /><span class="quest-selected-label"><b>${safe(selectedTitle)}</b><small>${safe(selectedId)}</small></span><i aria-hidden="true">&#9662;</i></button><div class="quest-picker-menu" role="listbox" aria-label="Choose prerequisite quest" hidden>${unknownChoice}${choices}</div></div><button class="remove-item" data-remove-req="${index}" aria-label="Remove requirement">&times;</button></div><small class="requirement-hint">Unlocks after this quest is completed.</small></div>`;
  }).join('') : '<div class="empty-state">No prerequisites. This quest is available from the start.</div>';

  $$('.quest-picker-trigger').forEach(trigger => trigger.onclick = () => {
    const picker = trigger.closest('.quest-picker-control'), menu = picker.querySelector('.quest-picker-menu');
    const opening = menu.hidden;
    $$('.quest-picker-control.is-open').forEach(openPicker => {
      openPicker.classList.remove('is-open');
      openPicker.querySelector('.quest-picker-menu').hidden = true;
      openPicker.querySelector('.quest-picker-trigger').setAttribute('aria-expanded', 'false');
    });
    if (opening) {
      picker.classList.add('is-open');
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
    }
  });
  $$('[data-req-choice]').forEach(option => option.onclick = () => {
    const picker = option.closest('.quest-picker-control');
    const input = picker.querySelector('[data-req]');
    const index = Number(input.dataset.req), value = option.dataset.reqValue;
    quest.data.requirements[index].quest = value;
    renderRequirements(quest);
    changed();
  });
  if (!document.documentElement.dataset.reqPickerBound) {
    document.addEventListener('click', event => {
      if (event.target.closest('.quest-picker-control')) return;
      $$('.quest-picker-control.is-open').forEach(picker => {
        picker.classList.remove('is-open');
        picker.querySelector('.quest-picker-menu').hidden = true;
        picker.querySelector('.quest-picker-trigger').setAttribute('aria-expanded', 'false');
      });
    });
    document.documentElement.dataset.reqPickerBound = 'true';
  }
  $$('[data-remove-req]').forEach(button => button.onclick = () => {
    quest.data.requirements.splice(Number(button.dataset.removeReq), 1);
    renderRequirements(quest);
    changed();
  });
}

// Render objective or reward rows, including item previews and type-specific fields.
function rewardItemId(value) {
  return typeof value === 'string' ? value : value?.id || '';
}

// Keep the item reward in the nested format Questlog expects for enchanted books.
function setRewardItemId(reward, itemId) {
  if (itemId !== ENCHANTED_BOOK_ITEM_ID) {
    reward.item = itemId;
    return;
  }
  const existingItem = typeof reward.item === 'object' && reward.item ? reward.item : {};
  const existingEnchant = existingItem.tag?.StoredEnchantments?.[0] || { id: 'minecraft:fortune', lvl: 3 };
  reward.item = {
    id: ENCHANTED_BOOK_ITEM_ID,
    tag: {
      ...(existingItem.tag || {}),
      StoredEnchantments: [{ id: existingEnchant.id || 'minecraft:fortune', lvl: Number(existingEnchant.lvl) || 3 }]
    }
  };
}

function rewardEnchantment(reward) {
  setRewardItemId(reward, ENCHANTED_BOOK_ITEM_ID);
  return reward.item.tag.StoredEnchantments[0];
}

// Add required enchantment controls only for enchanted book item rewards.
function renderBookEnchantmentFields(reward, index, entryIndex = null) {
  const enchantment = rewardEnchantment(reward);
  const random = entryIndex !== null;
  const attrs = random
    ? `data-random-enchant-index="${index}" data-random-enchant-entry="${entryIndex}"`
    : `data-enchant-index="${index}"`;
  const selectAttr = random ? 'data-random-enchant-field="id"' : 'data-enchant-field="id"';
  const levelAttr = random ? 'data-random-enchant-field="lvl"' : 'data-enchant-field="lvl"';
  const options = MINECRAFT_ENCHANTMENTS.map(option => `<option value="${safe(option.id)}" ${option.id === enchantment.id ? 'selected' : ''}>${safe(option.label)}</option>`).join('');
  return `<div class="enchant-fields wide" data-enchanted-fields ${attrs}><label class="field"><span>Enchantment <i>required</i></span><select ${selectAttr} ${attrs} required>${options}</select></label><label class="field"><span>Enchantment level <i>required</i></span><input ${levelAttr} ${attrs} type="number" min="1" max="255" step="1" value="${safe(enchantment.lvl)}" required></label></div>`;
}

// Toggle the enchantment controls in place so typing in the item field is uninterrupted.
function syncBookEnchantmentFields(host, reward, index, entryIndex = null) {
  const selector = entryIndex === null
    ? `[data-enchanted-fields][data-enchant-index="${index}"]`
    : `[data-enchanted-fields][data-random-enchant-index="${index}"][data-random-enchant-entry="${entryIndex}"]`;
  const panel = host.querySelector(selector);
  if (!panel) return;
  const hasEnchantedBook = rewardItemId(reward.item) === ENCHANTED_BOOK_ITEM_ID;
  if (hasEnchantedBook && !panel.querySelector('select, input')) {
    panel.outerHTML = renderBookEnchantmentFields(reward, index, entryIndex);
  } else if (!hasEnchantedBook && panel.querySelector('select, input')) {
    panel.outerHTML = entryIndex === null
      ? `<div class="enchant-fields wide" data-enchanted-fields data-enchant-index="${index}" hidden></div>`
      : `<div class="enchant-fields wide" data-enchanted-fields data-random-enchant-index="${index}" data-random-enchant-entry="${entryIndex}" hidden></div>`;
  }
}

// Delegate enchantment events so controls added after typing or item-picker selection work too.
function bindEnchantmentControls(host) {
  if (host.dataset.enchantmentEventsBound) return;
  const update = event => {
    const input = event.target;
    if (!input.matches('[data-enchant-field], [data-random-enchant-field]')) return;
    if (input.tagName === 'SELECT' && event.type !== 'change') return;
    if (input.tagName !== 'SELECT' && event.type !== 'input' && event.type !== 'change') return;
    let reward;
    if (input.dataset.randomEnchantField) {
      reward = state.quests.find(quest => quest.key === state.selected)?.data.rewards?.[Number(input.dataset.randomEnchantIndex)]
        ?.entries?.[Number(input.dataset.randomEnchantEntry)]?.reward;
    } else {
      reward = state.quests.find(quest => quest.key === state.selected)?.data.rewards?.[Number(input.dataset.enchantIndex)];
    }
    if (!reward) return;
    const enchantment = rewardEnchantment(reward);
    if ((input.dataset.enchantField || input.dataset.randomEnchantField) === 'id') enchantment.id = input.value;
    else {
      const level = Number(input.value);
      if (Number.isInteger(level) && level >= 1 && level <= 255) enchantment.lvl = level;
      else if (event.type === 'change') input.value = String(enchantment.lvl);
    }
    changed();
  };
  host.addEventListener('input', update);
  host.addEventListener('change', update);
  host.dataset.enchantmentEventsBound = 'true';
}

// Render one leaf objective inside an OR group with the same item and entity pickers.
function renderOrChild(objective, parentIndex, childIndex) {
  const type = OR_OBJECTIVES[objective.type] ? objective.type : Object.keys(OR_OBJECTIVES)[0];
  const config = OR_OBJECTIVES[type];
  const typeOptions = Object.entries(OR_OBJECTIVES).map(([value, entry]) => `<option value="${safe(value)}" ${value === type ? 'selected' : ''}>${safe(entry.label)}</option>`).join('');
  const fields = config.fields.map(field => {
    const [key, label, defaultValue, kind] = field;
    const value = objective[key] ?? defaultValue ?? '';
    const attrs = `data-or-field="${safe(key)}" data-or-parent="${parentIndex}" data-or-child="${childIndex}"`;
    const wide = key === 'name' || key === 'nbt' ? 'wide' : '';
    if (kind === 'checkbox') return `<label class="check-field wide"><input type="checkbox" ${attrs} ${objective[key] ?? defaultValue ? 'checked' : ''}>${safe(label)}</label>`;
    if (kind === 'select') {
      const choices = field.slice(4);
      const options = choices.map(([optionValue, optionLabel]) => `<option value="${safe(optionValue)}" ${String(optionValue) === String(value) ? 'selected' : ''}>${safe(optionLabel)}</option>`).join('');
      return `<label class="field ${wide}"><span>${safe(label)}</span><select ${attrs}>${options}</select></label>`;
    }
    if (key === 'item') {
      const iconId = value && !String(value).startsWith('#') ? value : 'minecraft:barrier';
      return `<label class="field ${wide}"><span>${safe(label)}</span><div class="repeat-item-id-control"><img class="item-preview" src="${safe(localSprite(iconId))}" alt="" /><input type="text" ${attrs} value="${safe(value)}" placeholder="${safe(defaultValue || '')}" /><button type="button" class="button small" data-pick-or-item="${parentIndex}" data-or-child="${childIndex}">Browse</button></div></label>`;
    }
    if (key === 'entity') {
      const entityInfo = ENTITY_CATALOG.find(entity => entity.id === value);
      const iconId = entityInfo?.icon || (String(value).startsWith('minecraft:') ? `${value}_spawn_egg` : 'minecraft:barrier');
      return `<label class="field ${wide}"><span>${safe(label)}</span><div class="repeat-item-id-control"><img class="entity-preview" src="${safe(localSprite(iconId))}" alt="" /><input type="text" ${attrs} value="${safe(value)}" placeholder="${safe(defaultValue || '')}" /><button type="button" class="button small" data-pick-or-entity="${parentIndex}" data-or-child="${childIndex}">Browse</button></div></label>`;
    }
    if (kind === 'biome') {
      const selectedBiome = BIOME_CATALOG.find(biome => biome.id === value);
      const icon = selectedBiome?.icon || 'minecraft:barrier';
      return `<label class="field ${wide}"><span>${safe(label)}</span><div class="repeat-item-id-control biome-id-control"><img class="biome-preview" src="${safe(localSprite(icon))}" alt="" /><input type="hidden" ${attrs} value="${safe(value)}"><button type="button" class="biome-picker-trigger" data-pick-or-biome="${parentIndex}" data-or-child="${childIndex}" aria-haspopup="dialog"><span class="biome-selected-label"><b>${safe(selectedBiome?.label || 'Unlisted biome')}</b><small>${safe(value)}</small></span><i aria-hidden="true">⌄</i></button></div></label>`;
    }
    const inputType = kind === 'number' ? 'number' : 'text';
    return `<label class="field ${wide}"><span>${safe(label)}</span><input type="${inputType}" ${attrs} value="${safe(value)}" placeholder="${safe(defaultValue || '')}"></label>`;
  }).join('');
  return `<div class="or-objective-option"><div class="or-objective-head"><select data-or-type="${parentIndex}" data-or-child="${childIndex}">${typeOptions}</select>${objective.objectives?.length > 2 ? `<button type="button" class="remove-item" data-remove-or="${parentIndex}" data-or-child="${childIndex}" aria-label="Remove alternative">×</button>` : ''}</div><div class="repeat-fields">${fields}</div></div>`;
}

// Render an OR objective and its alternative objectives as a nested form section.
function renderOrObjective(objective, index, types) {
  objective.objectives = Array.isArray(objective.objectives) ? objective.objectives : [makeDefault(OR_OBJECTIVES, 'questlog:item_obtain'), makeDefault(OR_OBJECTIVES, 'questlog:entity_kill')];
  if (objective.objectives.length < 2) objective.objectives = [makeDefault(OR_OBJECTIVES, 'questlog:item_obtain'), makeDefault(OR_OBJECTIVES, 'questlog:entity_kill')];
  const typeOptions = Object.entries(types).map(([value, entry]) => `<option value="${safe(value)}" ${value === 'questlog:or' ? 'selected' : ''}>${safe(entry.label)}</option>`).join('');
  const children = objective.objectives.map((child, childIndex) => renderOrChild(child, index, childIndex)).join('');
  return `<div class="repeat-item or-objective"><div class="repeat-top"><select data-kind="objectives" data-index="${index}">${typeOptions}</select><button class="remove-item" data-remove="objectives" data-index="${index}" aria-label="Remove objective">×</button></div><div class="repeat-fields"><label class="field wide"><span>Group display name</span><input type="text" data-or-name="${index}" value="${safe(objective.name || '')}" placeholder="Complete either objective"></label><div class="or-objectives wide">${children}</div><button type="button" class="button small or-add" data-add-or="${index}"><span aria-hidden="true">+</span> Add alternative</button></div></div>`;
}

function renderRepeater(name, items, types) {
  const host = $(`#${name}`);
  if (!items.length) {
    host.innerHTML = `<div class="empty-state">No ${name} added yet.</div>`;
    return;
  }

  host.innerHTML = items.map((item, index) => {
    const type = item.type || Object.keys(types)[0];
    if (name === 'objectives' && type === 'questlog:or') return renderOrObjective(item, index, types);
    if (name === 'rewards' && type === 'questlog:random') return renderRandomReward(item, index);
    if (name === 'rewards' && type === 'questlog:experience' && item.experience === undefined && item.amount !== undefined) {
      item.experience = item.amount;
      delete item.amount;
    }
    const config = types[type] || types['questlog:custom'] || types[Object.keys(types)[0]];
    const fields = config.fields.map(([key, label, defaultValue, kind]) => {
      if (kind === 'checkbox') {
        return `<label class="check-field wide"><input type="checkbox" data-field="${key}" data-list="${name}" data-index="${index}" ${item[key] ?? defaultValue ? 'checked' : ''}>${label}</label>`;
      }
      const wide = key === 'name' || key === 'command' || key === 'nbt' ? 'wide' : '';
      const value = key === 'item' ? rewardItemId(item[key]) || defaultValue : item[key] ?? (name === 'objectives' && key === 'name' ? '' : defaultValue);
      if (kind === 'select') {
        const choices = config.fields.find(field => field[0] === key).slice(4);
        const options = choices.map(([optionValue, optionLabel]) => `<option value="${safe(optionValue)}" ${String(optionValue) === String(value ?? '') ? 'selected' : ''}>${safe(optionLabel)}</option>`).join('');
        return `<label class="field ${wide}"><span>${label}</span><select data-field="${key}" data-list="${name}" data-index="${index}">${options}</select></label>`;
      }
      if (kind === 'dimension') {
        const selectedDimension = DIMENSIONS.find(dimension => dimension.id === value);
        const icon = selectedDimension?.icon || 'minecraft:barrier';
        const selectedLabel = selectedDimension?.label || 'Unlisted dimension';
        const options = DIMENSIONS.map(dimension => `<button type="button" class="dimension-option ${dimension.id === value ? 'selected' : ''}" data-dimension-choice="${safe(dimension.id)}" data-dimension-label="${safe(dimension.label)}" data-dimension-icon="${safe(localSprite(dimension.icon))}" role="option" aria-selected="${dimension.id === value}"><img src="${safe(localSprite(dimension.icon))}" alt="" /><span><b>${safe(dimension.label)}</b><small>${safe(dimension.id)}</small></span>${dimension.id === value ? '<i>✓</i>' : ''}</button>`).join('');
        const unknownOption = selectedDimension ? '' : `<button type="button" class="dimension-option selected" data-dimension-choice="${safe(value)}" data-dimension-label="Unlisted dimension" data-dimension-icon="${safe(localSprite(icon))}" role="option" aria-selected="true"><img src="${safe(localSprite(icon))}" alt="" /><span><b>Unlisted dimension</b><small>${safe(value)}</small></span><i>✓</i></button>`;
        return `<label class="field ${wide}"><span>${label}</span><div class="dimension-picker-control"><input type="hidden" data-field="${key}" data-list="${name}" data-index="${index}" value="${safe(value)}"><button type="button" class="dimension-picker-trigger" aria-haspopup="listbox" aria-expanded="false"><img data-dimension-preview src="${safe(localSprite(icon))}" alt="" /><span class="dimension-selected-label"><b>${safe(selectedLabel)}</b><small>${safe(value)}</small></span><i aria-hidden="true">⌄</i></button><div class="dimension-menu" role="listbox" aria-label="Choose dimension" hidden>${unknownOption}${options}</div></div></label>`;
      }
      if (kind === 'biome') {
        const selectedBiome = BIOME_CATALOG.find(biome => biome.id === value);
        const icon = selectedBiome?.icon || 'minecraft:barrier';
        const labelText = selectedBiome?.label || 'Unlisted biome';
        return `<label class="field ${wide}"><span>${label}</span><div class="repeat-item-id-control biome-id-control"><img class="biome-preview" src="${safe(localSprite(icon))}" alt="" /><input type="hidden" data-field="${key}" data-list="${name}" data-index="${index}" value="${safe(value)}"><button type="button" class="biome-picker-trigger" data-pick-biome="${index}" aria-haspopup="dialog"><span class="biome-selected-label"><b>${safe(labelText)}</b><small>${safe(value)}</small></span><i aria-hidden="true">⌄</i></button></div></label>`;
      }
      if (key === 'entity' && name === 'objectives') {
        const entityInfo = ENTITY_CATALOG.find(entity => entity.id === value);
        const entityIcon = entityInfo?.icon || (value && !String(value).startsWith('#') && String(value).startsWith('minecraft:') ? `${String(value)}_spawn_egg` : 'minecraft:barrier');
        return `<label class="field ${wide}"><span>${label}</span><div class="repeat-item-id-control entity-id-control"><img class="entity-preview" src="${safe(localSprite(entityIcon))}" alt="" /><input data-field="${key}" data-list="${name}" data-index="${index}" type="text" value="${safe(value)}" placeholder="minecraft:zombie" /><button type="button" class="button small" data-pick-entity="${index}">Browse</button></div></label>`;
      }
      if (key === 'item') {
        const encodedItem = name === 'rewards' && type === 'questlog:item';
        const enchantmentFields = encodedItem && value === ENCHANTED_BOOK_ITEM_ID ? renderBookEnchantmentFields(item, index) : encodedItem ? `<div class="enchant-fields wide" data-enchanted-fields data-enchant-index="${index}" hidden></div>` : '';
        return `<label class="field ${wide}"><span>${label}</span><div class="repeat-item-id-control"><img class="item-preview" src="${safe(localSprite(value))}" alt="" /><input data-field="${key}" data-list="${name}" data-index="${index}" type="text" value="${safe(value)}" placeholder="${safe(defaultValue)}" /><button type="button" class="button small" data-pick-list="${name}" data-index="${index}">Browse</button></div></label>${enchantmentFields}`;
      }
      const inputType = kind === 'number' ? 'number' : 'text';
      return `<label class="field ${wide}"><span>${label}</span><input data-field="${key}" data-list="${name}" data-index="${index}" type="${inputType}" value="${safe(value)}" placeholder="${safe(defaultValue)}"></label>`;
    }).join('');
    const options = Object.entries(types).map(([value, option]) =>
      `<option value="${value}" ${value === type ? 'selected' : ''}>${option.label}</option>`
    ).join('');
    return `<div class="repeat-item"><div class="repeat-top"><select data-kind="${name}" data-index="${index}">${options}</select><button class="remove-item" data-remove="${name}" data-index="${index}">×</button></div><div class="repeat-fields">${fields}</div></div>`;
  }).join('');
  if (name === 'rewards') bindEnchantmentControls(host);

  $$(`[data-kind="${name}"]`).forEach(select => select.onchange = () => {
    const index = Number(select.dataset.index);
    items[index] = makeDefault(types, select.value);
    renderRepeater(name, items, types);
    changed();
  });
  $$('.dimension-picker-trigger').forEach(trigger => trigger.onclick = () => {
    const picker = trigger.closest('.dimension-picker-control');
    const menu = picker.querySelector('.dimension-menu');
    const opening = menu.hidden;
    $$('.dimension-picker-control.is-open').forEach(openPicker => {
      openPicker.classList.remove('is-open');
      openPicker.querySelector('.dimension-menu').hidden = true;
      openPicker.querySelector('.dimension-picker-trigger').setAttribute('aria-expanded', 'false');
    });
    if (opening) {
      picker.classList.add('is-open');
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
    }
  });
  $$('[data-dimension-choice]').forEach(option => option.onclick = () => {
    const picker = option.closest('.dimension-picker-control');
    const hiddenInput = picker.querySelector('[data-field="dimension"]');
    hiddenInput.value = option.dataset.dimensionChoice;
    picker.querySelector('[data-dimension-preview]').src = option.dataset.dimensionIcon;
    picker.querySelector('.dimension-selected-label').innerHTML = `<b>${safe(option.dataset.dimensionLabel)}</b><small>${safe(option.dataset.dimensionChoice)}</small>`;
    picker.querySelector('.dimension-menu').hidden = true;
    picker.classList.remove('is-open');
    picker.querySelector('.dimension-picker-trigger').setAttribute('aria-expanded', 'false');
    hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  if (!document.documentElement.dataset.dimensionPickerBound) {
    document.addEventListener('click', event => {
      if (event.target.closest('.dimension-picker-control')) return;
      $$('.dimension-picker-control.is-open').forEach(picker => {
        picker.classList.remove('is-open');
        picker.querySelector('.dimension-menu').hidden = true;
        picker.querySelector('.dimension-picker-trigger').setAttribute('aria-expanded', 'false');
      });
    });
    document.documentElement.dataset.dimensionPickerBound = 'true';
  }
  $$(`[data-remove="${name}"]`).forEach(button => button.onclick = () => {
    items.splice(Number(button.dataset.index), 1);
    renderRepeater(name, items, types);
    changed();
  });
  $$(`[data-list="${name}"]`).forEach(input => {
    const update = () => {
      const index = Number(input.dataset.index), key = input.dataset.field;
      if (input.type === 'checkbox') items[index][key] = input.checked;
      else if (input.type === 'number') {
        const number = Number(input.value);
        if (Number.isFinite(number)) items[index][key] = number;
      } else if ((input.tagName === 'SELECT' && input.value === '') || (key === 'nbt' && !input.value.trim())) delete items[index][key];
      else if (key === 'item' && name === 'rewards' && items[index].type === 'questlog:item') setRewardItemId(items[index], input.value.trim());
      else items[index][key] = input.value;

      if (key === 'item') {
        const image = input.parentElement.querySelector('.item-preview');
        if (image) {
          image.onerror = () => { image.style.visibility = 'hidden'; };
          image.onload = () => { image.style.visibility = 'visible'; };
          image.style.visibility = 'visible';
          image.src = localSprite(input.value);
        }
        if (name === 'rewards' && items[index].type === 'questlog:item') syncBookEnchantmentFields(host, items[index], index);
      }
      if (key === 'dimension') {
        const image = input.parentElement.querySelector('[data-dimension-preview]');
        const dimension = DIMENSIONS.find(option => option.id === input.value);
        if (image) image.src = localSprite(dimension?.icon || 'minecraft:barrier');
      }
      changed();
    };
    input.addEventListener(input.type === 'checkbox' || input.tagName === 'SELECT' ? 'change' : 'input', update);
  });
  $$(`[data-pick-list="${name}"]`).forEach(button => button.onclick = () => {
    openItemPicker(button.parentElement.querySelector('[data-list]'));
  });
  $$('[data-pick-entity]').forEach(button => button.onclick = () => {
    const input = button.parentElement.querySelector('[data-list]');
    openEntityPicker(input);
  });
  $$('[data-pick-biome]').forEach(button => button.onclick = () => {
    const input = button.parentElement.querySelector('[data-list="objectives"][data-field="biome"]');
    openBiomePicker(input);
  });
  $$('[data-list="objectives"][data-field="entity"]').forEach(input => {
    const preview = input.parentElement.querySelector('.entity-preview');
    preview.onerror = () => { preview.style.visibility = 'hidden'; };
    preview.onload = () => { preview.style.visibility = 'visible'; };
    input.addEventListener('input', () => {
      const value = input.value.trim();
      preview.style.visibility = value && !value.startsWith('#') ? 'visible' : 'hidden';
      const entityInfo = ENTITY_CATALOG.find(entity => entity.id === value);
      const icon = entityInfo?.icon || (value.startsWith('minecraft:') ? `${value}_spawn_egg` : 'minecraft:barrier');
      preview.src = value && !value.startsWith('#') ? localSprite(icon) : '';
    });
  });
  if (name === 'objectives') {
    $$('[data-or-name]').forEach(input => input.addEventListener('input', () => {
      items[Number(input.dataset.orName)].name = input.value;
      changed();
    }));
    $$('[data-or-field]').forEach(input => {
      const update = () => {
        const parentIndex = Number(input.dataset.orParent), childIndex = Number(input.dataset.orChild), key = input.dataset.orField;
        const child = items[parentIndex].objectives[childIndex];
        if (input.type === 'checkbox') child[key] = input.checked;
        else if (input.type === 'number') child[key] = Number(input.value);
        else if ((input.tagName === 'SELECT' && !input.value) || (key === 'nbt' && !input.value.trim())) delete child[key];
        else child[key] = input.value;
        if (key === 'item' || key === 'entity' || key === 'biome') {
          const preview = input.parentElement.querySelector('img');
          if (preview) {
            const entity = key === 'entity', selected = input.value.trim();
            const info = entity ? ENTITY_CATALOG.find(entry => entry.id === selected) : null;
            const biome = key === 'biome' ? BIOME_CATALOG.find(entry => entry.id === selected) : null;
            const image = selected && !selected.startsWith('#')
              ? key === 'biome' ? biome?.icon || 'minecraft:barrier' : entity ? info?.icon || (selected.startsWith('minecraft:') ? `${selected}_spawn_egg` : 'minecraft:barrier') : selected
              : 'minecraft:barrier';
            preview.style.visibility = selected && !selected.startsWith('#') ? 'visible' : 'hidden';
            preview.onerror = () => { preview.style.visibility = 'hidden'; };
            preview.onload = () => { preview.style.visibility = 'visible'; };
            preview.src = localSprite(image);
            if (key === 'biome') input.parentElement.querySelector('.biome-selected-label').innerHTML = `<b>${safe(biome?.label || 'Unlisted biome')}</b><small>${safe(selected)}</small>`;
          }
        }
        changed();
      };
      input.addEventListener(input.type === 'checkbox' || input.tagName === 'SELECT' ? 'change' : 'input', update);
    });
    $$('[data-or-type]').forEach(select => select.onchange = () => {
      const parentIndex = Number(select.dataset.orType), childIndex = Number(select.dataset.orChild);
      items[parentIndex].objectives[childIndex] = makeDefault(OR_OBJECTIVES, select.value);
      renderRepeater(name, items, types);
      changed();
    });
    $$('[data-pick-or-item]').forEach(button => button.onclick = () => openItemPicker(button.parentElement.querySelector('[data-or-field="item"]')));
    $$('[data-pick-or-entity]').forEach(button => button.onclick = () => openEntityPicker(button.parentElement.querySelector('[data-or-field="entity"]')));
    $$('[data-pick-or-biome]').forEach(button => button.onclick = () => openBiomePicker(button.parentElement.querySelector('[data-or-field="biome"]')));
    $$('[data-add-or]').forEach(button => button.onclick = () => {
      items[Number(button.dataset.addOr)].objectives.push(makeDefault(OR_OBJECTIVES, 'questlog:item_obtain'));
      renderRepeater(name, items, types);
      changed();
    });
    $$('[data-remove-or]').forEach(button => button.onclick = () => {
      items[Number(button.dataset.removeOr)].objectives.splice(Number(button.dataset.orChild), 1);
      renderRepeater(name, items, types);
      changed();
    });
  }
  if (name === 'rewards') bindRandomRewardControls(items);
}

// Render a weighted reward pool and show each entry's share of the total roll weight.
function renderRandomReward(item, index) {
  item.entries ||= [];
  const totalWeight = item.entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.weight) || 0), Math.max(0, Number(item.empty_weight) || 0));
  const entries = item.entries.map((entry, entryIndex) => {
    entry.reward ||= makeDefault(REWARDS, 'questlog:item');
    const config = REWARDS[entry.reward.type] || REWARDS['questlog:custom'];
    const options = Object.entries(REWARDS).filter(([type]) => type !== 'questlog:random').map(([type, option]) =>
      `<option value="${type}" ${type === entry.reward.type ? 'selected' : ''}>${option.label}</option>`
    ).join('');
    const percent = totalWeight ? Math.max(0, Number(entry.weight) || 0) / totalWeight * 100 : 0;
    const fields = config.fields.map(([key, label, defaultValue, kind]) => {
      if (kind === 'checkbox') return `<label class="check-field wide"><input type="checkbox" data-random-field="${key}" data-index="${index}" data-entry="${entryIndex}" ${entry.reward[key] ?? defaultValue ? 'checked' : ''}>${label}</label>`;
      const value = key === 'item' ? rewardItemId(entry.reward[key]) || defaultValue : entry.reward[key] ?? defaultValue;
      if (key === 'item') {
        const enchantmentFields = entry.reward.type === 'questlog:item' && value === ENCHANTED_BOOK_ITEM_ID
          ? renderBookEnchantmentFields(entry.reward, index, entryIndex)
          : entry.reward.type === 'questlog:item' ? `<div class="enchant-fields wide" data-enchanted-fields data-random-enchant-index="${index}" data-random-enchant-entry="${entryIndex}" hidden></div>` : '';
        return `<label class="field wide"><span>${label}</span><div class="repeat-item-id-control"><img class="item-preview" src="${safe(localSprite(value))}" alt="" /><input data-random-field="${key}" data-index="${index}" data-entry="${entryIndex}" type="text" value="${safe(value)}" /><button type="button" class="button small" data-pick-random="${entryIndex}" data-index="${index}">Browse</button></div></label>${enchantmentFields}`;
      }
      const isNumber = kind === 'number';
      return `<label class="field ${key === 'command' || key === 'name' ? 'wide' : ''}"><span>${label}</span><input data-random-field="${key}" data-index="${index}" data-entry="${entryIndex}" type="${isNumber ? 'number' : 'text'}" value="${safe(value)}"></label>`;
    }).join('');
    return `<div class="random-entry"><div class="random-entry-head"><label class="field"><span>Drop weight</span><input type="number" min="0" step="any" data-random-weight data-index="${index}" data-entry="${entryIndex}" value="${safe(entry.weight ?? 1)}"></label><strong class="random-percent" data-random-percent="${entryIndex}">${percent.toFixed(1)}%</strong><button class="remove-item" data-remove-random="${entryIndex}" data-index="${index}" title="Remove reward">×</button></div><div class="chance-track"><i data-chance-bar="${entryIndex}" style="width:${percent}%"></i></div><div class="repeat-top"><select data-random-kind data-index="${index}" data-entry="${entryIndex}">${options}</select></div><div class="repeat-fields">${fields}</div></div>`;
  }).join('');
  const emptyPercent = totalWeight ? Math.max(0, Number(item.empty_weight) || 0) / totalWeight * 100 : 0;
  return `<div class="repeat-item random-pool"><div class="repeat-top"><strong>${REWARDS['questlog:random'].label}</strong><button class="remove-item" data-remove="rewards" data-index="${index}" title="Remove random reward">×</button></div><div class="repeat-fields random-settings"><label class="field"><span>Roll count</span><input type="number" min="1" step="1" data-random-root="roll_count" data-index="${index}" value="${safe(item.roll_count ?? 1)}"></label><label class="field"><span>Empty weight</span><input type="number" min="0" step="any" data-random-root="empty_weight" data-index="${index}" value="${safe(item.empty_weight ?? 0)}"></label></div><div class="random-chance empty-chance"><span>Nothing</span><strong data-empty-percent>${emptyPercent.toFixed(1)}%</strong><div class="chance-track"><i data-empty-bar style="width:${emptyPercent}%"></i></div></div><div class="random-entries">${entries || '<div class="empty-state">No rewards in this pool yet.</div>'}</div><button class="button small add-pool-entry" data-add-random-entry="${index}" type="button">＋ Add pool reward</button></div>`;
}

// Update weighted percentages without rebuilding inputs, so typing stays uninterrupted.
function updateRandomChances(item, host) {
  const total = item.entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.weight) || 0), Math.max(0, Number(item.empty_weight) || 0));
  item.entries.forEach((entry, entryIndex) => {
    const percent = total ? Math.max(0, Number(entry.weight) || 0) / total * 100 : 0;
    const label = host.querySelector(`[data-random-percent="${entryIndex}"]`);
    const bar = host.querySelector(`[data-chance-bar="${entryIndex}"]`);
    if (label) label.textContent = `${percent.toFixed(1)}%`;
    if (bar) bar.style.width = `${percent}%`;
  });
  const empty = total ? Math.max(0, Number(item.empty_weight) || 0) / total * 100 : 0;
  const emptyLabel = host.querySelector('[data-empty-percent]'), emptyBar = host.querySelector('[data-empty-bar]');
  if (emptyLabel) emptyLabel.textContent = `${empty.toFixed(1)}%`;
  if (emptyBar) emptyBar.style.width = `${empty}%`;
}

// Wire nested reward controls for random pools and keep their chances live.
function bindRandomRewardControls(items) {
  $$('[data-add-random-entry]').forEach(button => button.onclick = () => {
    const pool = items[Number(button.dataset.addRandomEntry)];
    pool.entries ||= [];
    pool.entries.push({ weight: 1, reward: makeDefault(REWARDS, 'questlog:item') });
    renderRepeater('rewards', items, REWARDS);
    changed();
  });
  $$('[data-remove-random]').forEach(button => button.onclick = () => {
    items[Number(button.dataset.index)].entries.splice(Number(button.dataset.removeRandom), 1);
    renderRepeater('rewards', items, REWARDS);
    changed();
  });
  $$('[data-random-kind]').forEach(select => select.onchange = () => {
    items[Number(select.dataset.index)].entries[Number(select.dataset.entry)].reward = makeDefault(REWARDS, select.value);
    renderRepeater('rewards', items, REWARDS);
    changed();
  });
  $$('[data-random-root]').forEach(input => input.addEventListener('input', () => {
    const pool = items[Number(input.dataset.index)], number = Number(input.value);
    if (Number.isFinite(number) && number >= 0) pool[input.dataset.randomRoot] = number;
    updateRandomChances(pool, input.closest('.random-pool'));
    changed();
  }));
  $$('[data-random-weight]').forEach(input => input.addEventListener('input', () => {
    const pool = items[Number(input.dataset.index)], entry = pool.entries[Number(input.dataset.entry)], number = Number(input.value);
    if (Number.isFinite(number) && number >= 0) entry.weight = number;
    updateRandomChances(pool, input.closest('.random-pool'));
    changed();
  }));
  $$('[data-random-field]').forEach(input => input.addEventListener(input.type === 'checkbox' ? 'change' : 'input', () => {
    const reward = items[Number(input.dataset.index)].entries[Number(input.dataset.entry)].reward;
    if (input.type === 'checkbox') reward[input.dataset.randomField] = input.checked;
    else if (input.type === 'number') reward[input.dataset.randomField] = Number(input.value);
    else if (input.dataset.randomField === 'item' && reward.type === 'questlog:item') setRewardItemId(reward, input.value.trim());
    else reward[input.dataset.randomField] = input.value;
    if (input.dataset.randomField === 'item') {
      const image = input.parentElement.querySelector('.item-preview');
      if (image) image.src = localSprite(input.value);
      if (reward.type === 'questlog:item') syncBookEnchantmentFields(input.closest('.random-entry'), reward, Number(input.dataset.index), Number(input.dataset.entry));
    }
    changed();
  }));
  $$('[data-pick-random]').forEach(button => button.onclick = () => openItemPicker(button.parentElement.querySelector('[data-random-field="item"]')));
}

// Build a complete default object for a newly selected objective or reward type.
function makeDefault(types, type) {
  if (types === REWARDS && type === 'questlog:random') return { type, roll_count: 1, empty_weight: 0, entries: [{ weight: 1, reward: makeDefault(REWARDS, 'questlog:item') }] };
  if (types === OBJECTIVES && type === 'questlog:or') return { type, name: 'Complete either objective', objectives: [makeDefault(OR_OBJECTIVES, 'questlog:item_obtain'), makeDefault(OR_OBJECTIVES, 'questlog:entity_kill')] };
  const config = types[type], item = { type };
  for (const [key, , value, kind] of config.fields) {
    item[key] = kind === 'checkbox' ? !!value : kind === 'number' ? Number(value) : value;
  }
  return item;
}

// Copy form values to project state and refresh the saved preview after a short pause.
function changed() {
  const quest = current();
  if (!quest) return;
  quest.data.title = $('#title').value;
  quest.data.description = $('#description').value;
  const failedDescription = $('#descriptionFailed').value;
  if (failedDescription.trim()) quest.data.description_failed = failedDescription;
  else delete quest.data.description_failed;
  [['textColorEnabled', 'textColor', 'text_color'], ['titleColorEnabled', 'titleColor', 'title_color'], ['progressTextColorEnabled', 'progressTextColor', 'progress_text_color']].forEach(([toggleId, inputId, key]) => {
    if ($(`#${toggleId}`).checked) quest.data[key] = $(`#${inputId}`).value.toUpperCase();
    else delete quest.data[key];
  });
  [['leftPanelWidth', 'left_panel_width'], ['rightPanelWidth', 'right_panel_width'], ['panelHeight', 'panel_height']].forEach(([inputId, key]) => {
    const value = $(`#${inputId}`).value;
    if (value !== '' && Number.isFinite(Number(value))) quest.data[key] = Number(value);
    else delete quest.data[key];
  });
  const texture = $('#backgroundTexture').value.trim();
  if (texture) {
    const normalizedTexture = texture.startsWith('minecraft:') ? texture : texture.startsWith('textures/') ? `minecraft:${texture}` : `minecraft:textures/block/${texture}`;
    quest.data.background_texture = normalizedTexture;
  } else delete quest.data.background_texture;
  updateBackgroundTexturePreview(quest.data.background_texture || '');
  normalizeQuestIds();
  $('#fileName').value = quest.fileName;
  quest.chapter = $('#chapter').value;
  quest.data.icon = { ...(quest.data.icon || {}), item: $('#icon').value || 'minecraft:book' };
  if ($('#visibility').checked) quest.data.hidden = true;
  else delete quest.data.hidden;
  const hideWhenCompleted = $('#hideWhenCompleted').checked;
  if (hideWhenCompleted) quest.data.hide_when_completed = true;
  else delete quest.data.hide_when_completed;
  syncHideWhenCompletedToggle(hideWhenCompleted);
  debounceSave();
}

// Keep the completion toggle's status text in sync with its checked state.
function syncHideWhenCompletedToggle(enabled) {
  const status = $('#hideWhenCompletedState');
  if (!status) return;
  status.textContent = enabled ? 'HIDES QUEST' : 'STAYS VISIBLE';
  status.classList.toggle('enabled', enabled);
}

// Keep the visibility toggle's label in sync with the quest's hidden state.
function syncQuestVisibilityToggle(hidden) {
  const status = $('#visibilityState');
  if (!status) return;
  status.textContent = hidden ? 'HIDDEN' : 'VISIBLE';
  status.classList.toggle('enabled', hidden);
}

// Show the selected quest JSON and its generated filename.
function renderPreview() {
  const quest = current();
  if (!quest) {
    $('#jsonPreview').textContent = '{}';
    $('#outputName').textContent = 'quest.json';
    return;
  }
  $('#jsonPreview').textContent = JSON.stringify(questOutputData(quest), null, 2);
  $('#outputName').textContent = `${quest.fileName || 'quest'}.json`;
}
