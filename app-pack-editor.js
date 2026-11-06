/*
 * Cobblemon pack intake.
 * Reads the ZIP directory locally and lists Pokémon texture files without
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
let activePackArchiveEntries = [];
let packSelectionVersion = 0;
let activePackView = 'pokemon';
let activePackSpawnGroups = null;
let activePackPokemonInventory = new Map();
let activePackSpawnPage = 'all';
let packDropLookupPromise = null;
let originalPokemonDropRecordsPromise = null;
let packDropCategory = 'minecraft';
let packDropSelectedItem = '';
const packEditDocuments = new Map();
const dirtyPackFiles = new Set();
const newPackFiles = new Set();
let packEditMode = { spawn: false, drops: false };
let activePackPokemonKey = '';
let activePackPokemonId = '';
let activePackProvenanceHtml = '';
let spawnBiomePickerTarget = null;
let spawnBiomePickerCategory = 'all';
let spawnBiomeOptionsPromise = null;
let packEnglishStringsPromise = null;
let moveCatalogPromise = null;
const MOVE_TYPE_COLORS = { normal:'#a8a77a', fire:'#ee8130', water:'#6390f0', electric:'#f7d02c', grass:'#7ac74c', ice:'#96d9d6', fighting:'#c22e28', poison:'#a33ea1', ground:'#e2bf65', flying:'#a98ff3', psychic:'#f95587', bug:'#a6b91a', rock:'#b6a136', ghost:'#735797', dragon:'#6f35fc', dark:'#705746', steel:'#b7b7ce', fairy:'#d685ad' };
const PACK_DROP_CATEGORIES = [
  { id:'minecraft', label:'Minecraft', icon:'./Images/grass_block.png', catalog:'LOCAL_ITEM_CATALOG' },
  { id:'cobblemon', label:'Cobblemon', icon:'./Images/cobblemonItems/poke_balls/poke_ball.png', catalog:'COBBLEMON_ITEM_CATALOG' },
  { id:'aquamirae', label:'Aquamirae', icon:'./Images/aquamiraeItems/rune_of_the_storm.png', catalog:'AQUAMIRAE_ITEM_CATALOG' },
  { id:'betternether', label:'Better Nether', icon:'./Images/betternetherItems/nether_ruby.png', catalog:'BETTERNETHER_ITEM_CATALOG' },
  { id:'aether', label:'Aether', icon:'./Images/aetherItems/materials/ambrosium_shard.png', catalog:'AETHER_ITEM_CATALOG' },
  { id:'cobblesafari', label:'CobbleSafari', icon:'./Images/cobblesafariItems/ticket_safari.png', catalog:'COBBLESAFARI_ITEM_CATALOG' }
];
const COBBLEMON_BUILTIN_SPAWN_PRESETS = `ancient_city derelict desert_pyramid end_city flowers foliage freshwater gemstones illager_structures jungle_pyramid lava_surface mansion natural nether_fossil nether_structures ocean_monument ocean_ruins pillager_outpost redstone river ruined_portal shipwreck stronghold trail_ruins treetop underlava underwater urban village water_surface wild woodland_mansion`.split(' ');
const AETHER_SPAWN_PRESETS = ['aether:skyroot_forest', 'aether:skyroot_grove', 'aether:skyroot_meadow', 'aether:skyroot_woodland'];
const COBBLEMON_NETHER_SPAWN_TAGS = `is_basalt is_crimson is_desert is_forest is_frozen is_fungus is_mountain is_overgrowth is_quartz is_soul_fire is_soul_sand is_toxic is_warped is_wasteland`.split(' ').map(tag => `#cobblemon:nether/${tag}`);
const COBBLEMON_END_SPAWN_TAGS = ['#cobblemon:is_end'];
const SPAWN_TIME_FILTERS = ['Unfiltered', 'Dawn', 'Day', 'Dusk', 'Night'];
const spawnPresetTimeFilters = new Map();
const COBBLEMON_BIOME_TAGS = new Set(`apricorns_dense apricorns_normal apricorns_sparse archipelago archipelago_anti autumn bergmite_hisuibiome bergmite_kalosbiome continental continental_anti cubone_alolabiome cubone_kantobiome dartrix_alolabiome dartrix_hisuibiome dense dewott_hisuibiome dewott_unovabiome elegant elegant_anti exeggcute_alolabiome exeggcute_kantobiome fancy forsaken garden garden_anti goomy_hisuibiome goomy_kalosbiome high_plains icy_snow icy_snow_anti inferno is_arid is_badlands is_bamboo is_basalt is_beach is_cave is_cherry_blossom is_coast is_cold is_cold_and_temperate_ocean is_cold_ocean is_crimson is_deep_dark is_deep_ocean is_desert is_dripstone is_end is_fiery is_floral is_forest is_freezing is_freshwater is_frozen is_frozen_ocean is_fungus is_glacial is_grassland is_highlands is_hills is_icy is_island is_jungle is_lukewarm_and_temperate_ocean is_lukewarm_ocean is_lush is_magical is_mars is_mercury is_mirage_island is_moon is_mountain is_mushroom is_ocean is_overgrowth is_overworld is_peak is_plains is_plateau is_quartz is_river is_sandy is_savanna is_shrubland is_sky is_snowy is_snowy_flat is_snowy_forest is_snowy_taiga is_soul_fire is_soul_sand is_space is_spooky is_stony_beach is_swamp is_taiga is_temperate is_temperate_ocean is_thermal is_toxic is_tropical_island is_tundra is_venus is_volcanic is_warm_ocean is_warped jungle jungle_anti koffing_galarbiome koffing_kantobiome marine marine_anti meadow meadow_anti mimejr_galarbiome mimejr_sinnohbiome monsoon monsoon_anti ocean ocean_anti ore_dawn_stone_normal ore_dawn_stone_rare ore_dusk_stone_normal ore_dusk_stone_rare ore_fire_stone_nether ore_fire_stone_normal ore_fire_stone_rare ore_ice_stone_normal ore_ice_stone_rare ore_leaf_stone_normal ore_leaf_stone_rare ore_moon_stone_dripstone ore_moon_stone_normal ore_moon_stone_rare ore_shiny_stone_normal ore_shiny_stone_rare ore_sun_stone_normal ore_sun_stone_rare ore_thunder_stone_normal ore_thunder_stone_rare ore_water_stone_normal ore_water_stone_rare petilil_hisuibiome petilil_unovabiome pikachu_alolabiome pikachu_kantobiome polar quilava_hisuibiome quilava_johtobiome revival_herbs river river_anti rufflet_hisuibiome rufflet_unovabiome saccharine_tree sandstorm sandstorm_anti savanna savanna_anti sparse spring summer sun tundra tundra_anti village_plains_pokecenter void winter`.split(/\s+/));

// Pick a recognizable local block sprite for each Cobblemon biome-tag family.
function biomeTagIconItem(tag) {
  if (!String(tag).startsWith('#')) return null;
  const resource = String(tag).slice(1).toLowerCase();
  const [namespace, name] = resource.includes(':') ? resource.split(':', 2) : ['', resource];
  if (namespace === 'cobblemon' && name.startsWith('nether/')) return 'minecraft:netherrack';
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

// Read only the ZIP central directory so large ZIPs do not need to load into memory.
async function readJarCentralDirectory(file) {
  if (file.size < 22) throw new Error('This file is too small to be a valid ZIP.');
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
  if (endOffset < 0) throw new Error('Could not find a ZIP directory in this ZIP.');

  const endAbsolute = tailStart + endOffset;
  let entryCount = tail.getUint16(endOffset + 10, true);
  let directorySize = tail.getUint32(endOffset + 12, true);
  let directoryOffset = tail.getUint32(endOffset + 16, true);
  const isZip64 = entryCount === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff;

  if (isZip64) {
    if (endAbsolute < 20) throw new Error('The ZIP has an incomplete ZIP64 directory.');
    const locatorView = new DataView(await file.slice(endAbsolute - 20, endAbsolute).arrayBuffer());
    if (locatorView.getUint32(0, true) !== ZIP64_LOCATOR_SIGNATURE) throw new Error('The ZIP has an invalid ZIP64 directory.');
    const recordOffset = toSafeZipNumber(locatorView.getBigUint64(8, true), 'ZIP64 directory');
    const zip64View = new DataView(await file.slice(recordOffset, recordOffset + 56).arrayBuffer());
    if (zip64View.byteLength < 56 || zip64View.getUint32(0, true) !== ZIP64_END_SIGNATURE) throw new Error('The ZIP has an incomplete ZIP64 directory.');
    entryCount = toSafeZipNumber(zip64View.getBigUint64(32, true), 'ZIP entry count');
    directorySize = toSafeZipNumber(zip64View.getBigUint64(40, true), 'ZIP directory size');
    directoryOffset = toSafeZipNumber(zip64View.getBigUint64(48, true), 'ZIP directory offset');
  }

  if (directoryOffset + directorySize > file.size) throw new Error('The ZIP directory points outside the file.');
  const directory = await file.slice(directoryOffset, directoryOffset + directorySize).arrayBuffer();
  return { view: new DataView(directory), bytes: new Uint8Array(directory), entryCount };
}

// Read metadata for each ZIP entry, including ZIP64 sizes and local offsets.
async function readJarEntries(file) {
  const { view, bytes, entryCount } = await readJarCentralDirectory(file);
  const decoder = new TextDecoder('utf-8');
  const entries = [];
  let offset = 0;

  for (let index = 0; index < entryCount; index++) {
    if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== ZIP_CENTRAL_SIGNATURE) {
      throw new Error('The ZIP has a damaged ZIP directory.');
    }
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const nameStart = offset + 46;
    const extraStart = nameStart + nameLength;
    const nextOffset = nameStart + nameLength + extraLength + commentLength;
    if (nextOffset > view.byteLength) throw new Error('The ZIP has a truncated ZIP directory.');

    const nameBytes = bytes.subarray(nameStart, nameStart + nameLength);
    const path = decoder.decode(nameBytes).replace(/\\/g, '/');
    const versionNeeded = view.getUint16(offset + 6, true);
    const flags = view.getUint16(offset + 8, true);
    const compression = view.getUint16(offset + 10, true);
    const modifiedTime = view.getUint16(offset + 12, true);
    const modifiedDate = view.getUint16(offset + 14, true);
    const crc32 = view.getUint32(offset + 16, true);
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
            uncompressedSize = toSafeZipNumber(view.getBigUint64(valueOffset, true), 'ZIP entry size');
            valueOffset += 8;
          }
          if (compressedSize === 0xffffffff) {
            compressedSize = toSafeZipNumber(view.getBigUint64(valueOffset, true), 'Compressed ZIP entry size');
            valueOffset += 8;
          }
          if (localOffset === 0xffffffff) localOffset = toSafeZipNumber(view.getBigUint64(valueOffset, true), 'ZIP entry offset');
          break;
        }
        extraOffset = fieldEnd;
      }
      if (!foundZip64) throw new Error(`Missing ZIP64 details for ${path}.`);
    }
    const externalAttributes = view.getUint32(offset + 38, true);
    entries.push({ path, lowerPath: path.toLowerCase(), versionNeeded, flags, compression, modifiedTime, modifiedDate, crc32, compressedSize, uncompressedSize, externalAttributes, localOffset });
    offset = nextOffset;
  }
  return entries;
}

// Calculate the ZIP CRC-32 used for newly written JSON entries.
function calculateZipCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Create a ZIP central-directory record for a copied or newly edited ZIP file.
function createZipCentralRecord(entry, nameBytes, flags, compression, crc, compressedSize, uncompressedSize, localOffset) {
  if (nameBytes.length > 0xffff || localOffset > 0xffffffff || compressedSize > 0xffffffff || uncompressedSize > 0xffffffff) {
    throw new Error('This pack is too large for the browser ZIP writer (ZIP64 output is not supported yet).');
  }
  const record = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(record.buffer);
  view.setUint32(0, ZIP_CENTRAL_SIGNATURE, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, Math.min(entry.versionNeeded || 20, 45), true);
  view.setUint16(8, flags, true);
  view.setUint16(10, compression, true);
  view.setUint16(12, entry.modifiedTime || 0, true);
  view.setUint16(14, entry.modifiedDate || 0, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, compressedSize, true);
  view.setUint32(24, uncompressedSize, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, entry.externalAttributes || 0, true);
  view.setUint32(42, localOffset, true);
  record.set(nameBytes, 46);
  return record;
}

// Rebuild the ZIP while copying untouched compressed payloads and replacing edited JSON files.
async function buildEditedPackJar() {
  if (!activePackFile) throw new Error('Upload a ZIP before downloading the pack.');
  if (!dirtyPackFiles.size) return activePackFile;

  const replacements = new Map();
  const encoder = new TextEncoder();
  for (const lowerPath of dirtyPackFiles) {
    const entry = activePackEntries.get(lowerPath);
    if (!entry) continue;
    const document = packEditDocuments.get(lowerPath);
    if (document === undefined) continue;
    const bytes = encoder.encode(`${JSON.stringify(document, null, 2)}\n`);
    replacements.set(lowerPath, { ...entry, bytes, crc32: calculateZipCrc32(bytes), compressedSize: bytes.length, uncompressedSize: bytes.length, compression: 0, flags: 0x800 });
  }

  const signatureFile = path => /^META-INF\/(?:.*\/)?(?:[^/]+\.(?:SF|RSA|DSA|EC)|SIG-[^/]+)$/i.test(path);
  const originalEntries = activePackArchiveEntries.filter(entry => !replacements.has(entry.lowerPath) && !signatureFile(entry.path));
  const outputEntries = [...originalEntries, ...replacements.values()];
  if (outputEntries.length > 0xffff) throw new Error('This pack contains too many files for the browser ZIP writer (ZIP64 output is not supported yet).');

  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  for (const entry of outputEntries) {
    const nameBytes = encoder.encode(entry.path);
    let payload;
    let compression = entry.compression;
    let flags = ((entry.flags || 0) & 0x6) | 0x800;
    let crc = entry.crc32;
    let compressedSize = entry.compressedSize;
    let uncompressedSize = entry.uncompressedSize;
    if (entry.bytes) {
      payload = entry.bytes;
      compression = 0;
      flags = 0x800;
      crc = entry.crc32;
      compressedSize = payload.length;
      uncompressedSize = payload.length;
    } else {
      if (entry.flags & 1) throw new Error(`The encrypted ZIP entry ${entry.path} cannot be copied.`);
      const localHeader = new DataView(await activePackFile.slice(entry.localOffset, entry.localOffset + 30).arrayBuffer());
      if (localHeader.byteLength < 30 || localHeader.getUint32(0, true) !== ZIP_LOCAL_SIGNATURE) throw new Error(`The ZIP entry ${entry.path} has an invalid local header.`);
      const dataStart = entry.localOffset + 30 + localHeader.getUint16(26, true) + localHeader.getUint16(28, true);
      payload = activePackFile.slice(dataStart, dataStart + entry.compressedSize);
    }
    if (nameBytes.length > 0xffff || compressedSize > 0xffffffff || uncompressedSize > 0xffffffff || localOffset > 0xffffffff) {
      throw new Error('This pack is too large for the browser ZIP writer (ZIP64 output is not supported yet).');
    }
    const localRecord = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localRecord.buffer);
    localView.setUint32(0, ZIP_LOCAL_SIGNATURE, true);
    localView.setUint16(4, Math.min(entry.versionNeeded || 20, 45), true);
    localView.setUint16(6, flags, true);
    localView.setUint16(8, compression, true);
    localView.setUint16(10, entry.modifiedTime || 0, true);
    localView.setUint16(12, entry.modifiedDate || 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, compressedSize, true);
    localView.setUint32(22, uncompressedSize, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localRecord.set(nameBytes, 30);
    localParts.push(localRecord, payload);
    centralParts.push(createZipCentralRecord(entry, nameBytes, flags, compression, crc, compressedSize, uncompressedSize, localOffset));
    localOffset += localRecord.length + compressedSize;
  }

  const centralOffset = localOffset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  if (centralOffset > 0xffffffff || centralSize > 0xffffffff) throw new Error('This pack is too large for the browser ZIP writer (ZIP64 output is not supported yet).');
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, ZIP_END_SIGNATURE, true);
  endView.setUint16(8, outputEntries.length, true);
  endView.setUint16(10, outputEntries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  endView.setUint16(20, 0, true);
  return new Blob([...localParts, ...centralParts, endRecord], { type: 'application/zip' });
}

// Download the currently uploaded ZIP with any edited and new JSON files included.
async function downloadEditedPackJar() {
  const button = $('#downloadPackJar');
  if (!activePackFile || button.disabled) return;
  button.disabled = true;
  const originalLabel = button.innerHTML;
  button.textContent = 'Preparing…';
  try {
    const blob = await buildEditedPackJar();
    const filename = `${activePackFile.name.replace(/\.zip$/i, '')}-edited.zip`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('#packUploadStatus').textContent = `Downloaded ${filename}`;
    $('#packUploadStatus').classList.remove('error');
  } catch (error) {
    $('#packUploadStatus').textContent = error instanceof Error ? error.message : 'Could not build the edited ZIP.';
    $('#packUploadStatus').classList.add('error');
  } finally {
    button.disabled = false;
    button.innerHTML = originalLabel;
  }
}

// Parse every JSON document in the active datapack, using unsaved drafts for edited files.
async function checkPackJsonFiles() {
  const button = $('#checkPackJson');
  if (!activePackFile || button.disabled) return;
  button.disabled = true;
  const originalLabel = button.innerHTML;
  button.textContent = 'Checking...';
  const status = $('#packUploadStatus');
  status.textContent = 'Checking datapack JSON...';
  status.classList.remove('error');
  const isJsonDocument = entry => /\.json$/i.test(entry.path) || /(?:^|\/)pack\.mcmeta$/i.test(entry.path);
  const jsonEntries = [...activePackArchiveEntries.filter(isJsonDocument), ...[...activePackEntries.values()].filter(entry => entry.virtual && isJsonDocument(entry))];
  const errors = [];
  for (const entry of jsonEntries) {
    try {
      if (packEditDocuments.has(entry.lowerPath)) {
        const text = JSON.stringify(packEditDocuments.get(entry.lowerPath));
        if (typeof text !== 'string') throw new Error('File cannot be serialized as JSON.');
        JSON.parse(text);
      } else {
        await readJarJson(activePackFile, entry);
      }
    } catch (error) {
      errors.push(`${entry.path}: ${error instanceof Error ? error.message : 'Invalid JSON.'}`);
    }
  }
  const details = $('#packPokemonDetails');
  if (errors.length) {
    status.textContent = `JSON check found ${errors.length} invalid file${errors.length === 1 ? '' : 's'}.`;
    status.classList.add('error');
    details.innerHTML = `<div class="pack-detail-heading"><span class="eyebrow">DATAPACK VALIDATION</span><h2>JSON check found ${errors.length} problem${errors.length === 1 ? '' : 's'}</h2><small>Review the file paths and parser messages below, then check again after fixing them.</small></div><section class="pack-json-results error"><h3>Files that need attention</h3><ul class="pack-json-error-list">${errors.map(error => {
      const separator = error.indexOf(': ');
      const path = separator < 0 ? error : error.slice(0, separator);
      const message = separator < 0 ? 'Invalid JSON.' : error.slice(separator + 2);
      return `<li><code>${safePokemonName(path)}</code><span>${safePokemonName(message)}</span></li>`;
    }).join('')}</ul><div class="pack-json-fixes"><h3>Things to check</h3><ul><li>Put double quotes around property names and text values.</li><li>Check that each property or array entry is separated by a comma.</li><li>Remove trailing commas and make sure braces and brackets are paired.</li><li>Use the parser message above to locate the exact file and syntax problem.</li></ul></div></section>`;
  } else {
    status.textContent = `JSON check passed - ${jsonEntries.length} file${jsonEntries.length === 1 ? '' : 's'} valid`;
    details.innerHTML = `<div class="pack-detail-heading"><span class="eyebrow">DATAPACK VALIDATION</span><h2>All JSON files are valid</h2><small>Checked ${jsonEntries.length} JSON document${jsonEntries.length === 1 ? '' : 's'}, including pack.mcmeta and unsaved editor changes.</small></div><section class="pack-json-results success"><h3>Syntax check passed</h3><p>Every checked file can be parsed as JSON. This check confirms JSON syntax; it does not verify that each Cobblemon field or value is supported by the mod.</p></section>`;
  }
  details.scrollIntoView({ behavior: 'smooth', block: 'start' });
  button.disabled = false;
  button.innerHTML = originalLabel;
}

// Build a blank 1.21.1 Cobblemon datapack ZIP with its expected folder layout.
function buildEmptyCobblemonPackJar() {
  const encoder = new TextEncoder();
  const files = [
    { path: 'pack.mcmeta', bytes: encoder.encode(`${JSON.stringify({ pack: { pack_format: 48, description: 'Empty Cobblemon datapack template' } }, null, 2)}\n`) },
    ...[
      'data/',
      'data/cobblemon/',
      'data/cobblemon/dex_entries/',
      'data/cobblemon/species/',
      'data/cobblemon/species_additions/',
      'data/cobblemon/spawn_detail_presets/',
      'data/cobblemon/spawn_pool_world/'
    ].map(path => ({ path, bytes: new Uint8Array(), externalAttributes: 0x10 }))
  ];
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const crc = calculateZipCrc32(file.bytes);
    const entry = { ...file, versionNeeded: 20, modifiedTime: 0, modifiedDate: 0, compression: 0, flags: 0x800, crc32: crc, compressedSize: file.bytes.length, uncompressedSize: file.bytes.length };
    const localRecord = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localRecord.buffer);
    localView.setUint32(0, ZIP_LOCAL_SIGNATURE, true);
    localView.setUint16(4, entry.versionNeeded, true);
    localView.setUint16(6, entry.flags, true);
    localView.setUint16(8, entry.compression, true);
    localView.setUint16(10, entry.modifiedTime, true);
    localView.setUint16(12, entry.modifiedDate, true);
    localView.setUint32(14, entry.crc32, true);
    localView.setUint32(18, entry.compressedSize, true);
    localView.setUint32(22, entry.uncompressedSize, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localRecord.set(nameBytes, 30);
    localParts.push(localRecord, file.bytes);
    centralParts.push(createZipCentralRecord(entry, nameBytes, entry.flags, entry.compression, entry.crc32, entry.compressedSize, entry.uncompressedSize, localOffset));
    localOffset += localRecord.length + file.bytes.length;
  }
  const centralOffset = localOffset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, ZIP_END_SIGNATURE, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  return new Blob([...localParts, ...centralParts, endRecord], { type: 'application/zip' });
}

// Load a ZIP into the editor and initialize the same pack state as a file upload.
async function loadPackArchive(file) {
  packSelectionVersion++;
  const entries = await readJarEntries(file);
  activePackFile = file;
  activePackArchiveEntries = entries;
  activePackEntries = new Map(entries.map(entry => [entry.lowerPath, entry]));
  packDropLookupPromise = null;
  $('#downloadPackJar').hidden = false;
  $('#checkPackJson').hidden = false;
  packEnglishStringsPromise = null;
  packEditDocuments.clear();
  dirtyPackFiles.clear();
  newPackFiles.clear();
  activePackSpawnGroups = null;
  updatePackEditStatus();
  await renderPokemonPackList(entries);
  const packPokemonCount = activePackPokemonInventory.size;
  if (activePackView === 'spawns') showPackSpawns();
  else if (activePackView === 'drops') showPackDrops();
  else $('#packPokemonDetails').innerHTML = '<div class="pack-detail-empty">Select a Pokémon from the sidebar to view its spawn data.</div>';
  const status = $('#packUploadStatus');
  status.textContent = packPokemonCount
    ? `${packPokemonCount.toLocaleString()} Pokémon referenced by pack data in ${file.name}`
    : `No Pokémon textures or data references found in ${file.name}`;
  status.classList.remove('error');
}

// Create and load a blank Cobblemon datapack template as the active editor pack.
async function createEmptyCobblemonPack() {
  const button = $('#createEmptyPackJar');
  if (button.disabled) return;
  if (dirtyPackFiles.size && !window.confirm('Creating a new empty pack will discard the edits held in this session. Continue?')) return;
  button.disabled = true;
  const status = $('#packUploadStatus');
  status.textContent = 'Creating empty Cobblemon pack…';
  status.classList.remove('error');
  try {
    const file = new File([buildEmptyCobblemonPackJar()], 'cobblemon-datapack-template.zip', { type: 'application/zip' });
    await loadPackArchive(file);
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Could not create the empty Cobblemon pack.';
    status.classList.add('error');
  } finally {
    button.disabled = false;
  }
}

// Make archive paths readable while retaining folders for variant names.
function pokemonTextureLabel(path) {
  return path.replace(/\.png$/i, '').split('/').map(part =>
    part.replace(/[_-]+/g, ' ').replace(/\b\p{L}/gu, letter => letter.toUpperCase())
  ).join(' / ');
}

// Resolve texture and species IDs to the local Pokémon sprite filenames.
function pokemonSpriteCandidates(...values) {
  const candidates = new Set();
  const add = value => {
    const stem = String(value || '').replace(/\.(?:png|json)$/i, '').split('/').pop().split(':').pop().replace(/\s+[a-z][\w-]*=.*/i, '').toLowerCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
    if (!stem) return;
    candidates.add(stem);
    const regional = stem.replace(/-(hisui|galar|alola|paldea)$/, suffix => ({ '-hisui':'-hisuian', '-galar':'-galarian', '-alola':'-alolan', '-paldea':'-paldean' })[suffix]);
    if (regional !== stem) candidates.add(regional);
    const shorthand = stem.replace(/-(hisuian|galarian|alolan|paldean)$/, suffix => ({ '-hisuian':'-hisui', '-galarian':'-galar', '-alolan':'-alola', '-paldean':'-paldea' })[suffix]);
    if (shorthand !== stem) candidates.add(shorthand);
  };
  values.forEach(value => {
    add(value);
    pokemonSpawnJsonCandidates(String(value || '')).forEach(add);
  });
  return [...candidates];
}

