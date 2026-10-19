/*
 * Local item picker.
 * Resolves Minecraft and mod item IDs to images and handles browsing.
 */

// Resolve a catalog entry or namespaced item ID to its local image path.
function localSprite(value) {
  if (value && typeof value === 'object') {
    if (value.image) {
      const folder = value.id?.startsWith('aquamirae:') ? 'aquamiraeItems' : value.id?.startsWith('betternether:') ? 'betternetherItems' : value.id?.startsWith('aether:') ? 'aetherItems' : value.id?.startsWith('cobblesafari:') ? 'cobblesafariItems' : 'cobblemonItems';
      return `./Images/${folder}/${value.image.split('/').map(encodeURIComponent).join('/')}`;
    }
    value = value.id || value.name || '';
  }
  const id = String(value || '');
  if (id.startsWith('cobblemon:') || id.startsWith('aquamirae:') || id.startsWith('betternether:') || id.startsWith('aether:') || id.startsWith('cobblesafari:')) {
    const namespace = id.split(':', 1)[0];
    const folder = namespace === 'cobblemon' ? 'cobblemonItems' : namespace === 'aquamirae' ? 'aquamiraeItems' : namespace === 'betternether' ? 'betternetherItems' : namespace === 'aether' ? 'aetherItems' : 'cobblesafariItems';
    const catalog = namespace === 'cobblemon' ? window.COBBLEMON_ITEM_CATALOG : namespace === 'aquamirae' ? window.AQUAMIRAE_ITEM_CATALOG : namespace === 'betternether' ? window.BETTERNETHER_ITEM_CATALOG : namespace === 'aether' ? window.AETHER_ITEM_CATALOG : window.COBBLESAFARI_ITEM_CATALOG;
    const name = id.slice(namespace.length + 1);
    const entry = (catalog || []).find(item => item.id === id);
    const image = entry?.image || `${name}.png`;
    return `./Images/${folder}/${image.split('/').map(encodeURIComponent).join('/')}`;
  }
  return `./Images/${encodeURIComponent(id.replace(/^minecraft:/, ''))}.png`;
}

// Keep the quest icon preview synchronized with the selected item ID.
function setIconPreview(id) {
  const image = $('#iconPreview');
  if (!image) return;
  image.style.visibility = id ? 'visible' : 'hidden';
  image.onerror = () => { image.style.visibility = 'hidden'; };
  image.onload = () => { image.style.visibility = 'visible'; };
  image.src = id ? localSprite(id) : '';
}

// Ensure the local catalog scripts are present before displaying the picker.
async function loadItemCatalog() {
  const catalogs = [
    ['LOCAL_ITEM_CATALOG', 'item-catalog.js', 'Minecraft'],
    ['COBBLEMON_ITEM_CATALOG', 'cobblemon-catalog.js', 'Cobblemon'],
    ['AQUAMIRAE_ITEM_CATALOG', 'aquamirae-catalog.js', 'Aquamirae'],
    ['BETTERNETHER_ITEM_CATALOG', 'betternether-catalog.js', 'Better Nether'],
    ['AETHER_ITEM_CATALOG', 'aether-catalog.js', 'Aether'],
    ['COBBLESAFARI_ITEM_CATALOG', 'cobblesafari-catalog.js', 'CobbleSafari']
  ];
  for (const [key, filename, label] of catalogs) {
    if (!Array.isArray(window[key]) || !window[key].length) {
      $('#itemStatus').textContent = `Could not load ${filename}. Keep it beside index.html.`;
      throw new Error(`${label} item catalog missing`);
    }
  }
}

// Open the picker and select the category matching the item already in the field.
function openItemPicker(target, currentId = '') {
  pickerTarget = target;
  const existing = typeof target === 'function' ? currentId : target?.value;
  const id = String(existing || '');
  pickerCategory = id.startsWith('cobblemon:') ? 'cobblemon' : id.startsWith('aquamirae:') ? 'aquamirae' : id.startsWith('betternether:') ? 'betternether' : id.startsWith('aether:') ? 'aether' : id.startsWith('cobblesafari:') ? 'cobblesafari' : 'minecraft';
  $('#itemSearch').value = '';
  $('#itemGrid').innerHTML = '';
  $('#itemStatus').textContent = 'Loading local item catalog…';
  $$('#itemDialog .item-category[data-category]').forEach(button => button.classList.toggle('active', button.dataset.category === pickerCategory));
  $('#itemDialog').showModal();
  loadItemCatalog().then(renderItemGrid).catch(() => {});
}

