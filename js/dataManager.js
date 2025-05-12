// js/dataManager.js

// These will hold the application's core data state
let zipFileInstance = null;
let flowDataContent = null;
let originalSegmentTextsMap = {}; // { "pageId_segmentIndex": "original text" }
let currentDisplayPageIndex = 0;
let currentActiveSegmentIndex = -1;


export function setZipFile(fileInstance) {
    zipFileInstance = fileInstance;
}
export function getZipFile() {
    return zipFileInstance;
}

export function setFlowData(data) {
    flowDataContent = data;
}
export function getFlowData() {
    return flowDataContent;
}

export function setCurrentDisplayPageIndex(index) {
    currentDisplayPageIndex = index;
}
export function getCurrentDisplayPageIndex() {
    return currentDisplayPageIndex;
}
export function getCurrentPage() {
    if (flowDataContent && flowDataContent.pages && flowDataContent.pages[currentDisplayPageIndex]) {
        return flowDataContent.pages[currentDisplayPageIndex];
    }
    return null;
}

export function setActiveSegmentIndex(index) {
    currentActiveSegmentIndex = index;
}
export function getActiveSegmentIndex() {
    return currentActiveSegmentIndex;
}


export function initializeOriginalTexts() {
    originalSegmentTextsMap = {};
    if (flowDataContent && flowDataContent.pages) {
        flowDataContent.pages.forEach((page) => {
            if (page.segments && Array.isArray(page.segments)) {
                page.segments.forEach((segment, sIndex) => {
                    const key = `${page.pageId}_${sIndex}`;
                    originalSegmentTextsMap[key] = segment.text;
                });
            } else { // Ensure page.segments is an array even if initially missing or malformed
                page.segments = [];
            }
        });
    }
}
export function getOriginalText(pageId, segmentIndex) {
    return originalSegmentTextsMap[`${pageId}_${segmentIndex}`];
}
export function updateSegmentText(pageIndexInFlow, segmentIndexInPage, newText) {
    if (flowDataContent &&
        flowDataContent.pages[pageIndexInFlow] &&
        flowDataContent.pages[pageIndexInFlow].segments &&
        flowDataContent.pages[pageIndexInFlow].segments[segmentIndexInPage]) {
        flowDataContent.pages[pageIndexInFlow].segments[segmentIndexInPage].text = newText;
        return true;
    }
    console.warn(`updateSegmentText: Could not find segment at pageIndex ${pageIndexInFlow}, segmentIndex ${segmentIndexInPage}`);
    return false;
}

export function resetDataState() {
    zipFileInstance = null;
    flowDataContent = null;
    originalSegmentTextsMap = {};
    currentDisplayPageIndex = 0;
    currentActiveSegmentIndex = -1;
    console.log("Data state reset.");
}