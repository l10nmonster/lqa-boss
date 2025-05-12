// js/ui.js
import * as Data from './dataManager.js'; // To get activeSegmentIndex for rendering

export const DOM = {
    fileInput: document.getElementById('fileInput'),
    saveChangesBtn: document.getElementById('saveChangesBtn'),
    screenshotImage: document.getElementById('screenshotImage'),
    screenshotContainer: document.getElementById('screenshotContainer'),
    editPanel: document.getElementById('editPanel'),
    flowNameInTitleSpan: document.getElementById('flowNameInTitle'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    pageIndicator: document.getElementById('pageIndicator'),
    screenshotSection: document.getElementById('screenshot-section'),
    editPanelSection: document.getElementById('edit-panel-section')
};

export function updatePageNavigationUI() {
    const flow = Data.getFlowData();
    const currentPageIdx = Data.getCurrentDisplayPageIndex();
    if (!DOM.pageIndicator || !DOM.prevPageBtn || !DOM.nextPageBtn || !flow || !flow.pages) return;

    DOM.pageIndicator.textContent = `Page ${currentPageIdx + 1} of ${flow.pages.length}`;
    DOM.prevPageBtn.disabled = currentPageIdx === 0;
    DOM.nextPageBtn.disabled = currentPageIdx === (flow.pages.length - 1);
}

export function renderHighlights() {
    const page = Data.getCurrentPage();
    const activeSegmentIdx = Data.getActiveSegmentIndex();

    if (!page || !page.segments || !DOM.screenshotImage || !DOM.screenshotImage.naturalWidth || DOM.screenshotImage.naturalWidth === 0 || !DOM.screenshotContainer) {
        if (DOM.screenshotContainer) DOM.screenshotContainer.querySelectorAll('.highlight-box').forEach(box => box.remove());
        return;
    }
    DOM.screenshotContainer.querySelectorAll('.highlight-box').forEach(box => box.remove());

    const dprViewing = window.devicePixelRatio || 1;
    const displayedImageCSSWidth = DOM.screenshotImage.offsetWidth;
    const displayedImageCSSHeight = DOM.screenshotImage.offsetHeight;
    const sourceImageNaturalWidth = DOM.screenshotImage.naturalWidth;
    const sourceImageNaturalHeight = DOM.screenshotImage.naturalHeight;

    if (displayedImageCSSWidth === 0 || sourceImageNaturalWidth === 0) return;

    const intendedLogicalWidth = sourceImageNaturalWidth / dprViewing;
    const scaleFactorX = displayedImageCSSWidth / intendedLogicalWidth;
    const scaleFactorY = displayedImageCSSHeight / (sourceImageNaturalHeight / dprViewing);

    page.segments.forEach((segment, index) => {
        const highlightBox = document.createElement('div');
        highlightBox.className = 'highlight-box';
        highlightBox.dataset.segmentIndex = index;
        const cssLeft = segment.x * scaleFactorX;
        const cssTop = segment.y * scaleFactorY;
        const cssWidth = segment.width * scaleFactorX;
        const cssHeight = segment.height * scaleFactorY;
        highlightBox.style.left = `${cssLeft}px`;
        highlightBox.style.top = `${cssTop}px`;
        highlightBox.style.width = `${cssWidth}px`;
        highlightBox.style.height = `${cssHeight}px`;
        if (index === activeSegmentIdx) highlightBox.classList.add('active');
        DOM.screenshotContainer.appendChild(highlightBox);
    });
}

export function renderEditItems(onTextChange, onFocus, onUndo) {
    const page = Data.getCurrentPage();
    const currentPageIdx = Data.getCurrentDisplayPageIndex();

    if (!DOM.editPanel) return;
    DOM.editPanel.innerHTML = '';
    if (!page || !page.segments || page.segments.length === 0) {
        DOM.editPanel.innerHTML = '<p>No text segments on this page.</p>';
        return;
    }

    page.segments.forEach((segment, index) => {
        const editItemDiv = document.createElement('div');
        editItemDiv.className = 'edit-item';
        editItemDiv.dataset.segmentIndex = index;
        const textarea = document.createElement('textarea');
        textarea.id = `text-input-p${currentPageIdx}-s${index}`;
        textarea.value = segment.text;
        textarea.dataset.pageIndex = currentPageIdx;
        textarea.dataset.segmentIndex = index;

        const originalText = Data.getOriginalText(page.pageId, index);
        if (originalText === undefined) { // Should be populated by initializeOriginalTexts
            console.warn(`Original text for ${page.pageId}_${index} not found!`);
            // Fallback: consider current text as original if not found (though this hides changes)
             Data.originalSegmentTextsMap[`${page.pageId}_${index}`] = segment.text;
        }

        if (segment.text === Data.getOriginalText(page.pageId, index)) {
            editItemDiv.classList.add('unmodified');
            editItemDiv.classList.remove('modified');
        } else {
            editItemDiv.classList.add('modified');
            editItemDiv.classList.remove('unmodified');
        }

        textarea.addEventListener('input', onTextChange);
        textarea.addEventListener('focus', onFocus);

        const undoBtn = document.createElement('button');
        undoBtn.className = 'undo-btn';
        undoBtn.innerHTML = '↺';
        undoBtn.title = 'Revert to original text';
        // Pass necessary data to onUndo closure
        undoBtn.onclick = () => onUndo(textarea, page.pageId, index, Data.getOriginalText(page.pageId, index));

        editItemDiv.appendChild(textarea);
        editItemDiv.appendChild(undoBtn);
        DOM.editPanel.appendChild(editItemDiv);
    });
}

export function updateSegmentHighlightAndEditorFocusUI() {
    const segmentIndex = Data.getActiveSegmentIndex();
    // const segmentsCount = Data.getCurrentPage() ? Data.getCurrentPage().segments.length : 0;

    if (!DOM.screenshotContainer || !DOM.editPanel) return;

    DOM.screenshotContainer.querySelectorAll('.highlight-box').forEach(box => {
        box.classList.remove('active');
        if (segmentIndex !== -1 && parseInt(box.dataset.segmentIndex, 10) === segmentIndex) {
            box.classList.add('active');
        }
    });
    DOM.editPanel.querySelectorAll('.edit-item').forEach(item => {
        item.classList.remove('active-segment-editor');
        const textarea = item.querySelector('textarea');
        if (segmentIndex !== -1 && textarea && parseInt(textarea.dataset.segmentIndex, 10) === segmentIndex) {
            item.classList.add('active-segment-editor');
        }
    });
}


export function adjustEditorPanelHeight() {
    if (!DOM.screenshotImage || !DOM.editPanelSection || !DOM.screenshotSection) {
        console.warn("AdjustEditorPanelHeight: Missing critical DOM elements for height calc.");
        return;
    }
    if (DOM.screenshotImage.naturalWidth === 0 || DOM.screenshotImage.offsetHeight === 0) {
        // This can happen if image is not loaded or src is empty
        // Set to a default min height in this case, or do nothing
        DOM.editPanelSection.style.height = `${350}px`; // Default min height
        return;
    }

    const screenshotImageHeight = DOM.screenshotImage.offsetHeight;
    const screenshotNavEl = DOM.screenshotSection.querySelector('.screenshot-nav');
    const screenshotNavHeight = screenshotNavEl ? screenshotNavEl.offsetHeight : 0;

    const targetHeightSource = screenshotImageHeight + screenshotNavHeight;
    const editorMinHeight = 350; // CSS min-height for the editor's content area
    let finalEditorPanelHeight;

    if (targetHeightSource >= editorMinHeight) {
        finalEditorPanelHeight = targetHeightSource;
    } else {
        finalEditorPanelHeight = editorMinHeight;
    }
    DOM.editPanelSection.style.height = `${finalEditorPanelHeight}px`;
}

export function resetUI() {
    if (DOM.screenshotImage) {
        DOM.screenshotImage.onload = null;
        DOM.screenshotImage.src = '';
        DOM.screenshotImage.style.width = 'auto';
        DOM.screenshotImage.style.height = 'auto';
    }
    if (DOM.screenshotContainer) DOM.screenshotContainer.querySelectorAll('.highlight-box').forEach(box => box.remove());
    if (DOM.editPanel) DOM.editPanel.innerHTML = '<p>Load a <code>.lqaboss</code> file.</p>';
    if (DOM.flowNameInTitleSpan) {
        DOM.flowNameInTitleSpan.textContent = 'No flow loaded';
        DOM.flowNameInTitleSpan.title = '';
    }
    if (DOM.pageIndicator) DOM.pageIndicator.textContent = 'Page X of Y';
    if (DOM.prevPageBtn) DOM.prevPageBtn.disabled = true;
    if (DOM.nextPageBtn) DOM.nextPageBtn.disabled = true;
    if (DOM.saveChangesBtn) DOM.saveChangesBtn.disabled = true;
    if (DOM.fileInput) DOM.fileInput.value = ''; // Important to allow re-selection of same file
    if (DOM.editPanelSection) DOM.editPanelSection.style.height = 'auto'; // Reset height
}

export function setFlowNameInTitleUI(flowNameFromFile, actualFileName) {
    if (!DOM.flowNameInTitleSpan) return;
    const displayName = flowNameFromFile || actualFileName.replace(/\.lqaboss$/i, '') || 'Unnamed Flow';
    DOM.flowNameInTitleSpan.textContent = displayName;
    if (flowNameFromFile) DOM.flowNameInTitleSpan.title = `Flow: ${flowNameFromFile} (File: ${actualFileName})`;
    else DOM.flowNameInTitleSpan.title = actualFileName;
}