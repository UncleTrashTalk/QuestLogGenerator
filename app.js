/*
 * Application startup and event wiring.
 * Feature functions live in app-data, app-items, app-editor, app-graph, and app-files.
 */

// Show short status messages after actions such as saving, importing, or deleting.
function notify(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

// Apply a theme and remember the choice for the next visit.
const themeToggle = $('#themeToggle');
function setTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  localStorage.setItem('qlover-theme', dark ? 'dark' : 'light');
  themeToggle.innerHTML = dark
    ? '<span aria-hidden="true">☀</span><span class="theme-toggle-label">Light theme</span>'
    : '<span aria-hidden="true">☾</span><span class="theme-toggle-label">Dark theme</span>';
  themeToggle.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
  themeToggle.title = `Switch to ${dark ? 'light' : 'dark'} theme`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#17231c' : '#8db596');
}
setTheme(localStorage.getItem('qlover-theme') === 'dark' ? 'dark' : 'light');
themeToggle.onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

// Wire up project navigation, chapter selection, and item icon browsing.
$('#newQuest').onclick = () => {
  const quest = defaultQuest();
  quest.fileName = uniqueQuestFileName(quest.fileName);
  state.quests.push(quest);
  state.selected = quest.key;
  persist();
  renderAll();
  $('#title').focus();
};
$('#viewAllQuests').onclick = () => {
  showAllQuestsMap = !showAllQuestsMap;
  renderAll();
};
$('#newChapter').onclick = () => {
  const chapter = defaultChapter();
  state.chapters.push(chapter);
  editChapter(chapter.key);
};
$('#search').oninput = renderSidebar;
$('#allChapters').onclick = () => { questChapterFilter = 'all'; renderSidebar(); };
$('#graphChapter').onchange = () => {
  graphChapter = $('#graphChapter').value;
  localStorage.setItem('qlover-graph-chapter', graphChapter);
  renderGraph();
};
['title', 'description', 'descriptionFailed', 'chapter', 'icon'].forEach(id => $('#'+id).addEventListener('input', changed));
$('#visibility').addEventListener('change', changed);
$('#hideWhenCompleted').addEventListener('change', changed);
['leftPanelWidth', 'rightPanelWidth', 'panelHeight', 'backgroundTexture'].forEach(id => $('#'+id).addEventListener('input', changed));
[['textColorEnabled', 'textColor'], ['titleColorEnabled', 'titleColor'], ['progressTextColorEnabled', 'progressTextColor']].forEach(([toggleId, inputId]) => {
  $(`#${toggleId}`).addEventListener('change', () => { syncOptionalColorControl(toggleId, inputId); changed(); });
  $(`#${inputId}`).addEventListener('input', () => {
    $(`#${toggleId}`).checked = true;
    syncOptionalColorControl(toggleId, inputId);
    changed();
  });
});
$('#icon').addEventListener('input', () => setIconPreview($('#icon').value));
$('#pickIcon').onclick = () => openItemPicker($('#icon'));
$('#closeItemPicker').onclick = () => $('#itemDialog').close();
$('#itemSearch').oninput = renderItemGrid;
$('#closeEntityPicker').onclick = () => $('#entityDialog').close();
$('#entitySearch').oninput = renderEntityGrid;
$('#closeBiomePicker').onclick = () => $('#biomeDialog').close();
$('#biomeSearch').oninput = renderBiomeGrid;
$$('[data-biome-category]').forEach(button => button.onclick = () => {
  biomePickerCategory = button.dataset.biomeCategory;
  $$('[data-biome-category]').forEach(category => category.classList.toggle('active', category === button));
  renderBiomeGrid();
});
$$('[data-entity-category]').forEach(button => button.onclick = () => {
  entityPickerCategory = button.dataset.entityCategory;
  $$('[data-entity-category]').forEach(category => category.classList.toggle('active', category === button));
  renderEntityGrid();
});
$('#pickBackgroundTexture').onclick = () => {
  $('#textureSearch').value = '';
  renderTextureGrid();
  $('#textureDialog').showModal();
};
$('#clearBackgroundTexture').onclick = () => {
  $('#backgroundTexture').value = '';
  updateBackgroundTexturePreview('');
  changed();
};
$('#closeTexturePicker').onclick = () => $('#textureDialog').close();
$('#textureSearch').oninput = renderTextureGrid;
$$('#itemDialog .item-category[data-category]').forEach(button => button.onclick = () => {
  pickerCategory = button.dataset.category;
  $$('#itemDialog .item-category[data-category]').forEach(category => category.classList.toggle('active', category === button));
  renderItemGrid();
});
$('#itemDialog').addEventListener('click', event => {
  if (event.target === $('#itemDialog')) $('#itemDialog').close();
});
$('#entityDialog').addEventListener('click', event => {
  if (event.target === $('#entityDialog')) $('#entityDialog').close();
});
$('#biomeDialog').addEventListener('click', event => {
  if (event.target === $('#biomeDialog')) $('#biomeDialog').close();
});
$('#textureDialog').addEventListener('click', event => {
  if (event.target === $('#textureDialog')) $('#textureDialog').close();
});
$('#chapter').addEventListener('change', changed);