// Render a reusable local Pokémon sprite with the standard Poké Ball fallback.
function renderPokemonSprite(value, className = '') {
  const candidates = pokemonSpriteCandidates(value);
  if (!candidates.length) return '';
  return `<span class="pack-pokemon-avatar ${className}"><span class="pack-pokemon-mark" aria-hidden="true" hidden><i></i></span><img class="pack-pokemon-sprite" src="./Images/sprites/${encodeURIComponent(candidates[0])}.png" data-pokemon-sprite-candidates="${safePokemonName(candidates.join('|'))}" alt="" loading="lazy"></span>`;
}

// Try alternate regional sprite spellings and show the Poké Ball placeholder if none exist.
function bindPokemonSpriteFallbacks(container) {
  container.querySelectorAll('[data-pokemon-sprite-candidates]').forEach(image => {
    const candidates = image.dataset.pokemonSpriteCandidates.split('|').filter(Boolean);
    image.dataset.spriteIndex = '0';
    image.addEventListener('error', () => {
      const nextIndex = Number(image.dataset.spriteIndex || 0) + 1;
      if (nextIndex < candidates.length) {
        image.dataset.spriteIndex = String(nextIndex);
        image.src = `./Images/sprites/${encodeURIComponent(candidates[nextIndex])}.png`;
        return;
      }
      image.hidden = true;
      if (image.previousElementSibling) image.previousElementSibling.hidden = false;
    });
  });
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

// Match a pack texture to a bundled species record so missing pack data can fall back to base data.
function findBaseSpeciesForTexture(texturePath, preferredId = '') {
  const species = window.COBBLEMON_ORIGINAL_SPECIES || [];
  if (preferredId) return species.find(entry => entry.id === preferredId);
  const byFileName = new Map(species.map(entry => [`${entry.id}.json`, entry]));
  return pokemonSpawnJsonCandidates(texturePath).map(fileName => byFileName.get(fileName)).find(Boolean);
}

// Link each species Pokédex translation key to its matching dex_entries record.
async function resolvePokemonPokedexRows(speciesRecords) {
  const rows = [];
  const englishLanguage = await loadPackEnglishStrings();
  const baseEntries = window.COBBLEMON_ORIGINAL_DEX_ENTRIES || [];
  const packEntries = [...activePackEntries.values()].filter(entry => /(?:^|\/)dex_entries\/(?:.*\/)?[^/]+\.json$/.test(entry.lowerPath));
  for (const record of speciesRecords) {
    const values = Array.isArray(record.data?.pokedex) ? record.data.pokedex : record.data?.pokedex ? [record.data.pokedex] : [];
    for (const pokedexValue of values) {
      const value = String(pokedexValue);
      const match = value.match(/^([^.]+)\.species\.(.+)\.desc$/i);
      const expectedId = match ? `${match[1]}:${match[2]}`.toLowerCase() : '';
      const baseEntry = baseEntries.find(entry => String(entry.speciesId || entry.id).toLowerCase() === expectedId);
      const baseResource = baseEntry ? resourceFolderSuffix(baseEntry.path, 'dex_entries') : '';
      const filename = `${expectedId.split(':').pop() || ''}.json`;
      const matchingPackEntries = packEntries.filter(entry => entry.lowerPath.endsWith(`/${filename}`));
      const packEntry = matchingPackEntries.find(entry => resourceFolderSuffix(entry.lowerPath, 'dex_entries') === baseResource) || matchingPackEntries[0];
      let linkedId = baseEntry?.speciesId || baseEntry?.id || '';
      let linkedPath = baseEntry?.path || '';
      if (packEntry) {
        try {
          const dexData = await readEditedPackJson(packEntry);
          linkedId = dexData.speciesId || dexData.id || linkedId;
          linkedPath = packEntry.path;
        } catch { /* Keep the original index link if a pack dex entry is malformed. */ }
      }
      const englishText = englishLanguage.strings[value.toLowerCase()];
      rows.push(['Pokédex text', englishText ? `${value} → ${englishText}` : `${value} (English text not found; ${englishLanguage.filesFound} pack en_us.json file(s) scanned)`]);
      if (linkedId) rows.push(['Dex entry', linkedPath ? `${linkedId} (${linkedPath})` : linkedId]);
    }
  }
  return rows;
}

// Read English Cobblemon translations from every matching language folder in the uploaded ZIP.
async function loadPackEnglishStrings() {
  if (!packEnglishStringsPromise) packEnglishStringsPromise = (async () => {
    const entries = [...activePackEntries.values()]
      .filter(entry => /(?:^|\/)assets\/cobblemon\/lang\/(?:.*\/)?en_us\.json$/i.test(String(entry.path).replace(/\\/g, '/')))
      .sort((left, right) => left.path.localeCompare(right.path));
    const strings = {};
    const addStrings = (value, prefix = '') => {
      if (typeof value === 'string' && prefix) strings[prefix.toLowerCase()] = value;
      else if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Some packs wrap a translation in a small object instead of storing a plain string.
        if (prefix && typeof value.text === 'string') strings[prefix.toLowerCase()] = value.text;
        else if (prefix && typeof value.value === 'string') strings[prefix.toLowerCase()] = value.value;
        Object.entries(value).forEach(([key, child]) => addStrings(child, prefix ? `${prefix}.${key}` : key));
      }
    };
    // Load the bundled base Cobblemon translations first; pack language files override these keys.
    try {
      const response = await fetch('./CobblemonOriginal/en_us.json');
      if (response.ok) addStrings(await response.json());
    } catch { /* Pack translations can still be used if the bundled language file is unavailable. */ }
    let filesRead = 0;
    for (const entry of entries) {
      try { addStrings(await readEditedPackJson(entry)); filesRead += 1; } catch { /* Ignore malformed language files and use remaining entries. */ }
    }
    return { strings, filesFound: entries.length, filesRead };
  })();
  return packEnglishStringsPromise;
}

// Inflate one JSON file from the selected ZIP entry and parse it locally.
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
    if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot decompress ZIP files.');
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    jsonBytes = await new Response(stream).arrayBuffer();
  } else throw new Error(`The spawn JSON uses unsupported ZIP compression (${entry.compression}).`);
  const jsonText = new TextDecoder('utf-8').decode(jsonBytes).replace(/^\uFEFF/, '');
  return JSON.parse(jsonText);
}

// Read the latest in-memory draft when a pack file has already been edited.
async function readEditedPackJson(entry) {
  if (packEditDocuments.has(entry.lowerPath)) return structuredClone(packEditDocuments.get(entry.lowerPath));
  return readJarJson(activePackFile, entry);
}

// Prepare a cloned draft for a source file and keep a small edit count in the toolbar.
function getPackEditDocument(path, originalData) {
  const entry = findPackEntry(path);
  if (!entry) return null;
  if (!packEditDocuments.has(entry.lowerPath)) packEditDocuments.set(entry.lowerPath, structuredClone(originalData));
  return { entry, data: packEditDocuments.get(entry.lowerPath) };
}

function findPackEntry(path) {
  return [...activePackEntries.values()].find(candidate => candidate.path === path || candidate.lowerPath === String(path).replace(/\\/g, '/').toLowerCase());
}

