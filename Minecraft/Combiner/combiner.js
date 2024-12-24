const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const combineButton = document.getElementById('combineButton');
const versionSelect = document.getElementById('versionSelect');
const darkModeToggle = document.getElementById('darkModeToggle');
const previewSection = document.getElementById('previewSection');
const customNameInput = document.getElementById('customName');
const customDescriptionInput = document.getElementById('customDescription');
const customIconInput = document.getElementById('customIcon');
const previewIcon = document.getElementById('previewIcon');
const previewName = document.getElementById('previewName');
const previewDescription = document.getElementById('previewDescription');

let filesArray = [];
let previews = {};
let incompatiblePacks = [];

// Versions-Mapping (Version → pack_format)
const versionPackFormatMap = {
    "1.6.1 – 1.8.9": 1,
    "1.9 – 1.10.2": 2,
    "1.11 – 1.12.2": 3,
    "1.13 - 1.14.4": 4,
    "1.15 - 1.16.1": 5,
    "1.16.2 - 1.16.5": 6,
    "1.17 - 1.17.1": 7,
    "1.18 - 1.18.2": 8,
    "1.19 - 1.19.2": 9,
    "1.19.3": 12,
    "1.19.4": 13,
    "1.20 – 1.20.1": 15,
    "1.20.2": 18,
    "1.20.3 - 1.20.4": 22,
    "1.20.5-": 33,
    "1.21-": 34,
    "1.21.2 – 1.21.4": 42,
    "1.21.4": 46
};

// Dropdown mit Versionen füllen
function populateVersionSelect() {
    console.log("Populating version select dropdown...");
    Object.entries(versionPackFormatMap).forEach(([version, packFormat]) => {
        const option = document.createElement('option');
        option.value = version;
        option.textContent = `${version} (Pack Format: ${packFormat})`;
        versionSelect.appendChild(option);
    });
    console.log("Version dropdown populated.");
}
populateVersionSelect();

// Dark Mode Zustand speichern
const isDarkModeEnabled = () => localStorage.getItem('darkMode') === 'enabled';
const setDarkMode = (enabled) => {
    console.log(`Setting dark mode: ${enabled}`);
    if (enabled) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('darkMode', 'enabled');
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('darkMode', 'disabled');
    }
};

// Dark Mode beim Laden anwenden
document.addEventListener('DOMContentLoaded', () => {
    console.log("Document loaded. Checking dark mode status...");
    if (isDarkModeEnabled()) {
        darkModeToggle.checked = true;
        setDarkMode(true);
    }
    console.log("Dark mode status applied.");
});

// Dark Mode Toggle
darkModeToggle.addEventListener('change', () => {
    console.log("Dark mode toggle changed.");
    setDarkMode(darkModeToggle.checked);
});

// Dateien hinzufügen und anzeigen
fileInput.addEventListener('change', async () => {
    console.log("Files selected.");
    filesArray = Array.from(fileInput.files);
    console.log("Files array updated:", filesArray);
    previews = {};
    incompatiblePacks = [];
    await loadPreviewsAndCheckCompatibility();
    renderFileList();
});

// Kompatibilitätsprüfung beim Versionswechsel
versionSelect.addEventListener('change', async () => {
    console.log("Version changed. Rechecking compatibility...");
    incompatiblePacks = [];
    await loadPreviewsAndCheckCompatibility();
    renderFileList();
});

// Vorschauen laden und Kompatibilität prüfen
async function loadPreviewsAndCheckCompatibility() {
    console.log("Loading previews and checking compatibility...");
    const selectedVersion = versionSelect.value;
    const selectedPackFormat = versionPackFormatMap[selectedVersion];

    for (const file of filesArray) {
        try {
            console.log(`Loading preview for file: ${file.name}`);
            const zip = await JSZip.loadAsync(file);
            const packMcmeta = zip.file('pack.mcmeta');
            const packPng = zip.file('pack.png');

            if (packPng) {
                const blob = await packPng.async('blob');
                previews[file.name] = URL.createObjectURL(blob);
            } else {
                previews[file.name] = null;
            }

            if (packMcmeta) {
                const mcmetaContent = JSON.parse(await packMcmeta.async('string'));
                const packFormat = mcmetaContent.pack.pack_format;

                if (packFormat < selectedPackFormat) {
                    incompatiblePacks.push({
                        name: file.name,
                        reason: `Pack format (${packFormat}) is too old for selected version (${selectedPackFormat}).`
                    });
                } else if (packFormat > selectedPackFormat) {
                    incompatiblePacks.push({
                        name: file.name,
                        reason: `Pack format (${packFormat}) is too new for selected version (${selectedPackFormat}).`
                    });
                }
            } else {
                incompatiblePacks.push({
                    name: file.name,
                    reason: "Missing pack.mcmeta file."
                });
            }
        } catch (error) {
            console.error(`Error loading preview for ${file.name}:`, error);
        }
    }
    console.log("Compatibility check complete.", incompatiblePacks);
}