// Filter the current category and display every matching local item.
function renderItemGrid() {
  const query = $('#itemSearch').value.trim().toLowerCase();
  const categories = {
    minecraft: window.LOCAL_ITEM_CATALOG,
    cobblemon: window.COBBLEMON_ITEM_CATALOG,
    aquamirae: window.AQUAMIRAE_ITEM_CATALOG,
    betternether: window.BETTERNETHER_ITEM_CATALOG,
    aether: window.AETHER_ITEM_CATALOG,
    cobblesafari: window.COBBLESAFARI_ITEM_CATALOG
  };
  itemCatalog = query
    ? Object.values(categories).flat()
    : (categories[pickerCategory] || categories.minecraft);
  const matched = itemCatalog.filter(item => item.label.toLowerCase().includes(query) || item.id.includes(query));
  $('#itemStatus').textContent = `${matched.length.toLocaleString()} items${query ? ' across all categories' : ''}`;
  $('#itemGrid').innerHTML = matched.map(item => `<button class="item-option" type="button" data-item-id="${safe(item.id)}"><img loading="lazy" src="${safe(localSprite(item))}" alt="" /><span><b>${safe(item.label)}</b><small>${safe(item.id)}</small></span></button>`).join('');
  $$('.item-option').forEach(button => button.onclick = () => {
    if (typeof pickerTarget === 'function') pickerTarget(button.dataset.itemId);
    else if (pickerTarget) {
      pickerTarget.value = button.dataset.itemId;
      pickerTarget.dispatchEvent(new Event('input', { bubbles: true }));
      if (pickerTarget === $('#icon')) setIconPreview(button.dataset.itemId);
    }
    $('#itemDialog').close();
  });
  $$('.item-option img').forEach(image => image.onerror = () => { image.style.visibility = 'hidden'; });
}

// Open the searchable vanilla mob picker for an entity objective field.
function openEntityPicker(target) {
  entityPickerTarget = target;
  const namespace = String(target?.value || '').split(':')[0];
  entityPickerCategory = ENTITY_CATEGORIES.some(category => category.id === namespace) ? namespace : 'minecraft';
  $('#entitySearch').value = '';
  $$('[data-entity-category]').forEach(button => button.classList.toggle('active', button.dataset.entityCategory === entityPickerCategory));
  renderEntityGrid();
  $('#entityDialog').showModal();
}

// Filter available vanilla mob IDs and show the matching local spawn egg icons.
function renderEntityGrid() {
  const query = $('#entitySearch').value.trim().toLowerCase();
  const source = query ? ENTITY_CATALOG : ENTITY_CATALOG.filter(entity => entity.category === entityPickerCategory);
  const matched = source.filter(entity => entity.label.toLowerCase().includes(query) || entity.id.toLowerCase().includes(query));
  $('#entityStatus').textContent = `${matched.length} entities${query ? ' across all categories' : ` in ${ENTITY_CATEGORIES.find(category => category.id === entityPickerCategory)?.label || 'Minecraft'}`}`;
  $('#entityGrid').innerHTML = matched.map(entity => `<button class="item-option" type="button" data-entity-id="${safe(entity.id)}"><img loading="lazy" src="${safe(localSprite(entity.icon))}" alt="" /><span><b>${safe(entity.label)}</b><small>${safe(entity.id)}</small></span></button>`).join('');
  $$('[data-entity-id]').forEach(button => button.onclick = () => {
    if (!entityPickerTarget) return;
    entityPickerTarget.value = button.dataset.entityId;
    entityPickerTarget.dispatchEvent(new Event('input', { bubbles: true }));
    $('#entityDialog').close();
  });
  $$('#entityGrid img').forEach(image => image.onerror = () => { image.style.visibility = 'hidden'; });
}
