const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const combineButton = document.getElementById('combineButton');
const versionSelect = document.getElementById('versionSelect');
const darkModeToggle = document.getElementById('darkModeToggle');
const fileHint = document.getElementById('fileHint');
const conflictList = document.getElementById('conflictList');
const noConflicts = document.getElementById('noConflicts');
const dependencyContainer = document.getElementById('dependencyContainer');

const authorInput = document.getElementById('authorInput');
const descriptionInput = document.getElementById('descriptionInput');
const logoInput = document.getElementById('logoInput');
const logoPreview = document.getElementById('logoPreview');
const logoPreviewContainer = document.getElementById('logoPreviewContainer');

const presetNameInput = document.getElementById('presetNameInput');
const savePresetButton = document.getElementById('savePresetButton');
const loadPresetSelect = document.getElementById('loadPresetSelect');
const deletePresetButton = document.getElementById('deletePresetButton');

const addFilesButton = document.getElementById('addFilesButton');
const removeAllButton = document.getElementById('removeAllButton');
const undoButton = document.getElementById('undoButton');
const redoButton = document.getElementById('redoButton');

const saveSessionButton = document.getElementById('saveSessionButton');
const loadSessionButton = document.getElementById('loadSessionButton');
const loadSessionInput = document.getElementById('loadSessionInput');

let filesArray = [];
let previews = {};
let filePathMaps = {};
let zipMap = {};
let conflictResolution = {};
let conflictCountPerPack = {};
let history = [];
let historyIndex = -1;

const versionPackFormatMap = {
    "1.6.1 - 1.8.9": 1,
    "1.9 - 1.10.2": 2,
    "1.11 - 1.12.2": 3,
    "1.13 - 1.14.4": 4,
    "1.15 - 1.16.1": 5,
    "1.16.2 - 1.16.5": 6,
    "1.17 - 1.17.1": 7,
    "1.18 - 1.18.2": 8,
    "1.19 - 1.19.2": 9,
    "1.19.3": 12,
    "1.19.4 - 1.20.1": 13,
    "1.20.2": 14,
    "1.21 - 1.21.6": 55
};

function populateVersionSelect() {
    Object.keys(versionPackFormatMap).forEach((version, i) => {
        const option = document.createElement('option');
        option.value = version;
        option.textContent = version;
        if (i === 0) option.selected = true;
        versionSelect.appendChild(option);
    });
}
populateVersionSelect();

const isDarkModeEnabled = () => localStorage.getItem('darkMode') === 'enabled';
const setDarkMode = (enabled) => {
    if (enabled) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('darkMode', 'enabled');
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('darkMode', 'disabled');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (isDarkModeEnabled()) {
        darkModeToggle.checked = true;
        setDarkMode(true);
    } else {
        darkModeToggle.checked = true;
        setDarkMode(true);
    }
    loadPresets();
    updateHistory();
});

darkModeToggle.addEventListener('change', () => {
    setDarkMode(darkModeToggle.checked);
});

// ---- Dateiliste & Verlauf ----

addFilesButton.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
    const newFiles = Array.from(fileInput.files).filter(f => !filesArray.some(x => x.name === f.name));
    if (newFiles.length === 0) return;
    filesArray = filesArray.concat(newFiles);
    await loadPreviewsAndPaths(newFiles);
    renderFileList();
    detectConflicts();
    updateCombineState();
    updateDependencyView();
    pushHistory();
    fileInput.value = '';
});

removeAllButton.addEventListener('click', () => {
    filesArray = [];
    previews = {};
    filePathMaps = {};
    zipMap = {};
    conflictResolution = {};
    conflictCountPerPack = {};
    renderFileList();
    detectConflicts();
    updateCombineState();
    updateDependencyView();
    pushHistory();
});

undoButton.addEventListener('click', async () => {
    if (historyIndex <= 0) return;
    historyIndex--;
    filesArray = history[historyIndex].slice();
    previews = {};
    filePathMaps = {};
    zipMap = {};
    conflictResolution = {};
    await loadPreviewsAndPaths(filesArray);
    renderFileList();
    detectConflicts();
    updateCombineState();
    updateDependencyView();
    updateUndoRedoButtons();
});

redoButton.addEventListener('click', async () => {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    filesArray = history[historyIndex].slice();
    previews = {};
    filePathMaps = {};
    zipMap = {};
    conflictResolution = {};
    await loadPreviewsAndPaths(filesArray);
    renderFileList();
    detectConflicts();
    updateCombineState();
    updateDependencyView();
    updateUndoRedoButtons();
});

