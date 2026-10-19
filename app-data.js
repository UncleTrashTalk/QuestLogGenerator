/*
 * Shared project data and helpers.
 * This file owns the quest schemas, browser storage, ID rules, and default records.
 */
const STORE = 'questlog-studio-v1';

// Objective field definitions drive the objective editor and its graph labels.
const OBJECTIVES = {
  'questlog:stat': { label: 'Track statistic', fields: [['stat', 'Statistic ID', 'minecraft:play_time'], ['required_amount', 'Required amount', 1, 'number'], ['retroactive', 'Track total statistic (retroactive)', true, 'checkbox'], ['name', 'Display name', 'Reach the statistic']] },
  'questlog:block_mine': { label: 'Mine block', fields: [['block', 'Block ID or tag', 'minecraft:stone'], ['required_amount', 'Required amount', 1, 'number'], ['name', 'Display name', 'Mine Stone']] },
  'questlog:block_place': { label: 'Place block', fields: [['block', 'Block ID or tag', 'minecraft:stone'], ['required_amount', 'Required amount', 1, 'number'], ['name', 'Display name', 'Place Stone']] },
  'questlog:entity_breed': { label: 'Breed entity', fields: [['entity', 'Entity ID or tag', 'minecraft:cow'], ['required_amount', 'Required amount', 1, 'number'], ['name', 'Display name', 'Breed Cows']] },
  'questlog:entity_death': { label: 'Die to entity', fields: [['entity', 'Entity ID or tag', 'minecraft:zombie'], ['required_amount', 'Required amount', 1, 'number'], ['name', 'Display name', 'Be defeated by a Zombie']] },
  'questlog:entity_kill': { label: 'Kill entity', fields: [['entity', 'Entity ID or tag', 'minecraft:zombie'], ['required_amount', 'Required amount', 1, 'number'], ['name', 'Display name', 'Kill Zombies']] },
  'questlog:entity_tame': { label: 'Tame entity', fields: [['entity', 'Entity ID or tag', 'minecraft:wolf'], ['required_amount', 'Required amount', 1, 'number'], ['name', 'Display name', 'Tame a Wolf']] },
  'questlog:item_craft': { label: 'Craft item', fields: [['item', 'Item ID or tag', 'minecraft:torch'], ['nbt', 'NBT match (SNBT, optional)', undefined], ['required_amount', 'Required amount', 1, 'number'], ['name', 'Display name', 'Craft 1 Torch']] },
  'questlog:item_drop': { label: 'Drop item', fields: [['item', 'Item ID or tag', 'minecraft:diamond'], ['nbt', 'NBT match (SNBT, optional)', undefined], ['required_amount', 'Required amount', 1, 'number'], ['name', 'Display name', 'Drop a Diamond']] },
  'questlog:item_equip': { label: 'Equip item', fields: [['item', 'Item ID or tag', 'minecraft:iron_helmet'], ['slot', 'Equipment slot (optional)', undefined, 'select', ['', 'Any slot'], ['mainhand', 'Mainhand'], ['offhand', 'Offhand'], ['head', 'Head'], ['chest', 'Chest'], ['legs', 'Legs'], ['feet', 'Feet']], ['nbt', 'NBT match (SNBT, optional)', undefined], ['required_amount', 'Required amount', 1, 'number'], ['name', 'Display name', 'Equip an Iron Helmet']] },
  'questlog:item_obtain': { label: 'Obtain item', fields: [['item', 'Item ID or tag', 'minecraft:diamond'], ['nbt', 'NBT match (SNBT, optional)', undefined], ['required_amount', 'Required amount', 1, 'number'], ['name', 'Display name', 'Obtain 1 Diamond']] }
};

// Build the vanilla mob picker from local spawn egg images included in the item catalog.
const VANILLA_ENTITY_CATALOG = (window.LOCAL_ITEM_CATALOG || [])
  .filter(item => item.id.endsWith('_spawn_egg') && !['minecraft:copper_golem_spawn_egg', 'minecraft:creaking_spawn_egg', 'minecraft:happy_ghast_spawn_egg'].includes(item.id))
  .map(item => ({
    id: item.id.slice('minecraft:'.length, -'_spawn_egg'.length),
    label: item.label.replace(/ Spawn Egg$/, ''),
    icon: item.id,
    category: 'minecraft'
  }));

