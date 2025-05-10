if ('launchQueue' in window && window.launchQueue) { // Check window.launchQueue too
    console.log("PWA Launch Queue API is available.");
    window.launchQueue.setConsumer(async (launchParams) => {
        if (launchParams.files && launchParams.files.length > 0) {
            console.log("PWA launched with file(s):", launchParams.files);
            const fileHandle = launchParams.files[0]; // Handle the first file
            try {
                const file = await fileHandle.getFile();
                console.log("Processing launched file:", file.name);

                // Simulate a file input event to reuse existing handleFileLoad logic
                // This is a common pattern to avoid duplicating file processing logic.
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);

                // Create a mock event object if your handleFileLoad expects it
                const mockEvent = { target: { files: dataTransfer.files } };
                handleFileLoad(mockEvent);

            } catch (err) {
                console.error('Error processing launched file:', err);
                alert('Could not open the launched LQA Data file: ' + err.message);
            }
        } else {
            console.log("PWA launched without files or files array empty.");
        }
    });
} else {
    console.log('PWA Launch Queue API not available. Relying on manual file input.');
}

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const saveChangesBtn = document.getElementById('saveChangesBtn');
    const screenshotImage = document.getElementById('screenshotImage');
    const screenshotContainer = document.getElementById('screenshotContainer');
    const editPanel = document.getElementById('editPanel');
    const flowNameDisplay = document.getElementById('flowNameDisplay');

    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageIndicator = document.getElementById('pageIndicator');

    let zipFile = null;
    let flowData = null;
    let currentPageIndex = 0;
    let activeSegmentIndex = -1; // -1 means no segment actively focused via script/tab
    let originalSegmentTexts = {}; // Stores { "pageId_segmentIndex": "original text" }

    // --- Guard against missing critical elements ---
    if (!fileInput || !saveChangesBtn || !screenshotImage || !screenshotContainer || !editPanel ||
        !flowNameDisplay || !prevPageBtn || !nextPageBtn || !pageIndicator) {
        console.error("LQA Viewer: One or more critical UI elements are missing from the DOM. Aborting initialization.");
        return;
    }

    // --- Event Listeners ---
    fileInput.addEventListener('change', handleFileLoad);
    saveChangesBtn.addEventListener('click', handleSaveChanges);
    prevPageBtn.addEventListener('click', () => navigatePage(-1));
    nextPageBtn.addEventListener('click', () => navigatePage(1));
    editPanel.addEventListener('keydown', handleEditPanelKeyDown);
    // No auto-open file dialog as per browser restrictions

    // --- Main Functions ---
    async function handleFileLoad(event) {
        const file = event.target.files[0];
        if (!file) {
            console.log("No file selected.");
            return;
        }
        console.log("Loading file:", file.name);
        resetViewerPartialState(); // Reset parts of state before loading new file

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                zipFile = await JSZip.loadAsync(e.target.result);
                const metadataFile = zipFile.file("flow_metadata.json");
                if (!metadataFile) {
                    alert('Invalid .lqaboss file: "flow_metadata.json" not found.');
                    resetViewer(); return;
                }
                const metadataContent = await metadataFile.async("string");
                flowData = JSON.parse(metadataContent);

                if (!flowData || !flowData.pages || !Array.isArray(flowData.pages) || flowData.pages.length === 0) {
                    alert('Invalid .lqaboss file: No valid pages data found in metadata.');
                    resetViewer(); return;
                }

                originalSegmentTexts = {}; // Initialize for the new file
                flowData.pages.forEach((page) => {
                    if (page.segments && Array.isArray(page.segments)) {
                        page.segments.forEach((segment, sIndex) => {
                            const originalKey = `${page.pageId}_${sIndex}`;
                            originalSegmentTexts[originalKey] = segment.text;
                        });
                    } else {
                        console.warn(`Page ${page.pageId || 'unknown'} has missing or invalid segments array.`);
                        page.segments = []; // Ensure segments is an array for safety
                    }
                });

                flowNameDisplay.textContent = `Flow: ${flowData.flowName || 'Unnamed Flow'}`;
                currentPageIndex = 0;
                activeSegmentIndex = -1; // Reset before displaying first page
                await displayCurrentPage(); // This will render and attempt to focus first segment

                saveChangesBtn.disabled = false;
            } catch (error) {
                alert('Error processing .lqaboss file: ' + error.message);
                console.error("ZIP/JSON Processing Error:", error);
                resetViewer();
            }
        };
        reader.onerror = (e) => {
            alert('Error reading file: ' + (e.target.error ? e.target.error.name : 'Unknown read error'));
            console.error("File Read Error:", e.target.error);
            resetViewer();
        };
        reader.readAsArrayBuffer(file);
    }

    function navigatePage(direction) {
        if (!flowData || !flowData.pages) return;
        const newIndex = currentPageIndex + direction;
        if (newIndex >= 0 && newIndex < flowData.pages.length) {
            currentPageIndex = newIndex;
            activeSegmentIndex = -1; // Reset active segment when changing pages
            displayCurrentPage();
        }
    }

    async function displayCurrentPage() {
        if (!flowData || !zipFile || !flowData.pages[currentPageIndex]) {
            screenshotImage.src = "";
            editPanel.innerHTML = "<p>Error: Page data unavailable.</p>";
            console.error("displayCurrentPage: Preconditions not met", flowData, zipFile, currentPageIndex);
            return;
        }

        const page = flowData.pages[currentPageIndex];
        pageIndicator.textContent = `Page ${currentPageIndex + 1} of ${flowData.pages.length}`;
        prevPageBtn.disabled = currentPageIndex === 0;
        nextPageBtn.disabled = currentPageIndex === (flowData.pages.length - 1);

        try {
            const imageFileEntry = zipFile.file(page.imageFile);
            if (!imageFileEntry) {
                throw new Error(`Image file "${page.imageFile}" not found in zip for pageId "${page.pageId}".`);
            }
            const imageBase64 = await imageFileEntry.async("base64");

            screenshotImage.onload = null; // Clear previous handler
            screenshotImage.onload = () => {
                console.log(`Image loaded: ${page.imageFile}. Natural Dims: ${screenshotImage.naturalWidth}x${screenshotImage.naturalHeight}`);
                const dprViewing = window.devicePixelRatio || 1;
                const logicalWidth = screenshotImage.naturalWidth / dprViewing;
                const logicalHeight = screenshotImage.naturalHeight / dprViewing;

                screenshotImage.style.width = `${logicalWidth}px`;
                screenshotImage.style.height = `${logicalHeight}px`;
                console.log(`Styled image to CSS Dims: ${logicalWidth.toFixed(0)}px x ${logicalHeight.toFixed(0)}px (Viewing DPR: ${dprViewing})`);

                renderHighlightsForCurrentPage();
                renderEditPanelForCurrentPage(); // This creates textareas

                // Determine initial focus after rendering
                if (page.segments && page.segments.length > 0) {
                    // If activeSegmentIndex was set by tabbing to this page, honor it
                    // Otherwise, default to first segment (index 0)
                    const targetFocusIndex = (activeSegmentIndex !== -1 && page.segments[activeSegmentIndex]) ? activeSegmentIndex : 0;
                    focusSegment(targetFocusIndex, true);
                } else {
                    activeSegmentIndex = -1; // No segments to focus
                }
            };
            screenshotImage.src = `data:image/png;base64,${imageBase64}`; // Set src AFTER onload is attached

            // Fallback for cached images or rapid src changes
            if (screenshotImage.complete && screenshotImage.naturalWidth > 0) {
                console.log("Image was already complete; manually triggering onload logic.");
                setTimeout(() => { // Delay ensures DOM has chance to acknowledge new src
                    if (screenshotImage.onload) screenshotImage.onload();
                }, 100);
            }
        } catch (error) {
            console.error(`Error loading image "${page.imageFile}":`, error);
            screenshotImage.src = "";
            screenshotImage.style.width = 'auto';
            screenshotImage.style.height = 'auto';
            editPanel.innerHTML = `<p>Error loading image: ${error.message}</p>`;
            alert(`Error loading image for page ${currentPageIndex + 1}: ${error.message}`);
        }
    }

    function renderHighlightsForCurrentPage() {
        const page = flowData.pages[currentPageIndex];
        if (!page || !page.segments || !screenshotImage.src || !screenshotImage.naturalWidth || screenshotImage.naturalWidth === 0) {
            console.warn("RenderHighlights: Pre-conditions not met (page, segments, or image dimensions).");
            if (screenshotContainer) screenshotContainer.querySelectorAll('.highlight-box').forEach(box => box.remove());
            return;
        }
        if (screenshotContainer) screenshotContainer.querySelectorAll('.highlight-box').forEach(box => box.remove());

        const dprViewing = window.devicePixelRatio || 1;
        const displayedImageCSSWidth = screenshotImage.offsetWidth;
        const displayedImageCSSHeight = screenshotImage.offsetHeight;
        const sourceImageNaturalWidth = screenshotImage.naturalWidth;
        const sourceImageNaturalHeight = screenshotImage.naturalHeight;

        if (displayedImageCSSWidth === 0 || sourceImageNaturalWidth === 0) {
            console.warn("RenderHighlights: Image dimensions (displayed or natural) are zero."); return;
        }

        const intendedLogicalWidth = sourceImageNaturalWidth / dprViewing;
        // Scale factor to account for any minor differences between styled size and intended logical size
        const scaleFactorX = displayedImageCSSWidth / intendedLogicalWidth;
        const scaleFactorY = displayedImageCSSHeight / (sourceImageNaturalHeight / dprViewing);

        // console.log(`RH Details: DPRv=${dprViewing}, ImgNat=${sourceImageNaturalWidth}x${sourceImageNaturalHeight}, ImgDispCSS=${displayedImageCSSWidth}x${displayedImageCSSHeight}, IntendedLogW=${intendedLogicalWidth.toFixed(2)}, SFX=${scaleFactorX.toFixed(4)}, SFY=${scaleFactorY.toFixed(4)}`);

        page.segments.forEach((segment, index) => {
            const highlightBox = document.createElement('div');
            highlightBox.className = 'highlight-box';
            highlightBox.dataset.segmentIndex = index;

            // Using "Option A" - segment coordinates are assumed to be logical 1x
            const cssLeft = segment.x * scaleFactorX;
            const cssTop = segment.y * scaleFactorY;
            const cssWidth = segment.width * scaleFactorX;
            const cssHeight = segment.height * scaleFactorY;

            highlightBox.style.left = `${cssLeft}px`;
            highlightBox.style.top = `${cssTop}px`;
            highlightBox.style.width = `${cssWidth}px`;
            highlightBox.style.height = `${cssHeight}px`;

            if (index === activeSegmentIndex) {
                highlightBox.classList.add('active');
            }
            if (screenshotContainer) screenshotContainer.appendChild(highlightBox);
        });
    }

    function renderEditPanelForCurrentPage() {
        const page = flowData.pages[currentPageIndex];
        editPanel.innerHTML = ''; // Clear previous

        if (!page || !page.segments || page.segments.length === 0) {
            editPanel.innerHTML = '<p>No text segments on this page.</p>';
            return;
        }

        page.segments.forEach((segment, index) => {
            const editItemDiv = document.createElement('div');
            editItemDiv.className = 'edit-item';
            editItemDiv.dataset.segmentIndex = index;

            const textarea = document.createElement('textarea');
            textarea.id = `text-input-p${currentPageIndex}-s${index}`;
            textarea.value = segment.text;
            textarea.dataset.pageIndex = currentPageIndex; // Store for event handler context
            textarea.dataset.segmentIndex = index;

            const originalKey = `${page.pageId}_${index}`;
            if (originalSegmentTexts[originalKey] === undefined) { // Should have been populated in handleFileLoad
                console.warn(`Original text for ${originalKey} not found! Defaulting to current text as original.`);
                originalSegmentTexts[originalKey] = segment.text; // Fallback
            }

            if (segment.text === originalSegmentTexts[originalKey]) {
                editItemDiv.classList.add('unmodified');
                editItemDiv.classList.remove('modified');
            } else {
                editItemDiv.classList.add('modified');
                editItemDiv.classList.remove('unmodified');
            }

            textarea.addEventListener('input', (event) => {
                const pIdx = parseInt(event.target.dataset.pageIndex, 10);
                const sIdx = parseInt(event.target.dataset.segmentIndex, 10);
                const currentTextValue = event.target.value;

                if (flowData && flowData.pages[pIdx] && flowData.pages[pIdx].segments[sIdx]) {
                    flowData.pages[pIdx].segments[sIdx].text = currentTextValue;
                }

                const itemDiv = event.target.closest('.edit-item');
                const key = `${flowData.pages[pIdx].pageId}_${sIdx}`;
                if (itemDiv) {
                    if (currentTextValue === originalSegmentTexts[key]) {
                        itemDiv.classList.remove('modified');
                        itemDiv.classList.add('unmodified');
                    } else {
                        itemDiv.classList.remove('unmodified');
                        itemDiv.classList.add('modified');
                    }
                }
            });

            textarea.addEventListener('focus', (event) => {
                const sIdx = parseInt(event.target.dataset.segmentIndex, 10);
                focusSegment(sIdx);
            });

            const undoBtn = document.createElement('button');
            undoBtn.className = 'undo-btn';
            undoBtn.innerHTML = '↺'; // Undo symbol
            undoBtn.title = 'Revert to original text';
            undoBtn.onclick = () => {
                const sIdx = parseInt(textarea.dataset.segmentIndex, 10); // Use textarea's dataset
                const pIdx = parseInt(textarea.dataset.pageIndex, 10);
                const key = `${flowData.pages[pIdx].pageId}_${sIdx}`;

                if (originalSegmentTexts[key] !== undefined &&
                    flowData.pages[pIdx] && flowData.pages[pIdx].segments[sIdx]) {
                    textarea.value = originalSegmentTexts[key];
                    flowData.pages[pIdx].segments[sIdx].text = originalSegmentTexts[key];
                    // Trigger input event to update styling and data model if other listeners exist
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                }
            };

            editItemDiv.appendChild(textarea);
            editItemDiv.appendChild(undoBtn);
            editPanel.appendChild(editItemDiv);
        });
    }

    function focusSegment(segmentIndex, scrollIntoView = false) {
        if (!flowData || !flowData.pages[currentPageIndex] || !flowData.pages[currentPageIndex].segments) {
            activeSegmentIndex = -1; return;
        }
        const segmentsOnPage = flowData.pages[currentPageIndex].segments;
        if (segmentIndex < 0 || segmentIndex >= segmentsOnPage.length) {
            console.warn(`FocusSegment: Index ${segmentIndex} out of bounds for ${segmentsOnPage.length} segments.`);
            activeSegmentIndex = -1; // Reset if target is invalid
             // Clear previous active states
            if(screenshotContainer) screenshotContainer.querySelectorAll('.highlight-box.active').forEach(b => b.classList.remove('active'));
            if(editPanel) editPanel.querySelectorAll('.edit-item.active-segment-editor').forEach(i => i.classList.remove('active-segment-editor'));
            return;
        }

        activeSegmentIndex = segmentIndex; // Update the active index

        if(screenshotContainer) screenshotContainer.querySelectorAll('.highlight-box').forEach(box => {
            box.classList.remove('active');
            if (parseInt(box.dataset.segmentIndex, 10) === segmentIndex) {
                box.classList.add('active');
            }
        });

        if(editPanel) editPanel.querySelectorAll('.edit-item').forEach(item => {
            item.classList.remove('active-segment-editor');
            const textarea = item.querySelector('textarea');
            if (textarea && parseInt(textarea.dataset.segmentIndex, 10) === segmentIndex) {
                item.classList.add('active-segment-editor');
                if (scrollIntoView || document.activeElement !== textarea) {
                    textarea.focus();
                    textarea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        });
    }

    function handleEditPanelKeyDown(event) {
        if (event.key === 'Tab' && flowData && flowData.pages[currentPageIndex] && flowData.pages[currentPageIndex].segments) {
            const segmentsOnCurrentPage = flowData.pages[currentPageIndex].segments;
            const segmentsCount = segmentsOnCurrentPage.length;

            // event.preventDefault(); // Prevent default tab behavior only if we handle it

            if (segmentsCount === 0) { // No segments on this page
                // Allow default tabbing to move to page nav buttons or out of the panel
                // You might want to explicitly focus prev/next buttons if that's desired.
                // For now, let default behavior take over if no segments.
                return;
            }

            let currentSegmentIdx = -1;
            const activeElem = document.activeElement;
            if (activeElem && activeElem.tagName === 'TEXTAREA' && activeElem.dataset.segmentIndex) {
                currentSegmentIdx = parseInt(activeElem.dataset.segmentIndex, 10);
            } else {
                // If focus isn't on a known textarea, determine based on activeSegmentIndex
                // or prepare to go to the first/last based on shiftKey
                currentSegmentIdx = activeSegmentIndex !== -1 ? activeSegmentIndex : (event.shiftKey ? 0 : segmentsCount -1) ;
            }


            if (event.shiftKey) { // Shift + Tab (Moving Backwards)
                if (currentSegmentIdx <= 0) { // Currently on the first segment (or no segment focused, treat as before first)
                    if (currentPageIndex > 0) { // Not on the first page
                        event.preventDefault(); // We are handling this
                        navigatePage(-1);
                        // displayCurrentPage will try to focus first; we want last after page renders
                        setTimeout(() => {
                            const prevPage = flowData.pages[currentPageIndex]; // currentPageIndex is now updated
                            if (prevPage && prevPage.segments.length > 0) {
                                focusSegment(prevPage.segments.length - 1, true);
                            } else if (prevPage) {
                                focusSegment(-1); // No segments on new page
                            }
                        }, 150);
                    } else {
                        // On the first segment of the VERY FIRST page. Do nothing, keep focus.
                        console.log("Shift+Tab on first segment of first page. Focus remains.");
                        event.preventDefault(); // Prevent tabbing out of the textareas
                    }
                } else { // Go to previous segment on current page
                    event.preventDefault(); // We are handling this
                    focusSegment(currentSegmentIdx - 1, true);
                }
            } else { // Tab (Moving Forwards)
                if (currentSegmentIdx >= segmentsCount - 1) { // Currently on the last segment (or no segment focused, treat as after last)
                    if (currentPageIndex < flowData.pages.length - 1) { // Not on the last page
                        event.preventDefault(); // We are handling this
                        navigatePage(1);
                        // displayCurrentPage will focus the first segment by default, which is correct here
                    } else {
                        // On the last segment of the VERY LAST page. Do nothing, keep focus.
                        console.log("Tab on last segment of last page. Focus remains.");
                        event.preventDefault(); // Prevent tabbing out of the textareas
                    }
                } else { // Go to next segment on current page
                    event.preventDefault(); // We are handling this
                    focusSegment(currentSegmentIdx + 1, true);
                }
            }
        }
        // If event.key is not 'Tab' or other conditions not met, default tab behavior occurs
    }

    function handleSaveChanges() {
        if (!flowData) {
            alert('No data loaded to save.');
            return;
        }

        const changedSegmentsData = {
            flowName: flowData.flowName,
            savedAt: new Date().toISOString(),
            pages: []
        };
        let changesMadeOverall = false;

        flowData.pages.forEach((page) => {
            const pageOutput = {
                pageId: page.pageId,
                originalUrl: page.originalUrl,
                imageFile: page.imageFile,
                changedSegments: []
            };
            let pageHasChanges = false;
            page.segments.forEach((segment, sIndex) => {
                const originalKey = `${page.pageId}_${sIndex}`;
                const originalText = originalSegmentTexts[originalKey]; // Should be populated
                const currentText = segment.text;

                if (originalText !== currentText) {
                    pageHasChanges = true;
                    changesMadeOverall = true;
                    const { x, y, width, height, text, ...otherMetadata } = segment; // Destructure
                    pageOutput.changedSegments.push({
                        segmentIndex: sIndex,
                        originalText: originalText,
                        currentText: currentText,
                        ...otherMetadata
                    });
                }
            });
            if (pageHasChanges) {
                changedSegmentsData.pages.push(pageOutput);
            }
        });

        if (!changesMadeOverall) {
            alert('No changes were made to any text segments.');
            return;
        }

        const jsonString = JSON.stringify(changedSegmentsData, null, 2);
        const base64Data = btoa(unescape(encodeURIComponent(jsonString)));
        const dataUrl = `data:application/json;charset=utf-8;base64,${base64Data}`;
        const filename = `${(flowData.flowName || 'flow').replace(/[^a-z0-9_.-]/gi, '_')}_edited_segments.json`;

        chrome.downloads.download({
            url: dataUrl,
            filename: filename,
            saveAs: true
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                alert(`Save changes failed: ${chrome.runtime.lastError.message}`);
            } else if (downloadId === undefined) {
                // User might have cancelled the saveAs dialog
                console.log("Save changes download cancelled or failed to start.");
            } else {
                console.log('Edited segments JSON download initiated.');
                // No success alert popup as per request
            }
        });
    }

    function resetViewerPartialState() { // Used before loading a new file
        zipFile = null;
        flowData = null;
        currentPageIndex = 0;
        activeSegmentIndex = -1;
        originalSegmentTexts = {};
        if (screenshotImage) {
            screenshotImage.onload = null; // Important to clear old onload
            screenshotImage.src = '';
            screenshotImage.style.width = 'auto';
            screenshotImage.style.height = 'auto';
        }
        if (screenshotContainer) screenshotContainer.querySelectorAll('.highlight-box').forEach(box => box.remove());
        if (editPanel) editPanel.innerHTML = '<p>Loading file...</p>'; // Indicate loading
    }


    function resetViewer() { // Full reset
        resetViewerPartialState(); // Call the partial reset
        if (flowNameDisplay) flowNameDisplay.textContent = '';
        if (pageIndicator) pageIndicator.textContent = 'Page X of Y';
        if (prevPageBtn) prevPageBtn.disabled = true;
        if (nextPageBtn) nextPageBtn.disabled = true;
        if (saveChangesBtn) saveChangesBtn.disabled = true;
        if (fileInput) fileInput.value = '';
        if (editPanel) editPanel.innerHTML = '<p>Load a <code>.lqaboss</code> file.</p>';
    }
});