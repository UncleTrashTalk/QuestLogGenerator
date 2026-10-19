/* Supported biome IDs available to the biome objective picker. */
const BIOME_IDS = `
terralith:alpha_islands
terralith:alpha_islands_winter
terralith:alpine_grove
terralith:alpine_highlands
terralith:amethyst_canyon
terralith:amethyst_rainforest
terralith:ancient_sands
terralith:arid_highlands
terralith:ashen_savanna
terralith:basalt_cliffs
terralith:birch_taiga
terralith:blooming_plateau
terralith:blooming_valley
terralith:brushland
terralith:bryce_canyon
terralith:caldera
terralith:cloud_forest
terralith:cold_shrubland
terralith:desert_canyon
terralith:desert_oasis
terralith:desert_spires
terralith:emerald_peaks
terralith:forested_highlands
terralith:fractured_savanna
terralith:frozen_cliffs
terralith:glacial_chasm
terralith:granite_cliffs
terralith:gravel_beach
terralith:gravel_desert
terralith:haze_mountain
terralith:highlands
terralith:hot_shrubland
terralith:ice_marsh
terralith:jungle_mountains
terralith:lavender_forest
terralith:lavender_valley
terralith:lush_desert
terralith:lush_valley
terralith:mirage_isles
terralith:moonlight_grove
terralith:moonlight_valley
terralith:mountain_steppe
terralith:orchid_swamp
terralith:painted_mountains
terralith:red_oasis
terralith:rocky_jungle
terralith:rocky_mountains
terralith:rocky_shrubland
terralith:sakura_grove
terralith:sakura_valley
terralith:sandstone_valley
terralith:savanna_badlands
terralith:savanna_slopes
terralith:scarlet_mountains
terralith:shield_clearing
terralith:shield
terralith:shrubland
terralith:siberian_grove
terralith:siberian_taiga
terralith:skylands
terralith:skylands_autumn
terralith:skylands_spring
terralith:skylands_summer
terralith:skylands_winter
terralith:snowy_badlands
terralith:snowy_cherry_grove
terralith:snowy_maple_forest
terralith:snowy_shield
terralith:steppe
terralith:stony_spires
terralith:temperate_highlands
terralith:tropical_jungle
terralith:valley_clearing
terralith:volcanic_crater
terralith:volcanic_peaks
terralith:warm_river
terralith:warped_mesa
terralith:white_cliffs
terralith:white_mesa
terralith:windswept_spires
terralith:wintry_forest
terralith:wintry_lowlands
terralith:yellowstone
terralith:yosemite_cliffs
terralith:yosemite_lowlands
betternether:bone_reefs
betternether:crimson_glowing_woods
betternether:crimson_pinewoods
betternether:flooded_deltas
betternether:gravel_deserts
betternether:magma_lands
betternether:nether_grasslands
betternether:nether_jungles
betternether:nether_mushroom_forests
betternether:nether_mushroom_forest_edges
betternether:nether_swamplands
betternether:nether_swampland_terraces
betternether:old_fungiwoods
betternether:old_swamplands
betternether:old_warped_woods
betternether:poor_nether_grasslands
betternether:soul_plains
betternether:sulfuric_bone_reefs
betternether:upside_down_forests
betternether:upside_down_forests_cleared
betternether:wart_forest
betternether:wart_forest_edges
aquamirae:ice_maze
aether:aether_highlands
aether:aether_magnetic_hills
aether:aether_arctic_peaks
aether:aether_forgotten_highlands
aether:aether_irradiated_forests
minecraft:badlands
minecraft:bamboo_jungle
minecraft:beach
minecraft:birch_forest
minecraft:cherry_grove
minecraft:cold_ocean
minecraft:dark_forest
minecraft:deep_cold_ocean
minecraft:deep_dark
minecraft:deep_frozen_ocean
minecraft:deep_lukewarm_ocean
minecraft:deep_ocean
minecraft:desert
minecraft:dripstone_caves
minecraft:eroded_badlands
minecraft:flower_forest
minecraft:forest
minecraft:frozen_ocean
minecraft:frozen_peaks
minecraft:frozen_river
minecraft:grove
minecraft:ice_spikes
minecraft:jagged_peaks
minecraft:jungle
minecraft:lukewarm_ocean
minecraft:lush_caves
minecraft:mangrove_swamp
minecraft:meadow
minecraft:mushroom_fields
minecraft:ocean
minecraft:old_growth_birch_forest
minecraft:old_growth_pine_taiga
minecraft:old_growth_spruce_taiga
minecraft:pale_garden
minecraft:plains
minecraft:river
minecraft:savanna
minecraft:savanna_plateau
minecraft:snowy_beach
minecraft:snowy_plains
minecraft:snowy_slopes
minecraft:snowy_taiga
minecraft:sparse_jungle
minecraft:stony_peaks
minecraft:stony_shore
minecraft:sunflower_plains
minecraft:swamp
minecraft:taiga
minecraft:warm_ocean
minecraft:windswept_forest
minecraft:windswept_gravelly_hills
minecraft:windswept_hills
minecraft:windswept_savanna
minecraft:wooded_badlands
`.trim().split(/\s+/);

