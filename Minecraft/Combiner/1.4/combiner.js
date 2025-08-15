const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const combineButton = document.getElementById('combineButton');
const versionSelect = document.getElementById('versionSelect');
const darkModeToggle = document.getElementById('darkModeToggle');
const fileHint = document.getElementById('fileHint');

let filesArray = [];
let previews = {};
let draggedIndex = null;

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
    "1.19.4": 13,
    "1.20 - 1.20.1": 15,
    "1.20.2": 18,
    "1.20.3 - 1.20.4": 22,
    "1.21 - 1.21.1": 34,
    "1.21.5": 55,
    "1.21.6": 63,
    "1.21.7": 64
}


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
});

darkModeToggle.addEventListener('change', () => {
    setDarkMode(darkModeToggle.checked);
});

fileInput.addEventListener('change', async () => {
    filesArray = Array.from(fileInput.files);
    previews = {};
    await loadPreviews();
    renderFileList();
    updateCombineState();
});

async function loadPreviews() {
    for (const file of filesArray) {
        try {
            const zip = await JSZip.loadAsync(file);
            const packPng = zip.file('pack.png');
            if (packPng) {
                const blob = await packPng.async('blob');
                previews[file.name] = URL.createObjectURL(blob);
            } else {
                previews[file.name] = null;
            }
        } catch (error) {
            console.error(`Fehler beim Lesen von ${file.name}:`, error);
        }
    }
}

function renderFileList() {
    fileList.innerHTML = '';
    filesArray.forEach((file, index) => {
        const li = document.createElement('li');
        li.className = 'file-item';
        li.draggable = true;

        const img = previews[file.name]
            ? `<img src="${previews[file.name]}" alt="Pack Preview">`
            : '<img src="default-preview.png" alt="No Preview">';

        li.innerHTML = `
            <div class="file-item-content">
                ${img}
                <span>${file.name}</span>
            </div>
            <button class="remove-btn" data-index="${index}" title="Entfernen">🗑️</button>
        `;

        li.addEventListener('dragstart', (e) => handleDragStart(e, index));
        li.addEventListener('dragover', handleDragOver);
        li.addEventListener('drop', (e) => handleDrop(e, index));
        li.addEventListener('dragend', handleDragEnd);

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
            updateCombineState();
        });
    });
}

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
}

function handleDragEnd(e) {
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
    }
}

combineButton.addEventListener('click', async () => {
    if (filesArray.length < 2) return;

    const selectedVersion = versionSelect.value;
    const packFormat = versionPackFormatMap[selectedVersion] || 18;
    const zip = new JSZip();

    for (const file of filesArray) {
        try {
            const loadedZip = await JSZip.loadAsync(file);
            loadedZip.forEach((path, fileData) => {
                if (!zip.file(path)) {
                    zip.file(path, fileData.async('arraybuffer'));
                }
            });
        } catch (error) {
            console.error(`Fehler beim Laden von ${file.name}:`, error);
        }
    }

    try {
        const mcmetaContent = {
            pack: {
                pack_format: packFormat,
                description: [
                    { text: "Resource pack ", color: "blue" },
                    { text: "combiner", color: "green" },
                    { text: "\nby ", color: "red" },
                    { text: "Allesmacher", color: "yellow" }
                ]
            }
        };

        zip.file('pack.mcmeta', JSON.stringify(mcmetaContent, null, 2));
        const contentBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(contentBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'combined-resourcepack.zip';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Fehler beim Erstellen der ZIP-Datei:', error);
    }
});

