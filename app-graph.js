/*
 * Dependency map renderer.
 * Displays one selected chapter as a downward tree with objective and visibility details.
 */
function renderGraph() {
  const svg = $('#graph');
  const chapterSelect = $('#graphChapter');
  const nodeWidth = 168, nodeHeight = 68, slotWidth = 202, rowHeight = 112, padding = 30;
  const dark = document.documentElement.dataset.theme === 'dark';
  const palette = {
    surface: dark ? '#202b23' : '#f4f8f4',
    node: dark ? '#27372c' : '#ffffff',
    selectedNode: dark ? '#304333' : '#e1eee3',
    border: dark ? '#394d3f' : '#cbdacf',
    hover: dark ? '#a9cbb0' : '#2c6245',
    text: dark ? '#e0eae1' : '#294b36',
    muted: dark ? '#a2b5a6' : '#6d8474',
    accent: dark ? '#a9cbb0' : '#2c6245',
    dots: dark ? '#35493a' : '#d1dfd4',
    edge: dark ? '#819d87' : '#8db596',
    visible: '#9dff24',
    visibleGlow: '#9dff2480',
    failure: dark ? '#ffad42' : '#b85b12',
    failureGlow: dark ? '#ff9f2f99' : '#e8873266',
    hidden: dark ? '#c084fc' : '#8b5cf6',
    hiddenGlow: dark ? '#c084fc99' : '#8b5cf699',
    rewardItem: '#65e879',
    rewardItemGlow: '#65e87999',
    rewardXp: '#f5c451',
    rewardXpGlow: '#f5c451aa',
    rewardRandom: '#c084fc',
    rewardRandomGlow: '#c084fcaa',
    objective: dark ? '#b8c9ba' : '#607667'
  };

  // Build chapter choices, including a group for quests without a valid chapter.
  const chapters = state.chapters.map(chapter => ({
    id: chapter.fileName,
    title: chapter.data.name || chapter.fileName,
    quests: state.quests.filter(quest => quest.chapter === chapter.fileName)
  }));
  const assigned = new Set(chapters.flatMap(chapter => chapter.quests.map(quest => quest.key)));
  const unassigned = state.quests.filter(quest => !assigned.has(quest.key));
  if (unassigned.length) chapters.push({ id: '__unassigned__', title: 'No chapter', quests: unassigned });
  if (!chapters.length) chapters.push({ id: '__unassigned__', title: 'No chapter', quests: [] });

  const selectedQuest = current();
  const preferredChapter = selectedQuest?.chapter || '__unassigned__';
  if (!chapters.some(chapter => chapter.id === graphChapter)) {
    graphChapter = chapters.some(chapter => chapter.id === preferredChapter) ? preferredChapter : chapters[0].id;
  }
  chapterSelect.innerHTML = chapters.map(chapter => `<option value="${safe(chapter.id)}">${safe(chapter.title)} (${chapter.quests.length})</option>`).join('');
  chapterSelect.value = graphChapter;
  const chapter = chapters.find(item => item.id === graphChapter) || chapters[0];
  $('#mapEyebrow').textContent = showAllQuestsMap ? 'ALL CHAPTERS MAP' : 'CHAPTER MAP';
  $('#mapTitle').textContent = showAllQuestsMap ? 'Quest dependencies across chapters' : 'Quest dependencies';
  chapterSelect.closest('.map-controls').hidden = showAllQuestsMap;
  svg.setAttribute('aria-label', showAllQuestsMap ? 'Quest dependency map across all chapters' : 'Quest dependency map');

  // Resolve prerequisite IDs to quests in this chapter and compute each quest's depth.
  const mapGroups = showAllQuestsMap ? chapters : [chapter];
  const quests = mapGroups.flatMap(group => group.quests);
  const groupByQuest = new Map(mapGroups.flatMap(group => group.quests.map(quest => [quest.key, group.id])));
  const indexById = new Map(quests.map((quest, index) => [questId(quest), index]));
  const nodes = quests.map((quest, index) => ({
    quest,
    index,
    groupId: groupByQuest.get(quest.key),
    parents: (quest.data.requirements || []).map(requirement => indexById.get(requirement.quest))
      .filter((parent, position, list) => parent !== undefined && parent !== index && list.indexOf(parent) === position),
    children: []
  }));
  nodes.forEach(node => {
    node.localParents = showAllQuestsMap ? node.parents.filter(parent => nodes[parent].groupId === node.groupId) : node.parents;
    node.primaryParent = node.localParents[0] ?? null;
  });
  nodes.forEach(node => { if (node.primaryParent !== null) nodes[node.primaryParent].children.push(node.index); });

  const depthCache = new Map();
  function getDepth(index, path = new Set()) {
    if (depthCache.has(index)) return depthCache.get(index);
    if (path.has(index)) return 0;
    const nextPath = new Set(path);
    nextPath.add(index);
    const parents = nodes[index].localParents;
    const depth = parents.length ? Math.max(...parents.map(parent => getDepth(parent, nextPath) + 1)) : 0;
    depthCache.set(index, depth);
    return depth;
  }
  nodes.forEach(node => { node.depth = getDepth(node.index); });

  // Keep the first title line clear of the icon and wrap the rest below it.
  const titleMeasure = document.createElement('canvas').getContext('2d');
  // Measure slightly larger than the rendered text to account for font loading differences.
  titleMeasure.font = '600 11px Arial, sans-serif';
  function wrapTitle(title) {
    const words = String(title || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    const maxWidthForLine = () => lines.length ? nodeWidth - 46 : nodeWidth - 78;
    const titleWords = words.length ? words : ['Untitled quest'];
    for (const [wordIndex, word] of titleWords.entries()) {
      line = line.trimEnd();
      const candidate = line ? `${line} ${word}` : word;
      if (line && titleMeasure.measureText(candidate).width > maxWidthForLine()) {
        lines.push(line);
        line = '';
      }
      if (line) line += ' ';
      for (const character of word) {
        const next = line + character;
        if (line && titleMeasure.measureText(next).width > maxWidthForLine()) {
          lines.push(line);
          line = character;
        } else line = next;
      }
      if (wordIndex < titleWords.length - 1) line += ' ';
    }
    if (line) lines.push(line);
    return lines;
  }
  // Wrap long objective names within the card instead of clipping them.
  function wrapObjective(text, reserveIcon = true) {
    const previousFont = titleMeasure.font;
    titleMeasure.font = '8px Arial, sans-serif';
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const source = words.length ? words : ['Objective'];
    const lines = [];
    let line = '';
    const maxWidth = () => lines.length ? nodeWidth - 46 : nodeWidth - (reserveIcon ? 61 : 46);
    for (const [wordIndex, word] of source.entries()) {
      line = line.trimEnd();
      const candidate = line ? `${line} ${word}` : word;
      if (line && titleMeasure.measureText(candidate).width > maxWidth()) {
        lines.push(line);
        line = '';
      }
      if (line) line += ' ';
      for (const character of word) {
        const next = line + character;
        if (line && titleMeasure.measureText(next).width > maxWidth()) {
          lines.push(line);
          line = character;
        } else line = next;
      }
      if (wordIndex < source.length - 1) line += ' ';
    }
    if (line) lines.push(line);
    titleMeasure.font = previousFont;
    return lines;
  }
  // Choose an icon and readable summary for the first objective on each quest.
  function describeObjectives(quest) {
    const objectives = quest.data.objectives || [];
    const objective = objectives[0];
    const type = objective?.type || '';
    const dimension = type === 'questlog:visit_dimension' ? DIMENSIONS.find(item => item.id === objective.dimension) : null;
    const targetId = objective?.item?.id || objective?.item || objective?.entity || objective?.block || objective?.stat || objective?.biome;
    const iconId = dimension?.icon || (type.startsWith('questlog:item_')
      ? targetId || 'minecraft:paper'
      : type === 'questlog:block_mine' || type === 'questlog:block_place' ? targetId || 'minecraft:stone'
      : type === 'questlog:entity_kill' || type === 'questlog:entity_death' ? 'minecraft:iron_sword'
      : type === 'questlog:entity_breed' ? 'minecraft:wheat'
      : type === 'questlog:entity_tame' ? 'minecraft:lead'
      : type === 'questlog:stat' ? 'minecraft:clock'
      : 'minecraft:paper');
    const typeLabel = OBJECTIVES[type]?.label || (type ? type.replace(/^.*:/, '').replace(/[_-]+/g, ' ') : 'Objective');
    const target = String(targetId || objective?.dimension || objective?.quest || '').split(':').pop().replace(/[_-]+/g, ' ');
    const amount = Number(objective?.required_amount);
    const name = objective?.name || dimension?.label || (target ? `${typeLabel}: ${target}` : typeLabel);
    const summary = objectives.length
      ? `${name}${amount > 1 ? ` ×${amount}` : ''}${objectives.length > 1 ? ` +${objectives.length - 1}` : ''}`
      : 'No objectives';
    const tooltip = objectives.map(item => {
      const label = item.name || OBJECTIVES[item.type]?.label || item.type || 'Objective';
      const itemTarget = item.item?.id || item.item || item.entity || item.block || item.stat || item.dimension;
      const quantity = Number(item.required_amount);
      return `${label}${itemTarget ? ` (${itemTarget})` : ''}${quantity > 1 ? ` ×${quantity}` : ''}`;
    }).join('\n');
    return { objectiveIconId: iconId, objectiveSummary: summary, objectiveLines: wrapObjective(summary), objectiveTooltip: tooltip, hasObjectives: objectives.length > 0 };
  }
  // Show the first failure condition on the card and expose all conditions in its tooltip.
  function describeFailures(quest) {
    const failures = quest.data.failures || [];
    const failure = failures[0];
    const type = failure?.type || '';
    const typeLabel = FAILURES[type]?.label || (type ? type.replace(/^.*:/, '').replace(/[_-]+/g, ' ') : 'Failure');
    const target = failure?.stat || failure?.item || failure?.entity || failure?.dimension;
    const readableTarget = String(target || '').split(':').pop().replace(/[_-]+/g, ' ');
    const name = failure?.name || (readableTarget ? `${typeLabel}: ${readableTarget}` : typeLabel);
    const amount = Number(failure?.required_amount);
    const summary = failures.length
      ? `Fail: ${name}${amount > 0 ? ` (${amount})` : ''}${failures.length > 1 ? ` +${failures.length - 1}` : ''}`
      : '';
    const tooltip = failures.map(item => {
      const label = item.name || FAILURES[item.type]?.label || item.type || 'Failure';
      const itemTarget = item.stat || item.item || item.entity || item.dimension;
      const quantity = Number(item.required_amount);
      return `${label}${itemTarget ? ` (${itemTarget})` : ''}${quantity > 0 ? `: ${quantity}` : ''}`;
    }).join('\n');
    return { hasFailures: failures.length > 0, failureLines: failures.length ? wrapObjective(summary, false) : [], failureTooltip: tooltip };
  }
  nodes.forEach(node => {
    node.titleLines = wrapTitle(node.quest.data.title || node.quest.fileName);
    Object.assign(node, describeObjectives(node.quest));
    Object.assign(node, describeFailures(node.quest));
    node.descriptionLines = node.quest.data.description ? wrapObjective(node.quest.data.description, false) : [];
    node.texture = window.MINECRAFT_TEXTURE_CATALOG?.find(texture => texture.id === node.quest.data.background_texture) || null;
    node.rewardBadges = describeQuestRewards(node.quest);
    node.rewardRows = layoutRewardBadges(node.rewardBadges);
    const objectiveExtra = Math.max(0, node.objectiveLines.length - 1) * 12;
    const descriptionExtra = node.descriptionLines.length * 12;
    const failureExtra = node.hasFailures ? 14 + Math.max(0, node.failureLines.length - 1) * 12 : 0;
    const titleAndDetailsHeight = nodeHeight + Math.max(0, node.titleLines.length - 1) * 12 + objectiveExtra + descriptionExtra + failureExtra;
    const rewardStart = 28 + node.titleLines.length * 12 + 18 + objectiveExtra + descriptionExtra + failureExtra + 8;
    node.rewardStart = rewardStart;
    node.height = Math.max(titleAndDetailsHeight, node.rewardRows.length ? rewardStart + node.rewardRows.length * 20 + 5 : 0);
  });

  // Convert Questlog reward data into small visual badges for the card footer.
  function describeQuestRewards(quest) {
    const badges = [];
    function describe(reward, options = {}) {
      if (!reward) return;
      const type = reward.type || '';
      const common = { random: !!options.random, tooltip: '' };
      if (type === 'questlog:item') {
        const itemId = typeof reward.item === 'string' ? reward.item : reward.item?.id || 'minecraft:barrier';
        const count = Number(reward.count ?? 1);
        const countLabel = count > 1 ? `×${count}` : '';
        badges.push({ ...common, kind: 'icon', icon: localSprite(itemId), label: [countLabel, options.chance].filter(Boolean).join(' '), tooltip: `${itemId}${count !== 1 ? ` ×${count}` : ''}${options.chance ? ` · ${options.chance} chance per roll` : ''}` });
      } else if (type === 'questlog:experience') {
        const amount = reward.experience ?? reward.amount ?? 0;
        const unit = reward.level ? ' levels' : ' XP';
        badges.push({ ...common, kind: 'icon', icon: localSprite('minecraft:experience_bottle'), label: `${amount}${unit}${options.chance ? ` ${options.chance}` : ''}`, tone: 'xp', tooltip: `${amount}${reward.level ? ' experience levels' : ' experience points'}${options.chance ? ` · ${options.chance} chance per roll` : ''}` });
      } else if (type === 'questlog:command') {
        const command = String(reward.command || '/(command)');
        badges.push({ ...common, kind: 'command', label: command, tooltip: `Run command: ${command}` });
      } else if (type === 'questlog:loot_table') {
        badges.push({ ...common, kind: 'icon', icon: localSprite('minecraft:chest'), label: 'Loot table', tooltip: `Loot table: ${reward.loot_table || ''}` });
      } else if (type === 'questlog:choice') {
        const pickCount = Number(reward.pick_count ?? 1);
        badges.push({ ...common, kind: 'icon', icon: localSprite('minecraft:chest'), label: `Choose ${pickCount}`, tooltip: `Choose ${pickCount} reward${pickCount === 1 ? '' : 's'} from ${reward.choices?.length || 0} options` });
      } else {
        const name = reward.name || (type ? type.replace(/^.*:/, '').replace(/[_-]+/g, ' ') : 'Reward');
        badges.push({ ...common, kind: 'icon', icon: localSprite(reward.icon?.item || 'minecraft:paper'), label: name, tooltip: name });
      }
    }
    for (const reward of quest.data.rewards || []) {
      if (reward.type !== 'questlog:random') {
        describe(reward);
        continue;
      }
      const entries = reward.entries || [];
      const total = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.weight) || 0), Math.max(0, Number(reward.empty_weight) || 0));
      for (const entry of entries) {
        const percent = total ? Math.max(0, Number(entry.weight) || 0) / total * 100 : 0;
        describe(entry.reward, { random: true, chance: `${percent.toFixed(1)}%` });
      }
    }
    return badges.length ? badges : [{ kind: 'empty', label: 'No rewards', tooltip: 'No rewards' }];
  }

  // Pack reward badges into rows that fit within the quest card.
  function layoutRewardBadges(badges) {
    const measure = titleMeasure;
    measure.font = '7px "DM Mono", monospace';
    let rows = [], row = [], used = 0;
    for (const badge of badges) {
      const textWidth = measure.measureText(badge.label || '').width;
      badge.width = badge.kind === 'command' ? nodeWidth - 20 : badge.kind === 'empty' ? 58 : Math.min(nodeWidth - 20, 22 + textWidth);
      if (row.length && used + 4 + badge.width > nodeWidth - 16) {
        rows.push(row);
        row = [];
        used = 0;
      }
      badge.x = used ? used + 4 : 0;
      row.push(badge);
      used = badge.x + badge.width;
    }
    if (row.length) rows.push(row);
    return rows;
  }

  // Allocate horizontal space by each prerequisite tree so children stay below their parent.
  const widthCache = new Map();
  function getTreeWidth(index, path = new Set()) {
    if (widthCache.has(index)) return widthCache.get(index);
    if (path.has(index)) return 1;
    const nextPath = new Set(path);
    nextPath.add(index);
    const width = Math.max(1, nodes[index].children.reduce((total, child) => total + getTreeWidth(child, nextPath), 0));
    widthCache.set(index, width);
    return width;
  }

  // Lay out each chapter as its own section so the combined map stays clearly grouped.
  function layoutChapter(group, sectionTop) {
    const groupNodes = nodes.filter(node => node.groupId === group.id);
    const placed = new Set(), centers = new Map();
    function placeTree(index, startSlot) {
      if (placed.has(index)) return centers.get(index);
      placed.add(index);
      const children = nodes[index].children.filter(child => !placed.has(child));
      if (!children.length) {
        const center = startSlot + 0.5;
        centers.set(index, center);
        return center;
      }
      let cursor = startSlot, firstCenter = null, lastCenter = null;
      for (const child of children) {
        const center = placeTree(child, cursor);
        if (firstCenter === null) firstCenter = center;
        lastCenter = center;
        cursor += getTreeWidth(child);
      }
      const center = (firstCenter + lastCenter) / 2;
      centers.set(index, center);
      return center;
    }
    const roots = groupNodes.filter(node => node.primaryParent === null).map(node => node.index);
    let slotsUsed = 0;
    for (const root of roots) {
      const treeWidth = getTreeWidth(root);
      placeTree(root, slotsUsed);
      slotsUsed += treeWidth;
    }
    for (const node of groupNodes) {
      if (placed.has(node.index)) continue;
      const treeWidth = getTreeWidth(node.index);
      placeTree(node.index, slotsUsed);
      slotsUsed += treeWidth;
    }
    const maxDepth = groupNodes.length ? Math.max(...groupNodes.map(node => node.depth)) : -1;
    const depthY = new Map();
    let nextDepthY = sectionTop + 49;
    for (let depth = 0; depth <= maxDepth; depth++) {
      depthY.set(depth, nextDepthY);
      const rowHeightForDepth = Math.max(nodeHeight, ...groupNodes.filter(node => node.depth === depth).map(node => node.height));
      nextDepthY += rowHeightForDepth + (rowHeight - nodeHeight);
    }
    const bottom = maxDepth < 0 ? sectionTop + 88 : nextDepthY - (rowHeight - nodeHeight) + 24;
    return { group, groupNodes, sectionTop, bottom, centers, slotsUsed, depthY };
  }
  const sectionLayouts = [];
  let sectionTop = showAllQuestsMap ? 40 : 0;
  for (const group of mapGroups) {
    const section = layoutChapter(group, sectionTop);
    sectionLayouts.push(section);
    sectionTop = section.bottom + (showAllQuestsMap ? 8 : 0);
  }

  [...nodes].sort((a, b) => a.depth - b.depth || a.index - b.index).forEach((node, index) => { node.number = index + 1; });
  const maxSlots = Math.max(2, ...sectionLayouts.map(section => section.slotsUsed));
  const width = Math.max(520, maxSlots * slotWidth + padding * 2);
  const height = Math.max(210, (sectionLayouts.at(-1)?.bottom || 186) + 8);
  const positions = new Map();
  for (const section of sectionLayouts) {
    const centeredOffset = Math.max(0, (width - padding * 2 - section.slotsUsed * slotWidth) / 2);
    for (const node of section.groupNodes) {
      positions.set(node.index, {
        x: padding + centeredOffset + section.centers.get(node.index) * slotWidth - nodeWidth / 2,
        y: section.depthY.get(node.depth)
      });
    }
  }
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMin meet');
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.style.width = '100%';
  svg.style.height = 'auto';
  svg.style.aspectRatio = `${width} / ${height}`;

  // Draw the chapter heading, prerequisite arrows, and quest cards.
  const texturePatterns = nodes.filter(node => node.texture).map(node => `<pattern id="questTexture${node.index}" width="16" height="16" patternUnits="userSpaceOnUse"><image href="./Images/textures/${encodeURIComponent(node.texture.file)}" x="0" y="0" width="16" height="16" preserveAspectRatio="none"/></pattern>`).join('');
  let markup = `<defs><pattern id="treeDots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="${palette.dots}"/></pattern><linearGradient id="nodeHoverGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${palette.hover}" stop-opacity=".17"/><stop offset="100%" stop-color="${palette.hover}" stop-opacity=".025"/></linearGradient><linearGradient id="nodeBorderGradient" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop offset="0%" stop-color="${palette.accent}" stop-opacity=".12"/><stop offset="38%" stop-color="${palette.accent}" stop-opacity=".3"/><stop offset="52%" stop-color="#d7ffe3"/><stop offset="66%" stop-color="${palette.accent}"/><stop offset="100%" stop-color="${palette.accent}" stop-opacity=".12"/><animateTransform attributeName="gradientTransform" type="rotate" from="0 .5 .5" to="360 .5 .5" dur="3s" repeatCount="indefinite"/></linearGradient>${texturePatterns}<marker id="treeArrow" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="${palette.muted}" stroke-width="1"/></marker></defs><rect width="${width}" height="${height}" fill="${palette.surface}"/><rect width="${width}" height="${height}" fill="url(#treeDots)"/>${showAllQuestsMap ? `<text x="${padding}" y="24" fill="${palette.accent}" font-size="11" font-family="DM Mono, monospace" font-weight="700" letter-spacing="1">ALL CHAPTERS</text><line x1="${padding}" y1="34" x2="${width - padding}" y2="34" stroke="${palette.border}" stroke-width="1"/>` : ''}`;
  for (const section of sectionLayouts) {
    const sectionHeight = section.bottom - section.sectionTop;
    if (showAllQuestsMap) markup += `<rect x="8" y="${section.sectionTop + 4}" width="${width - 16}" height="${sectionHeight - 4}" rx="8" fill="${palette.node}" fill-opacity=".28" stroke="${palette.border}" stroke-width=".8"/>`;
    markup += `<text x="${padding}" y="${section.sectionTop + 24}" fill="${palette.accent}" font-size="11" font-family="DM Mono, monospace" font-weight="600" letter-spacing="1">${safe(section.group.title.toUpperCase())}${showAllQuestsMap ? ` (${section.group.quests.length})` : ''}</text><line x1="${padding}" y1="${section.sectionTop + 34}" x2="${width - padding}" y2="${section.sectionTop + 34}" stroke="${palette.border}" stroke-width="1"/>`;
    if (!section.groupNodes.length) markup += `<text x="${padding}" y="${section.sectionTop + 68}" fill="${palette.muted}" font-size="11" font-family="DM Sans, sans-serif">${showAllQuestsMap ? 'No quests in this chapter yet' : 'No quests in this chapter yet'}</text>`;
  }
  for (const node of nodes) {
    const target = positions.get(node.index);
    for (const parentIndex of node.parents) {
      const source = positions.get(parentIndex);
      if (!source) continue;
      const startY = source.y + nodes[parentIndex].height, endY = target.y, midpoint = startY + (endY - startY) / 2;
      markup += `<path d="M${source.x + nodeWidth / 2} ${startY} C${source.x + nodeWidth / 2} ${midpoint},${target.x + nodeWidth / 2} ${midpoint},${target.x + nodeWidth / 2} ${endY - 4}" fill="none" stroke="${palette.edge}" stroke-width="1.7" marker-end="url(#treeArrow)"/>`;
    }
  }
  for (const node of nodes) {
    const { x, y } = positions.get(node.index);
    const selected = node.quest.key === state.selected;
    const hidden = !!node.quest.data.hidden;
    const markerColor = hidden ? palette.hidden : palette.visible;
    const markerGlow = `filter:drop-shadow(0 0 3px ${hidden ? palette.hiddenGlow : palette.visibleGlow})`;
    const icon = localSprite(node.quest.data.icon?.item || 'minecraft:book');
    const titleText = node.titleLines.map((line, lineIndex) => `<tspan x="${x + 29}" y="${y + (lineIndex === 0 ? 18 : 28 + lineIndex * 12)}">${safe(line)}</tspan>`).join('');
    const detailY = y + 28 + node.titleLines.length * 12;
    const descriptionY = detailY;
    const descriptionColor = node.quest.data.text_color || palette.objective;
    const descriptionDetail = node.descriptionLines.map((line, lineIndex) => `<text x="${x + 29}" y="${descriptionY + lineIndex * 12}" fill="${safe(descriptionColor)}" font-size="7.5" font-family="DM Sans, sans-serif">${safe(line)}</text>`).join('');
    const objectiveY = detailY + node.descriptionLines.length * 12;
    const objectiveColor = node.quest.data.progress_text_color || palette.objective;
    const objectiveDetail = node.hasObjectives
      ? `<title>${safe(node.objectiveTooltip)}</title><image href="${safe(localSprite(node.objectiveIconId))}" x="${x + 29}" y="${objectiveY - 10}" width="12" height="12" preserveAspectRatio="xMidYMid meet"/>${node.objectiveLines.map((line, lineIndex) => `<text x="${x + (lineIndex === 0 ? 45 : 29)}" y="${objectiveY + lineIndex * 12}" fill="${safe(objectiveColor)}" font-size="8" font-family="DM Sans, sans-serif">${safe(line)}</text>`).join('')}`
      : `<text x="${x + 29}" y="${objectiveY}" fill="${safe(objectiveColor)}" font-size="8" font-family="DM Sans, sans-serif">${safe(node.objectiveSummary)}</text>`;
    const failureY = objectiveY + node.objectiveLines.length * 12 + 2;
    const failureDetail = node.hasFailures
      ? `<title>${safe(node.failureTooltip)}</title>${node.failureLines.map((line, lineIndex) => `<text x="${x + 29}" y="${failureY + lineIndex * 12}" fill="${palette.failure}" font-size="7.5" font-family="DM Sans, sans-serif" font-weight="600" style="filter:drop-shadow(0 0 3px ${palette.failureGlow})">${safe(line)}</text>`).join('')}`
      : '';
    const rewardMarkup = node.rewardRows.map((row, rowIndex) => row.map(badge => {
      const badgeX = x + 8 + badge.x, badgeY = y + node.rewardStart + rowIndex * 20;
      const color = badge.random ? palette.rewardRandom : badge.tone === 'xp' ? palette.rewardXp : badge.kind === 'empty' ? palette.muted : palette.rewardItem;
      const glow = badge.random ? palette.rewardRandomGlow : badge.tone === 'xp' ? palette.rewardXpGlow : palette.rewardItemGlow;
      const tip = badge.tooltip ? `<title>${safe(badge.tooltip)}</title>` : '';
      if (badge.kind === 'command') {
        const commandText = badge.label.length > 24 ? `${badge.label.slice(0, 23)}…` : badge.label;
        return `<g>${tip}<rect x="${badgeX}" y="${badgeY}" width="${badge.width}" height="17" rx="4" fill="${palette.surface}" stroke="${color}" stroke-width="1" style="filter:drop-shadow(0 0 2px ${glow})"/><rect x="${badgeX + 4}" y="${badgeY + 3}" width="13" height="11" rx="2" fill="none" stroke="${palette.accent}" stroke-width=".8"/><path d="M${badgeX + 7} ${badgeY + 6}l3 2.5-3 2.5M${badgeX + 11.5} ${badgeY + 11}h3" fill="none" stroke="${palette.accent}" stroke-width=".8" stroke-linecap="round" stroke-linejoin="round"/><text x="${badgeX + 21}" y="${badgeY + 11.5}" fill="${palette.text}" font-size="7" font-family="DM Mono, monospace">${safe(commandText)}</text></g>`;
      }
      if (badge.kind === 'empty') return `<g>${tip}<text x="${badgeX + 2}" y="${badgeY + 12}" fill="${palette.muted}" font-size="7" font-family="DM Sans, sans-serif">${safe(badge.label)}</text></g>`;
      return `<g>${tip}<rect x="${badgeX}" y="${badgeY}" width="${badge.width}" height="17" rx="4" fill="${palette.surface}" stroke="${color}" stroke-width="1" style="filter:drop-shadow(0 0 2px ${glow})"/><image href="${safe(badge.icon)}" x="${badgeX + 2}" y="${badgeY + 2}" width="13" height="13" preserveAspectRatio="xMidYMid meet"/>${badge.label ? `<text x="${badgeX + 17}" y="${badgeY + 11.5}" fill="${palette.text}" font-size="7" font-family="DM Mono, monospace">${safe(badge.label)}</text>` : ''}</g>`;
    }).join('')).join('');
    const titleColor = node.quest.data.title_color || palette.text;
    const backgroundFill = node.texture ? `url(#questTexture${node.index})` : selected ? palette.selectedNode : palette.node;
    markup += `<g class="graph-node${selected ? ' selected' : ''}" data-key="${node.quest.key}" style="cursor:pointer"><rect class="node-background" x="${x}" y="${y}" width="${nodeWidth}" height="${node.height}" rx="8" fill="${backgroundFill}" stroke="${selected ? palette.accent : palette.border}" stroke-width="${selected ? 2 : 1}" style="${selected ? `filter:drop-shadow(0 0 6px ${palette.accent}55)` : ''}"/><rect class="node-hover" x="${x}" y="${y}" width="${nodeWidth}" height="${node.height}" rx="8" fill="url(#nodeHoverGradient)" pointer-events="none"/><rect class="node-border-glow" x="${x + .75}" y="${y + .75}" width="${nodeWidth - 1.5}" height="${node.height - 1.5}" rx="7.5" fill="none" stroke="url(#nodeBorderGradient)" stroke-width="2" pointer-events="none"/><circle cx="${x + 16}" cy="${y + 16}" r="4" fill="${markerColor}" stroke="${hidden ? '#5b3b78' : '#38551e'}" stroke-width=".8" style="${markerGlow}"/><text fill="${safe(titleColor)}" font-size="10" font-family="DM Sans, sans-serif" font-weight="600">${titleText}</text><rect x="${x + nodeWidth - 30}" y="${y + 7}" width="22" height="22" rx="4" fill="${palette.surface}" stroke="${palette.border}" stroke-width=".7"/><image href="${safe(icon)}" x="${x + nodeWidth - 28}" y="${y + 9}" width="18" height="18" preserveAspectRatio="xMidYMid meet"/><text x="${x + 12}" y="${objectiveY}" fill="${palette.muted}" font-size="8" font-family="DM Mono, monospace">${String(node.number).padStart(2, '0')}</text>${descriptionDetail}${objectiveDetail}${failureDetail}${rewardMarkup}</g>`;
  }

  svg.innerHTML = markup;
  $$('.graph-node').forEach(node => node.onclick = () => {
    state.selected = node.dataset.key;
    renderAll();
  });
}
