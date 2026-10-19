/*
 * Project export helpers.
 * Builds the same quests/ and chapters/ folder structure for download or direct save.
 */

// Download one JSON object as a standalone file.
function download(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// Collect all project records using the directory layout expected by Questlog.
function projectFiles() {
  return [
    ...state.quests.map(quest => ({ path: `quests/${slug(quest.fileName)}.json`, data: questOutputData(quest) })),
    ...state.chapters.map(chapter => ({ path: `chapters/${slug(chapter.fileName)}.json`, data: chapter.data }))
  ];
}

// Calculate a ZIP checksum so the browser can create a valid archive without a library.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Package project files in a ZIP archive when direct folder writing is unavailable.
function makeZip(files) {
  const encoder = new TextEncoder(), localParts = [], centralParts = [];
  let offset = 0;
  const put16 = (view, position, value) => view.setUint16(position, value, true);
  const put32 = (view, position, value) => view.setUint32(position, value, true);

  for (const file of files) {
    const name = encoder.encode(file.path);
    const data = encoder.encode(JSON.stringify(file.data, null, 2) + '\n');
    const checksum = crc32(data);
    const local = new Uint8Array(30 + name.length), localView = new DataView(local.buffer);
    put32(localView, 0, 0x04034b50); put16(localView, 4, 20); put16(localView, 6, 0x800);
    put16(localView, 8, 0); put16(localView, 10, 0); put16(localView, 12, 0);
    put32(localView, 14, checksum); put32(localView, 18, data.length); put32(localView, 22, data.length);
    put16(localView, 26, name.length); put16(localView, 28, 0); local.set(name, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + name.length), centralView = new DataView(central.buffer);
    put32(centralView, 0, 0x02014b50); put16(centralView, 4, 20); put16(centralView, 6, 20);
    put16(centralView, 8, 0x800); put16(centralView, 10, 0); put16(centralView, 12, 0); put16(centralView, 14, 0);
    put32(centralView, 16, checksum); put32(centralView, 20, data.length); put32(centralView, 24, data.length);
    put16(centralView, 28, name.length); put16(centralView, 30, 0); put16(centralView, 32, 0);
    put16(centralView, 34, 0); put16(centralView, 36, 0); put32(centralView, 38, 0); put32(centralView, 42, offset);
    central.set(name, 46);
    centralParts.push(central);
    offset += local.length + data.length;
  }

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22), endView = new DataView(end.buffer);
  put32(endView, 0, 0x06054b50); put16(endView, 8, files.length); put16(endView, 10, files.length);
  put32(endView, 12, centralSize); put32(endView, 16, offset); put16(endView, 20, 0);
  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
}

// Prefer a user-selected questlog folder; fall back to the portable ZIP download.
async function saveProjectFiles() {
  const files = projectFiles();
  if (!files.length) { notify('Add a quest or chapter first'); return; }
  if (window.showDirectoryPicker) {
    try {
      const root = await window.showDirectoryPicker({ mode: 'readwrite' });
      const project = await root.getDirectoryHandle('questlog', { create: true });
      for (const file of files) {
        const [folderName, filename] = file.path.split('/');
        const folder = await project.getDirectoryHandle(folderName, { create: true });
        const handle = await folder.getFileHandle(filename, { create: true });
        const writer = await handle.createWritable();
        await writer.write(JSON.stringify(file.data, null, 2) + '\n');
        await writer.close();
      }
      notify('Questlog folder saved');
      return;
    } catch (error) {
      if (error.name === 'AbortError') { notify('Folder selection cancelled'); return; }
      console.warn('Folder save unavailable; creating ZIP instead.', error);
    }
  }
  const archive = makeZip(files);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(archive);
  link.download = 'questlog-files.zip';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1500);
  notify('Downloaded questlog-files.zip');
}