function pushHistory() {
    const snapshot = filesArray.slice();
    history = history.slice(0, historyIndex + 1);
    history.push(snapshot);
    historyIndex = history.length - 1;
    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    undoButton.disabled = historyIndex <= 0;
    redoButton.disabled = historyIndex >= history.length - 1;
}

async function loadPreviewsAndPaths(list) {
    const targets = Array.isArray(list) ? list : list ? [list] : [];
    for (const file of targets) {
        try {
            const zip = await JSZip.loadAsync(file);
            zipMap[file.name] = zip;
            const packPng = zip.file('pack.png');
            if (packPng) {
                const blob = await packPng.async('blob');
                previews[file.name] = URL.createObjectURL(blob);
            } else {
                previews[file.name] = null;
            }
            const paths = [];
            zip.forEach((relativePath, fileData) => {
                if (!fileData.dir) paths.push(relativePath);
            });
            filePathMaps[file.name] = paths;
        } catch {
            previews[file.name] = null;
            filePathMaps[file.name] = [];
        }
    }
}

function renderFileList() {
    fileList.innerHTML = '';
    filesArray.forEach((file, index) => {
        const li = document.createElement('li');
        li.className = 'file-item';
        li.draggable = true;

        const count = conflictCountPerPack[file.name] || 0;
        let statusClass = 'status-green';
        if (count > 5) statusClass = 'status-red';
        else if (count > 0) statusClass = 'status-yellow';

        const statusIndicator = `<div class="status-indicator ${statusClass}"></div>`;

        const img = previews[file.name]
            ? `<img src="${previews[file.name]}" alt="Pack Vorschau">`
            : '<img src="default-preview.png" alt="Keine Vorschau">';

        li.innerHTML = `
            <div class="file-item-content">
                ${statusIndicator}
                ${img}
                <span class="file-name">${file.name}</span>
            </div>
            <button class="remove-btn" data-index="${index}">Entfernen</button>
        `;

        li.addEventListener('dragstart', (e) => handleDragStart(e, index));
        li.addEventListener('dragover', handleDragOver);
        li.addEventListener('drop', (e) => handleDrop(e, index));
        li.addEventListener('dragend', handleDragEnd);
        li.addEventListener('click', () => showDependencies(file.name));

        fileList.appendChild(li);
    });
    attachRemoveListeners();
}

function attachRemoveListeners() {
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-index'), 10);
            filesArray.splice(idx, 1);
            renderFileList();
            detectConflicts();
            updateCombineState();
            updateDependencyView();
            pushHistory();
        });
    });
}

let draggedIndex = null;