// Match each biome to a representative local item icon by its terrain and plants.
function biomeItemIcon(id) {
  if (id.startsWith('aether:')) return 'aether:ambrosium_shard';
  if (id.startsWith('aquamirae:')) return 'aquamirae:rune_of_the_storm';
  const name = id.split(':')[1];
  if (id.startsWith('betternether:')) {
    const netherRules = [
      [/bone|sulfur/, 'betternether:bone_stalactite'], [/crimson/, 'betternether:crimson_boat'],
      [/magma/, 'betternether:magma_flower_seed'], [/grassland/, 'betternether:ngrass_1'],
      [/mushroom|fungi/, 'betternether:jellyfish_mushroom_sapling'], [/soul/, 'betternether:soul_vein'],
      [/wart/, 'betternether:wart_sign'], [/upside_down/, 'betternether:glowstone_stalactite'],
      [/swamp|woods|forest|jungle/, 'betternether:willow_boat'], [/delta|flood|reef/, 'betternether:netherrack_stalactite'],
      [/gravel/, 'betternether:basalt_stalactite']
    ];
    return netherRules.find(([pattern]) => pattern.test(name))?.[1] || 'betternether:nether_ruby';
  }
  const rules = [
    [/amethyst/, 'minecraft:amethyst_shard'], [/volcanic|basalt|caldera/, 'minecraft:basalt'],
    [/desert|sand|mesa|badlands|oasis|arid|mirage/, 'minecraft:sand'],
    [/snow|winter|wintry|frozen|glacial|ice|siberian|cold/, 'minecraft:snow_block'],
    [/ocean|river|beach|shore|isles/, 'minecraft:water_bucket'],
    [/jungle|tropical|bamboo/, 'minecraft:jungle_sapling'], [/sakura|cherry/, 'minecraft:cherry_sapling'],
    [/lavender|orchid|flower|blooming/, 'minecraft:allium'], [/swamp|marsh/, 'minecraft:lily_pad'],
    [/forest|grove|taiga|woodland|birch|maple|shield/, 'minecraft:oak_sapling'],
    [/mushroom/, 'minecraft:red_mushroom'], [/emerald/, 'minecraft:emerald'],
    [/gravel|rocky|stony|stone|granite|cliff|spire|mountain|peak|highland|canyon|haze|steppe/, 'minecraft:stone'],
    [/savanna|shrubland|brushland|grassland|plains|meadow|valley|clearing|skylands|alpha|yellowstone|yosemite/, 'minecraft:grass_block']
  ];
  return rules.find(([pattern]) => pattern.test(name))?.[1] || 'minecraft:grass_block';
}

const BIOME_CATALOG = BIOME_IDS.map(id => {
  const [category, key] = id.split(':');
  return {
    id,
    category,
    label: key.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join(' '),
    icon: biomeItemIcon(id)
  };
});

const BIOME_CATEGORIES = [
  { id: 'minecraft', label: 'Minecraft', icon: 'minecraft:grass_block' },
  { id: 'terralith', label: 'Terralith', icon: 'minecraft:amethyst_shard' },
  { id: 'betternether', label: 'Better Nether', icon: 'betternether:nether_ruby' },
  { id: 'aquamirae', label: 'Aquamirae', icon: 'aquamirae:rune_of_the_storm' },
  { id: 'aether', label: 'Aether', icon: 'aether:ambrosium_shard' }
];
