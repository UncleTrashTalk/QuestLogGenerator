/*
 * Cobblemon pack intake.
 * Reads the JAR ZIP directory locally and lists Pokémon texture files without
 * extracting or uploading the archive.
 */
const POKEMON_TEXTURE_PREFIX = 'assets/cobblemon/textures/pokemon/';
const ZIP_END_SIGNATURE = 0x06054b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_END_SIGNATURE = 0x06064b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_SIGNATURE = 0x04034b50;
let activePackFile = null;
let activePackEntries = new Map();
let packSelectionVersion = 0;
let activePackView = 'pokemon';
let activePackSpawnGroups = null;
let moveCatalogPromise = null;
const MOVE_TYPE_COLORS = { normal:'#a8a77a', fire:'#ee8130', water:'#6390f0', electric:'#f7d02c', grass:'#7ac74c', ice:'#96d9d6', fighting:'#c22e28', poison:'#a33ea1', ground:'#e2bf65', flying:'#a98ff3', psychic:'#f95587', bug:'#a6b91a', rock:'#b6a136', ghost:'#735797', dragon:'#6f35fc', dark:'#705746', steel:'#b7b7ce', fairy:'#d685ad' };
const COBBLEMON_BUILTIN_SPAWN_PRESETS = `ancient_city derelict desert_pyramid end_city flowers foliage freshwater gemstones illager_structures jungle_pyramid lava_surface mansion natural nether_fossil nether_structures ocean_monument ocean_ruins pillager_outpost redstone river ruined_portal shipwreck stronghold trail_ruins treetop underlava underwater urban village water_surface wild woodland_mansion`.split(' ');
const COBBLEMON_BIOME_TAGS = new Set(`apricorns_dense apricorns_normal apricorns_sparse archipelago archipelago_anti autumn bergmite_hisuibiome bergmite_kalosbiome continental continental_anti cubone_alolabiome cubone_kantobiome dartrix_alolabiome dartrix_hisuibiome dense dewott_hisuibiome dewott_unovabiome elegant elegant_anti exeggcute_alolabiome exeggcute_kantobiome fancy forsaken garden garden_anti goomy_hisuibiome goomy_kalosbiome high_plains icy_snow icy_snow_anti inferno is_arid is_badlands is_bamboo is_basalt is_beach is_cave is_cherry_blossom is_coast is_cold is_cold_and_temperate_ocean is_cold_ocean is_crimson is_deep_dark is_deep_ocean is_desert is_dripstone is_end is_fiery is_floral is_forest is_freezing is_freshwater is_frozen is_frozen_ocean is_fungus is_glacial is_grassland is_highlands is_hills is_icy is_island is_jungle is_lukewarm_and_temperate_ocean is_lukewarm_ocean is_lush is_magical is_mars is_mercury is_mirage_island is_moon is_mountain is_mushroom is_ocean is_overgrowth is_overworld is_peak is_plains is_plateau is_quartz is_river is_sandy is_savanna is_shrubland is_sky is_snowy is_snowy_flat is_snowy_forest is_snowy_taiga is_soul_fire is_soul_sand is_space is_spooky is_stony_beach is_swamp is_taiga is_temperate is_temperate_ocean is_thermal is_toxic is_tropical_island is_tundra is_venus is_volcanic is_warm_ocean is_warped jungle jungle_anti koffing_galarbiome koffing_kantobiome marine marine_anti meadow meadow_anti mimejr_galarbiome mimejr_sinnohbiome monsoon monsoon_anti ocean ocean_anti ore_dawn_stone_normal ore_dawn_stone_rare ore_dusk_stone_normal ore_dusk_stone_rare ore_fire_stone_nether ore_fire_stone_normal ore_fire_stone_rare ore_ice_stone_normal ore_ice_stone_rare ore_leaf_stone_normal ore_leaf_stone_rare ore_moon_stone_dripstone ore_moon_stone_normal ore_moon_stone_rare ore_shiny_stone_normal ore_shiny_stone_rare ore_sun_stone_normal ore_sun_stone_rare ore_thunder_stone_normal ore_thunder_stone_rare ore_water_stone_normal ore_water_stone_rare petilil_hisuibiome petilil_unovabiome pikachu_alolabiome pikachu_kantobiome polar quilava_hisuibiome quilava_johtobiome revival_herbs river river_anti rufflet_hisuibiome rufflet_unovabiome saccharine_tree sandstorm sandstorm_anti savanna savanna_anti sparse spring summer sun tundra tundra_anti village_plains_pokecenter void winter`.split(/\s+/));

