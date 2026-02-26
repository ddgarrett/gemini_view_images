const btnNew = document.getElementById('btn-new');
const treeContainer = document.getElementById('tree-container');
const gridContainer = document.getElementById('grid-container');
const pageCounter = document.getElementById('page-counter');

// Pagination State
let selectedMedia = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 9; // 3x3 grid

let currentTreeData = null;
let selectedNodes = new Set(); // Stores the actual selected data objects (folders/files)

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
            
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'hidden';
            li.appendChild(childrenContainer);
            
            buildTree(child, childrenContainer); // Recursive call

            label.addEventListener('click', (e) => handleSelection(e, child, label));
        } else {
            label.className = 'file-icon';
            li.appendChild(label); // No sizeSpan appended anymore
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

    if (!(e.ctrlKey || e.metaKey)) {
        // Standard click: Clear previous and select only this
        selectedNodes.clear();
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    }

    if (selectedNodes.has(node)) {
        selectedNodes.delete(node);
        label.classList.remove('selected');
    } else {
        selectedNodes.add(node);
        label.classList.add('selected');
    }

    // Special case for folders: still toggle the expand/collapse on click
    if (node.type === 'folder' && !(e.ctrlKey || e.metaKey)) {
        const childrenContainer = label.nextElementSibling;
        const isHidden = childrenContainer.classList.toggle('hidden');
        label.classList.replace(isHidden ? 'folder-open' : 'folder-icon', isHidden ? 'folder-icon' : 'folder-open');
    }

    refreshMediaGallery();
};

// Update the 3x3 Grid based on pagination
function updateGrid() {
    gridContainer.innerHTML = '';
    const totalPages = Math.ceil(selectedMedia.length / ITEMS_PER_PAGE) || 1;
    
    // Safety check for current page
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    pageCounter.textContent = `Page ${currentPage} of ${totalPages} pages`;

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, selectedMedia.length);
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
document.getElementById('btn-next').addEventListener('click', () => { const total = Math.ceil(selectedMedia.length/ITEMS_PER_PAGE); if(currentPage < total) { currentPage++; updateGrid(); }});
document.getElementById('btn-last').addEventListener('click', () => { currentPage = Math.ceil(selectedMedia.length / ITEMS_PER_PAGE) || 1; updateGrid(); });

// Function to render the UI from a data object (reused for New and Open)
function loadTreeData(data) {
    currentTreeData = data; // Store it for saving later
    treeContainer.innerHTML = '';
    
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
