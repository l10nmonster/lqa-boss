// js/main.js
import { DOM, resetUI, adjustEditorPanelHeight, renderHighlights } from './ui.js';
import { handleFileLoad, handleSaveChanges, navigatePage, handleEditPanelKeyDown, focusSegmentByIdx } from './eventHandlers.js';
import * as Data from './dataManager.js'; // Import all from DataManager

document.addEventListener('DOMContentLoaded', () => {
    if (!DOM.fileInput || !DOM.saveChangesBtn || !DOM.prevPageBtn || !DOM.nextPageBtn || !DOM.editPanel) {
        console.error("LQA Viewer: One or more critical UI elements are missing from the DOM in main.js. Aborting.");
        return;
    }

    DOM.fileInput.addEventListener('change', handleFileLoad);
    DOM.saveChangesBtn.addEventListener('click', handleSaveChanges);
    DOM.prevPageBtn.addEventListener('click', () => navigatePage(-1));
    DOM.nextPageBtn.addEventListener('click', () => navigatePage(1));
    DOM.editPanel.addEventListener('keydown', handleEditPanelKeyDown);

    if (DOM.screenshotContainer) {
        DOM.screenshotContainer.addEventListener('click', (event) => {
            const clickedElement = event.target;
            // Check if the clicked element is a highlight box
            if (clickedElement.classList.contains('highlight-box')) {
                const segmentIndexStr = clickedElement.dataset.segmentIndex;
                if (segmentIndexStr !== undefined) {
                    const segmentIndex = parseInt(segmentIndexStr, 10);
                    console.log(`Highlight box clicked for segment index: ${segmentIndex}`);
                    // Call a function (which will be in eventHandlers.js) to focus this segment
                    focusSegmentByIdx(segmentIndex, true); // true for scrollIntoView
                }
            }
        });
    }
    
    // PWA File Handling API (launchQueue)
    if ('launchQueue' in window && window.launchQueue) {
        console.log("PWA Launch Queue API is available. Setting consumer.");
        window.launchQueue.setConsumer(async (launchParams) => {
            console.log("Launch Queue Consumer Fired. Params:", launchParams);
            if (launchParams.files && launchParams.files.length > 0) {
                const fileHandle = launchParams.files[0];
                try {
                    const file = await fileHandle.getFile();
                    console.log("File from launchQueue:", file.name);
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    const mockEvent = { target: { files: dataTransfer.files } };
                    await handleFileLoad(mockEvent);
                } catch (err) {
                    console.error('Error processing launched file via PWA launchQueue:', err);
                    alert('Could not open the launched file: ' + err.message);
                }
            } else {
                 console.log("PWA launched, but no files in launchParams.");
            }
        });
    } else {
        console.log('PWA Launch Queue API not available. Relying on manual file input.');
    }

    // Initial UI reset
    resetUI();

    // Resize listener
    let resizeDebounceTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeDebounceTimer);
        resizeDebounceTimer = setTimeout(() => {
            const flow = Data.getFlowData();
            if (flow && DOM.screenshotImage.src) { // Only if data and image are loaded
                const dpr = window.devicePixelRatio || 1;
                if (DOM.screenshotImage && DOM.screenshotImage.naturalWidth > 0) {
                    const logicalWidth = DOM.screenshotImage.naturalWidth / dpr;
                    const logicalHeight = DOM.screenshotImage.naturalHeight / dpr;
                    DOM.screenshotImage.style.width = `${logicalWidth}px`;
                    DOM.screenshotImage.style.height = `${logicalHeight}px`;
                }
                // Adjust panel height first, then re-render highlights as they depend on final image size
                adjustEditorPanelHeight();
                const currentPageData = Data.getCurrentPage();
                if (currentPageData) {
                    renderHighlights(); // renderHighlights now gets activeSegmentIndex from Data module
                }
            }
        }, 250);
    });
});