// Pick a recognizable local block sprite for each Cobblemon biome-tag family.
function biomeTagIconItem(tag) {
  if (!String(tag).startsWith('#')) return null;
  const resource = String(tag).slice(1).toLowerCase();
  const [namespace, name] = resource.includes(':') ? resource.split(':', 2) : ['', resource];
  if (namespace !== 'cobblemon' || !COBBLEMON_BIOME_TAGS.has(name)) return 'minecraft:redstone';
  if (/desert|sandy|badlands|sandstorm|arid/.test(name)) return 'minecraft:sand';
  if (/ocean|river|marine|coast|archipelago|island|freshwater/.test(name)) return 'minecraft:prismarine_bricks';
  if (/snow|cold|frozen|freezing|glacial|icy|tundra|polar|winter/.test(name)) return 'minecraft:packed_ice';
  if (/volcan|fiery|inferno|basalt|soul_fire|thermal|crimson|warped|soul_sand/.test(name)) return 'minecraft:basalt';
  if (/cave|dripstone|deep_dark|spooky|ore_/.test(name)) return 'minecraft:stone';
  if (/end|void|space|moon|mars|mercury|venus|sky/.test(name)) return 'minecraft:end_stone';
  if (/forest|garden|tree|jungle|taiga|floral|apricorn|bamboo|grassland|plains|savanna|meadow|shrubland|lush|overgrowth|continental|temperate|spring|summer|autumn|dense|sparse|sun|monsoon|mushroom|fancy|elegant|highlands|high_plains|hills|mountain|peak|plateau|meadow|bergmite|cubone|dartrix|dewott|exeggcute|goomy|koffing|mimejr|petilil|pikachu|quilava|rufflet|tundra/.test(name)) return 'minecraft:oak_leaves';
  return 'minecraft:grass_block';
}

function safePokemonName(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

// Load the bundled one-move-per-line catalog and index names without spaces or punctuation.
async function loadMoveCatalog() {
  if (!moveCatalogPromise) moveCatalogPromise = fetch('./CobblemonOriginal/CobblemonStuff/moves.json')
    .then(response => { if (!response.ok) throw new Error('Move catalog could not be loaded.'); return response.text(); })
    .then(text => new Map(text.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line)).map(move => [String(move.name).toLowerCase().replace(/[^a-z0-9]/g, ''), move])));
  return moveCatalogPromise;
}