function handleDragStart(e, index) {
    draggedIndex = index;
    e.target.classList.add('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
    const target = e.target.closest('.file-item');
    if (target) target.classList.add('over');
}

function handleDrop(e, droppedIndex) {
    e.preventDefault();
    const draggedFile = filesArray[draggedIndex];
    filesArray.splice(draggedIndex, 1);
    filesArray.splice(droppedIndex, 0, draggedFile);
    renderFileList();
    detectConflicts();
    updateCombineState();
    updateDependencyView();
    pushHistory();
}

function handleDragEnd() {
    document.querySelectorAll('.file-item').forEach(item => item.classList.remove('over', 'dragging'));
}

function updateCombineState() {
    if (filesArray.length >= 2) {
        combineButton.disabled = false;
        fileHint.style.opacity = 0;
        setTimeout(() => { fileHint.style.visibility = 'hidden'; }, 300);
    } else {
        combineButton.disabled = true;
        fileHint.style.visibility = 'visible';
        fileHint.style.opacity = 1;
        conflictList.innerHTML = '';
        noConflicts.textContent = 'Keine Konflikte gefunden.';
        dependencyContainer.innerHTML = '<p>Wähle ein Pack, um Abhängigkeiten zu sehen.</p>';
    }
}

// ---- Konflikt-Management ----

function detectConflicts() {
    const pathCount = {};
    filesArray.forEach(file => {
        const paths = filePathMaps[file.name] || [];
        paths.forEach(p => {
            if (!pathCount[p]) pathCount[p] = [];
            pathCount[p].push(file.name);
        });
    });
    const conflicts = Object.entries(pathCount)
        .filter(([path, names]) => names.length > 1)
        .map(([path, names]) => ({ path, names }));

    conflictList.innerHTML = '';
    conflictResolution = {};
    conflictCountPerPack = {};

    if (conflicts.length === 0) {
        noConflicts.textContent = 'Keine Konflikte gefunden.';
        filesArray.forEach(f => conflictCountPerPack[f.name] = 0);
        renderFileList();
        return;
    }
    noConflicts.textContent = '';
    filesArray.forEach(f => conflictCountPerPack[f.name] = 0);
    conflicts.forEach(conf => {
        conf.names.forEach(name => {
            conflictCountPerPack[name] = (conflictCountPerPack[name] || 0) + 1;
        });
    });
    conflicts.forEach(conf => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="conflict-path">${conf.path}</span>
            <select class="conflict-select" data-path="${conf.path}">
                <option value="">Entfernen</option>
                ${conf.names.map(n => `<option value="${n}">Behalte aus: ${n}</option>`).join('')}
            </select>
        `;
        conflictList.appendChild(li);
    });
    document.querySelectorAll('.conflict-select').forEach(sel => {
        sel.addEventListener('change', () => {
            const path = sel.getAttribute('data-path');
            conflictResolution[path] = sel.value === '' ? null : sel.value;
        });
    });
    renderFileList();
}

// ---- Combine-Funktion ----

combineButton.addEventListener('click', async () => {
    if (filesArray.length < 2) return;

    const selectedVersion = versionSelect.value;
    const packFormat = versionPackFormatMap[selectedVersion] || 18;
    const zipOut = new JSZip();

    for (const file of filesArray) {
        const loadedZip = zipMap[file.name];
        if (!loadedZip) continue;
        loadedZip.forEach((entryPath, fileData) => {
            if (fileData.dir) return;
            if (conflictResolution.hasOwnProperty(entryPath)) {
                const choice = conflictResolution[entryPath];
                if (choice === null) return;
                if (choice !== file.name) return;
            }
            if (!zipOut.file(entryPath)) {
                zipOut.file(entryPath, fileData.async('arraybuffer'));
            }
        });
    }

    const mcmetaContent = {
        pack: {
            pack_format: packFormat,
            description: descriptionInput.value || "",
            author: authorInput.value || ""
        }
    };
    zipOut.file('pack.mcmeta', JSON.stringify(mcmetaContent, null, 2));

    const logoFile = logoInput.files[0];
    if (logoFile) {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            const blob = base64ToBlob(base64, 'image/png');
            zipOut.file('pack_logo.png', blob);
            finalizeZip(zipOut);
        };
        reader.readAsDataURL(logoFile);
    } else {
        finalizeZip(zipOut);
    }
});

function finalizeZip(zipOut) {
    zipOut.generateAsync({ type: 'blob' }).then(contentBlob => {
        const url = URL.createObjectURL(contentBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'combined-resourcepack.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}

function base64ToBlob(base64, mime) {
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mime });
}

// ---- Logo-Vorschau ----

logoInput.addEventListener('change', () => {
    const file = logoInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = () => {
            logoPreview.src = reader.result;
            logoPreviewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    } else {
        logoPreviewContainer.classList.add('hidden');
        logoPreview.src = '';
    }
});

// ---- Preset-Funktionen ----

function loadPresets() {
    const stored = JSON.parse(localStorage.getItem('rpcombiner_presets') || '{}');
    loadPresetSelect.innerHTML = '<option value="">Preset laden…</option>';
    Object.keys(stored).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        loadPresetSelect.appendChild(opt);
    });
    deletePresetButton.disabled = true;
}

savePresetButton.addEventListener('click', () => {
    const name = presetNameInput.value.trim();
    if (!name) return;
    const stored = JSON.parse(localStorage.getItem('rpcombiner_presets') || '{}');
    const reader = new FileReader();
    if (logoInput.files[0]) {
        reader.onload = () => {
            stored[name] = {
                version: versionSelect.value,
                author: authorInput.value,
                description: descriptionInput.value,
                logoData: reader.result
            };
            localStorage.setItem('rpcombiner_presets', JSON.stringify(stored));
            loadPresets();
            presetNameInput.value = '';
        };
        reader.readAsDataURL(logoInput.files[0]);
    } else {
        stored[name] = {
            version: versionSelect.value,
            author: authorInput.value,
            description: descriptionInput.value,
            logoData: null
        };
        localStorage.setItem('rpcombiner_presets', JSON.stringify(stored));
        loadPresets();
        presetNameInput.value = '';
    }
});

loadPresetSelect.addEventListener('change', () => {
    const name = loadPresetSelect.value;
    const stored = JSON.parse(localStorage.getItem('rpcombiner_presets') || '{}');
    if (stored[name]) {
        versionSelect.value = stored[name].version;
        authorInput.value = stored[name].author;
        descriptionInput.value = stored[name].description;
        if (stored[name].logoData) {
            logoPreview.src = stored[name].logoData;
            logoPreviewContainer.classList.remove('hidden');
            fetch(stored[name].logoData)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], 'pack_logo.png', { type: 'image/png' });
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    logoInput.files = dataTransfer.files;
                });
        } else {
            logoInput.value = '';
            logoPreviewContainer.classList.add('hidden');
            logoPreview.src = '';
        }
        deletePresetButton.disabled = false;
    } else {
        deletePresetButton.disabled = true;
    }
});

deletePresetButton.addEventListener('click', () => {
    const name = loadPresetSelect.value;
    if (!name) return;
    const stored = JSON.parse(localStorage.getItem('rpcombiner_presets') || '{}');
    delete stored[name];
    localStorage.setItem('rpcombiner_presets', JSON.stringify(stored));
    loadPresets();
});

// ---- Session speichern / laden ----

saveSessionButton.addEventListener('click', () => {
    const sessionData = {
        version: versionSelect.value,
        author: authorInput.value,
        description: descriptionInput.value,
        conflictResolution,
        files: []
    };
    const readers = [];
    filesArray.forEach(file => {
        const reader = new FileReader();
        readers.push(
            new Promise(resolve => {
                reader.onload = () => {
                    sessionData.files.push({
                        name: file.name,
                        data: reader.result.split(',')[1]
                    });
                    resolve();
                };
                reader.readAsDataURL(file);
            })
        );
    });
    Promise.all(readers).then(() => {
        const blob = new Blob([JSON.stringify(sessionData)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'rpcombiner_session.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
});

loadSessionButton.addEventListener('click', () => loadSessionInput.click());

loadSessionInput.addEventListener('change', async () => {
    const file = loadSessionInput.files[0];
    if (!file) return;
    const text = await file.text();
    try {
        const data = JSON.parse(text);
        versionSelect.value = data.version;
        authorInput.value = data.author;
        descriptionInput.value = data.description;
        conflictResolution = data.conflictResolution || {};
        const reconstructed = [];
        for (const f of data.files) {
            const blob = base64ToBlob(f.data, 'application/zip');
            const newFile = new File([blob], f.name, { type: 'application/zip' });
            reconstructed.push(newFile);
        }
        filesArray = reconstructed;
        previews = {};
        filePathMaps = {};
        zipMap = {};
        conflictCountPerPack = {};
        await loadPreviewsAndPaths(filesArray);
        renderFileList();
        detectConflicts();
        updateCombineState();
        updateDependencyView();
        pushHistory();
    } catch {}
    loadSessionInput.value = '';
});

// ---- Abhängigkeiten (Dependencies) anzeigen ----

function showDependencies(packName) {
    dependencyContainer.innerHTML = '';
    if (!filePathMaps[packName]) {
        dependencyContainer.innerHTML = '<p>Keine Dateien gefunden.</p>';
        return;
    }
    const idx = filesArray.findIndex(f => f.name === packName);
    if (idx === -1) return;

    const allFiles = filePathMaps[packName] || [];
    const effective = [];
    const overridden = [];

    allFiles.forEach(path => {
        let isOverridden = false;
        for (let j = idx + 1; j < filesArray.length; j++) {
            const otherName = filesArray[j].name;
            if ((filePathMaps[otherName] || []).includes(path)) {
                isOverridden = true;
                break;
            }
        }
        if (isOverridden) overridden.push(path);
        else effective.push(path);
    });

    const sectionEff = document.createElement('div');
    sectionEff.className = 'dependency-section';
    sectionEff.innerHTML = '<h3>Effektive Dateien</h3>';
    if (effective.length === 0) {
        sectionEff.innerHTML += '<p>(keine)</p>';
    } else {
        const ulEff = document.createElement('ul');
        effective.forEach(p => {
            const li = document.createElement('li');
            li.textContent = p;
            ulEff.appendChild(li);
        });
        sectionEff.appendChild(ulEff);
    }

    const sectionOver = document.createElement('div');
    sectionOver.className = 'dependency-section';
    sectionOver.innerHTML = '<h3>Überschriebene Dateien</h3>';
    if (overridden.length === 0) {
        sectionOver.innerHTML += '<p>(keine)</p>';
    } else {
        const ulO = document.createElement('ul');
        overridden.forEach(p => {
            const li = document.createElement('li');
            li.textContent = p;
            ulO.appendChild(li);
        });
        sectionOver.appendChild(ulO);
    }

    dependencyContainer.appendChild(sectionEff);
    dependencyContainer.appendChild(sectionOver);
}

function updateDependencyView() {
    dependencyContainer.innerHTML = '<p>Wähle ein Pack, um Abhängigkeiten zu sehen.</p>';
}