function renderFileList() {
    console.log("Rendering file list...");
    fileList.innerHTML = '';
    filesArray.forEach((file, index) => {
        const li = document.createElement('li');
        li.className = 'file-item';
        li.draggable = true;

        const img = previews[file.name]
            ? `<img src="${previews[file.name]}" alt="Pack Preview" class="file-preview">`
            : '<img src="default-preview.png" alt="No Preview" class="file-preview">';

        const incompatibility = incompatiblePacks.find(pack => pack.name === file.name);
        const warning = incompatibility ? `<div class="warning">⚠️ ${incompatibility.reason}</div>` : '';

        li.innerHTML = `
            <div class="file-item-content">
                ${img}
                <div class="file-info">
                    <span class="file-name">${file.name}</span>
                    ${warning}
                </div>
            </div>
        `;

        li.addEventListener('dragstart', (e) => handleDragStart(e, index));
        li.addEventListener('dragover', handleDragOver);
        li.addEventListener('drop', (e) => handleDrop(e, index));
        li.addEventListener('dragend', handleDragEnd);

        fileList.appendChild(li);
    });
    console.log("File list rendered.");
}

function handleDragStart(e, index) {
    console.log(`Drag started for file at index ${index}.`);
    draggedIndex = index;
    e.target.classList.add('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDrop(e, droppedIndex) {
    console.log(`File dropped at index ${droppedIndex}.`);
    e.preventDefault();
    const draggedFile = filesArray[draggedIndex];
    filesArray.splice(draggedIndex, 1);
    filesArray.splice(droppedIndex, 0, draggedFile);
    renderFileList();
    console.log("File order updated.");
}

function handleDragEnd(e) {
    console.log("Drag ended.");
    e.target.classList.remove('dragging');
}

function updatePreview() {
    previewName.textContent = customNameInput.value || 'Unnamed Resource Pack';
    previewDescription.textContent = customDescriptionInput.value || 'No description provided';

    if (customIconInput.files[0]) {
        const fileReader = new FileReader();
        fileReader.onload = (e) => {
            previewIcon.src = e.target.result;
        };
        fileReader.readAsDataURL(customIconInput.files[0]);
    } else {
        previewIcon.src = 'default-preview.png';
    }
}

[customNameInput, customDescriptionInput, customIconInput].forEach(input => {
    input.addEventListener('input', updatePreview);
});

combineButton.addEventListener('click', async () => {
    console.log("Combine button clicked.");
    if (filesArray.length < 2) {
        alert('Bitte lade mindestens zwei Resourcepacks hoch.');
        return;
    }

    if (incompatiblePacks.length > 0) {
        const warningMessage = incompatiblePacks.map(pack => `${pack.name}: ${pack.reason}`).join('\n');
        if (!confirm(`Some packs are incompatible:\n${warningMessage}\nDo you want to continue?`)) {
            return;
        }
    }

    const selectedVersion = versionSelect.value;
    console.log(`Selected version: ${selectedVersion}`);
    const packFormat = versionPackFormatMap[selectedVersion] || 22; // Fallback auf 22

    console.log(`Using pack_format: ${packFormat}`);
    const zip = new JSZip();

    const customName = customNameInput.value || 'combined-resourcepack';
    const customDescription = customDescriptionInput.value || 'Kombiniertes Resourcepack';
    const customIcon = customIconInput.files[0];

    if (customIcon) {
        try {
            console.log("Adding custom icon...");
            const iconBlob = await customIcon.arrayBuffer();
            zip.file('pack.png', iconBlob);
        } catch (error) {
            console.error("Error adding custom icon:", error);
        }
    }

    for (const file of filesArray) {
        try {
            console.log(`Adding file to ZIP: ${file.name}`);
            const loadedZip = await JSZip.loadAsync(file);
            loadedZip.forEach((path, fileData) => {
                if (!zip.file(path)) {
                    zip.file(path, fileData.async('arraybuffer'));
                }
            });
        } catch (error) {
            console.error(`Error adding file to ZIP: ${file.name}`, error);
        }
    }

    try {
        console.log("Creating pack.mcmeta...");
        const mcmetaContent = {
            pack: {
                pack_format: packFormat,
                supported_formats: { "min_inclusive": 18, "max_inclusive": packFormat },
                description: customDescription
            }
        };

        zip.file('pack.mcmeta', JSON.stringify(mcmetaContent, null, 2));

        console.log("Generating ZIP file...");
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);

        console.log("Initiating download...");
        const a = document.createElement('a');
        a.href = url;
        a.download = `${customName}.zip`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        console.log("Download completed.");
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error generating ZIP file:', error);
    }
});
