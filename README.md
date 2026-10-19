# Questlog Studio

A local first, browser based editor for Questlog quest and chapter JSON files. The item picker is configured for the server's Minecraft Java 1.21.1 assets.

## Run locally

Open `index.html` directly, or serve this folder with Python:

```powershell
python -m http.server 8000
```

Then visit http://localhost:8000. The project autosaves in the browser's local storage. Use **Save project files** to save a `questlog` folder containing separate `quests/<file>.json` and `chapters/<file>.json` files. Browsers that support folder access can write directly to a chosen folder; other browsers download a ZIP with that folder structure. You can also download an individual quest or chapter JSON file. Import individual JSON files with **Import JSON**.

## Notes

- Quest IDs are derived from quest file names (`first_steps.json` becomes `questlog:first_steps`).
- Quest dependencies are stored as `questlog:quest_complete` entries in `requirements`.
- Objectives include `questlog:visit_dimension` for dimension IDs such as `minecraft:the_nether`; experience rewards use the `experience` field.
- Unknown quest properties are retained in Advanced JSON.
- The icon picker uses a local catalog generated from the PNG filenames in `Images/` and shows local previews from that folder. Image files should be named after their item IDs, for example `oak_log.png` for `minecraft:oak_log`. Modded IDs can still be typed manually, though a preview requires a matching PNG.
- The picker has separate Minecraft, Cobblemon, Aquamirae, Better Nether, Aether, and CobbleSafari categories. Mod item catalogs pair namespaced item IDs with images from their corresponding local `Images/` folders. They use the `cobblemon:`, `aquamirae:`, `betternether:`, `aether:`, and `cobblesafari:` namespaces. Better Nether previews load from `Images/betternetherItems/`; the Nether Ruby image is used as its category icon. Aether previews load from `Images/aetherItems/`; the Ambrosium Shard image is used as its category icon. CobbleSafari previews load from `Images/cobblesafariItems/`; the Safari Ticket image is used as its category icon.
- Browser local storage belongs to the current browser profile. Save the project files to back it up or move it.
- The objectives and rewards menus include common example types; Advanced JSON can represent any additional Questlog properties or types.

Schema examples and dependency conventions are based on [Infernal Studios Questlog 1.20.1 examples](https://github.com/infernalstudios/Questlog/tree/1.20.1/examples/questlog).





