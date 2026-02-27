const btnNew = document.getElementById('btn-new');
const treeContainer = document.getElementById('tree-container');
const gridContainer = document.getElementById('grid-container');
const pageCounter = document.getElementById('page-counter');
const pageSizeSelect = document.getElementById('page-size');

// Pagination State
let selectedMedia = [];
let currentPage = 1;
let itemsPerPage = 9; // default 3x3 grid

let currentTreeData = null;
let selectedNodes = new Set(); // Stores the actual selected data objects (folders/files)
let flatNodeList = []; // Flat list of all clickable nodes in DOM order
let lastSelectedIndex = null; // Anchor index for shift-click range selection

// Formatting
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024, dm = decimals < 0 ? 0 : decimals, sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Extract all media files from a selected tree node
function extractMedia(node) {
    let media = [];
    if (node.type === 'folder') {
        node.children.forEach(child => media = media.concat(extractMedia(child)));
    } else {
        media.push(node);
    }
    return media;
}

// Build the HTML Tree
function buildTree(node, parentElement) {
    const ul = document.createElement('ul');
    parentElement.appendChild(ul);

    node.children.forEach(child => {
        const li = document.createElement('li');
        ul.appendChild(li);

        const label = document.createElement('span');
        label.textContent = child.name;
        
        if (child.type === 'folder') {
            label.className = 'folder-icon';
            li.appendChild(label);
            
            const index = flatNodeList.length;
            flatNodeList.push({ node: child, label });
            label.dataset.index = String(index);
            
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'hidden';
            li.appendChild(childrenContainer);
            
            buildTree(child, childrenContainer); // Recursive call

            label.addEventListener('click', (e) => handleSelection(e, child, label));
        } else {
            label.className = 'file-icon';
            li.appendChild(label); // No sizeSpan appended anymore
            
            const index = flatNodeList.length;
            flatNodeList.push({ node: child, label });
            label.dataset.index = String(index);
            
            label.addEventListener('click', (e) => handleSelection(e, child, label));
        }   
    });
}

function refreshMediaGallery() {
    let allMedia = [];
    
    selectedNodes.forEach(node => {
        allMedia = allMedia.concat(extractMedia(node));
    });

    // Remove duplicates (e.g., if a folder and its child are both selected)
    selectedMedia = [...new Set(allMedia)]; 
    
    currentPage = 1;
    updateGrid();
}

const handleSelection = (e, node, label) => {
    e.stopPropagation();

    const index = parseInt(label.dataset.index, 10);
    const hasToggleModifier = e.ctrlKey || e.metaKey;   // Ctrl (Win/Linux) or Cmd (macOS)
    const isShift = e.shiftKey;

    // Shift-click: range selection
    if (isShift && lastSelectedIndex !== null) {
        if (!hasToggleModifier) {
            // Fresh range selection
            selectedNodes.clear();
            document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        }

        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);

        for (let i = start; i <= end; i++) {
            const item = flatNodeList[i];
            if (!item) continue;

            if (hasToggleModifier && selectedNodes.has(item.node)) {
                // Ctrl/Cmd + Shift: allow deselecting within the range
                selectedNodes.delete(item.node);
                item.label.classList.remove('selected');
            } else if (!selectedNodes.has(item.node)) {
                selectedNodes.add(item.node);
                item.label.classList.add('selected');
            }
        }

        lastSelectedIndex = index;
        refreshMediaGallery();
        return;
    }

    // Non-shift clicks
    if (!hasToggleModifier) {
        // Plain click: clear others and select only this item
        selectedNodes.clear();
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));

        selectedNodes.add(node);
        label.classList.add('selected');
    } else {
        // Ctrl/Cmd click: toggle just this item, keep others
        if (selectedNodes.has(node)) {
            selectedNodes.delete(node);
            label.classList.remove('selected');
        } else {
            selectedNodes.add(node);
            label.classList.add('selected');
        }
    }

    // Folder expand/collapse only on plain (non-modifier, non-shift) click
    if (node.type === 'folder' && !hasToggleModifier && !isShift) {
        const childrenContainer = label.nextElementSibling;
        const isHidden = childrenContainer.classList.toggle('hidden');
        label.classList.replace(
            isHidden ? 'folder-open' : 'folder-icon',
            isHidden ? 'folder-icon' : 'folder-open'
        );
    }

    lastSelectedIndex = index;
    refreshMediaGallery();
};

