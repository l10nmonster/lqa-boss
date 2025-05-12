// js/eventHandlers.js
import * as UI from './ui.js';
import * as Data from './dataManager.js';

// JSZip is loaded globally via <script> tag in index.html

export async function handleFileLoad(event) {
    const file = event.target.files[0];
    if (!file) {
        console.log("File input event triggered, but no file selected.");
        return;
    }
    console.log("Attempting to load file:", file.name);
    Data.resetDataState();
    UI.resetUI(); // Resets UI to initial state including "Load a file..."
    UI.setFlowNameInTitleUI("Loading...", file.name); // Temporary name

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const loadedZip = await JSZip.loadAsync(e.target.result);
            Data.setZipFile(loadedZip);

            const metadataFile = Data.getZipFile().file("flow_metadata.json");
            if (!metadataFile) {
                alert('Invalid .lqaboss file: "flow_metadata.json" not found.');
                UI.resetUI(); return;
            }
            const metadataContent = await metadataFile.async("string");
            const parsedFlowData = JSON.parse(metadataContent);
            Data.setFlowData(parsedFlowData);

            if (!Data.getFlowData() || !Data.getFlowData().pages || !Array.isArray(Data.getFlowData().pages) || Data.getFlowData().pages.length === 0) {
                alert('Invalid .lqaboss file: No valid pages data found.');
                UI.resetUI(); return;
            }

            Data.initializeOriginalTexts(); // Populate original texts map
            UI.setFlowNameInTitleUI(Data.getFlowData().flowName, file.name); // Set final flow name

            Data.setCurrentDisplayPageIndex(0);
            Data.setActiveSegmentIndex(-1); // No segment active initially on first page load
            await displayCurrentPageFlow(); // Ensure this is awaited if it has async operations

            if (UI.DOM.saveChangesBtn) UI.DOM.saveChangesBtn.disabled = false;

        } catch (error) {
            alert(`Error processing .lqaboss file: ${error.message}`);
            console.error("ZIP/JSON Processing Error:", error);
            UI.resetUI();
        }
    };
    reader.onerror = (e) => {
        alert('Error reading file: ' + (e.target.error ? e.target.error.name : 'Unknown read error'));
        console.error("File Read Error:", e.target.error);
        UI.resetUI();
    };
    reader.readAsArrayBuffer(file);
}

export function navigatePage(direction) {
    const flow = Data.getFlowData();
    let currentPageIdx = Data.getCurrentDisplayPageIndex();
    if (!flow || !flow.pages) return;

    const newIndex = currentPageIdx + direction;
    if (newIndex >= 0 && newIndex < flow.pages.length) {
        Data.setCurrentDisplayPageIndex(newIndex);
        Data.setActiveSegmentIndex(-1); // Reset active segment when changing pages
        displayCurrentPageFlow();
    }
}

async function displayCurrentPageFlow() {
    const page = Data.getCurrentPage();
    const zip = Data.getZipFile();

    if (!page || !zip) {
        if (UI.DOM.screenshotImage) UI.DOM.screenshotImage.src = "";
        if (UI.DOM.editPanel) UI.DOM.editPanel.innerHTML = "<p>Error: Page data or ZIP instance unavailable.</p>";
        console.error("displayCurrentPageFlow: Preconditions not met", page, zip);
        UI.updatePageNavigationUI(); // Update nav buttons state (likely disabled)
        return;
    }

    UI.updatePageNavigationUI();

    try {
        const imageFileEntry = zip.file(page.imageFile);
        if (!imageFileEntry) {
            throw new Error(`Image file "${page.imageFile}" not found in zip for pageId "${page.pageId}".`);
        }
        const imageBase64 = await imageFileEntry.async("base64");

        UI.DOM.screenshotImage.onload = null; // Clear previous
        UI.DOM.screenshotImage.onload = () => {
            const dpr = window.devicePixelRatio || 1;
            const logicalWidth = UI.DOM.screenshotImage.naturalWidth / dpr;
            const logicalHeight = UI.DOM.screenshotImage.naturalHeight / dpr;
            UI.DOM.screenshotImage.style.width = `${logicalWidth}px`;
            UI.DOM.screenshotImage.style.height = `${logicalHeight}px`;

            UI.renderHighlights();
            UI.renderEditItems(handleTextChange, handleSegmentFocus, handleUndoSegment);
            UI.adjustEditorPanelHeight();

            // Focus first segment if available
            if (page.segments && page.segments.length > 0) {
                 const targetFocusIndex = (Data.getActiveSegmentIndex() !== -1 && page.segments[Data.getActiveSegmentIndex()])
                                        ? Data.getActiveSegmentIndex()
                                        : 0;
                focusSegment(targetFocusIndex, true);
            } else {
                Data.setActiveSegmentIndex(-1); // No segments
            }
        };
        UI.DOM.screenshotImage.src = `data:image/png;base64,${imageBase64}`;

        if (UI.DOM.screenshotImage.complete && UI.DOM.screenshotImage.naturalWidth > 0) {
            setTimeout(() => { if (UI.DOM.screenshotImage.onload) UI.DOM.screenshotImage.onload(); }, 100);
        }
    } catch (error) {
        console.error(`Error loading image "${page.imageFile}":`, error);
        if(UI.DOM.screenshotImage) {
            UI.DOM.screenshotImage.src = "";
            UI.DOM.screenshotImage.style.width = 'auto';
            UI.DOM.screenshotImage.style.height = 'auto';
        }
        if(UI.DOM.editPanel) UI.DOM.editPanel.innerHTML = `<p>Error loading image: ${error.message}</p>`;
        alert(`Error loading image for page ${Data.getCurrentDisplayPageIndex() + 1}: ${error.message}`);
    }
}