// Turn species move tokens into compact cards grouped by level, TM, egg, tutor, or other method.
async function renderMoveCards(moves) {
  const catalog = await loadMoveCatalog();
  const groups = new Map();
  for (const token of moves) {
    const [methodRaw, ...nameParts] = String(token).split(':');
    const method = methodRaw.toLowerCase();
    const moveId = nameParts.join(':');
    const groupName = /^\d+$/.test(method) ? `Level ${Number(method)}` : ({ tm:'Technical machine', egg:'Egg moves', tutor:'Move tutor', legacy:'Legacy moves' }[method] || `${method.charAt(0).toUpperCase()}${method.slice(1)} moves`);
    if (!groups.has(groupName)) groups.set(groupName, []);
    const move = catalog.get(moveId.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const name = move?.name || moveId.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ');
    const type = move?.type || 'normal';
    const category = move?.category || 'status';
    const typeColor = MOVE_TYPE_COLORS[type] || MOVE_TYPE_COLORS.normal;
    const image = `./Images/moves/${category}.png`;
    groups.get(groupName).push(`<article class="pack-move-tile" style="--move-type-color:${typeColor}" title="${safePokemonName(name)} · ${safePokemonName(type)} · ${safePokemonName(category)}"><div class="pack-move-title"><b>${safePokemonName(name)}</b><img src="${image}" alt="${safePokemonName(category)}" title="${safePokemonName(category)} move" onerror="this.hidden=true"></div><div class="pack-move-meta"><span>${safePokemonName(type)}</span><span>${safePokemonName(category)}</span></div></article>`);
  }
  return [...groups.entries()].map(([name, cards]) => `<section class="pack-move-method"><h5>${safePokemonName(name)} <small>${cards.length}</small></h5><div class="pack-move-tiles">${cards.join('')}</div></section>`).join('');
}

function toSafeZipNumber(value, description) {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${description} is too large to read in this browser.`);
  return Number(value);
}

// Read only the ZIP central directory so large JARs do not need to load into memory.
async function readJarCentralDirectory(file) {
  if (file.size < 22) throw new Error('This file is too small to be a valid JAR.');
  const tailStart = Math.max(0, file.size - (22 + 0xffff + 20));
  const tailBuffer = await file.slice(tailStart).arrayBuffer();
  const tail = new DataView(tailBuffer);
  let endOffset = -1;
  for (let offset = tail.byteLength - 22; offset >= 0; offset--) {
    if (tail.getUint32(offset, true) === ZIP_END_SIGNATURE) {
      const commentLength = tail.getUint16(offset + 20, true);
      if (offset + 22 + commentLength <= tail.byteLength) {
        endOffset = offset;
        break;
      }
    }
  }
  if (endOffset < 0) throw new Error('Could not find a ZIP directory in this JAR.');

  const endAbsolute = tailStart + endOffset;
  let entryCount = tail.getUint16(endOffset + 10, true);
  let directorySize = tail.getUint32(endOffset + 12, true);
  let directoryOffset = tail.getUint32(endOffset + 16, true);
  const isZip64 = entryCount === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff;

  if (isZip64) {
    if (endAbsolute < 20) throw new Error('The JAR has an incomplete ZIP64 directory.');
    const locatorView = new DataView(await file.slice(endAbsolute - 20, endAbsolute).arrayBuffer());
    if (locatorView.getUint32(0, true) !== ZIP64_LOCATOR_SIGNATURE) throw new Error('The JAR has an invalid ZIP64 directory.');
    const recordOffset = toSafeZipNumber(locatorView.getBigUint64(8, true), 'ZIP64 directory');
    const zip64View = new DataView(await file.slice(recordOffset, recordOffset + 56).arrayBuffer());
    if (zip64View.byteLength < 56 || zip64View.getUint32(0, true) !== ZIP64_END_SIGNATURE) throw new Error('The JAR has an incomplete ZIP64 directory.');
    entryCount = toSafeZipNumber(zip64View.getBigUint64(32, true), 'JAR entry count');
    directorySize = toSafeZipNumber(zip64View.getBigUint64(40, true), 'JAR directory size');
    directoryOffset = toSafeZipNumber(zip64View.getBigUint64(48, true), 'JAR directory offset');
  }

  if (directoryOffset + directorySize > file.size) throw new Error('The JAR directory points outside the file.');
  const directory = await file.slice(directoryOffset, directoryOffset + directorySize).arrayBuffer();
  return { view: new DataView(directory), bytes: new Uint8Array(directory), entryCount };
}

// Read metadata for each JAR entry, including ZIP64 sizes and local offsets.
async function readJarEntries(file) {
  const { view, bytes, entryCount } = await readJarCentralDirectory(file);
  const decoder = new TextDecoder('utf-8');
  const entries = [];
  let offset = 0;

  for (let index = 0; index < entryCount; index++) {
    if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== ZIP_CENTRAL_SIGNATURE) {
      throw new Error('The JAR has a damaged ZIP directory.');
    }
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const nameStart = offset + 46;
    const extraStart = nameStart + nameLength;
    const nextOffset = nameStart + nameLength + extraLength + commentLength;
    if (nextOffset > view.byteLength) throw new Error('The JAR has a truncated ZIP directory.');

    const nameBytes = bytes.subarray(nameStart, nameStart + nameLength);
    const path = decoder.decode(nameBytes).replace(/\\/g, '/');
    const compression = view.getUint16(offset + 10, true);
    let compressedSize = view.getUint32(offset + 20, true);
    let uncompressedSize = view.getUint32(offset + 24, true);
    let localOffset = view.getUint32(offset + 42, true);
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) {
      let extraOffset = extraStart;
      const extraEnd = extraStart + extraLength;
      let foundZip64 = false;
      while (extraOffset + 4 <= extraEnd) {
        const id = view.getUint16(extraOffset, true);
        const length = view.getUint16(extraOffset + 2, true);
        const dataStart = extraOffset + 4;
        const fieldEnd = dataStart + length;
        if (fieldEnd > extraEnd) break;
        if (id === 0x0001) {
          foundZip64 = true;
          let valueOffset = dataStart;
          if (uncompressedSize === 0xffffffff) {
            uncompressedSize = toSafeZipNumber(view.getBigUint64(valueOffset, true), 'JAR entry size');
            valueOffset += 8;
          }
          if (compressedSize === 0xffffffff) {
            compressedSize = toSafeZipNumber(view.getBigUint64(valueOffset, true), 'Compressed JAR entry size');
            valueOffset += 8;
          }
          if (localOffset === 0xffffffff) localOffset = toSafeZipNumber(view.getBigUint64(valueOffset, true), 'JAR entry offset');
          break;
        }
        extraOffset = fieldEnd;
      }
      if (!foundZip64) throw new Error(`Missing ZIP64 details for ${path}.`);
    }
    entries.push({ path, lowerPath: path.toLowerCase(), compression, compressedSize, uncompressedSize, localOffset });
    offset = nextOffset;
  }
  return entries;
}

// Make archive paths readable while retaining folders for variant names.
function pokemonTextureLabel(path) {
  return path.replace(/\.png$/i, '').split('/').map(part =>
    part.replace(/[_-]+/g, ' ').replace(/\b\p{L}/gu, letter => letter.toUpperCase())
  ).join(' / ');
}

// Collapse shiny and emissive texture variants into one sidebar Pokémon row.
function collapsePokemonTextureVariants(paths) {
  const grouped = new Map();
  paths.forEach(path => {
    const stem = path.replace(/\.png$/i, '');
    const baseStem = stem.replace(/(?:_(?:shiny|emissive))+$/i, '');
    const key = baseStem.toLowerCase();
    const priority = stem.toLowerCase() === baseStem.toLowerCase() ? 0 : 1;
    const current = grouped.get(key);
    if (!current || priority < current.priority) grouped.set(key, { path: priority ? `${baseStem}.png` : path, priority });
  });
  return [...grouped.values()].map(entry => entry.path).sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true })
  );
}

// Try the texture's exact filename and known regional-form spellings.
function pokemonSpawnJsonCandidates(texturePath) {
  const stem = texturePath.replace(/\.png$/i, '');
  const basename = stem.split('/').pop();
  const candidates = new Set();
  const add = value => {
    if (!value) return;
    candidates.add(`${value}.json`.toLowerCase());
  };
  const aliases = value => {
    const withoutTextureVariant = value.replace(/_(shiny|emissive)$/i, '');
    const regional = withoutTextureVariant.replace(/_(hisui|galar|alola|paldea)$/i, suffix => ({
      _hisui: '_hisuian', _galar: '_galarian', _alola: '_alolan', _paldea: '_paldean'
    })[suffix.toLowerCase()] || suffix);
    // Some packs use texture suffixes (for example Articuno_galar.png) while
    // spawn files are named after the base species (articuno.json).
    const baseName = value.split('/').pop().split('_', 1)[0];
    return [value, withoutTextureVariant, regional, baseName];
  };
  [...aliases(stem), ...aliases(basename)].forEach(add);
  return [...candidates];
}

// Inflate one JSON file from the selected JAR entry and parse it locally.
async function readJarJson(file, entry) {
  const headerBuffer = await file.slice(entry.localOffset, entry.localOffset + 30).arrayBuffer();
  const header = new DataView(headerBuffer);
  if (header.byteLength < 30 || header.getUint32(0, true) !== ZIP_LOCAL_SIGNATURE) throw new Error('The spawn JSON has an invalid ZIP header.');
  const nameLength = header.getUint16(26, true);
  const extraLength = header.getUint16(28, true);
  const dataStart = entry.localOffset + 30 + nameLength + extraLength;
  const compressed = await file.slice(dataStart, dataStart + entry.compressedSize).arrayBuffer();
  let jsonBytes;
  if (entry.compression === 0) jsonBytes = compressed;
  else if (entry.compression === 8) {
    if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot decompress JAR files.');
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    jsonBytes = await new Response(stream).arrayBuffer();
  } else throw new Error(`The spawn JSON uses unsupported ZIP compression (${entry.compression}).`);
  const jsonText = new TextDecoder('utf-8').decode(jsonBytes).replace(/^\uFEFF/, '');
  return JSON.parse(jsonText);
}

// Format a spawn condition key so it reads well in the details panel.
function formatSpawnKey(key) {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_.]/g, ' ').replace(/\b\p{L}/gu, letter => letter.toUpperCase());
}

function formatSpawnValue(value) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map(formatSpawnValue).join(', ') : 'None';
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// Flatten nested conditions into label/value pairs for the spawn detail cards.
function flattenSpawnConditions(value, prefix = '', rows = []) {
  if (Array.isArray(value)) {
    rows.push([prefix, /(?:^|\.)(?:biome|biomes)$/i.test(prefix) ? value : formatSpawnValue(value)]);
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => flattenSpawnConditions(child, prefix ? `${prefix}.${key}` : key, rows));
  } else if (prefix) rows.push([prefix, formatSpawnValue(value)]);
  return rows;
}

function renderSpawnRows(rows) {
  return rows.filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => {
    const isBiomeList = Array.isArray(value) && /(?:^|\.)(?:biome|biomes)$/i.test(key);
    const content = isBiomeList
      ? `<div class="spawn-biome-tags">${value.map(tag => {
        const tagText = String(tag);
        const itemId = biomeTagIconItem(tagText);
        const imagePath = itemId && typeof localSprite === 'function' ? localSprite(itemId) : '';
        return `<span class="spawn-biome-tag">${imagePath ? `<img src="${safePokemonName(imagePath)}" alt="" title="${safePokemonName(itemId)}" onerror="this.hidden=true">` : ''}<code>${safePokemonName(tagText)}</code></span>`;
      }).join('')}</div>`
      : safePokemonName(formatSpawnValue(value));
    return `<div class="spawn-detail-row"><dt>${safePokemonName(formatSpawnKey(key))}</dt><dd>${content}</dd></div>`;
  }).join('');
}

// Show the selected Pokémon's spawn pools in the right-hand workspace.
// Read all pack spawn entries and group them by their referenced preset names.
async function loadPackSpawnGroups() {
  if (activePackSpawnGroups) return activePackSpawnGroups;
  const groups = new Map(COBBLEMON_BUILTIN_SPAWN_PRESETS.map(name => [name, { name, entries: [], sources: [] }]));
  const spawnFiles = [...activePackEntries.values()].filter(entry => /(?:^|\/)spawn_pool_world\/(?:.*\/)?[^/]+\.json$/.test(entry.lowerPath));
  const presetFiles = [...activePackEntries.values()].filter(entry => /(?:^|\/)spawn_detail_presets\/(?:.*\/)?[^/]+\.json$/.test(entry.lowerPath));
  const records = await Promise.all(spawnFiles.map(async entry => {
    try {
      const json = await readJarJson(activePackFile, entry);
      return { path: entry.path, spawns: Array.isArray(json) ? json : Array.isArray(json?.spawns) ? json.spawns : [] };
    } catch (error) {
      return { path: entry.path, spawns: [], error };
    }
  }));
  records.forEach(record => record.spawns.forEach(spawn => {
    const presetNames = Array.isArray(spawn.presets) ? spawn.presets : typeof spawn.presets === 'string' ? [spawn.presets] : [];
    presetNames.forEach(name => {
      const preset = String(name);
      if (!groups.has(preset)) groups.set(preset, { name: preset, entries: [], sources: [] });
      groups.get(preset).entries.push({ pokemon: String(spawn.pokemon || 'Unknown Pokémon'), weight: Number(spawn.weight) || 0, level: spawn.level, bucket: spawn.bucket, path: record.path });
    });
  }));
  // Add vanilla Cobblemon spawn entries without adding them to the uploaded-pack sidebar.
  (window.COBBLEMON_ORIGINAL_SPAWNS || []).forEach(spawn => {
    const presetNames = Array.isArray(spawn.presets) ? spawn.presets : typeof spawn.presets === 'string' ? [spawn.presets] : [];
    presetNames.forEach(name => {
      const preset = String(name);
      if (!groups.has(preset)) groups.set(preset, { name: preset, entries: [], sources: [] });
      groups.get(preset).entries.push({ pokemon: String(spawn.pokemon || 'Unknown Pokémon'), weight: Number(spawn.weight) || 0, bucket: spawn.bucket || 'common', path: 'CobblemonOriginal' });
    });
  });
  presetFiles.forEach(entry => {
    const match = entry.lowerPath.match(/(?:^|\/)spawn_detail_presets\/(?:.*\/)?([^/]+)\.json$/);
    if (!match) return;
    const name = match[1];
    if (!groups.has(name)) groups.set(name, { name, entries: [], sources: [] });
    groups.get(name).sources.push(entry.path);
  });
  activePackSpawnGroups = [...groups.values()].sort((left, right) => left.name.localeCompare(right.name));
  return activePackSpawnGroups;
}

function titleCasePokemon(value) {
  return value.replace(/[_-]+/g, ' ').replace(/\b\p{L}/gu, character => character.toUpperCase());
}

// Render collapsible preset groups with each Pokémon's share of total spawn weight.
function renderPackSpawnGroups(groups) {
  return `<div class="pack-spawn-preset-list">${groups.map(group => {
    const rarityGroups = new Map();
    group.entries.forEach(entry => {
      const rawBucket = String(entry.bucket || 'common').toLowerCase();
      const bucket = ['ultra-rare', 'rare', 'uncommon', 'common'].includes(rawBucket) ? rawBucket : rawBucket || 'other';
      if (!rarityGroups.has(bucket)) rarityGroups.set(bucket, new Map());
      const totals = rarityGroups.get(bucket);
      totals.set(entry.pokemon, (totals.get(entry.pokemon) || 0) + Math.max(0, entry.weight));
    });
    const rarityOrder = ['ultra-rare', 'rare', 'uncommon', 'common'];
    const orderedRarities = [...rarityGroups.entries()].sort((left, right) => {
      const leftRank = rarityOrder.indexOf(left[0]);
      const rightRank = rarityOrder.indexOf(right[0]);
      return (leftRank < 0 ? 99 : leftRank) - (rightRank < 0 ? 99 : rightRank) || left[0].localeCompare(right[0]);
    });
    const pokemonCount = new Set(group.entries.map(entry => entry.pokemon)).size;
    const content = orderedRarities.length
      ? orderedRarities.map(([rarity, totals]) => {
        const totalWeight = [...totals.values()].reduce((sum, weight) => sum + weight, 0);
        const rows = [...totals.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
        return `<section class="pack-rarity-group"><header><h4>${safePokemonName(titleCasePokemon(rarity))}</h4><small>${rows.length} Pokémon</small></header><div class="pack-preset-pokemon-list">${rows.map(([pokemon, weight]) => {
          const percent = totalWeight ? weight / totalWeight * 100 : 0;
          return `<div class="pack-preset-pokemon"><div class="pack-preset-pokemon-head"><b>${safePokemonName(titleCasePokemon(pokemon))}</b><strong>${percent.toFixed(1)}%</strong></div><div class="chance-track"><i style="width:${percent}%"></i></div></div>`;
        }).join('')}</div></section>`;
      }).join('')
      : '<div class="pack-detail-empty">No Pokémon in this preset in the uploaded pack.</div>';
    const sourceNote = group.sources.length ? `<small class="pack-preset-source">Custom definition: ${group.sources.map(safePokemonName).join(', ')}</small>` : '';
    return `<details class="pack-spawn-preset"><summary><span>${safePokemonName(titleCasePokemon(group.name))}<code>${safePokemonName(group.name)}</code></span><small>${pokemonCount} Pokémon</small></summary>${sourceNote}${content}</details>`;
  }).join('')}</div>`;
}

// Switch the Pack Editor workspace to its preset-based spawn browser.
async function showPackSpawns() {
  activePackView = 'spawns';
  const version = ++packSelectionVersion;
  $('#packSpawnsButton').classList.add('active');
  $('#packSpawnsButton').setAttribute('aria-pressed', 'true');
  $$('.pack-pokemon-row, .pack-base-pokemon-row').forEach(row => row.classList.remove('active'));
  const details = $('#packPokemonDetails');
  details.innerHTML = '<div class="pack-detail-empty">Loading spawn presets and Pokémon weights…</div>';
  try {
    const groups = await loadPackSpawnGroups();
    if (version !== packSelectionVersion) return;
    const sourceNote = activePackFile ? '' : '<div class="pack-detail-empty">Showing original Cobblemon spawns. Upload a pack to include its additional spawn data.</div>';
    details.innerHTML = `<div class="pack-detail-heading"><span class="eyebrow">SPAWN BROWSER</span><h2>Spawn presets</h2><small>Percentages compare spawn weights only with Pokémon in the same rarity bucket.</small></div>${sourceNote}${renderPackSpawnGroups(groups)}`;
  } catch (error) {
    if (version !== packSelectionVersion) return;
    details.innerHTML = `<div class="pack-detail-empty error">${safePokemonName(error instanceof Error ? error.message : 'Could not read spawn data.')}</div>`;
  }
}

async function showPokemonSpawns(texturePath, row) {
  const version = ++packSelectionVersion;
  activePackView = 'pokemon';
  const baseId = row?.dataset.originalPokemon || '';
  const baseSpecies = (window.COBBLEMON_ORIGINAL_SPECIES || []).find(species => species.id === baseId);
  $('#packSpawnsButton').classList.remove('active');
  $('#packSpawnsButton').setAttribute('aria-pressed', 'false');
  $$('.pack-pokemon-row, .pack-base-pokemon-row').forEach(item => item.classList.toggle('active', item === row));
  const details = $('#packPokemonDetails');
  const label = baseSpecies?.name || pokemonTextureLabel(texturePath);
  details.innerHTML = `<div class="pack-detail-heading"><span class="eyebrow">POKÉMON SPAWN DATA</span><h2>${safePokemonName(label)}</h2><small>${safePokemonName(baseSpecies?.path || texturePath)}</small></div><div class="pack-detail-empty">Looking for this Pokémon's species and spawn data…</div>`;
  const candidateNames = pokemonSpawnJsonCandidates(texturePath);
  // Packs may contain multiple datapacks, each with a spawn_pool_world folder.
  const matchingEntries = baseSpecies ? [] : [...activePackEntries.values()].filter(entry => {
    const match = entry.lowerPath.match(/(?:^|\/)spawn_pool_world\/(?:.*\/)?([^/]+\.json)$/);
    return match && candidateNames.includes(match[1]);
  }).sort((left, right) => left.lowerPath.localeCompare(right.lowerPath));
  const additionNames = new Set(candidateNames);
  const additionEntries = baseSpecies ? [] : [...activePackEntries.values()].filter(entry => {
    const match = entry.lowerPath.match(/(?:^|\/)species_additions\/(?:.*\/)?([^/]+\.json)$/);
    return match && additionNames.has(match[1]);
  }).sort((left, right) => left.lowerPath.localeCompare(right.lowerPath));
  const speciesEntries = baseSpecies ? [] : [...activePackEntries.values()].filter(entry => {
    const match = entry.lowerPath.match(/(?:^|\/)species\/(?:.*\/)?([^/]+\.json)$/);
    return match && additionNames.has(match[1]);
  }).sort((left, right) => left.lowerPath.localeCompare(right.lowerPath));
  if (!baseSpecies && !matchingEntries.length && !additionEntries.length && !speciesEntries.length) {
    if (version !== packSelectionVersion) return;
    details.innerHTML = `<div class="pack-detail-heading"><span class="eyebrow">POKÉMON DATA</span><h2>${safePokemonName(label)}</h2><small>${safePokemonName(texturePath)}</small></div><div class="pack-detail-empty">No matching spawn or species-addition JSON was found in this JAR.</div>`;
    return;
  }
  try {
    let records;
    if (baseSpecies) {
      const grouped = new Map();
      (window.COBBLEMON_ORIGINAL_SPAWNS || []).filter(spawn => spawn.speciesId === baseId).forEach(spawn => {
        if (!grouped.has(spawn.source)) grouped.set(spawn.source, []);
        grouped.get(spawn.source).push(spawn);
      });
      records = [...grouped.entries()].map(([path, spawns]) => ({ path, spawns, raw: JSON.stringify({ spawns }, null, 2) }));
    } else {
      records = await Promise.all(matchingEntries.map(async entry => {
        const record = await readJarJson(activePackFile, entry);
        const spawns = Array.isArray(record) ? record : Array.isArray(record?.spawns) ? record.spawns : [];
        return { path: entry.path, spawns, raw: JSON.stringify(record, null, 2) };
      }));
    }
    const additionRecords = await Promise.all(additionEntries.map(async entry => ({
      path: entry.path,
      data: await readJarJson(activePackFile, entry)
    })));
    let speciesRecords;
    if (baseSpecies) {
      const response = await fetch(`./${baseSpecies.path}`);
      if (!response.ok) throw new Error(`Could not load original species data (${response.status}).`);
      speciesRecords = [{ path: baseSpecies.path, data: await response.json() }];
    } else {
      speciesRecords = await Promise.all(speciesEntries.map(async entry => ({
        path: entry.path,
        data: await readJarJson(activePackFile, entry)
      })));
    }
    if (version !== packSelectionVersion) return;
    const spawns = records.flatMap(record => record.spawns.map(spawn => ({ ...spawn, __source: record.path })));
    const heading = `<div class="pack-detail-heading"><span class="eyebrow">POKÉMON DATA</span><h2>${safePokemonName(label)}</h2><small>${speciesRecords.length} species file${speciesRecords.length === 1 ? '' : 's'} · ${records.length} spawn file${records.length === 1 ? '' : 's'}</small></div>`;
    const pokemonFields = speciesRecords.flatMap(record => {
      const baseFields = Object.entries(record.data || {})
        .filter(([key]) => !['moves', 'drops', 'forms'].includes(key.toLowerCase()))
        .flatMap(([key, value]) => flattenSpawnConditions(value, key));
      const forms = Array.isArray(record.data?.forms) ? record.data.forms.map(form => form.name).filter(Boolean) : [];
      if (forms.length) baseFields.push(['Forms', formatSpawnValue(forms)]);
      return baseFields;
    });
    const pokemonContent = pokemonFields.length
      ? `<section class="pack-pokemon-data"><h3>Pokémon data</h3><dl>${renderSpawnRows(pokemonFields)}</dl></section>`
      : '<section class="pack-pokemon-data"><h3>Pokémon data</h3><div class="pack-detail-empty">No generic species data was found.</div></section>';
    const cards = spawns.map((spawn, index) => {
      const facts = [
        ['Level', spawn.level], ['Rarity', spawn.bucket], ['Position', spawn.spawnablePositionType],
        ['Presets', spawn.presets], ['Weight', spawn.weight]
      ].filter(([, value]) => value !== undefined);
      const conditions = flattenSpawnConditions(spawn.condition || {});
      const extraConditions = spawn.weightMultiplier ? flattenSpawnConditions(spawn.weightMultiplier, 'Weight multiplier') : [];
      const conditionContent = [...conditions, ...extraConditions];
      return `<article class="pack-spawn-card"><header><div><h3>${safePokemonName(spawn.pokemon || label)}</h3><small>Spawn entry ${index + 1}${spawn.bucket ? ` · ${safePokemonName(spawn.bucket)}` : ''}</small><small class="spawn-source">${safePokemonName(spawn.__source)}</small></div></header>${facts.length ? `<dl class="spawn-facts">${renderSpawnRows(facts)}</dl>` : ''}<div class="spawn-conditions"><h4>Where and when</h4>${conditionContent.length ? `<dl>${renderSpawnRows(conditionContent)}</dl>` : '<p>No additional conditions are listed.</p>'}</div></article>`;
    }).join('');
    const spawnContent = spawns.length
      ? `<div class="pack-spawn-list">${cards}</div>`
      : '<div class="pack-detail-empty">No matching spawn data was found.</div>';
    const dropRecords = [...additionRecords, ...speciesRecords].filter(record => record.data?.drops && typeof record.data.drops === 'object');
    const dropContent = dropRecords.length
      ? dropRecords.map(record => {
        const drops = record.data.drops;
        const entries = Array.isArray(drops.entries) ? drops.entries : [];
        const rows = entries.map(drop => {
          const itemId = String(drop.item || 'Unknown item');
          const imagePath = typeof localSprite === 'function' ? localSprite(itemId) : '';
          const details = [
            drop.quantityRange ? `Quantity: ${drop.quantityRange}` : null,
            drop.itemCount !== undefined ? `Count: ${drop.itemCount}` : null
          ].filter(Boolean).join(' · ');
          const percent = Number(drop.percentage);
          const hasPercent = drop.percentage !== undefined && Number.isFinite(percent);
          const chance = hasPercent ? `<strong class="pack-drop-percent">${percent.toFixed(1)}%</strong>` : '';
          const chanceBar = hasPercent ? `<div class="chance-track pack-drop-chance"><i style="width:${Math.max(0, Math.min(100, percent))}%"></i></div>` : '';
          return `<div class="pack-drop-entry"><div class="pack-drop-row"><div class="pack-drop-item">${imagePath ? `<img class="pack-drop-icon" src="${safePokemonName(imagePath)}" alt="" title="${safePokemonName(itemId)}" onerror="this.hidden=true">` : ''}<b>${safePokemonName(itemId)}</b></div><div class="pack-drop-meta">${details ? `<span>${safePokemonName(details)}</span>` : ''}${chance}</div></div>${chanceBar}</div>`;
        }).join('');
        return `<article class="pack-drop-card"><header><div><h4>${safePokemonName(record.data.target || label)}</h4><small>${safePokemonName(record.path)}</small></div>${drops.amount !== undefined ? `<span class="pack-drop-amount">${safePokemonName(drops.amount)} roll${Number(drops.amount) === 1 ? '' : 's'}</span>` : ''}</header>${rows || '<p>No individual drops are listed.</p>'}</article>`;
      }).join('')
      : '<div class="pack-detail-empty">No drop data was found in the matching species files.</div>';
    const moveGroups = speciesRecords.flatMap(record => {
      const groups = [];
      if (Array.isArray(record.data?.moves) && record.data.moves.length) groups.push({ name: record.data.name || label, path: record.path, moves: record.data.moves });
      (Array.isArray(record.data?.forms) ? record.data.forms : []).forEach(form => {
        if (Array.isArray(form.moves) && form.moves.length) groups.push({ name: `${record.data.name || label} — ${form.name || 'Form'}`, path: record.path, moves: form.moves });
      });
      return groups;
    });
    const movesContent = moveGroups.length
      ? (await Promise.all(moveGroups.map(async group => `<article class="pack-move-card"><header><h4>${safePokemonName(group.name)}</h4><small>${safePokemonName(group.path)}</small></header>${await renderMoveCards(group.moves)}</article>`))).join('')
      : '<div class="pack-detail-empty">No moves were found in the matching species files.</div>';
    const rawFiles = [
      ...records.map(record => [record.path, record.raw]),
      ...[...speciesRecords, ...additionRecords].map(record => [record.path, JSON.stringify(record.data, null, 2)])
    ];
    const rawJson = rawFiles.length
      ? `<section class="pack-raw-json"><h3>Raw JSON</h3>${rawFiles.map(([path, raw]) => `<details><summary>${safePokemonName(path)}</summary><pre>${safePokemonName(raw)}</pre></details>`).join('')}</section>`
      : '';
    details.innerHTML = `${heading}${pokemonContent}<section class="pack-spawn-section"><h3>Spawn data</h3>${spawnContent}</section><section class="pack-drop-data"><h3>Drop data</h3><div class="pack-drop-list">${dropContent}</div></section><section class="pack-moves-data"><h3>Moves</h3><div class="pack-moves-list">${movesContent}</div></section>${rawJson}`;
  } catch (error) {
    if (version !== packSelectionVersion) return;
    details.innerHTML = `<div class="pack-detail-heading"><span class="eyebrow">POKÉMON SPAWN DATA</span><h2>${safePokemonName(label)}</h2><small>${matchingEntries.map(entry => safePokemonName(entry.path)).join('<br>')}</small></div><div class="pack-detail-empty error">${safePokemonName(error instanceof Error ? error.message : 'Could not read this spawn JSON.')}</div>`;
  }
}

// Draw the discovered Pokémon names in the pack sidebar.
function renderPokemonPackList(paths) {
  const list = $('#packPokemonList');
  $('#packPokemonCount').textContent = paths.length.toLocaleString();
  if (!paths.length) {
    list.innerHTML = '<div class="pack-empty-list">No Pokémon PNGs were found in <code>assets/cobblemon/textures/pokemon</code>.</div>';
    return;
  }
  list.innerHTML = paths.map(path => {
    const label = pokemonTextureLabel(path);
    return `<button class="pack-pokemon-row" type="button" data-pokemon-texture="${safePokemonName(path)}" title="Show spawn data for ${safePokemonName(label)}"><span class="pack-pokemon-mark" aria-hidden="true"><i></i></span><span class="pack-pokemon-copy"><b>${safePokemonName(label)}</b><small>${safePokemonName(path)}</small></span></button>`;
  }).join('');
  $$('.pack-pokemon-row').forEach(row => row.onclick = () => showPokemonSpawns(row.dataset.pokemonTexture, row));
}

// Draw the bundled original Cobblemon species as a separate sidebar list.
function renderBasePokemonList() {
  const list = $('#packBasePokemonList');
  const species = [...(window.COBBLEMON_ORIGINAL_SPECIES || [])].sort((left, right) =>
    (left.nationalPokedexNumber ?? Number.MAX_SAFE_INTEGER) - (right.nationalPokedexNumber ?? Number.MAX_SAFE_INTEGER) || left.name.localeCompare(right.name)
  );
  $('#packBasePokemonCount').textContent = species.length.toLocaleString();
  if (!species.length) {
    list.innerHTML = '<div class="pack-empty-list">Original Cobblemon species data could not be loaded.</div>';
    return;
  }
  list.innerHTML = species.map(entry => `<button class="pack-base-pokemon-row" type="button" data-original-pokemon="${safePokemonName(entry.id)}" title="Show base data for ${safePokemonName(entry.name)}"><span class="pack-pokemon-mark" aria-hidden="true"><i></i></span><span class="pack-pokemon-copy"><b>${safePokemonName(entry.name)}</b><small>${entry.nationalPokedexNumber ? `#${String(entry.nationalPokedexNumber).padStart(4, '0')}` : safePokemonName(entry.id)}</small></span></button>`).join('');
  $$('.pack-base-pokemon-row').forEach(row => row.onclick = () => showPokemonSpawns(`${row.dataset.originalPokemon}.png`, row));
}

// Let either long sidebar list collapse without changing the other section.
function wirePackSidebarCollapse(buttonId, listId, sectionName) {
  const button = $(`#${buttonId}`);
  const list = $(`#${listId}`);
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    button.setAttribute('aria-label', `${expanded ? 'Expand' : 'Collapse'} ${sectionName} list`);
    list.hidden = expanded;
  });
}

wirePackSidebarCollapse('togglePackPokemonList', 'packPokemonList', 'Pokémon in pack');
wirePackSidebarCollapse('togglePackBasePokemonList', 'packBasePokemonList', 'Pokémon in base');
renderBasePokemonList();

$('#packSpawnsButton').addEventListener('click', showPackSpawns);

// Handle a local JAR selection and report what the pack contains.
$('#packJarInput').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  packSelectionVersion++;
  const status = $('#packUploadStatus');
  status.textContent = `Reading ${file.name}…`;
  status.classList.remove('error');
  try {
    if (!file.name.toLowerCase().endsWith('.jar')) throw new Error('Choose a .jar file.');
    const entries = await readJarEntries(file);
    activePackFile = file;
    activePackEntries = new Map(entries.map(entry => [entry.lowerPath, entry]));
    activePackSpawnGroups = null;
    const paths = collapsePokemonTextureVariants(entries
      .filter(entry => entry.lowerPath.startsWith(POKEMON_TEXTURE_PREFIX) && entry.lowerPath.endsWith('.png'))
      .map(entry => entry.path.slice(POKEMON_TEXTURE_PREFIX.length))
    );
    renderPokemonPackList(paths);
    if (activePackView === 'spawns') showPackSpawns();
    else $('#packPokemonDetails').innerHTML = '<div class="pack-detail-empty">Select a Pokémon from the sidebar to view its spawn data.</div>';
    status.textContent = paths.length
      ? `${paths.length.toLocaleString()} Pokémon texture files found in ${file.name}`
      : `No matching textures found in ${file.name}`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Could not read this JAR.';
    status.classList.add('error');
  } finally {
    event.target.value = '';
  }
});