// Mod entities use their category item icon as a local picker preview.
const MOD_ENTITY_CATALOG = [
  ...[
    ['aerbunny', 'Aerbunny'], ['aerwhale', 'Aerwhale'], ['flying_cow', 'Flying Cow'], ['phyg', 'Phyg'],
    ['sheepuff', 'Sheepuff'], ['whirlwind', 'Whirlwind'], ['valkyrie', 'Valkyrie'], ['aechor_plant', 'Aechor Plant'],
    ['blue_swet', 'Blue Swet'], ['golden_swet', 'Golden Swet'], ['cockatrice', 'Cockatrice'], ['evil_whirlwind', 'Evil Whirlwind'],
    ['zephyr', 'Zephyr'], ['sentry', 'Sentry'], ['mimic', 'Mimic'], ['fire_minion', 'Fire Minion'],
    ['slider', 'Slider'], ['valkyrie_queen', 'Valkyrie Queen'], ['sun_spirit', 'Sun Spirit']
  ].map(([id, label]) => ({ id: `aether:${id}`, label, category: 'aether', icon: 'aether:moa_egg' })),
  ...[
    ['firefly', 'Firefly'], ['flying_pig', 'Flying Pig'], ['hydrogen_jellyfish', 'Hydrogen Jellyfish'],
    ['jungle_skeleton', 'Jungle Skeleton'], ['skull', 'Skull'], ['naga', 'Naga']
  ].map(([id, label]) => ({ id: `betternether:${id}`, label, category: 'betternether', icon: 'betternether:netherrack_stalactite' })),
  ...[
    ['eel', 'Eel'], ['tortured_soul', 'Tortured Soul'], ['abyssal_scyphoid', 'Abyssal Scyphoid'],
    ['maw', 'Maw'], ['scuttler', 'Scuttler'], ['shellback', 'Shellback'], ['golden_moth', 'Golden Moth']
  ].map(([id, label]) => ({ id: `aquamirae:${id}`, label, category: 'aquamirae', icon: 'aquamirae:salvager_helmet' }))
];
const ENTITY_CATALOG = [...VANILLA_ENTITY_CATALOG, ...MOD_ENTITY_CATALOG];
const ENTITY_CATEGORIES = [
  { id: 'minecraft', label: 'Minecraft', icon: 'minecraft:grass_block' },
  { id: 'aquamirae', label: 'Aquamirae', icon: 'aquamirae:rune_of_the_storm' },
  { id: 'betternether', label: 'Better Nether', icon: 'betternether:nether_ruby' },
  { id: 'aether', label: 'Aether', icon: 'aether:ambrosium_shard' }
];

// Supported visit-dimension objectives and their local visual icons.
const DIMENSIONS = [
  { id: 'minecraft:overworld', label: 'Overworld', icon: 'minecraft:grass_block' },
  { id: 'minecraft:the_nether', label: 'Nether', icon: 'minecraft:netherrack' },
  { id: 'minecraft:the_end', label: 'The End', icon: 'minecraft:end_stone' },
  { id: 'aether:the_aether', label: 'Aether', icon: 'minecraft:glowstone' },
  { id: 'cobblesafari:dungeon_distortion', label: 'Distortion World', icon: 'cobblesafari:balm_distortion' },
  { id: 'cobblesafari:domedimension', label: 'Safari Dimension', icon: 'cobblemon:safari_ball' },
  { id: 'cobblesafari:dungeon_underground', label: 'Sinnoh Underground', icon: 'cobblesafari:underground_flag_bronze' }
];

// Reward field definitions use the same format as objective definitions.
const REWARDS = {
  'questlog:item': { label: 'Give item', fields: [['item', 'Item ID', 'minecraft:diamond'], ['count', 'Count', 1, 'number'], ['auto_claim', 'Auto claim', true, 'checkbox']] },
  'questlog:command': { label: 'Run command', fields: [['command', 'Command', '/say Quest complete!'], ['permission_level', 'Permission level', 2, 'number']] },
  'questlog:experience': { label: 'Give experience', fields: [['experience', 'Experience', 500, 'number']] },
  'questlog:loot_table': { label: 'Give loot table', fields: [['loot_table', 'Loot table ID', 'minecraft:chests/simple_dungeon']] },
  'questlog:random': { label: 'Random weighted reward', fields: [] },
  'questlog:custom': { label: 'Custom reward', fields: [['name', 'Name', 'Custom reward']] }
};