// Called by textarea input event
function handleTextChange(event) {
    const pIndex = parseInt(event.target.dataset.pageIndex, 10); // This is currentPageIndex
    const sIndex = parseInt(event.target.dataset.segmentIndex, 10);
    const currentTextValue = event.target.value;

    Data.updateSegmentText(pIndex, sIndex, currentTextValue);

    const itemDiv = event.target.closest('.edit-item');
    const page = Data.getCurrentPage(); // pageId is on this object
    if (itemDiv && page) {
        const originalText = Data.getOriginalText(page.pageId, sIndex);
        if (currentTextValue === originalText) {
            itemDiv.classList.remove('modified'); itemDiv.classList.add('unmodified');
        } else {
            itemDiv.classList.remove('unmodified'); itemDiv.classList.add('modified');
        }
    }
}

export function focusSegmentByIdx(segmentIndex, scrollIntoView = false) {
    const page = Data.getCurrentPage();
    if (!page || !page.segments) {
        Data.setActiveSegmentIndex(-1);
        console.warn("focusSegmentByIdx: No page or segments data.");
        return;
    }
    if (segmentIndex < 0 || segmentIndex >= page.segments.length) {
        console.warn(`focusSegmentByIdx: Index ${segmentIndex} out of bounds for ${page.segments.length} segments.`);
        Data.setActiveSegmentIndex(-1); // Reset if target is invalid
        UI.updateSegmentHighlightAndEditorFocusUI(); // Clear active classes
        return;
    }

    Data.setActiveSegmentIndex(segmentIndex); // Update the central active index
    UI.updateSegmentHighlightAndEditorFocusUI(); // Update visuals for both highlight and editor item

    const textareaToFocus = UI.DOM.editPanel.querySelector(`textarea[data-segment-index="${segmentIndex}"]`);
    if (textareaToFocus) {
        if (scrollIntoView || document.activeElement !== textareaToFocus) {
            textareaToFocus.focus();
            textareaToFocus.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    } else {
        console.warn(`focusSegmentByIdx: Textarea for segment index ${segmentIndex} not found.`);
    }
}

// Called by textarea focus event
function handleSegmentFocus(event) {
    const sIndex = parseInt(event.target.dataset.segmentIndex, 10);
    focusSegment(sIndex);
}

// Called by undo button click
function handleUndoSegment(textareaElement, pageId, segmentIdx, originalText) {
    if (originalText !== undefined) {
        textareaElement.value = originalText;
        Data.updateSegmentText(Data.getCurrentDisplayPageIndex(), segmentIdx, originalText);
        // Trigger input event to update styling and any other listeners
        textareaElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

function focusSegment(segmentIndex, scrollIntoView = false) {
    const page = Data.getCurrentPage();
    if (!page || !page.segments) { Data.setActiveSegmentIndex(-1); return; }
    if (segmentIndex < 0 || segmentIndex >= page.segments.length) {
        Data.setActiveSegmentIndex(-1);
        UI.updateSegmentHighlightAndEditorFocusUI(); // Clear active classes
        return;
    }

    Data.setActiveSegmentIndex(segmentIndex);
    UI.updateSegmentHighlightAndEditorFocusUI(); // Update visuals

    const textareaToFocus = UI.DOM.editPanel.querySelector(`textarea[data-segment-index="${segmentIndex}"]`);
    if (textareaToFocus && (scrollIntoView || document.activeElement !== textareaToFocus)) {
        textareaToFocus.focus();
        textareaToFocus.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

export function handleEditPanelKeyDown(event) {
    const flow = Data.getFlowData();
    const page = Data.getCurrentPage();
    const currentPageIdx = Data.getCurrentDisplayPageIndex();

    if (event.key === 'Tab' && flow && page && page.segments) {
        const segmentsCount = page.segments.length;
        event.preventDefault();

        if (segmentsCount === 0) {
            if (event.shiftKey) {
                if (!UI.DOM.prevPageBtn.disabled) UI.DOM.prevPageBtn.focus();
                else if (!UI.DOM.nextPageBtn.disabled) UI.DOM.nextPageBtn.focus();
            } else {
                if (!UI.DOM.nextPageBtn.disabled) UI.DOM.nextPageBtn.focus();
                else if (!UI.DOM.prevPageBtn.disabled) UI.DOM.prevPageBtn.focus();
            }
            return;
        }

        let currentSegmentIdxFromDOM = -1;
        const activeElem = document.activeElement;
        if (activeElem && activeElem.tagName === 'TEXTAREA' && activeElem.dataset.segmentIndex) {
            currentSegmentIdxFromDOM = parseInt(activeElem.dataset.segmentIndex, 10);
        } else {
            currentSegmentIdxFromDOM = Data.getActiveSegmentIndex() !== -1 ? Data.getActiveSegmentIndex() : (event.shiftKey ? 0 : segmentsCount - 1);
        }

        if (event.shiftKey) { // Shift + Tab
            if (currentSegmentIdxFromDOM <= 0) {
                if (currentPageIdx > 0) {
                    navigatePage(-1);
                    setTimeout(() => {
                        const prevPageData = Data.getCurrentPage();
                        if (prevPageData && prevPageData.segments.length > 0) {
                            focusSegmentByIdx(prevPageData.segments.length - 1, true);
                        } else if (prevPageData) {
                            focusSegmentByIdx(-1);
                        }
                    }, 150);
                } else {
                    focusSegmentByIdx(currentSegmentIdxFromDOM, true); // Stay
                }
            } else {
                focusSegmentByIdx(currentSegmentIdxFromDOM - 1, true);
            }
        } else { // Tab
            if (currentSegmentIdxFromDOM >= segmentsCount - 1) {
                if (currentPageIdx < flow.pages.length - 1) {
                    navigatePage(1); // displayCurrentPageFlow will handle initial focus
                } else {
                    focusSegmentByIdx(currentSegmentIdxFromDOM, true); // Stay
                }
            } else {
                focusSegmentByIdx(currentSegmentIdxFromDOM + 1, true);
            }
        }
    }
}

export function handleSaveChanges() {
    const flow = Data.getFlowData();
    if (!flow) { alert('No data loaded to save.'); return; }

    const changedSegmentsData = {
        flowName: flow.flowName,
        savedAt: new Date().toISOString(),
        pages: []
    };
    let changesMadeOverall = false;

    flow.pages.forEach((page) => {
        const pageOutput = {
            pageId: page.pageId,
            originalUrl: page.originalUrl,
            imageFile: page.imageFile,
            changedSegments: []
        };
        let pageHasChanges = false;
        page.segments.forEach((segment, sIndex) => {
            const originalText = Data.getOriginalText(page.pageId, sIndex);
            const currentText = segment.text;
            if (originalText !== currentText) {
                pageHasChanges = true; changesMadeOverall = true;
                const { x, y, width, height, text, ...otherMetadata } = segment;
                pageOutput.changedSegments.push({
                    segmentIndex: sIndex, originalText, currentText, ...otherMetadata
                });
            }
        });
        if (pageHasChanges) changedSegmentsData.pages.push(pageOutput);
    });

    if (!changesMadeOverall) { alert('No changes were made.'); return; }

    const jsonString = JSON.stringify(changedSegmentsData, null, 2);
    const filename = `${(flow.flowName || 'flow').replace(/[^a-z0-9_.-]/gi, '_')}_edited_segments.json`;
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('Edited segments JSON download initiated.');
}