// Add or remove prerequisite, objective, and reward records for the selected quest.
$('#addRequirement').onclick = () => {
  const quest = current();
  if (!quest) return;
  quest.data.requirements = quest.data.requirements || [];
  const prerequisite = state.quests.find(item => item.key !== quest.key);
  quest.data.requirements.push({ type: 'questlog:quest_complete', quest: prerequisite ? questId(prerequisite) : 'questlog:quest_id' });
  renderRequirements(quest);
  changed();
};
$('#addObjective').onclick = () => {
  const quest = current();
  if (!quest) return;
  quest.data.objectives = quest.data.objectives || [];
  quest.data.objectives.push(makeDefault(OBJECTIVES, 'questlog:item_obtain'));
  renderRepeater('objectives', quest.data.objectives, OBJECTIVES);
  changed();
};
$('#addReward').onclick = () => {
  const quest = current();
  if (!quest) return;
  quest.data.rewards = quest.data.rewards || [];
  quest.data.rewards.push(makeDefault(REWARDS, 'questlog:item'));
  renderRepeater('rewards', quest.data.rewards, REWARDS);
  changed();
};
$('#addFailure').onclick = () => {
  const quest = current();
  if (!quest) return;
  quest.data.failures = quest.data.failures || [];
  quest.data.failures.push(makeDefault(FAILURES, 'questlog:stat'));
  renderRepeater('failures', quest.data.failures, FAILURES);
  changed();
};
$('#deleteQuest').onclick = () => {
  const quest = current();
  if (!quest) return;
  const title = quest.data.title || 'Untitled quest';
  const fileName = `${quest.fileName || 'quest'}.json`;
  if (!confirm(`Permanently delete "${title}" (${fileName})?\n\nThis cannot be undone from the editor.`)) return;
  state.quests = state.quests.filter(item => item.key !== quest.key);
  state.selected = state.quests[0]?.key || null;
  persist();
  renderAll();
  notify('Quest deleted');
};

// Copy preview JSON or download the selected quest and full project.
$('#downloadCurrent').onclick = () => {
  const quest = current();
  if (quest) download(`${quest.fileName || 'quest'}.json`, questOutputData(quest));
};
$('#copyJson').onclick = async () => {
  try {
    await navigator.clipboard.writeText($('#jsonPreview').textContent);
    notify('JSON copied');
  } catch {
    notify('Clipboard unavailable; select the preview text');
  }
};
$('#exportAll').onclick = saveProjectFiles;

// Apply valid Advanced JSON as the selected quest's data object.
$('#applyAdvanced').onclick = () => {
  try {
    const parsed = JSON.parse($('#advancedJson').value);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Expected a JSON object');
    const quest = current();
    quest.data = parsed;
    $('#jsonError').textContent = '';
    normalizeQuestIds();
    persist();
    renderAll();
    notify('Quest JSON applied');
  } catch (error) {
    $('#jsonError').textContent = error.message;
  }
};

// Import individual Questlog JSON files or a collection of project files.
$('#importFiles').onchange = async event => {
  for (const file of event.target.files) {
    try {
      const data = JSON.parse(await file.text());
      const baseName = file.name.replace(/\.json$/i, '');
      if (file.webkitRelativePath?.includes('/chapters/')) {
        state.chapters.push({ key: uid(), fileName: baseName, data });
      } else if (data.format === 'questlog-studio-project' && Array.isArray(data.files)) {
        for (const entry of data.files) {
          const name = entry.name.split('/').pop().replace(/\.json$/i, '');
          if (entry.name.includes('/chapters/')) state.chapters.push({ key: uid(), fileName: name, data: entry.data });
          else state.quests.push({ key: uid(), fileName: name, chapter: state.chapters[0]?.fileName || '', data: entry.data });
        }
      } else if (data.name && data.icon && !data.objectives) {
        state.chapters.push({ key: uid(), fileName: baseName, data });
      } else {
        state.quests.push({ key: uid(), fileName: baseName, chapter: state.chapters[0]?.fileName || '', data });
      }
    } catch {
      notify(`Could not import ${file.name}`);
    }
  }
  state.selected = state.quests.at(-1)?.key || null;
  persist();
  renderAll();
  event.target.value = '';
  notify('JSON imported');
};

// Repair imported duplicate IDs after the importer has added its quest records.
$('#importFiles').addEventListener('change', () => {
  if (normalizeQuestIds()) { persist(); renderAll(); }
});

// Clear the browser's required-title message as soon as the user starts typing.
$('#title').addEventListener('input', () => $('#title').setCustomValidity(''));

// Enforce required titles for every export, and base duplicate filenames on their titles.
$('#exportAll').onclick = () => { if (ensureQuestTitles()) saveProjectFiles(); };
$('#downloadCurrent').onclick = () => {
  if (!ensureQuestTitles()) return;
  const quest = current();
  if (quest) download(`${quest.fileName || 'quest'}.json`, questOutputData(quest));
};
$('#duplicateQuest').onclick = () => {
  const quest = current();
  if (!quest) return;
  const copy = JSON.parse(JSON.stringify(quest));
  copy.key = uid();
  copy.data.title = `${quest.data.title || 'Quest'} Copy`;
  copy.fileName = uniqueQuestFileName(questFileNameFromTitle(copy.data.title) || `${quest.fileName}_copy`);
  state.quests.push(copy);
  state.selected = copy.key;
  persist();
  renderAll();
  notify('Quest duplicated');
};

// Restore saved data, normalize generated IDs, and draw the first editor view.
load();
normalizeQuestIds();
persist();
renderAll();