// Vanilla Minecraft Java 1.21.1 enchantments available for enchanted book rewards.
const MINECRAFT_ENCHANTMENTS = [
  'aqua_affinity', 'bane_of_arthropods', 'binding_curse', 'blast_protection', 'channeling',
  'density', 'depth_strider', 'efficiency', 'feather_falling', 'fire_aspect', 'fire_protection',
  'flame', 'fortune', 'frost_walker', 'impaling', 'infinity', 'knockback', 'looting',
  'loyalty', 'luck_of_the_sea', 'lure', 'mending', 'multishot', 'piercing', 'power',
  'projectile_protection', 'protection', 'punch', 'quick_charge', 'respiration', 'riptide',
  'sharpness', 'silk_touch', 'smite', 'soul_speed', 'swift_sneak', 'thorns', 'unbreaking',
  'vanishing_curse', 'wind_burst', 'breach', 'sweeping_edge'
].map(id => ({ id: `minecraft:${id}`, label: id.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join(' ') }))
  .sort((left, right) => left.label.localeCompare(right.label));
const ENCHANTED_BOOK_ITEM_ID = 'minecraft:enchanted_book';

// Failure field definitions follow the same pattern as objective and reward fields.
const FAILURES = {
  'questlog:stat': { label: 'Reach a statistic', fields: [['stat', 'Statistic ID', 'minecraft:play_time'], ['required_amount', 'Required amount', 6000, 'number'], ['retroactive', 'Count previous progress', false, 'checkbox'], ['name', 'Display name', "Don't take longer than 5 minutes"]] },
  'questlog:custom': { label: 'Custom failure', fields: [['name', 'Name', 'Custom failure']] }
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
let state = { quests: [], chapters: [], selected: null };
let toastTimer, itemCatalog = [], pickerTarget = null, pickerCategory = 'minecraft', entityPickerTarget = null, entityPickerCategory = 'minecraft';
let graphChapter = localStorage.getItem('qlover-graph-chapter') || '';
let questChapterFilter = 'all';
let showAllQuestsMap = false;

// Small helpers used throughout the editor to create stable IDs and safe markup.
function uid() { return Math.random().toString(36).slice(2, 10); }
function slug(value) { return (value || '').toLowerCase().trim().replace(/[^a-z0-9/_-]+/g, '_').replace(/^_+|_+$/g, '') || 'new_quest'; }
function questId(quest) { return `questlog:${String(quest.fileName || '').replace(/\.json$/i, '').replace(/^\/+|\/+$/g, '')}`; }
function uniqueQuestFileName(base, exceptKey = null) {
  const root = slug(base);
  const used = new Set(state.quests.filter(quest => quest.key !== exceptKey).map(quest => slug(quest.fileName)));
  let candidate = root, suffix = 2;
  while (used.has(candidate)) candidate = `${root}_${suffix++}`;
  return candidate;
}

// Convert a quest title into a cross-platform safe filename and Questlog ID.
function questFileNameFromTitle(title) {
  const value = String(title || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/\s+/g, '_').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/[^a-z0-9_-]/g, '')
    .replace(/_+/g, '_').replace(/^[_-]+|[_-]+$/g, '');
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(value) ? `_${value}` : value;
}