function updateGridLayout() {
    const gridSize = Math.sqrt(itemsPerPage) || 1;
    gridContainer.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
    gridContainer.style.gridTemplateRows = `repeat(${gridSize}, 1fr)`;
}

// Update the Grid based on pagination and layout
function updateGrid() {
    gridContainer.innerHTML = '';
    const totalPages = Math.ceil(selectedMedia.length / itemsPerPage) || 1;
    
    // Safety check for current page
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    pageCounter.textContent = `Page ${currentPage} of ${totalPages} pages`;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, selectedMedia.length);
    const itemsToShow = selectedMedia.slice(startIndex, endIndex);

    itemsToShow.forEach(media => {
        const div = document.createElement('div');
        div.className = 'media-item';

        if (media.type === 'image') {
            const img = document.createElement('img');
            img.src = `file://${media.path}`;
            div.appendChild(img);
        } else if (media.type === 'video') {
            const video = document.createElement('video');
            video.src = `file://${media.path}#t=0.1`;
            video.preload = 'metadata';
            video.muted = true; // Add this to prevent browser playback blocks
            div.appendChild(video);
            
            const playIcon = document.createElement('div');
            playIcon.className = 'play-icon';
            playIcon.innerHTML = '▶';
            div.appendChild(playIcon);
        }
        gridContainer.appendChild(div);
    });
}

// Initialization and Event Listeners

// Pagination Controls
document.getElementById('btn-first').addEventListener('click', () => { currentPage = 1; updateGrid(); });
document.getElementById('btn-prev').addEventListener('click', () => { if (currentPage > 1) { currentPage--; updateGrid(); }});
document.getElementById('btn-next').addEventListener('click', () => { const total = Math.ceil(selectedMedia.length / itemsPerPage); if (currentPage < total) { currentPage--; currentPage++; currentPage = Math.min(currentPage + 0, total); currentPage++; updateGrid(); }});
document.getElementById('btn-last').addEventListener('click', () => { currentPage = Math.ceil(selectedMedia.length / itemsPerPage) || 1; updateGrid(); });

// Page size selector
if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', () => {
        const value = parseInt(pageSizeSelect.value, 10);
        if (!Number.isNaN(value) && value > 0) {
            itemsPerPage = value;
            currentPage = 1;
            updateGridLayout();
            updateGrid();
        }
    });
}

// Function to render the UI from a data object (reused for New and Open)
function loadTreeData(data) {
    currentTreeData = data; // Store it for saving later
    treeContainer.innerHTML = '';
    flatNodeList = [];
    lastSelectedIndex = null;
    selectedNodes.clear();
    
    const rootItem = document.createElement('div');
    rootItem.textContent = data.name;
    rootItem.className = 'folder-open';
    rootItem.style.fontWeight = 'bold';
    rootItem.style.cursor = 'pointer';
    treeContainer.appendChild(rootItem);
    
    buildTree(data, treeContainer);
    
    // Load default view
    selectedMedia = extractMedia(data);
    currentPage = 1;
    updateGridLayout();
    updateGrid();
}

// "New" Button
btnNew.addEventListener('click', async () => {
    const data = await window.electronAPI.openFolder();
    if (data) loadTreeData(data);
});

// "Save" Button
document.getElementById('btn-save').addEventListener('click', async () => {
    if (!currentTreeData) {
        alert("No folder loaded to save!");
        return;
    }
    const jsonString = JSON.stringify(currentTreeData, null, 2);
    const success = await window.electronAPI.saveFile(jsonString);
    if (success) console.log("File saved successfully.");
});

// "Open" Button
document.getElementById('btn-open').addEventListener('click', async () => {
    const data = await window.electronAPI.openFile();
    if (data) loadTreeData(data);
});

// Resizable Sidebar Logic
const resizer = document.getElementById('drag-bar');
const sidebar = document.getElementById('sidebar');

let isResizing = false;

resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    // Prevent text selection while dragging
    document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    // Calculate new width based on mouse position
    const newWidth = e.clientX;
    
    // Apply constraints
    if (newWidth > 150 && newWidth < window.innerWidth * 0.8) {
        sidebar.style.width = `${newWidth}px`;
    }
});

document.addEventListener('mouseup', () => {
    isResizing = false;
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
});