// Choose the most relevant existing datapack root for newly created data files.
function preferredDatapackRootPrefix() {
  const entries = [...activePackEntries.values()];
  const roots = new Set();
  entries.forEach(entry => {
    const match = entry.path.replace(/\\/g, '/').match(/^(.*?)(?:data\/cobblemon\/spawn_pool_world|data\/cobblemon)\//i);
    if (match) roots.add(match[1]);
  });
  const packMetaRoots = new Set(entries
    .filter(entry => /(?:^|\/)pack\.mcmeta$/i.test(entry.path))
    .map(entry => entry.path.replace(/\\/g, '/').replace(/pack\.mcmeta$/i, '')));
  if (!roots.size && packMetaRoots.size === 1) roots.add([...packMetaRoots][0]);
  const scoreRoot = root => entries.filter(entry => {
    const path = entry.path.replace(/\\/g, '/').toLowerCase();
    return path.startsWith(`${root.toLowerCase()}data/cobblemon/`);
  }).length + (packMetaRoots.has(root) ? 100000 : 0);
  return [...roots].sort((left, right) => scoreRoot(right) - scoreRoot(left) || left.length - right.length || left.localeCompare(right))[0] || '';
}

// Create a matching species override in the pack, preserving all original species fields.
async function ensureBaseSpeciesOverrideFile(baseSpecies) {
  const suffix = resourceFolderSuffix(baseSpecies?.path, 'species');
  if (!suffix) throw new Error('Could not determine the base species JSON path.');
  const existing = [...activePackEntries.values()].find(entry =>
    /(?:^|\/)species\/(?:.*\/)?[^/]+\.json$/i.test(entry.path) && resourceFolderSuffix(entry.path, 'species') === suffix
  );
  if (existing) return existing;
  const response = await fetch(`./${baseSpecies.path}`);
  if (!response.ok) throw new Error(`Could not load base species data (${response.status}).`);
  const data = await response.json();
  const path = `${preferredDatapackRootPrefix()}data/cobblemon/species/${suffix}`;
  const entry = { path, lowerPath: path.replace(/\\/g, '/').toLowerCase(), virtual: true };
  activePackEntries.set(entry.lowerPath, entry);
  packEditDocuments.set(entry.lowerPath, structuredClone(data));
  newPackFiles.add(entry.lowerPath);
  dirtyPackFiles.add(entry.lowerPath);
  updatePackEditStatus();
  return entry;
}

// Create a virtual datapack spawn file when the selected Pokémon has no matching spawn source yet.
function ensureSpawnFileForPokemon(pokemonId) {
  const entries = [...activePackEntries.values()];
  const fileStem = String(pokemonId).toLowerCase();
  const existing = entries.find(entry => /(?:^|\/)spawn_pool_world\/(?:.*\/)?[^/]+\.json$/i.test(entry.path) && new RegExp(`/${fileStem}(?:_additional(?:_\\d+)?)?\\.json$`, 'i').test(entry.path));
  if (existing) return existing;
  const rootPrefix = preferredDatapackRootPrefix();
  const reservedNames = new Set([
    ...(window.COBBLEMON_ORIGINAL_SPAWNS || []).map(spawn => String(spawn.source || '').split('/').pop().toLowerCase()),
    ...entries.filter(entry => /(?:^|\/)spawn_pool_world\//i.test(entry.path)).map(entry => entry.path.toLowerCase().split('/').pop())
  ]);
  let fileName = `${fileStem}_additional.json`;
  let suffix = 2;
  while (reservedNames.has(fileName.toLowerCase())) fileName = `${fileStem}_additional_${suffix++}.json`;
  const path = `${rootPrefix}data/cobblemon/spawn_pool_world/${fileName}`;
  const entry = { path, lowerPath: path.replace(/\\/g, '/').toLowerCase(), virtual: true };
  activePackEntries.set(entry.lowerPath, entry);
  packEditDocuments.set(entry.lowerPath, { enabled: true, spawns: [] });
  newPackFiles.add(entry.lowerPath);
  activePackSpawnGroups = null;
  return entry;
}

function hasMatchingSpawnFileForPokemon(pokemonId) {
  const candidates = new Set(pokemonSpawnJsonCandidates(`${pokemonId}.png`));
  const fileStem = String(pokemonId).toLowerCase();
  const originals = (window.COBBLEMON_ORIGINAL_SPAWNS || []).filter(spawn => spawn.speciesId === pokemonId);
  const resources = new Set(originals.map(spawn => resourceFolderSuffix(spawn.source, 'spawn_pool_world')));
  return [...activePackEntries.values()].some(entry => {
    const match = entry.lowerPath.match(/(?:^|\/)spawn_pool_world\/(?:.*\/)?([^/]+\.json)$/);
    const generatedAddition = new RegExp(`/${fileStem}_additional(?:_\\d+)?\\.json$`, 'i').test(entry.lowerPath);
    return match && (generatedAddition || candidates.has(match[1]) || resources.has(resourceFolderSuffix(entry.lowerPath, 'spawn_pool_world')));
  });
}

function updatePackEditStatus() {
  const status = $('#packEditStatus');
  if (status) status.textContent = dirtyPackFiles.size ? `${dirtyPackFiles.size} edited file${dirtyPackFiles.size === 1 ? '' : 's'} held in this session` : 'No edits yet';
  activePackSpawnGroups = null;
  packDropLookupPromise = null;
  spawnBiomeOptionsPromise = null;
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

// Render visual fields for each spawn entry in an editable pack source file.
function renderSpawnFileEditor(record, label, pokemonId) {
  const edit = getPackEditDocument(record.path, record.data);
  if (!edit) return '';
  const spawnList = Array.isArray(edit.data) ? edit.data : Array.isArray(edit.data?.spawns) ? edit.data.spawns : [];
  const enabled = Array.isArray(edit.data) || edit.data.enabled !== false;
  const cards = spawnList.map((spawn, index) => {
    const coreFields = ['id', 'pokemon', 'bucket', 'weight', 'level', 'spawnablePositionType', 'presets', 'type'];
    const extraFields = Object.keys(spawn).filter(key => !coreFields.includes(key) && !['condition', 'anticondition', 'weightMultiplier'].includes(key) && (typeof spawn[key] !== 'object' || Array.isArray(spawn[key])));
    const fields = [...coreFields, ...extraFields].map(key => {
      const value = spawn[key];
      const isNumber = typeof value === 'number';
      const isBoolean = typeof value === 'boolean';
      const isArray = Array.isArray(value) || key === 'presets';
      const fieldValue = Array.isArray(value) ? value.join(', ') : value ?? '';
      const rarityOptions = ['ultra-rare', 'rare', 'uncommon', 'common'];
      const control = key === 'bucket'
        ? `<select class="pack-rarity-select" data-spawn-index="${index}" data-spawn-field="${key}" data-spawn-kind="text" data-pack-file="${safePokemonName(edit.entry.lowerPath)}">${fieldValue && !rarityOptions.includes(String(fieldValue)) ? `<option value="${safePokemonName(fieldValue)}" selected>${safePokemonName(titleCasePokemon(String(fieldValue)))} (current)</option>` : ''}${rarityOptions.map(option => `<option value="${option}" ${String(fieldValue) === option ? 'selected' : ''}>${safePokemonName(titleCasePokemon(option))}</option>`).join('')}</select>`
        : isBoolean
        ? `<input type="checkbox" ${value ? 'checked' : ''} data-spawn-index="${index}" data-spawn-field="${key}" data-spawn-kind="boolean" data-pack-file="${safePokemonName(edit.entry.lowerPath)}">`
        : `<input type="${isNumber ? 'number' : 'text'}" ${isNumber ? 'step="any"' : ''} value="${safePokemonName(fieldValue)}" data-spawn-index="${index}" data-spawn-field="${key}" data-spawn-kind="${isArray ? 'array' : isNumber ? 'number' : 'text'}" data-pack-file="${safePokemonName(edit.entry.lowerPath)}">`;
      return `<label class="pack-edit-field"><span>${safePokemonName(formatSpawnKey(key))}</span>${control}</label>`;
    }).join('');
    const conditions = ['condition', 'anticondition', 'weightMultiplier'].map(group => {
      const value = spawn[group];
      const leaves = flattenEditableSpawnFields(value && typeof value === 'object' ? value : {}, []);
      const rows = leaves.map(leaf => {
        const path = safePokemonName(JSON.stringify([group, ...leaf.path]));
        const isBiomeArray = leaf.type === 'array' && /^(biome|biomes)$/i.test(leaf.path.at(-1));
        const isBiomeValue = leaf.type === 'string' && /^biome$/i.test(leaf.path.at(-1));
        const control = isBiomeArray
          ? renderPackBiomeArray(leaf.value, path, index, edit.entry.lowerPath)
          : isBiomeValue
            ? renderPackBiomePicker(leaf.value, path, index, edit.entry.lowerPath)
            : leaf.type === 'boolean'
          ? `<input type="checkbox" ${leaf.value ? 'checked' : ''} data-spawn-index="${index}" data-condition-path="${path}" data-spawn-kind="boolean" data-pack-file="${safePokemonName(edit.entry.lowerPath)}">`
          : `<input type="${leaf.type === 'number' ? 'number' : 'text'}" ${leaf.type === 'number' ? 'step="any"' : ''} value="${safePokemonName(leaf.value)}" data-spawn-index="${index}" data-condition-path="${path}" data-spawn-kind="${leaf.type}" data-pack-file="${safePokemonName(edit.entry.lowerPath)}">`;
        return `<div class="pack-condition-edit-row"><label class="pack-edit-field"><span>${safePokemonName(leaf.path.join(' · '))}</span>${control}</label><button class="button small danger-quiet" type="button" data-pack-action="remove-condition" data-spawn-index="${index}" data-condition-path="${path}" data-pack-file="${safePokemonName(edit.entry.lowerPath)}" aria-label="Remove condition">×</button></div>`;
      }).join('');
      return `<fieldset class="pack-spawn-condition"><legend>${safePokemonName(formatSpawnKey(group))}</legend>${rows || '<small class="pack-condition-empty">No fields yet</small>'}</fieldset>`;
    }).join('');
    return `<article class="pack-spawn-card pack-spawn-edit-card"><header><div><h3>Spawn ${index + 1}</h3><small class="spawn-source">${safePokemonName(record.path)}</small></div><button class="button small danger-quiet" type="button" data-pack-action="remove-spawn" data-pack-file="${safePokemonName(edit.entry.lowerPath)}" data-spawn-index="${index}">Remove</button></header><div class="pack-spawn-edit-fields">${fields}</div><div class="pack-spawn-edit-conditions">${conditions}</div><div class="pack-spawn-add-condition"><select aria-label="Condition group" data-new-condition-group><option value="condition">Condition</option><option value="anticondition">Anti condition</option><option value="weightMultiplier">Weight multiplier</option></select><input type="text" placeholder="Field, e.g. biomes" data-new-condition-key><input type="text" placeholder="Value (comma separates lists)" data-new-condition-value><button class="button small" type="button" data-pack-action="add-condition" data-pack-file="${safePokemonName(edit.entry.lowerPath)}" data-spawn-index="${index}">+ Add condition</button></div></article>`;
  }).join('');
  return `<div class="pack-spawn-edit-file" data-pack-file="${safePokemonName(edit.entry.lowerPath)}"><div class="pack-spawn-file-settings"><label><span><b>Spawn file enabled</b><small>Turn off to disable every spawn entry in this file.</small></span><input type="checkbox" ${enabled ? 'checked' : ''} data-pack-file="${safePokemonName(edit.entry.lowerPath)}" data-file-field="enabled"></label><code>${safePokemonName(record.path)}</code></div>${cards || '<div class="pack-detail-empty">No spawn entries in this file.</div>'}<button class="button small" type="button" data-pack-action="add-spawn" data-pack-file="${safePokemonName(edit.entry.lowerPath)}" data-pokemon-id="${safePokemonName(pokemonId)}">+ Add spawn card</button></div>`;
}

// Flatten condition objects into editable leaf values while retaining their nested key paths.
function flattenEditableSpawnFields(value, path = [], rows = []) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    Object.entries(value).forEach(([key, child]) => flattenEditableSpawnFields(child, [...path, key], rows));
  } else if (path.length) {
    rows.push({ path, value: Array.isArray(value) ? value.join(', ') : value ?? '', type: Array.isArray(value) ? 'array' : typeof value });
  }
  return rows;
}

// Use the shared biome catalog and local item sprites for spawn biome conditions.
function renderPackBiomePicker(value, conditionPath, spawnIndex, packFile, arrayIndex = null) {
  const icon = biomeTagIconItem(value) || 'minecraft:redstone';
  const label = spawnBiomeTagLabel(value);
  const kind = arrayIndex === null ? 'biome' : 'array-item';
  const arrayAttribute = arrayIndex === null ? '' : `data-condition-array-index="${arrayIndex}"`;
  return `<div class="repeat-item-id-control biome-id-control pack-spawn-biome-picker"><img class="biome-preview" src="${safePokemonName(localSprite(icon))}" alt=""><input type="hidden" value="${safePokemonName(value)}" data-spawn-index="${spawnIndex}" data-condition-path="${conditionPath}" data-spawn-kind="${kind}" ${arrayAttribute} data-pack-file="${safePokemonName(packFile)}"><button type="button" class="biome-picker-trigger" data-pack-spawn-biome-picker aria-haspopup="dialog"><span class="biome-selected-label"><b>${safePokemonName(label)}</b><small>${safePokemonName(value)}</small></span><i aria-hidden="true">?</i></button></div>`;
}

function spawnBiomeTagLabel(tag) {
  const resource = String(tag).replace(/^#/, '');
  const name = resource.includes(':') ? resource.split(':').slice(1).join(':') : resource;
  return name.split(/[\/_-]+/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

// Combine built-in Cobblemon condition tags with custom tags found in the uploaded pack's spawn files.
async function loadSpawnBiomeTagOptions() {
  if (!spawnBiomeOptionsPromise) spawnBiomeOptionsPromise = (async () => {
    const supported = new Set([...COBBLEMON_BIOME_TAGS].map(name => `#cobblemon:${name}`));
    COBBLEMON_NETHER_SPAWN_TAGS.forEach(tag => supported.add(tag));
    const aetherBiomes = new Set(AETHER_SPAWN_PRESETS);
    const custom = new Set();
    const visit = (value, key = '') => {
      if (Array.isArray(value)) {
        if (/^biomes?$/i.test(key)) value.forEach(tag => { if (typeof tag === 'string' && tag.startsWith('#')) custom.add(tag); });
        else value.forEach(child => visit(child));
      } else if (value && typeof value === 'object') Object.entries(value).forEach(([childKey, child]) => visit(child, childKey));
    };
    const entries = [...activePackEntries.values()].filter(entry => /(?:^|\/)spawn_pool_world\/(?:.*\/)?[^/]+\.json$/.test(entry.lowerPath));
    await Promise.all(entries.map(async entry => {
      try { visit(await readEditedPackJson(entry)); } catch { /* Skip malformed spawn files while keeping supported tags available. */ }
    }));
    const all = new Set([...supported, ...aetherBiomes, ...custom]);
    return [...all].map(id => ({
      id,
      category: supported.has(id) ? 'cobblemon' : aetherBiomes.has(id) ? 'aether' : 'custom',
      icon: aetherBiomes.has(id) ? 'aether:ambrosium_shard' : biomeTagIconItem(id) || 'minecraft:redstone',
      label: spawnBiomeTagLabel(id)
    })).sort((left, right) => left.category.localeCompare(right.category) || left.label.localeCompare(right.label) || left.id.localeCompare(right.id));
  })();
  return spawnBiomeOptionsPromise;
}

// Open the spawn-specific picker for Cobblemon biome tags, including pack-defined custom tags.
async function openSpawnBiomePicker(target) {
  spawnBiomePickerTarget = target;
  spawnBiomePickerCategory = 'all';
  $('#spawnBiomeSearch').value = '';
  $$('[data-spawn-biome-category]').forEach(button => button.classList.toggle('active', button.dataset.spawnBiomeCategory === 'all'));
  $('#spawnBiomeStatus').textContent = 'Loading spawn biome tags…';
  $('#spawnBiomeDialog').showModal();
  await renderSpawnBiomeGrid();
}

async function renderSpawnBiomeGrid() {
  const tags = await loadSpawnBiomeTagOptions();
  const query = $('#spawnBiomeSearch').value.trim().toLowerCase();
  const matched = tags.filter(tag => (query || spawnBiomePickerCategory === 'all' || tag.category === spawnBiomePickerCategory) && (!query || tag.id.toLowerCase().includes(query) || tag.label.toLowerCase().includes(query)));
  $('#spawnBiomeStatus').textContent = `${matched.length} biome tags${query ? ' across all categories' : ''}`;
  $('#spawnBiomeGrid').innerHTML = matched.map(tag => `<button class="item-option" type="button" data-spawn-biome-id="${safePokemonName(tag.id)}"><img loading="lazy" src="${safePokemonName(localSprite(tag.icon))}" alt=""><span><b>${safePokemonName(tag.label)}</b><small>${safePokemonName(tag.id)}</small></span></button>`).join('');
  $$('[data-spawn-biome-id]').forEach(button => button.onclick = () => {
    if (!spawnBiomePickerTarget) return;
    const tag = tags.find(item => item.id === button.dataset.spawnBiomeId);
    spawnBiomePickerTarget.value = tag.id;
    const control = spawnBiomePickerTarget.parentElement;
    control.querySelector('.biome-preview').src = localSprite(tag.icon);
    control.querySelector('.biome-selected-label').innerHTML = `<b>${safePokemonName(tag.label)}</b><small>${safePokemonName(tag.id)}</small>`;
    spawnBiomePickerTarget.dispatchEvent(new Event('input', { bubbles: true }));
    $('#spawnBiomeDialog').close();
  });
}

// Render each biome in an array as its own icon picker with an add control.
function renderPackBiomeArray(value, conditionPath, spawnIndex, packFile) {
  const values = String(value || '').split(',').map(item => item.trim()).filter(Boolean);
  const controls = values.map((biome, arrayIndex) => `<div class="pack-spawn-biome-row">${renderPackBiomePicker(biome, conditionPath, spawnIndex, packFile, arrayIndex)}<button class="button small danger-quiet" type="button" data-pack-action="remove-biome-value" data-pack-file="${safePokemonName(packFile)}" data-spawn-index="${spawnIndex}" data-condition-path="${conditionPath}" data-condition-array-index="${arrayIndex}" aria-label="Remove biome">×</button></div>`).join('');
  return `<div class="pack-spawn-biome-list">${controls || '<small class="pack-condition-empty">No biome values yet</small>'}<button class="button small" type="button" data-pack-action="add-biome-value" data-pack-file="${safePokemonName(packFile)}" data-spawn-index="${spawnIndex}" data-condition-path="${conditionPath}">+ Add biome</button></div>`;
}

// Render editable item and quantity fields for drops from files inside the uploaded pack.
function renderDropEditor(record, label, editing = false) {
  const data = record.data || {};
  const edit = editing ? getPackEditDocument(record.path, data) : null;
  const drops = data.drops && typeof data.drops === 'object' ? data.drops : {};
  const entries = Array.isArray(drops.entries) ? drops.entries : [];
  if (!edit) {
    const rows = entries.map(drop => {
      const id = typeof drop.item === 'object' ? drop.item.id : drop.item;
      const image = id && typeof localSprite === 'function' ? localSprite(id) : '';
      const fields = Object.entries(drop).filter(([key]) => key !== 'item').map(([key, value]) => `${formatSpawnKey(key)}: ${formatSpawnValue(value)}`).join(' · ');
      const percent = Number(drop.percentage);
      const hasPercent = drop.percentage !== undefined && Number.isFinite(percent);
      const chance = hasPercent ? `<strong class="pack-drop-percent">${percent.toFixed(1)}%</strong>` : '';
      const bar = hasPercent ? `<div class="chance-track pack-drop-chance"><i style="width:${Math.max(0, Math.min(100, percent))}%"></i></div>` : '';
      return `<div class="pack-drop-entry"><div class="pack-drop-row"><div class="pack-drop-item">${image ? `<img class="pack-drop-icon" src="${safePokemonName(image)}" alt="" onerror="this.hidden=true">` : ''}<b>${safePokemonName(id || 'Unknown item')}</b></div><div class="pack-drop-meta">${fields ? `<span>${safePokemonName(fields)}</span>` : ''}${chance}</div></div>${bar}</div>`;
    }).join('');
    return `<article class="pack-drop-card"><header><div><h4>${safePokemonName(data.target || label)}</h4><small>${safePokemonName(record.path)}</small></div>${drops.amount !== undefined ? `<span class="pack-drop-amount">${safePokemonName(drops.amount)} roll${Number(drops.amount) === 1 ? '' : 's'}</span>` : ''}</header>${rows || '<p>No individual drops are listed.</p>'}</article>`;
  }
  const draftDrops = edit.data.drops && typeof edit.data.drops === 'object' ? edit.data.drops : (edit.data.drops = { amount: 1, entries: [] });
  if (!Array.isArray(draftDrops.entries)) draftDrops.entries = [];
  const itemRows = draftDrops.entries.map((drop, index) => {
    const itemValue = drop.item && typeof drop.item === 'object' ? drop.item.id || '' : drop.item || '';
    const image = itemValue && typeof localSprite === 'function' ? localSprite(itemValue) : '';
    const fieldKeys = [...new Set([...Object.keys(drop).filter(key => key !== 'item'), 'quantityRange', 'percentage', 'itemCount'])];
    const fields = fieldKeys.map(key => {
      const value = drop[key];
      const isNumber = typeof value === 'number' || ['percentage', 'itemCount'].includes(key);
      const isObject = value && typeof value === 'object';
      const input = isObject
        ? `<textarea data-drop-index="${index}" data-drop-field="${safePokemonName(key)}" data-drop-kind="json" data-pack-file="${safePokemonName(edit.entry.lowerPath)}">${safePokemonName(JSON.stringify(value))}</textarea>`
        : `<input type="${isNumber ? 'number' : 'text'}" ${isNumber ? 'step="any"' : ''} value="${safePokemonName(value)}" data-drop-index="${index}" data-drop-field="${safePokemonName(key)}" data-pack-file="${safePokemonName(edit.entry.lowerPath)}">`;
      return `<label class="pack-edit-field"><span>${safePokemonName(formatSpawnKey(key))}${value === undefined ? ' (optional)' : ''}</span>${input}</label>`;
    }).join('');
    return `<div class="pack-drop-edit-entry"><div class="pack-drop-edit-item"><img class="pack-drop-icon" data-drop-preview="${index}" src="${safePokemonName(image)}" alt="" ${image ? '' : 'hidden'}><label class="pack-edit-field pack-edit-item-id"><span>Item</span><input type="text" value="${safePokemonName(itemValue)}" data-drop-index="${index}" data-drop-field="item" data-pack-file="${safePokemonName(edit.entry.lowerPath)}"></label><button class="button small" type="button" data-pack-action="pick-drop-item" data-pack-file="${safePokemonName(edit.entry.lowerPath)}" data-drop-index="${index}">Browse</button><button class="button small danger-quiet" type="button" data-pack-action="remove-drop" data-pack-file="${safePokemonName(edit.entry.lowerPath)}" data-drop-index="${index}" aria-label="Remove drop">×</button></div><div class="pack-drop-edit-fields">${fields}</div></div>`;
  }).join('');
  return `<article class="pack-drop-card pack-drop-edit" data-pack-file="${safePokemonName(edit.entry.lowerPath)}"><header><div><h4>${safePokemonName(edit.data.target || label)}</h4><small>${safePokemonName(record.path)}</small></div><label class="pack-edit-field pack-drop-amount-field"><span>Rolls</span><input type="number" min="1" step="1" value="${safePokemonName(draftDrops.amount ?? 1)}" data-drop-amount data-pack-file="${safePokemonName(edit.entry.lowerPath)}"></label></header><div class="pack-drop-edit-list">${itemRows || '<p>No drops yet.</p>'}</div><button class="button small" type="button" data-pack-action="add-drop" data-pack-file="${safePokemonName(edit.entry.lowerPath)}">+ Add drop</button></article>`;
}

// Show the selected Pokémon's spawn pools in the right-hand workspace.
// Read all pack spawn entries and group them by their referenced preset names.
async function loadPackSpawnGroups() {
  if (activePackSpawnGroups) return activePackSpawnGroups;
  const groups = new Map([...COBBLEMON_BUILTIN_SPAWN_PRESETS, ...AETHER_SPAWN_PRESETS, ...COBBLEMON_NETHER_SPAWN_TAGS, ...COBBLEMON_END_SPAWN_TAGS].map(name => [name, { name, entries: [], sources: [] }]));
  const aetherPresetSet = new Set(AETHER_SPAWN_PRESETS);
  const biomePresetSet = new Set([...COBBLEMON_NETHER_SPAWN_TAGS, ...COBBLEMON_END_SPAWN_TAGS]);
  const collectConditionBiomes = (value, biomes = []) => {
    if (Array.isArray(value)) value.forEach(item => { if (typeof item === 'string') biomes.push(item); else collectConditionBiomes(item, biomes); });
    else if (value && typeof value === 'object') Object.entries(value).forEach(([key, child]) => {
      if (['biome', 'biomes'].includes(key.toLowerCase())) collectConditionBiomes(child, biomes);
      else if (child && typeof child === 'object') collectConditionBiomes(child, biomes);
    });
    return biomes;
  };
  const addSpawnToPresetGroups = (spawn, path, source, defaultBucket = 'common') => {
    const presetNames = Array.isArray(spawn.presets) ? spawn.presets : typeof spawn.presets === 'string' ? [spawn.presets] : [];
    const biomePresets = collectConditionBiomes(spawn.condition).filter(name => aetherPresetSet.has(name) || biomePresetSet.has(name));
    [...new Set([...presetNames.map(String), ...biomePresets])].forEach(preset => {
      if (!groups.has(preset)) groups.set(preset, { name: preset, entries: [], sources: [] });
      groups.get(preset).entries.push({ pokemon: String(spawn.pokemon || 'Unknown Pokémon'), weight: Number(spawn.weight) || 0, bucket: spawn.bucket || defaultBucket, level: spawn.level ?? spawn.levelRange, timeRange: spawn.condition?.timeRange, path, source });
    });
  };
  const spawnFiles = [...activePackEntries.values()].filter(entry => /(?:^|\/)spawn_pool_world\/(?:.*\/)?[^/]+\.json$/.test(entry.lowerPath));
  const presetFiles = [...activePackEntries.values()].filter(entry => /(?:^|\/)spawn_detail_presets\/(?:.*\/)?[^/]+\.json$/.test(entry.lowerPath));
  const packSpawnResources = new Set(spawnFiles.map(entry => resourceFolderSuffix(entry.lowerPath, 'spawn_pool_world')));
  const records = await Promise.all(spawnFiles.map(async entry => {
    try {
      const json = await readEditedPackJson(entry);
      return { path: entry.path, spawns: Array.isArray(json) ? json : Array.isArray(json?.spawns) ? json.spawns : [] };
    } catch (error) {
      return { path: entry.path, spawns: [], error };
    }
  }));
  records.forEach(record => record.spawns.forEach(spawn => addSpawnToPresetGroups(spawn, record.path, 'pack')));
  // Add vanilla Cobblemon spawn entries without adding them to the uploaded-pack sidebar.
  (window.COBBLEMON_ORIGINAL_SPAWNS || []).filter(spawn => !packSpawnResources.has(resourceFolderSuffix(spawn.source, 'spawn_pool_world')))
    .forEach(spawn => addSpawnToPresetGroups(spawn, 'CobblemonOriginal', 'base'));
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

// Load original species drop definitions once, with bounded parallel file reads.
async function loadOriginalPokemonDropRecords() {
  if (!originalPokemonDropRecordsPromise) originalPokemonDropRecordsPromise = (async () => {
    const species = window.COBBLEMON_ORIGINAL_SPECIES || [];
    const records = [];
    for (let start = 0; start < species.length; start += 24) {
      const batch = species.slice(start, start + 24);
      const loaded = await Promise.all(batch.map(async entry => {
        try {
          const response = await fetch(`./${entry.path}`);
          if (!response.ok) return null;
          const data = await response.json();
          return data.drops ? { id: entry.id, name: entry.name, path: entry.path, drops: data.drops, source: 'base' } : null;
        } catch { return null; }
      }));
      records.push(...loaded.filter(Boolean));
    }
    return records;
  })();
  return originalPokemonDropRecordsPromise;
}

// Combine base, pack species, and species-addition drops for item-to-Pokémon lookup.
async function loadPokemonDropLookup() {
  if (!packDropLookupPromise) packDropLookupPromise = (async () => {
    const originalSpecies = window.COBBLEMON_ORIGINAL_SPECIES || [];
    const baseByPath = new Map(originalSpecies.map(entry => [resourceFolderSuffix(entry.path, 'species'), entry]));
    const baseById = new Map(originalSpecies.map(entry => [entry.id.toLowerCase(), entry]));
    const records = new Map((await loadOriginalPokemonDropRecords()).map(record => [record.id.toLowerCase(), record]));
    const packSpecies = [...activePackEntries.values()]
      .filter(entry => /(?:^|\/)species\/(?:.*\/)?[^/]+\.json$/i.test(entry.path))
      .sort((left, right) => left.lowerPath.localeCompare(right.lowerPath));
    for (let start = 0; start < packSpecies.length; start += 24) {
      const loaded = await Promise.all(packSpecies.slice(start, start + 24).map(async entry => {
        try { return { entry, data: await readEditedPackJson(entry) }; } catch { return null; }
      }));
      loaded.filter(Boolean).forEach(({ entry, data }) => {
        const suffix = resourceFolderSuffix(entry.path, 'species');
        const base = baseByPath.get(suffix);
        const id = String(base?.id || entry.path.split('/').pop().replace(/\.json$/i, '')).toLowerCase();
        const name = data.name || base?.name || titleCasePokemon(id);
        if (base) records.delete(id);
        if (data.drops) records.set(id, { id, name, path: entry.path, drops: data.drops, source: base ? 'override' : 'pack' });
      });
    }
    const additionFiles = [...activePackEntries.values()]
      .filter(entry => /(?:^|\/)species_additions\/(?:.*\/)?[^/]+\.json$/i.test(entry.path))
      .sort((left, right) => left.lowerPath.localeCompare(right.lowerPath));
    for (let start = 0; start < additionFiles.length; start += 24) {
      const loaded = await Promise.all(additionFiles.slice(start, start + 24).map(async entry => {
        try { return { entry, data: await readEditedPackJson(entry) }; } catch { return null; }
      }));
      loaded.filter(Boolean).forEach(({ entry, data }) => {
        if (!data.drops) return;
        const target = String(data.target || '').split(':').pop().toLowerCase();
        const filenameId = entry.path.split('/').pop().replace(/\.json$/i, '').toLowerCase();
        const base = baseById.get(target) || baseById.get(filenameId);
        const id = base?.id.toLowerCase() || target || filenameId;
        records.set(id, { id, name: base?.name || titleCasePokemon(id), path: entry.path, drops: data.drops, source: 'addition' });
      });
    }
    return [...records.values()].sort((left, right) => left.name.localeCompare(right.name));
  })();
  return packDropLookupPromise;
}

function titleCasePokemon(value) {
  return value.replace(/[_-]+/g, ' ').replace(/\b\p{L}/gu, character => character.toUpperCase());
}

// Choose a local block sprite that hints at where a spawn preset applies.
function spawnPresetIconItem(name) {
  const preset = String(name).toLowerCase();
  if (preset.startsWith('aether:')) return 'aether:ambrosium_shard';
  if (/end/.test(preset)) return 'minecraft:end_stone';
  if (/nether|lava|underlava|derelict/.test(preset)) return 'minecraft:netherrack';
  if (/water|river|ocean|underwater|freshwater|shipwreck/.test(preset)) return 'minecraft:prismarine_bricks';
  if (/cave|gemstone|redstone|stronghold|ancient_city/.test(preset)) return 'minecraft:stone_bricks';
  if (/desert|pyramid|ruined_portal/.test(preset)) return 'minecraft:sand';
  if (/structure|city|mansion|monument|village|illager|ruin|outpost|fortress/.test(preset)) return 'minecraft:bricks';
  if (/flower|foliage|forest|tree|garden/.test(preset)) return 'minecraft:oak_leaves';
  if (/wild|natural|biome|treetop/.test(preset)) return 'minecraft:grass_block';
  return 'minecraft:grass_block';
}

// Group built-in presets by dimension, then by their main Overworld spawn setting.
function spawnPresetSection(group) {
  const name = group.name.toLowerCase();
  if (name.startsWith('aether:')) return ['Aether', ''];
  if (name === '#cobblemon:is_end') return ['End', ''];
  if (name.startsWith('#cobblemon:nether/')) return ['Nether', ''];
  if (['end_city'].includes(name) || /^(end|the_end)[/:_]/.test(name)) return ['End', ''];
  if (/nether|underlava|lava_surface|derelict/.test(name)) return ['Nether', ''];
  const structurePresets = new Set(['ancient_city', 'desert_pyramid', 'illager_structures', 'jungle_pyramid', 'mansion', 'ocean_monument', 'ocean_ruins', 'pillager_outpost', 'ruined_portal', 'shipwreck', 'stronghold', 'trail_ruins', 'village', 'woodland_mansion']);
  if (structurePresets.has(name)) return ['Overworld', 'Structures'];
  if (['freshwater', 'river', 'underwater', 'water_surface'].includes(name)) return ['Overworld', 'Water'];
  if (['gemstones', 'redstone'].includes(name)) return ['Overworld', 'Caves'];
  if (['flowers', 'foliage', 'natural', 'treetop', 'wild'].includes(name)) return ['Overworld', 'Biome'];
  return ['Overworld', 'Other'];
}

// Get the path inside a resource folder so matching pack files can shadow bundled data.
function resourceFolderSuffix(path, folderName) {
  const normalized = String(path).replace(/\\/g, '/').toLowerCase();
  const marker = `/${folderName.toLowerCase()}/`;
  const index = normalized.lastIndexOf(marker);
  return index < 0 ? '' : normalized.slice(index + marker.length);
}

// Label each spawn card by its source, distinguishing pack additions from base-file overrides.
function spawnSourceBadge(path) {
  if (String(path).toLowerCase().startsWith('cobblemonoriginal/')) return '<span class="pack-source-badge base">Provided by base</span>';
  const resource = resourceFolderSuffix(path, 'spawn_pool_world');
  const overridesBase = (window.COBBLEMON_ORIGINAL_SPAWNS || []).some(spawn => resourceFolderSuffix(spawn.source, 'spawn_pool_world') === resource);
  return overridesBase
    ? '<span class="pack-source-badge override">Overrides base</span>'
    : '<span class="pack-source-badge pack">From pack</span>';
}

// Keep unrestricted entries visible at every time filter; only time-limited entries change.
function filterSpawnPresetEntries(entries, timeIndex) {
  if (!timeIndex) return entries;
  const selectedTime = SPAWN_TIME_FILTERS[timeIndex].toLowerCase();
  return entries.filter(entry => {
    if (entry.timeRange === undefined || entry.timeRange === null || entry.timeRange === '') return true;
    const ranges = Array.isArray(entry.timeRange) ? entry.timeRange : String(entry.timeRange).split(/[|,\s]+/);
    return ranges.some(range => String(range).toLowerCase() === selectedTime);
  });
}

// Render rarity groups and recalculate each Pokémon's share for the selected time.
function renderSpawnPresetEntries(entries, timeIndex = 0) {
  const visibleEntries = filterSpawnPresetEntries(entries, timeIndex);
  const rarityGroups = new Map();
  visibleEntries.forEach(entry => {
    const rawBucket = String(entry.bucket || 'common').toLowerCase();
    const bucket = ['ultra-rare', 'rare', 'uncommon', 'common'].includes(rawBucket) ? rawBucket : rawBucket || 'other';
    if (!rarityGroups.has(bucket)) rarityGroups.set(bucket, new Map());
    const totals = rarityGroups.get(bucket);
    if (!totals.has(entry.pokemon)) totals.set(entry.pokemon, { weight: 0, levels: new Set() });
    const pokemonTotals = totals.get(entry.pokemon);
    pokemonTotals.weight += Math.max(0, entry.weight);
    if (entry.level !== undefined && entry.level !== null && entry.level !== '') pokemonTotals.levels.add(String(entry.level));
  });
  const rarityOrder = ['ultra-rare', 'rare', 'uncommon', 'common'];
  const orderedRarities = [...rarityGroups.entries()].sort((left, right) => {
    const leftRank = rarityOrder.indexOf(left[0]);
    const rightRank = rarityOrder.indexOf(right[0]);
    return (leftRank < 0 ? 99 : leftRank) - (rightRank < 0 ? 99 : rightRank) || left[0].localeCompare(right[0]);
  });
  return orderedRarities.length
    ? orderedRarities.map(([rarity, totals]) => {
      const totalWeight = [...totals.values()].reduce((sum, data) => sum + data.weight, 0);
      const rows = [...totals.entries()].sort((left, right) => right[1].weight - left[1].weight || left[0].localeCompare(right[0]));
      return `<section class="pack-rarity-group"><header><h4>${safePokemonName(titleCasePokemon(rarity))}</h4><small>${rows.length} Pokémon</small></header><div class="pack-preset-pokemon-list">${rows.map(([pokemon, data]) => {
        const percent = totalWeight ? data.weight / totalWeight * 100 : 0;
        const levels = [...data.levels].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
        const levelLabel = levels.length ? `Level${levels.length > 1 ? ' ranges' : ' range'}: ${levels.join(', ')}` : 'Level range not specified';
        return `<div class="pack-preset-pokemon">${renderPokemonSprite(pokemon, 'pack-preset-pokemon-avatar')}<div class="pack-preset-pokemon-content"><div class="pack-preset-pokemon-head"><b>${safePokemonName(titleCasePokemon(pokemon))}</b><strong>${percent.toFixed(1)}%</strong></div><small class="pack-preset-level-range">${safePokemonName(levelLabel)}</small><div class="chance-track"><i style="width:${percent}%"></i></div></div></div>`;
      }).join('')}</div></section>`;
    }).join('')
    : `<div class="pack-detail-empty">${timeIndex ? `No Pokémon spawn entries are listed for ${safePokemonName(SPAWN_TIME_FILTERS[timeIndex].toLowerCase())}.` : 'No Pokémon spawn entries are listed for this preset.'}</div>`;
}

// Render collapsible preset groups with a five-position time filter on each tag.
function renderPackSpawnGroups(groups) {
  const renderPreset = (group, entries = group.entries) => {
    const timeIndex = spawnPresetTimeFilters.get(group.name) || 0;
    const pokemonCount = new Set(filterSpawnPresetEntries(entries, timeIndex).map(entry => entry.pokemon)).size;
    const content = renderSpawnPresetEntries(entries, timeIndex);
    const timeLabels = SPAWN_TIME_FILTERS.map((label, index) => `<span class="${index === timeIndex ? 'active' : ''}">${label}</span>`).join('');
    const timeFilter = `<div class="pack-preset-time-filter"><div class="pack-preset-time-heading"><b>Time range</b><strong data-spawn-time-label>${SPAWN_TIME_FILTERS[timeIndex]}</strong></div><input type="range" min="0" max="4" step="1" value="${timeIndex}" data-spawn-preset-time-filter="${safePokemonName(group.name)}" aria-label="Filter ${safePokemonName(group.name)} spawns by time"><div class="pack-preset-time-labels">${timeLabels}</div></div>`;
    const sourceNote = group.sources.length ? `<small class="pack-preset-source">Custom definition: ${group.sources.map(safePokemonName).join(', ')}</small>` : '';
    const icon = localSprite(spawnPresetIconItem(group.name));
    return `<details class="pack-spawn-preset"><summary><span class="pack-preset-title"><img src="${safePokemonName(icon)}" alt="" loading="lazy"><b>${safePokemonName(titleCasePokemon(group.name))}</b><code>${safePokemonName(group.name)}</code></span><small>${pokemonCount} Pokémon</small></summary>${timeFilter}${sourceNote}<div class="pack-preset-spawn-content">${content}</div></details>`;
  };
  const aetherPresetSet = new Set(AETHER_SPAWN_PRESETS);
  const aether = groups.filter(group => aetherPresetSet.has(group.name));
  const biomePresetSet = new Set([...COBBLEMON_NETHER_SPAWN_TAGS, ...COBBLEMON_END_SPAWN_TAGS]);
  const supported = groups.filter(group => !aetherPresetSet.has(group.name) && (COBBLEMON_BUILTIN_SPAWN_PRESETS.includes(group.name) || biomePresetSet.has(group.name) || group.entries.some(entry => entry.source === 'base')));
  const added = groups.filter(group => !aetherPresetSet.has(group.name) && !biomePresetSet.has(group.name) && !COBBLEMON_BUILTIN_SPAWN_PRESETS.includes(group.name) && !group.entries.some(entry => entry.source === 'base'));
  const renderSection = (title, rows, iconItem) => {
    if (!rows.length) return '';
    return `<section class="pack-preset-dimension"><h3><img src="${safePokemonName(localSprite(iconItem))}" alt="" loading="lazy">${title}<small>${rows.length} presets</small></h3>${rows.map(group => renderPreset(group)).join('')}</section>`;
  };
  const overworld = ['Biome', 'Structures', 'Water', 'Caves', 'Other'].map(category => {
    const rows = supported.filter(group => {
      const [dimension, type] = spawnPresetSection(group);
      return dimension === 'Overworld' && type === category;
    });
    return rows.length ? `<section class="pack-preset-category"><h4>${category}<small>${rows.length}</small></h4>${rows.map(group => renderPreset(group)).join('')}</section>` : '';
  }).join('');
  const supportedMarkup = supported.length
    ? `<section class="pack-preset-source-group"><h3>Supported by base <small>${supported.length}</small></h3>${overworld ? `<div class="pack-preset-dimension"><h3><img src="${safePokemonName(localSprite('minecraft:grass_block'))}" alt="" loading="lazy">Overworld</h3>${overworld}</div>` : ''}${renderSection('Nether', supported.filter(group => spawnPresetSection(group)[0] === 'Nether'), 'minecraft:netherrack')}${renderSection('End', supported.filter(group => spawnPresetSection(group)[0] === 'End'), 'minecraft:end_stone')}</section>`
    : '';
  const addedMarkup = added.length
    ? `<section class="pack-preset-source-group"><h3>Added by pack <small>${added.length}</small></h3>${added.map(group => renderPreset(group, group.entries.filter(entry => entry.source === 'pack'))).join('')}</section>`
    : '';
  const aetherMarkup = aether.length
    ? `<section class="pack-preset-dimension"><h3><img src="${safePokemonName(localSprite('aether:ambrosium_shard'))}" alt="" loading="lazy">Aether<small>${aether.length} presets</small></h3>${aether.map(group => renderPreset(group)).join('')}</section>`
    : '';
  return `<div class="pack-spawn-preset-list">${supportedMarkup}${aetherMarkup}${addedMarkup || '<div class="pack-detail-empty">No additional spawn presets were found in the pack.</div>'}</div>`;
}

// Build the per-file spawn switches for pack data only.
async function renderPackSpawnToggleCards(version = packSelectionVersion) {
  const host = $('#packSpawnBrowserContent');
  if (!host) return;
  if (!activePackFile) {
    host.innerHTML = '<div class="pack-detail-empty">Upload a pack or create an empty pack to view and toggle its spawn files.</div>';
    return;
  }
  host.innerHTML = '<div class="pack-detail-empty">Loading pack spawn files…</div>';
  const entries = [...activePackEntries.values()]
    .filter(entry => /(?:^|\/)spawn_pool_world\/(?:.*\/)?[^/]+\.json$/i.test(entry.path))
    .sort((left, right) => left.lowerPath.localeCompare(right.lowerPath));
  const records = await Promise.all(entries.map(async entry => {
    try {
      const data = await readEditedPackJson(entry);
      const edit = getPackEditDocument(entry.path, data);
      const editableData = edit?.data ?? data;
      const spawns = Array.isArray(editableData) ? editableData : Array.isArray(editableData?.spawns) ? editableData.spawns : [];
      return { entry, data: editableData, spawns, enabled: Array.isArray(editableData) || editableData?.enabled !== false };
    } catch (error) {
      return { entry, error };
    }
  }));
  if (version !== packSelectionVersion || activePackView !== 'spawns' || activePackSpawnPage !== 'toggle') return;
  const validRecords = records.filter(record => !record.error);
  if (!records.length) {
    host.innerHTML = '<div class="pack-detail-empty">No spawn files were found in this pack yet.</div>';
    return;
  }
  host.innerHTML = `<div class="pack-spawn-toggle-grid">${records.map(record => {
    if (record.error) return `<article class="pack-spawn-toggle-card error"><div><b>${safePokemonName(record.entry.path)}</b><p>Could not read this spawn file: ${safePokemonName(record.error.message || 'Invalid JSON')}</p></div></article>`;
    const pokemon = [...new Set(record.spawns.map(spawn => spawn?.pokemon).filter(Boolean))];
    const pokemonRows = pokemon.length
      ? pokemon.map(id => {
        const base = findBaseSpeciesForPackReference(id);
        const name = base?.name || titleCasePokemon(String(id).split(':').pop().split(/\s+/)[0]);
        return `<span class="pack-spawn-toggle-pokemon">${renderPokemonSprite(id)}<b>${safePokemonName(name)}</b></span>`;
      }).join('')
      : `<span class="pack-spawn-toggle-pokemon empty"><b>${safePokemonName(titleCasePokemon(record.entry.path.split('/').pop().replace(/\.json$/i, '').replace(/_additional(?:_\d+)?$/i, '')))}</b></span>`;
    const spawnCards = record.spawns.map((spawn, index) => {
      const id = spawn?.pokemon || '';
      const base = findBaseSpeciesForPackReference(id);
      const name = base?.name || (id ? titleCasePokemon(String(id).split(':').pop().split(/\s+/)[0]) : 'Unknown Pokémon');
      const facts = [
        ['Spawn ID', spawn.id], ['Rarity', spawn.bucket], ['Weight', spawn.weight], ['Level', spawn.level],
        ['Position type', spawn.spawnablePositionType], ['Presets', spawn.presets], ['Type', spawn.type]
      ].filter(([, value]) => value !== undefined);
      const conditions = [
        ...flattenSpawnConditions(spawn.condition || {}, 'Condition'),
        ...flattenSpawnConditions(spawn.anticondition || {}, 'Anti condition'),
        ...flattenSpawnConditions(spawn.weightMultiplier || {}, 'Weight multiplier')
      ];
      const knownKeys = new Set(['pokemon', 'id', 'bucket', 'weight', 'level', 'spawnablePositionType', 'presets', 'type', 'condition', 'anticondition', 'weightMultiplier']);
      const extraFields = Object.entries(spawn || {}).filter(([key]) => !knownKeys.has(key)).flatMap(([key, value]) => flattenSpawnConditions(value, key));
      return `<section class="pack-spawn-toggle-entry"><header><span class="pack-spawn-toggle-entry-title">${renderPokemonSprite(id || name)}<b>${safePokemonName(name)}</b></span><small>Spawn ${index + 1}</small></header>${facts.length ? `<dl>${renderSpawnRows(facts)}</dl>` : ''}${conditions.length ? `<div class="pack-spawn-toggle-entry-conditions"><h4>Conditions</h4><dl>${renderSpawnRows(conditions)}</dl></div>` : ''}${extraFields.length ? `<details><summary>Additional fields</summary><dl>${renderSpawnRows(extraFields)}</dl></details>` : ''}</section>`;
    }).join('');
    return `<article class="pack-spawn-toggle-card ${record.enabled ? 'enabled' : 'disabled'}"><header><div class="pack-spawn-toggle-pokemon-list">${pokemonRows}</div><label class="pack-spawn-enabled-control"><span>${record.enabled ? 'Enabled' : 'Disabled'}</span><input type="checkbox" ${record.enabled ? 'checked' : ''} data-pack-file="${safePokemonName(record.entry.lowerPath)}" data-file-field="enabled" aria-label="Enable spawns from ${safePokemonName(record.entry.path)}"><i aria-hidden="true"></i></label></header><small class="pack-spawn-toggle-path">${safePokemonName(record.entry.path)}</small><p>${record.spawns.length} spawn entr${record.spawns.length === 1 ? 'y' : 'ies'} in this file</p><div class="pack-spawn-toggle-entries">${spawnCards || '<div class="pack-detail-empty">This file has no spawn entries yet.</div>'}</div></article>`;
  }).join('')}</div><div class="pack-spawn-toggle-summary">${validRecords.length} pack spawn file${validRecords.length === 1 ? '' : 's'} · ${records.filter(record => !record.error && record.enabled).length} enabled</div>`;
  bindPokemonSpriteFallbacks(host);
}

// Switch the Pack Editor workspace to its spawn browser or per-file enable switches.
async function showPackSpawns(page = 'all') {
  activePackView = 'spawns';
  activePackSpawnPage = page;
  activePackProvenanceHtml = '';
  activePackPokemonKey = '';
  activePackPokemonId = '';
  packEditMode = { spawn: false, drops: false };
  const version = ++packSelectionVersion;
  $('#packSpawnsButton').classList.add('active');
  $('#packSpawnsButton').setAttribute('aria-pressed', 'true');
  $('#packDropsButton').classList.remove('active');
  $('#packDropsButton').setAttribute('aria-pressed', 'false');
  $$('.pack-pokemon-row, .pack-base-pokemon-row').forEach(row => row.classList.remove('active'));
  const details = $('#packPokemonDetails');
  const tabs = `<nav class="pack-spawn-browser-tabs" aria-label="Spawn views"><button type="button" class="${page === 'all' ? 'active' : ''}" data-pack-spawn-page="all">All Spawns</button><button type="button" class="${page === 'toggle' ? 'active' : ''}" data-pack-spawn-page="toggle">Toggle Pack Spawns</button></nav>`;
  const pageTitle = page === 'toggle' ? 'Toggle Pack Spawns' : 'All Spawns';
  details.innerHTML = `${tabs}<div class="pack-spawn-browser-heading"><div><span class="eyebrow">COBBLEMON SPAWNS</span><h2>${pageTitle}</h2></div></div><div id="packSpawnBrowserContent"><div class="pack-detail-empty">${page === 'toggle' ? 'Loading pack spawn files…' : 'Loading spawn presets and Pokémon weights…'}</div></div>`;
  try {
    if (page === 'toggle') {
      await renderPackSpawnToggleCards(version);
      return;
    }
    const groups = await loadPackSpawnGroups();
    if (version !== packSelectionVersion) return;
    const sourceNote = activePackFile ? '' : '<div class="pack-detail-empty">Showing original Cobblemon spawns. Upload a pack to include its additional spawn data.</div>';
    $('#packSpawnBrowserContent').innerHTML = `${sourceNote}<div class="pack-spawn-preset-description">Percentages compare spawn weights only with Pokémon in the same rarity bucket.</div>${renderPackSpawnGroups(groups)}`;
    bindPokemonSpriteFallbacks(details);
  } catch (error) {
    if (version !== packSelectionVersion) return;
    details.innerHTML = `<div class="pack-detail-empty error">${safePokemonName(error instanceof Error ? error.message : 'Could not read spawn data.')}</div>`;
  }
}

// Show the catalog-based drop browser in the Pack Editor workspace.
function showPackDrops() {
  activePackView = 'drops';
  activePackProvenanceHtml = '';
  activePackPokemonKey = '';
  activePackPokemonId = '';
  packEditMode = { spawn: false, drops: false };
  packDropCategory = 'minecraft';
  packDropSelectedItem = '';
  packSelectionVersion++;
  $('#packSpawnsButton').classList.remove('active');
  $('#packSpawnsButton').setAttribute('aria-pressed', 'false');
  $('#packDropsButton').classList.add('active');
  $('#packDropsButton').setAttribute('aria-pressed', 'true');
  $$('.pack-pokemon-row, .pack-base-pokemon-row').forEach(row => row.classList.remove('active'));
  const categories = PACK_DROP_CATEGORIES.map(category => `<button type="button" class="item-category ${category.id === packDropCategory ? 'active' : ''}" data-pack-drop-category="${category.id}"><img src="${category.icon}" alt=""><span>${category.label}</span></button>`).join('');
  $('#packPokemonDetails').innerHTML = `<div class="pack-detail-heading"><span class="eyebrow">COBBLEMON DROP BROWSER</span><h2>Find Pokémon by drop</h2><small>Choose an item to see which base or pack Pokémon can drop it.</small></div><label class="search picker-search"><span class="search-icon" aria-hidden="true"></span><input id="packDropSearch" type="search" placeholder="Search items or IDs across all categories…" aria-label="Search Cobblemon drops by item"></label><div class="item-categories pack-drop-categories">${categories}</div><div id="packDropItemStatus" class="item-status"></div><div id="packDropItemGrid" class="item-grid"></div><section class="pack-drop-browser-results"><div id="packDropResultHeading"></div><div id="packDropResults" class="pack-drop-list"><div class="pack-detail-empty">Choose an item to find matching Cobblemon drops.</div></div></section>`;
  renderPackDropItems();
}

// Show items from the existing catalog, searching across categories when a query is present.
function renderPackDropItems() {
  const category = PACK_DROP_CATEGORIES.find(item => item.id === packDropCategory) || PACK_DROP_CATEGORIES[0];
  const query = $('#packDropSearch').value.trim().toLowerCase();
  const allItems = PACK_DROP_CATEGORIES.flatMap(item => window[item.catalog] || []);
  const items = query ? allItems : window[category.catalog] || [];
  const matched = items.filter(item => item.label.toLowerCase().includes(query) || item.id.toLowerCase().includes(query));
  $('#packDropItemStatus').textContent = `${matched.length.toLocaleString()} items${query ? ' across all categories' : ` in ${category.label}`}`;
  $('#packDropItemGrid').innerHTML = matched.map(item => `<button class="item-option ${item.id === packDropSelectedItem ? 'selected' : ''}" type="button" data-pack-drop-item="${safePokemonName(item.id)}"><img loading="lazy" src="${safePokemonName(localSprite(item))}" alt=""><span><b>${safePokemonName(item.label)}</b><small>${safePokemonName(item.id)}</small></span></button>`).join('');
  $$('#packDropItemGrid img').forEach(image => image.onerror = () => { image.hidden = true; });
}

// Find every species drop entry whose item ID matches the selected catalog item.
async function renderPackDropMatches(itemId) {
  const catalogItem = PACK_DROP_CATEGORIES.flatMap(category => window[category.catalog] || []).find(item => item.id === itemId);
  const label = catalogItem?.label || itemId;
  $('#packDropResultHeading').innerHTML = `<div class="pack-drop-selected-item"><img src="${safePokemonName(localSprite(catalogItem || itemId))}" alt=""><span><b>${safePokemonName(label)}</b><small>${safePokemonName(itemId)}</small></span></div>`;
  $('#packDropResults').innerHTML = '<div class="pack-detail-empty">Searching base and pack species drop data…</div>';
  try {
    const records = await loadPokemonDropLookup();
    if (activePackView !== 'drops' || packDropSelectedItem !== itemId) return;
    const matches = records.map(record => ({ record, drops: (Array.isArray(record.drops?.entries) ? record.drops.entries : []).filter(drop => {
      const item = typeof drop.item === 'object' ? drop.item?.id : drop.item;
      return String(item || '').toLowerCase() === itemId.toLowerCase();
    }) })).filter(result => result.drops.length);
    $('#packDropItemStatus').textContent = `${matches.length} Pokémon drop ${label}`;
    if (!matches.length) {
      $('#packDropResults').innerHTML = '<div class="pack-detail-empty">No matching Cobblemon drops were found.</div>';
      return;
    }
    $('#packDropResults').innerHTML = matches.map(({ record, drops }) => {
      const badge = record.source === 'base'
        ? '<span class="pack-source-badge base">Provided by base</span>'
        : record.source === 'override'
          ? '<span class="pack-source-badge override">Overrides base</span>'
          : record.source === 'addition'
            ? '<span class="pack-source-badge pack">Species addition</span>'
            : '<span class="pack-source-badge pack">From pack</span>';
      const rows = drops.map(drop => {
        const fields = Object.entries(drop).filter(([key]) => key !== 'item').map(([key, value]) => `${formatSpawnKey(key)}: ${formatSpawnValue(value)}`).join(' · ');
        const percent = Number(drop.percentage);
        const chance = Number.isFinite(percent) ? `<strong class="pack-drop-percent">${percent.toFixed(1)}%</strong>` : '';
        return `<div class="pack-drop-entry"><div class="pack-drop-row"><div class="pack-drop-item"><img class="pack-drop-icon" src="${safePokemonName(localSprite(itemId))}" alt="" onerror="this.hidden=true"><b>${safePokemonName(label)}</b></div><div class="pack-drop-meta">${fields ? `<span>${safePokemonName(fields)}</span>` : ''}${chance}</div></div>${Number.isFinite(percent) ? `<div class="chance-track pack-drop-chance"><i style="width:${Math.max(0, Math.min(100, percent))}%"></i></div>` : ''}</div>`;
      }).join('');
      return `<article class="pack-drop-card"><header><div><h4 class="pack-drop-pokemon-title">${renderPokemonSprite(record.id)}<span>${safePokemonName(record.name)}</span></h4>${badge}<small>${safePokemonName(record.path)}</small></div>${record.drops.amount !== undefined ? `<span class="pack-drop-amount">${safePokemonName(record.drops.amount)} roll${Number(record.drops.amount) === 1 ? '' : 's'}</span>` : ''}</header>${rows}</article>`;
    }).join('');
    bindPokemonSpriteFallbacks($('#packDropResults'));
  } catch (error) {
    $('#packDropResults').innerHTML = `<div class="pack-detail-empty error">${safePokemonName(error instanceof Error ? error.message : 'Could not load Cobblemon drop data.')}</div>`;
  }
}

async function showPokemonSpawns(texturePath, row) {
  const version = ++packSelectionVersion;
  activePackView = 'pokemon';
  const baseId = row?.dataset.originalPokemon || '';
  const packPokemonId = row?.dataset.packPokemonId || baseId;
  const indexedPokemon = activePackPokemonInventory.get(String(packPokemonId || '').toLowerCase());
  activePackProvenanceHtml = '';
  const candidateNames = pokemonSpawnJsonCandidates(texturePath);
  const selectionKey = baseId || row?.dataset.pokemonTexture || texturePath;
  if (selectionKey !== activePackPokemonKey) packEditMode = { spawn: false, drops: false };
  activePackPokemonKey = selectionKey;
  const baseSpecies = findBaseSpeciesForTexture(texturePath, baseId);
  activePackPokemonId = String(baseSpecies?.id || packPokemonId || texturePath.replace(/\.png$/i, '').split('/').pop()).split(':').pop().toLowerCase();
  $('#packSpawnsButton').classList.remove('active');
  $('#packSpawnsButton').setAttribute('aria-pressed', 'false');
  $('#packDropsButton').classList.remove('active');
  $('#packDropsButton').setAttribute('aria-pressed', 'false');
  $$('.pack-pokemon-row, .pack-base-pokemon-row').forEach(item => item.classList.toggle('active', item === row));
  const details = $('#packPokemonDetails');
  const label = baseSpecies?.name || row?.dataset.pokemonName || pokemonTextureLabel(texturePath);
  details.innerHTML = `<div class="pack-detail-heading"><span class="eyebrow">POKÉMON SPAWN DATA</span><h2>${safePokemonName(label)}</h2><small>${safePokemonName(baseSpecies?.path || texturePath)}</small></div><div class="pack-detail-empty">Looking for this Pokémon's species and spawn data…</div>`;
  const originalSpawns = baseSpecies ? (window.COBBLEMON_ORIGINAL_SPAWNS || []).filter(spawn => spawn.speciesId === baseSpecies.id) : [];
  const originalSpawnResources = new Set(originalSpawns.map(spawn => resourceFolderSuffix(spawn.source, 'spawn_pool_world')));
  const indexedSpawnFiles = indexedPokemon?.files.spawns || new Set();
  const indexedAdditionFiles = indexedPokemon?.files.additions || new Set();
  const indexedSpeciesFiles = indexedPokemon?.files.species || new Set();
  const additionalSpawnFilePattern = new RegExp(`/${activePackPokemonId}_additional(?:_\\d+)?\\.json$`, 'i');
  // Packs may contain multiple datapacks, each with a spawn_pool_world folder.
  const matchingEntries = [...activePackEntries.values()].filter(entry => {
    const match = entry.lowerPath.match(/(?:^|\/)spawn_pool_world\/(?:.*\/)?([^/]+\.json)$/);
    return match && (candidateNames.includes(match[1]) || indexedSpawnFiles.has(entry.lowerPath) || originalSpawnResources.has(resourceFolderSuffix(entry.lowerPath, 'spawn_pool_world')) || additionalSpawnFilePattern.test(entry.lowerPath));
  }).sort((left, right) => left.lowerPath.localeCompare(right.lowerPath));
  const additionNames = new Set(candidateNames);
  const additionEntries = [...activePackEntries.values()].filter(entry => {
    const match = entry.lowerPath.match(/(?:^|\/)species_additions\/(?:.*\/)?([^/]+\.json)$/);
    return match && (additionNames.has(match[1]) || indexedAdditionFiles.has(entry.lowerPath));
  }).sort((left, right) => left.lowerPath.localeCompare(right.lowerPath));
  const baseSpeciesResource = baseSpecies ? resourceFolderSuffix(baseSpecies.path, 'species') : '';
  const speciesEntries = [...activePackEntries.values()].filter(entry => {
    const match = entry.lowerPath.match(/(?:^|\/)species\/(?:.*\/)?([^/]+\.json)$/);
    return match && (additionNames.has(match[1]) || indexedSpeciesFiles.has(entry.lowerPath) || resourceFolderSuffix(entry.lowerPath, 'species') === baseSpeciesResource);
  }).sort((left, right) => left.lowerPath.localeCompare(right.lowerPath));
  if (!baseSpecies && !matchingEntries.length && !additionEntries.length && !speciesEntries.length && !activePackFile) {
    if (version !== packSelectionVersion) return;
    details.innerHTML = `<div class="pack-detail-heading"><span class="eyebrow">POKÉMON DATA</span><h2>${safePokemonName(label)}</h2><small>${safePokemonName(texturePath)}</small></div><div class="pack-detail-empty">No matching spawn or species-addition JSON was found in this ZIP.</div>`;
    return;
  }
  try {
    let records;
    if (baseSpecies) {
      const grouped = new Map();
      originalSpawns.filter(spawn => !matchingEntries.some(entry => resourceFolderSuffix(entry.lowerPath, 'spawn_pool_world') === resourceFolderSuffix(spawn.source, 'spawn_pool_world'))).forEach(spawn => {
        if (!grouped.has(spawn.source)) grouped.set(spawn.source, []);
        grouped.get(spawn.source).push(spawn);
      });
      const originalRecords = [...grouped.entries()].map(([path, spawns]) => ({ path, spawns, raw: JSON.stringify({ spawns }, null, 2) }));
      const packRecords = await Promise.all(matchingEntries.map(async entry => {
        const record = await readEditedPackJson(entry);
        const spawns = Array.isArray(record) ? record : Array.isArray(record?.spawns) ? record.spawns : [];
        return { path: entry.path, spawns, raw: JSON.stringify(record, null, 2), data: record };
      }));
      records = [...originalRecords, ...packRecords];
    } else {
      records = await Promise.all(matchingEntries.map(async entry => {
        const record = await readEditedPackJson(entry);
        const spawns = Array.isArray(record) ? record : Array.isArray(record?.spawns) ? record.spawns : [];
        return { path: entry.path, spawns, raw: JSON.stringify(record, null, 2), data: record };
      }));
    }
    const additionRecords = await Promise.all(additionEntries.map(async entry => ({
      path: entry.path,
      data: await readEditedPackJson(entry)
    })));
    let speciesRecords;
    if (baseSpecies) {
      const override = speciesEntries.filter(entry => resourceFolderSuffix(entry.lowerPath, 'species') === baseSpeciesResource);
      if (override.length) {
        speciesRecords = await Promise.all(override.map(async entry => ({ path: entry.path, data: await readEditedPackJson(entry) })));
      } else {
        const response = await fetch(`./${baseSpecies.path}`);
        if (!response.ok) throw new Error(`Could not load original species data (${response.status}).`);
        speciesRecords = [{ path: baseSpecies.path, data: await response.json() }];
      }
    } else {
      speciesRecords = await Promise.all(speciesEntries.map(async entry => ({
        path: entry.path,
        data: await readEditedPackJson(entry)
      })));
    }
    if (version !== packSelectionVersion) return;
    const spawns = records.flatMap(record => record.spawns.map(spawn => ({ ...spawn, __source: record.path })));
    const heading = `<div class="pack-detail-heading"><span class="eyebrow">POKÉMON DATA</span><h2>${safePokemonName(label)}</h2><small>${speciesRecords.length} species file${speciesRecords.length === 1 ? '' : 's'} · ${records.length} spawn file${records.length === 1 ? '' : 's'}</small></div>`;
    const hasPackSpeciesOverride = !!baseSpecies && speciesEntries.some(entry => resourceFolderSuffix(entry.lowerPath, 'species') === baseSpeciesResource);
    const hasPackSpawnOverride = !!baseSpecies && matchingEntries.some(entry => originalSpawnResources.has(resourceFolderSuffix(entry.lowerPath, 'spawn_pool_world')));
    const hasBaseData = speciesRecords.some(record => record.path.startsWith('CobblemonOriginal/')) || records.some(record => record.path.startsWith('CobblemonOriginal/'));
    const hasPackData = speciesRecords.some(record => !record.path.startsWith('CobblemonOriginal/')) || records.some(record => !record.path.startsWith('CobblemonOriginal/')) || additionRecords.length > 0;
    activePackProvenanceHtml = [
      hasBaseData ? '<span class="pack-source-badge base">Provided by base</span>' : '',
      hasPackSpeciesOverride || hasPackSpawnOverride ? '<span class="pack-source-badge override">Overrides base</span>' : '',
      hasPackData && !hasPackSpeciesOverride && !hasPackSpawnOverride ? '<span class="pack-source-badge pack">Pack data</span>' : ''
    ].filter(Boolean).join('');
    const pokedexRows = await resolvePokemonPokedexRows(speciesRecords);
    const dexFields = speciesRecords.flatMap(record => {
      const data = record.data || {};
      const fields = [];
      if (data.name) fields.push(['Name', data.name]);
      if (data.primaryType) fields.push(['Primary type', data.primaryType]);
      if (data.secondaryType) fields.push(['Secondary type', data.secondaryType]);
      if (data.labels !== undefined) fields.push(['Label', data.labels]);
      if (data.experienceGroup !== undefined) fields.push(['Experience group', data.experienceGroup]);
      if (data.eggGroups !== undefined) fields.push(['Egg groups', data.eggGroups]);
      if (data.abilities !== undefined) fields.push(['Abilities', data.abilities]);
      if (data.weight !== undefined) fields.push(['Weight', data.weight]);
      if (data.nationalPokedexNumber !== undefined) fields.push(['National Pokédex number', data.nationalPokedexNumber]);
      const forms = Array.isArray(data.forms) ? data.forms.map(form => form.name).filter(Boolean) : [];
      if (forms.length) fields.push(['Forms', forms]);
      return fields;
    }).concat(pokedexRows);
    const baseStatFields = speciesRecords.flatMap(record => {
      const data = record.data || {};
      const fields = Object.entries(data.baseStats || {}).map(([key, value]) => [formatSpawnKey(key), value]);
      (Array.isArray(data.forms) ? data.forms : []).forEach(form => {
        Object.entries(form.baseStats || {}).forEach(([key, value]) => fields.push([`${form.name || 'Form'} ${formatSpawnKey(key)}`, value]));
      });
      return fields;
    });
    const behaviourFields = speciesRecords.flatMap(record => flattenSpawnConditions(record.data?.behaviour || {}));
    const otherPokemonFields = speciesRecords.flatMap(record => Object.entries(record.data || {})
      .filter(([key]) => !['name', 'primarytype', 'secondarytype', 'labels', 'experiencegroup', 'egggroups', 'abilities', 'weight', 'nationalpokedexnumber', 'pokedex', 'forms', 'basestats', 'behaviour', 'moves', 'drops'].includes(key.toLowerCase()))
      .flatMap(([key, value]) => flattenSpawnConditions(value, key)));
    const pokemonDataGroup = (title, fields) => fields.length
      ? `<section class="pack-pokemon-data-group"><h4>${title}</h4><dl>${renderSpawnRows(fields)}</dl></section>`
      : '';
    const pokemonContent = dexFields.length || baseStatFields.length || behaviourFields.length || otherPokemonFields.length
      ? `<section class="pack-pokemon-data"><h3>Pokémon data</h3>${pokemonDataGroup('Dex information', dexFields)}${pokemonDataGroup('Base stats', baseStatFields)}${pokemonDataGroup('Behaviour stats', behaviourFields)}${pokemonDataGroup('Other information', otherPokemonFields)}</section>`
      : '<section class="pack-pokemon-data"><h3>Pokémon data</h3><div class="pack-detail-empty">No generic species data was found.</div></section>';
    const editableSpawnRecords = records.filter(record => findPackEntry(record.path));
    const editableSpawnPaths = new Set(editableSpawnRecords.map(record => record.path));
    const visibleSpawns = packEditMode.spawn ? spawns.filter(spawn => !editableSpawnPaths.has(spawn.__source)) : spawns;
    const cards = visibleSpawns.map((spawn, index) => {
      const facts = [
        ['Level', spawn.level], ['Rarity', spawn.bucket], ['Position', spawn.spawnablePositionType],
        ['Presets', spawn.presets], ['Weight', spawn.weight]
      ].filter(([, value]) => value !== undefined);
      const conditions = flattenSpawnConditions(spawn.condition || {});
      const extraConditions = spawn.weightMultiplier ? flattenSpawnConditions(spawn.weightMultiplier, 'Weight multiplier') : [];
      const conditionContent = [...conditions, ...extraConditions];
      const pokemonName = spawn.pokemon || label;
      return `<article class="pack-spawn-card"><header><div><h3 class="pack-spawn-pokemon-title">${renderPokemonSprite(pokemonName)}<span>${safePokemonName(pokemonName)}</span></h3><small>Spawn entry ${index + 1}${spawn.bucket ? ` · ${safePokemonName(spawn.bucket)}` : ''}</small><small class="spawn-source">${safePokemonName(spawn.__source)}</small></div></header>${facts.length ? `<dl class="spawn-facts">${renderSpawnRows(facts)}</dl>` : ''}<div class="spawn-conditions"><h4>Where and when</h4>${conditionContent.length ? `<dl>${renderSpawnRows(conditionContent)}</dl>` : '<p>No additional conditions are listed.</p>'}</div></article>`;
    }).join('');
    const visualSpawnEditors = packEditMode.spawn
      ? editableSpawnRecords.map(record => renderSpawnFileEditor(record, label, activePackPokemonId)).join('')
      : '';
    const additiveSpawnNote = packEditMode.spawn && baseSpecies && !hasPackSpawnOverride
      ? '<div class="pack-additive-spawn-note"><strong>Adding to base spawns</strong><span>These entries are held in a uniquely named file under data/cobblemon/spawn_pool_world and add alongside base spawns. The original base files stay unchanged.</span></div>'
      : '';
    const spawnContent = `${additiveSpawnNote}${cards ? `<div class="pack-spawn-list">${cards}</div>` : ''}${visualSpawnEditors}${!cards && !visualSpawnEditors ? '<div class="pack-detail-empty">No matching spawn data was found.</div>' : ''}`;
    const dropRecords = [...additionRecords, ...speciesRecords].filter(record => record.data?.drops || findPackEntry(record.path));
    const editableDropRecords = dropRecords.filter(record => findPackEntry(record.path));
    const dropContent = dropRecords.length
      ? dropRecords.map(record => renderDropEditor(record, label, packEditMode.drops)).join('')
      : '<div class="pack-detail-empty">No drop data was found in the matching species files.</div>';
    const newSpeciesDropOverride = editableDropRecords.some(record => {
      const entry = findPackEntry(record.path);
      return entry && newPackFiles.has(entry.lowerPath);
    });
    const dropEditorActions = `${editableDropRecords.length ? `<button class="button small" type="button" data-pack-action="toggle-drop-edit">${packEditMode.drops ? 'Done' : 'Edit drops'}</button>` : ''}${activePackFile && baseSpecies && !hasPackSpeciesOverride ? `<button class="button small" type="button" data-pack-action="add-pack-drop-override" data-pokemon-id="${safePokemonName(baseSpecies.id)}">Add pack drops</button>` : ''}`;
    const dropOverrideNote = packEditMode.drops && newSpeciesDropOverride
      ? '<div class="pack-additive-spawn-note"><strong>Editing base Pokémon drops in the pack</strong><span>A copy of the base species JSON is being added under data/cobblemon/species at its matching path. Changes will override that species in this pack and retain its other data.</span></div>'
      : '';
    const moveGroups = speciesRecords.flatMap(record => {
      const groups = [];
      if (Array.isArray(record.data?.moves) && record.data.moves.length) groups.push({ name: record.data.name || label, path: record.path, moves: record.data.moves });
      (Array.isArray(record.data?.forms) ? record.data.forms : []).forEach(form => {
        if (Array.isArray(form.moves) && form.moves.length) groups.push({ name: `${record.data.name || label} · ${form.name || 'Form'}`, path: record.path, moves: form.moves });
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
    const spawnButtonLabel = packEditMode.spawn ? 'Done' : editableSpawnRecords.length ? 'Edit spawns' : 'Add pack spawns';
    details.innerHTML = `${heading}${pokemonContent}<section class="pack-spawn-section"><div class="pack-edit-section-heading"><h3>Spawn data</h3>${activePackFile ? `<button class="button small" type="button" data-pack-action="toggle-spawn-edit">${spawnButtonLabel}</button>` : ''}</div>${spawnContent}</section><section class="pack-drop-data"><div class="pack-edit-section-heading"><h3>Drop data</h3><div class="pack-edit-actions">${dropEditorActions}</div></div>${dropOverrideNote}<div class="pack-drop-list">${dropContent}</div></section><section class="pack-moves-data"><h3>Moves</h3><div class="pack-moves-list">${movesContent}</div></section>${rawJson}`;
    bindPokemonSpriteFallbacks(details);
  } catch (error) {
    if (version !== packSelectionVersion) return;
    details.innerHTML = `<div class="pack-detail-heading"><span class="eyebrow">POKÉMON SPAWN DATA</span><h2>${safePokemonName(label)}</h2><small>${matchingEntries.map(entry => safePokemonName(entry.path)).join('<br>')}</small></div><div class="pack-detail-empty error">${safePokemonName(error instanceof Error ? error.message : 'Could not read this spawn JSON.')}</div>`;
  }
}

// Match a species reference in a pack to a bundled base species when possible.
function findBaseSpeciesForPackReference(value, species = window.COBBLEMON_ORIGINAL_SPECIES || []) {
  const token = String(value || '').trim().split(/\s+/)[0].replace(/\.(?:png|json)$/i, '');
  const byId = new Map(species.map(entry => [String(entry.id).toLowerCase(), entry]));
  const exactId = token.toLowerCase();
  const exact = byId.get(exactId) || byId.get(exactId.split(':').pop());
  if (exact) return exact;
  const byFilename = new Map(species.map(entry => [`${String(entry.id).toLowerCase()}.json`, entry]));
  return pokemonSpawnJsonCandidates(`${token}.png`).map(name => byFilename.get(name)).find(Boolean) || null;
}

// Index Pokémon referenced by pack textures, species files, additions, and spawn entries.
async function buildPackPokemonInventory(entries) {
  const baseSpecies = window.COBBLEMON_ORIGINAL_SPECIES || [];
  const baseBySuffix = new Map(baseSpecies.map(entry => [resourceFolderSuffix(entry.path, 'species'), entry]));
  const inventory = new Map();
  const readEntryRecords = async files => {
    const records = [];
    for (let start = 0; start < files.length; start += 24) {
      const batch = await Promise.all(files.slice(start, start + 24).map(async entry => {
        try { return { entry, data: await readEditedPackJson(entry) }; } catch { return null; }
      }));
      records.push(...batch.filter(Boolean));
    }
    return records;
  };
  const add = (value, name, source, entry = null, preferredBase = null, texturePath = '') => {
    const base = preferredBase || findBaseSpeciesForPackReference(value, baseSpecies);
    const token = String(value || '').trim().split(/\s+/)[0].replace(/\.(?:png|json)$/i, '');
    const fallbackId = token.includes(':') ? token : token;
    const id = String(base?.id || fallbackId).trim();
    if (!id) return;
    const key = id.toLowerCase();
    if (!inventory.has(key)) {
      const shortName = token.split(':').pop().replace(/[_-]+/g, ' ');
      inventory.set(key, {
        id,
        name: base?.name || name || titleCasePokemon(shortName),
        base,
        texturePath: '',
        sources: new Set(),
        files: { species: new Set(), additions: new Set(), spawns: new Set() }
      });
    }
    const record = inventory.get(key);
    record.name = base?.name || name || record.name;
    record.base ||= base;
    record.sources.add(source);
    const fileGroup = source === 'speciesOverride' ? 'species' : source === 'speciesAddition' ? 'additions' : source === 'spawn' ? 'spawns' : '';
    if (entry && fileGroup) record.files[fileGroup].add(entry.lowerPath);
    if (texturePath && !record.texturePath) record.texturePath = texturePath;
  };

  const texturePaths = collapsePokemonTextureVariants(entries
    .filter(entry => entry.lowerPath.startsWith(POKEMON_TEXTURE_PREFIX) && entry.lowerPath.endsWith('.png'))
    .map(entry => entry.path.slice(POKEMON_TEXTURE_PREFIX.length)));
  texturePaths.forEach(path => {
    const filename = path.split('/').pop().replace(/\.png$/i, '');
    const base = findBaseSpeciesForPackReference(filename, baseSpecies);
    add(base?.id || filename, base?.name || pokemonTextureLabel(path), 'texture', null, base, path);
  });

  const speciesEntries = entries.filter(entry => /(?:^|\/)species\/(?:.*\/)?[^/]+\.json$/i.test(entry.path) && !/(?:^|\/)species_additions\//i.test(entry.path));
  (await readEntryRecords(speciesEntries)).forEach(({ entry, data }) => {
    const suffix = resourceFolderSuffix(entry.path, 'species');
    const base = baseBySuffix.get(suffix);
    const fileName = entry.path.split('/').pop().replace(/\.json$/i, '');
    const namespace = entry.path.match(/(?:^|\/)data\/([^/]+)\/species\//i)?.[1] || 'cobblemon';
    add(base?.id || data.speciesId || `${namespace}:${fileName}`, data.name, 'speciesOverride', entry, base);
  });

  const additionEntries = entries.filter(entry => /(?:^|\/)species_additions\/(?:.*\/)?[^/]+\.json$/i.test(entry.path));
  (await readEntryRecords(additionEntries)).forEach(({ entry, data }) => {
    const fileName = entry.path.split('/').pop().replace(/\.json$/i, '');
    const namespace = entry.path.match(/(?:^|\/)data\/([^/]+)\/species_additions\//i)?.[1] || 'cobblemon';
    const target = data.target || data.speciesId || `${namespace}:${fileName}`;
    add(target, data.name, 'speciesAddition', entry);
  });

  const spawnEntries = entries.filter(entry => /(?:^|\/)spawn_pool_world\/(?:.*\/)?[^/]+\.json$/i.test(entry.path));
  (await readEntryRecords(spawnEntries)).forEach(({ entry, data }) => {
    const spawns = Array.isArray(data) ? data : Array.isArray(data?.spawns) ? data.spawns : [];
    spawns.forEach(spawn => {
      if (spawn?.pokemon) add(spawn.pokemon, '', 'spawn', entry);
    });
  });

  return new Map([...inventory.entries()].sort((left, right) => {
    const a = left[1];
    const b = right[1];
    return (a.base?.nationalPokedexNumber ?? Number.MAX_SAFE_INTEGER) - (b.base?.nationalPokedexNumber ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name);
  }));
}

// Draw the discovered Pokémon names in the pack sidebar.
async function renderPokemonPackList(entries) {
  const list = $('#packPokemonList');
  const selectedId = list.querySelector('.pack-pokemon-row.active')?.dataset.packPokemonId || '';
  activePackPokemonInventory = await buildPackPokemonInventory(entries);
  const records = [...activePackPokemonInventory.values()];
  $('#packPokemonCount').dataset.total = String(records.length);
  $('#packPokemonCount').textContent = records.length.toLocaleString();
  if (!records.length) {
    list.innerHTML = '<div class="pack-empty-list">No Pokémon references were found in this pack. Pokémon can be indexed from textures, species files, species additions, or spawn entries.</div>';
    return;
  }
  list.innerHTML = records.map(record => {
    const texturePath = record.texturePath || `${record.id}.png`;
    const sprites = pokemonSpriteCandidates(texturePath, record.id, record.name);
    const badge = !record.base
      ? ['pack-inventory-badge added', 'Added by pack']
      : record.sources.has('speciesOverride')
        ? ['pack-inventory-badge override', 'Overrides base']
        : record.sources.has('spawn')
          ? ['pack-inventory-badge spawn', 'Spawn data']
          : record.sources.has('speciesAddition')
            ? ['pack-inventory-badge spawn', 'Pack addition']
            : ['pack-inventory-badge texture', 'Texture only'];
    const sourcePath = record.texturePath || [...record.files.species, ...record.files.additions, ...record.files.spawns][0] || record.id;
    return `<button class="pack-pokemon-row" type="button" data-pack-pokemon-id="${safePokemonName(record.id)}" data-pokemon-texture="${safePokemonName(texturePath)}" ${record.base ? `data-original-pokemon="${safePokemonName(record.base.id)}"` : ''} data-pokemon-name="${safePokemonName(record.name)}" data-search="${safePokemonName(`${record.name} ${record.id} ${sourcePath}`.toLowerCase())}" title="Show pack data for ${safePokemonName(record.name)}"><span class="pack-pokemon-avatar"><span class="pack-pokemon-mark" aria-hidden="true" hidden><i></i></span><img class="pack-pokemon-sprite" src="./Images/sprites/${encodeURIComponent(sprites[0])}.png" data-pokemon-sprite-candidates="${safePokemonName(sprites.join('|'))}" alt="" loading="lazy"></span><span class="pack-pokemon-copy"><span class="pack-pokemon-name-line"><b>${safePokemonName(record.name)}</b><small class="${badge[0]}">${badge[1]}</small></span><small>${safePokemonName(sourcePath)}</small></span></button>`;
  }).join('');
  bindPokemonSpriteFallbacks(list);
  $$('.pack-pokemon-row').forEach(row => {
    row.classList.toggle('active', row.dataset.packPokemonId.toLowerCase() === selectedId.toLowerCase());
    row.onclick = () => showPokemonSpawns(row.dataset.pokemonTexture, row);
  });
  filterPackPokemonLists();
}

// Draw the bundled original Cobblemon species as a separate sidebar list.
function renderBasePokemonList() {
  const list = $('#packBasePokemonList');
  const species = [...(window.COBBLEMON_ORIGINAL_SPECIES || [])].sort((left, right) =>
    (left.nationalPokedexNumber ?? Number.MAX_SAFE_INTEGER) - (right.nationalPokedexNumber ?? Number.MAX_SAFE_INTEGER) || left.name.localeCompare(right.name)
  );
  $('#packBasePokemonCount').dataset.total = String(species.length);
  $('#packBasePokemonCount').textContent = species.length.toLocaleString();
  if (!species.length) {
    list.innerHTML = '<div class="pack-empty-list">Original Cobblemon species data could not be loaded.</div>';
    return;
  }
  list.innerHTML = species.map(entry => {
    const sprites = pokemonSpriteCandidates(entry.id, entry.name);
    return `<button class="pack-base-pokemon-row" type="button" data-original-pokemon="${safePokemonName(entry.id)}" data-search="${safePokemonName(`${entry.name} ${entry.id} ${entry.nationalPokedexNumber || ''}`.toLowerCase())}" title="Show base data for ${safePokemonName(entry.name)}"><span class="pack-pokemon-avatar"><span class="pack-pokemon-mark" aria-hidden="true" hidden><i></i></span><img class="pack-pokemon-sprite" src="./Images/sprites/${encodeURIComponent(sprites[0])}.png" data-pokemon-sprite-candidates="${safePokemonName(sprites.join('|'))}" alt="" loading="lazy"></span><span class="pack-pokemon-copy"><b>${safePokemonName(entry.name)}</b><small>${entry.nationalPokedexNumber ? `#${String(entry.nationalPokedexNumber).padStart(4, '0')}` : safePokemonName(entry.id)}</small></span></button>`;
  }).join('');
  bindPokemonSpriteFallbacks(list);
  $$('.pack-base-pokemon-row').forEach(row => row.onclick = () => showPokemonSpawns(`${row.dataset.originalPokemon}.png`, row));
  filterPackPokemonLists();
}

// Filter pack and base Pokémon together by name, resource name, or Pokédex number.
function filterPackPokemonLists() {
  const query = $('#packPokemonSearch').value.trim().toLowerCase();
  [['packPokemonList', 'packPokemonCount'], ['packBasePokemonList', 'packBasePokemonCount']].forEach(([listId, countId]) => {
    const rows = $$(`#${listId} .pack-pokemon-row, #${listId} .pack-base-pokemon-row`);
    let visible = 0;
    rows.forEach(row => {
      const matches = !query || row.dataset.search.includes(query);
      row.hidden = !matches;
      if (matches) visible++;
    });
    const count = $(`#${countId}`);
    const total = Number(count.dataset.total || rows.length);
    count.textContent = query ? `${visible}/${total}` : total.toLocaleString();
  });
}

// Apply changes from editable drop fields directly to the selected pack file draft.
function updatePackDropField(input) {
  const document = packEditDocuments.get(input.dataset.packFile);
  if (!document) return;
  const drops = document.drops || (document.drops = { amount: 1, entries: [] });
  drops.entries ||= [];
  if (input.hasAttribute('data-drop-amount')) {
    drops.amount = input.value === '' ? '' : Number(input.value);
  } else {
    const index = Number(input.dataset.dropIndex);
    const drop = drops.entries[index];
    if (!drop) return;
    const field = input.dataset.dropField;
    if (field === 'item') {
      if (drop.item && typeof drop.item === 'object') drop.item.id = input.value;
      else drop.item = input.value;
      const preview = input.closest('.pack-drop-edit-item')?.querySelector('[data-drop-preview]');
      const image = input.value ? localSprite(input.value) : '';
      if (preview) { preview.src = image; preview.hidden = !image; }
    } else if (input.value === '') {
      delete drop[field];
    } else if (input.dataset.dropKind === 'json') {
      try { drop[field] = JSON.parse(input.value); } catch { return; }
    } else if (input.type === 'number') {
      drop[field] = input.value === '' ? '' : Number(input.value);
    } else drop[field] = input.value;
  }
  dirtyPackFiles.add(input.dataset.packFile);
  updatePackEditStatus();
}

// Update one root spawn field or one nested condition without replacing the whole source document.
function updatePackSpawnField(input) {
  const document = packEditDocuments.get(input.dataset.packFile);
  const spawnIndex = Number(input.dataset.spawnIndex);
  if (!document) return;
  const spawnList = Array.isArray(document) ? document : Array.isArray(document.spawns) ? document.spawns : [];
  const spawn = spawnList[spawnIndex];
  if (!spawn) return;
  const kind = input.dataset.spawnKind;
  let value;
  if (kind === 'boolean') value = input.checked;
  else if (kind === 'array') value = input.value.split(',').map(part => part.trim()).filter(Boolean);
  else if (kind === 'array-item') {
    const path = JSON.parse(input.dataset.conditionPath);
    const values = getNestedSpawnValue(spawn, path);
    if (!Array.isArray(values)) return;
    values[Number(input.dataset.conditionArrayIndex)] = input.value;
    value = values;
  }
  else if (kind === 'number') value = input.value === '' ? undefined : Number(input.value);
  else value = input.value;
  const path = input.dataset.conditionPath ? JSON.parse(input.dataset.conditionPath) : [input.dataset.spawnField];
  if (kind !== 'array-item') setNestedSpawnValue(spawn, path, value, value === undefined || (Array.isArray(value) && !value.length) || value === '');
  dirtyPackFiles.add(input.dataset.packFile);
  updatePackEditStatus();
}

// Update a file-level spawn setting such as whether this spawn JSON is enabled.
function updatePackSpawnFileField(input) {
  const document = packEditDocuments.get(input.dataset.packFile);
  if (document === undefined) return;
  const key = input.dataset.fileField;
  if (key === 'enabled') {
    if (Array.isArray(document)) packEditDocuments.set(input.dataset.packFile, { enabled: input.checked, spawns: document });
    else document.enabled = input.checked;
    dirtyPackFiles.add(input.dataset.packFile);
    updatePackEditStatus();
  }
}

function getNestedSpawnValue(target, path) {
  return path.reduce((value, key) => value?.[key], target);
}

// Set or remove a nested property such as condition.biomes on a spawn draft.
function setNestedSpawnValue(target, path, value, remove = false) {
  let cursor = target;
  path.slice(0, -1).forEach(key => {
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
    cursor = cursor[key];
  });
  if (remove) delete cursor[path[path.length - 1]];
  else cursor[path[path.length - 1]] = value;
}

// Return a spawn array while preserving whether the source file uses a root array or a spawns property.
function getEditableSpawnList(document) {
  if (Array.isArray(document)) return document;
  if (!Array.isArray(document.spawns)) document.spawns = [];
  return document.spawns;
}

// Re-render the open Pokémon after a drop is added, removed, or a JSON file is applied.
function refreshPackEditorSelection() {
  const selected = $$('.pack-pokemon-row.active, .pack-base-pokemon-row.active')[0];
  if (selected) selected.click();
  else if (activePackView === 'spawns') showPackSpawns();
}

$('#packPokemonDetails').addEventListener('input', event => {
  if (event.target.matches('[data-spawn-preset-time-filter]')) {
    const slider = event.target;
    const presetName = slider.dataset.spawnPresetTimeFilter;
    const timeIndex = Number(slider.value);
    spawnPresetTimeFilters.set(presetName, timeIndex);
    const card = slider.closest('.pack-spawn-preset');
    const group = activePackSpawnGroups?.find(item => item.name === presetName);
    if (!card || !group) return;
    const label = SPAWN_TIME_FILTERS[timeIndex];
    card.querySelector('[data-spawn-time-label]').textContent = label;
    card.querySelectorAll('.pack-preset-time-labels span').forEach((option, index) => option.classList.toggle('active', index === timeIndex));
    card.querySelector('summary>small').textContent = `${new Set(filterSpawnPresetEntries(group.entries, timeIndex).map(entry => entry.pokemon)).size} Pokémon`;
    card.querySelector('.pack-preset-spawn-content').innerHTML = renderSpawnPresetEntries(group.entries, timeIndex);
    bindPokemonSpriteFallbacks(card.querySelector('.pack-preset-spawn-content'));
    return;
  }
  if (event.target.id === 'packDropSearch') renderPackDropItems();
  if (event.target.matches('[data-pack-file][data-drop-field], [data-drop-amount]')) updatePackDropField(event.target);
  if (event.target.matches('[data-pack-file][data-file-field]')) updatePackSpawnFileField(event.target);
  if (event.target.matches('[data-pack-file][data-spawn-field], [data-condition-path]')) updatePackSpawnField(event.target);
});

$('#packPokemonDetails').addEventListener('change', async event => {
  if (event.target.matches('[data-drop-field][data-drop-kind="json"]')) updatePackDropField(event.target);
  if (event.target.matches('[data-pack-file][data-file-field]')) updatePackSpawnFileField(event.target);
  if (event.target.matches('[data-pack-file][data-spawn-field], [data-condition-path]')) updatePackSpawnField(event.target);
  if (event.target.matches('[data-spawn-field="pokemon"]')) await renderPokemonPackList([...activePackEntries.values()]);
  if (event.target.matches('[data-pack-file][data-file-field="enabled"]') && activePackView === 'spawns' && activePackSpawnPage === 'toggle') await renderPackSpawnToggleCards();
});

$('#packPokemonDetails').addEventListener('click', async event => {
  const spawnPageButton = event.target.closest('[data-pack-spawn-page]');
  if (spawnPageButton) {
    await showPackSpawns(spawnPageButton.dataset.packSpawnPage);
    return;
  }
  const dropCategoryButton = event.target.closest('[data-pack-drop-category]');
  if (dropCategoryButton) {
    packDropCategory = dropCategoryButton.dataset.packDropCategory;
    $$('[data-pack-drop-category]').forEach(button => button.classList.toggle('active', button === dropCategoryButton));
    renderPackDropItems();
    return;
  }
  const dropItemButton = event.target.closest('[data-pack-drop-item]');
  if (dropItemButton) {
    packDropSelectedItem = dropItemButton.dataset.packDropItem;
    renderPackDropItems();
    renderPackDropMatches(packDropSelectedItem);
    return;
  }
  const biomePickerButton = event.target.closest('[data-pack-spawn-biome-picker]');
  if (biomePickerButton) {
    const target = biomePickerButton.parentElement.querySelector('input[type="hidden"]');
    if (target) openSpawnBiomePicker(target);
    return;
  }
  const action = event.target.closest('[data-pack-action]');
  if (!action) return;
  const file = action.dataset.packFile;
  if (action.dataset.packAction === 'toggle-spawn-edit') {
    packEditMode.spawn = !packEditMode.spawn;
    if (packEditMode.spawn && activePackFile && !hasMatchingSpawnFileForPokemon(activePackPokemonId)) ensureSpawnFileForPokemon(activePackPokemonId);
    refreshPackEditorSelection();
    return;
  }
  if (action.dataset.packAction === 'toggle-drop-edit') {
    packEditMode.drops = !packEditMode.drops;
    refreshPackEditorSelection();
    return;
  }
  if (action.dataset.packAction === 'add-pack-drop-override') {
    const baseSpecies = (window.COBBLEMON_ORIGINAL_SPECIES || []).find(entry => entry.id === action.dataset.pokemonId);
    if (!baseSpecies || !activePackFile) return;
    action.disabled = true;
    try {
      await ensureBaseSpeciesOverrideFile(baseSpecies);
      await renderPokemonPackList([...activePackEntries.values()]);
      packEditMode.drops = true;
      refreshPackEditorSelection();
    } catch (error) {
      $('#packUploadStatus').textContent = error instanceof Error ? error.message : 'Could not create the species drop override.';
      $('#packUploadStatus').classList.add('error');
      action.disabled = false;
    }
    return;
  }
  const document = packEditDocuments.get(file);
  if (!document) return;
  if (action.dataset.packAction === 'pick-drop-item') {
    const field = action.closest('.pack-drop-edit-item')?.querySelector('[data-drop-field="item"]');
    if (field) openItemPicker(id => { field.value = id; field.dispatchEvent(new Event('input', { bubbles: true })); }, field.value);
  } else if (action.dataset.packAction === 'add-drop') {
    const drops = document.drops || (document.drops = { amount: 1, entries: [] });
    drops.entries ||= [];
    drops.entries.push({ item: 'minecraft:diamond', quantityRange: '1' });
    dirtyPackFiles.add(file);
    updatePackEditStatus();
    refreshPackEditorSelection();
  } else if (action.dataset.packAction === 'remove-drop') {
    document.drops.entries.splice(Number(action.dataset.dropIndex), 1);
    dirtyPackFiles.add(file);
    updatePackEditStatus();
    refreshPackEditorSelection();
  } else if (action.dataset.packAction === 'add-spawn') {
    const spawnList = getEditableSpawnList(document);
    const pokemon = (action.dataset.pokemonId || '').toLowerCase() || 'pokemon';
    spawnList.push({ id: `${pokemon}-${spawnList.length + 1}`, pokemon, bucket: 'common', weight: 1, level: '1-10', spawnablePositionType: 'grounded', presets: ['natural'], type: 'pokemon', condition: { biomes: ['#cobblemon:is_overworld'] } });
    dirtyPackFiles.add(file);
    updatePackEditStatus();
    await renderPokemonPackList([...activePackEntries.values()]);
    refreshPackEditorSelection();
  } else if (action.dataset.packAction === 'remove-spawn') {
    getEditableSpawnList(document).splice(Number(action.dataset.spawnIndex), 1);
    dirtyPackFiles.add(file);
    updatePackEditStatus();
    await renderPokemonPackList([...activePackEntries.values()]);
    refreshPackEditorSelection();
  } else if (action.dataset.packAction === 'remove-condition') {
    setNestedSpawnValue(getEditableSpawnList(document)[Number(action.dataset.spawnIndex)], JSON.parse(action.dataset.conditionPath), undefined, true);
    dirtyPackFiles.add(file);
    updatePackEditStatus();
    refreshPackEditorSelection();
  } else if (action.dataset.packAction === 'add-biome-value' || action.dataset.packAction === 'remove-biome-value') {
    const spawn = getEditableSpawnList(document)[Number(action.dataset.spawnIndex)];
    const path = JSON.parse(action.dataset.conditionPath);
    let values = getNestedSpawnValue(spawn, path);
    if (!Array.isArray(values)) {
      setNestedSpawnValue(spawn, path, []);
      values = getNestedSpawnValue(spawn, path);
    }
    if (action.dataset.packAction === 'add-biome-value') values.push('minecraft:plains');
    else values.splice(Number(action.dataset.conditionArrayIndex), 1);
    dirtyPackFiles.add(file);
    updatePackEditStatus();
    refreshPackEditorSelection();
  } else if (action.dataset.packAction === 'add-condition') {
    const card = action.closest('.pack-spawn-edit-card');
    const key = card?.querySelector('[data-new-condition-key]')?.value.trim();
    const rawValue = card?.querySelector('[data-new-condition-value]')?.value.trim();
    if (!key || !rawValue) return;
    const value = rawValue.includes(',') ? rawValue.split(',').map(part => part.trim()).filter(Boolean) : rawValue === 'true' ? true : rawValue === 'false' ? false : rawValue !== '' && Number.isFinite(Number(rawValue)) ? Number(rawValue) : rawValue;
    const group = card.querySelector('[data-new-condition-group]').value;
    setNestedSpawnValue(getEditableSpawnList(document)[Number(action.dataset.spawnIndex)], [group, ...key.split('.').filter(Boolean)], value);
    dirtyPackFiles.add(file);
    updatePackEditStatus();
    refreshPackEditorSelection();
  }
});

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
$('#packPokemonSearch').addEventListener('input', filterPackPokemonLists);
$('#closeSpawnBiomePicker').addEventListener('click', () => $('#spawnBiomeDialog').close());
$('#spawnBiomeSearch').addEventListener('input', renderSpawnBiomeGrid);
$$('[data-spawn-biome-category]').forEach(button => button.addEventListener('click', () => {
  spawnBiomePickerCategory = button.dataset.spawnBiomeCategory;
  $$('[data-spawn-biome-category]').forEach(category => category.classList.toggle('active', category === button));
  renderSpawnBiomeGrid();
}));
renderBasePokemonList();
if (window.location.protocol === 'file:') {
  $('#packUploadStatus').textContent = 'Local file mode blocks Cobblemon data fetches. Run Start Local Server.bat, then open http://127.0.0.1:8000.';
}

$('#packSpawnsButton').addEventListener('click', showPackSpawns);
$('#packDropsButton').addEventListener('click', showPackDrops);
$('#downloadPackJar').addEventListener('click', downloadEditedPackJar);
$('#checkPackJson').addEventListener('click', checkPackJsonFiles);
$('#createEmptyPackJar').addEventListener('click', createEmptyCobblemonPack);

// Keep provenance labels attached to the Pokémon heading after each detail render.
new MutationObserver(() => {
  const heading = $('#packPokemonDetails .pack-detail-heading');
  if (heading && activePackProvenanceHtml && !heading.querySelector('.pack-detail-provenance')) {
    heading.insertAdjacentHTML('beforeend', `<div class="pack-detail-provenance">${activePackProvenanceHtml}</div>`);
  }
  $$('#packPokemonDetails .spawn-source').forEach(source => {
    if (source.previousElementSibling?.classList.contains('pack-source-badge')) return;
    source.insertAdjacentHTML('beforebegin', spawnSourceBadge(source.textContent.trim()));
  });
}).observe($('#packPokemonDetails'), { childList: true });

// Handle a local ZIP selection and report what the pack contains.
$('#packJarInput').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (dirtyPackFiles.size && !window.confirm('Loading another pack will discard the edits held in this session. Continue?')) {
    event.target.value = '';
    return;
  }
  const status = $('#packUploadStatus');
  status.textContent = `Reading ${file.name}…`;
  status.classList.remove('error');
  try {
    if (!file.name.toLowerCase().endsWith('.zip')) throw new Error('Choose a .zip datapack.');
    await loadPackArchive(file);
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Could not read this ZIP datapack.';
    status.classList.add('error');
  } finally {
    event.target.value = '';
  }
});