// Regenerate filenames from quest titles and keep dependencies linked after renames.
// When old projects contain duplicate IDs, a dependency is matched to the nearest earlier quest.
function normalizeQuestIds() {
  const originalIds = state.quests.map(questId), groups = new Map();
  originalIds.forEach((id, index) => groups.set(id, [...(groups.get(id) || []), index]));
  const used = new Set();
  let changed = false;
  state.quests.forEach(quest => {
    const base = questFileNameFromTitle(quest.data.title) || slug(quest.fileName) || 'new_quest';
    let name = base, suffix = 2;
    while (used.has(`questlog:${name}`)) name = `${base}_${suffix++}`;
    if (quest.fileName !== name) { quest.fileName = name; changed = true; }
    used.add(questId(quest));
  });
  state.quests.forEach((quest, index) => {
    for (const requirement of quest.data.requirements || []) {
      const candidates = groups.get(requirement.quest);
      if (!candidates?.length) continue;
      const earlier = candidates.filter(candidate => candidate < index && candidate !== index);
      const target = candidates.length > 1 ? (earlier.at(-1) ?? candidates.find(candidate => candidate !== index)) : candidates[0];
      if (target === undefined) continue;
      const nextId = questId(state.quests[target]);
      if (requirement.quest !== nextId) { requirement.quest = nextId; changed = true; }
    }
  });
  return changed;
}

// Keep exports from proceeding until every quest has a player-facing title.
function ensureQuestTitles() {
  const missing = state.quests.find(quest => !String(quest.data.title || '').trim());
  if (!missing) return true;
  state.selected = missing.key;
  renderAll();
  const title = $('#title');
  title.setCustomValidity('Enter a quest title before saving.');
  title.focus();
  title.reportValidity();
  return false;
}

function safe(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

// Fresh records match the fields understood by the editor and Questlog output.
function defaultQuest() {
  return { key: uid(), fileName: 'new_quest', chapter: 'main', data: { title: '', description: '', icon: { item: 'minecraft:book' }, requirements: [], objectives: [], rewards: [] } };
}
function defaultChapter() {
  return { key: uid(), fileName: 'new_chapter', data: { name: 'New Chapter', translatable: false, icon: { item: 'minecraft:book' }, order: 1, default_chapter: false, hidden: false } };
}

// Add the Questlog chapter resource ID to the exported quest JSON.
function questOutputData(quest) {
  const data = { ...quest.data };
  const chapter = quest.chapter || '';
  if (chapter) data.chapter = chapter.includes(':') ? chapter : `questlog:${chapter}`;
  else delete data.chapter;
  return data;
}

// Save the working project in browser storage and keep the save indicator current.
function persist() {
  localStorage.setItem(STORE, JSON.stringify(state));
  $('#saveStatus').textContent = 'Saved locally';
  $('#saveStatus').style.color = '';
}
function debounceSave() {
  $('#saveStatus').textContent = 'Saving…';
  $('#saveStatus').style.color = '#c4ed69';
  clearTimeout(debounceSave.timer);
  debounceSave.timer = setTimeout(() => {
    persist();
    renderSidebar();
    renderGraph();
    renderPreview();
    $('#itemCount').textContent = `${state.quests.length} quests · ${state.chapters.length} chapters`;
    $('#questCount').textContent = state.quests.length;
    const quest = current();
    $('#editorTitle').textContent = quest ? (quest.data.title || 'Untitled quest') : 'Create a quest';
    $('#crumbQuest').textContent = quest ? questId(quest).toUpperCase() : 'NEW QUEST';
  }, 250);
}

// Restore the last project or create a starter chapter and example quest.
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE));
    if (saved && Array.isArray(saved.quests) && Array.isArray(saved.chapters)) state = saved;
  } catch { /* Start with a fresh project if browser storage is empty or invalid. */ }
  if (!state.chapters.length) state.chapters = [{ key: uid(), fileName: 'main', data: { name: 'Main', translatable: false, icon: { item: 'minecraft:grass_block' }, order: 1, default_chapter: true, hidden: false } }];
  if (!state.quests.length) {
    const quest = defaultQuest();
    quest.fileName = 'first_steps';
    quest.chapter = state.chapters[0].fileName;
    quest.data = { title: 'First Steps', description: 'Begin your adventure by gathering a few essentials.', icon: { item: 'minecraft:iron_pickaxe' }, requirements: [], objectives: [{ type: 'questlog:item_obtain', item: 'minecraft:oak_log', required_amount: 8, name: 'Gather 8 Oak Logs' }], rewards: [{ type: 'questlog:item', item: 'minecraft:bread', count: 4, auto_claim: true }] };
    state.quests = [quest];
    state.selected = quest.key;
  }
}

function current() { return state.quests.find(quest => quest.key === state.selected); }
