/**
 * LQA Boss Background Service Worker
 * Handles capture orchestration, debugger API, and IndexedDB communication
 */

// Load JSZip library
// Note: Ensure lib/jszip.min.js is available (run: npm run setup)
importScripts('/lib/jszip.min.js');

// State management
let captureState = {
  isCapturing: false,
  currentTabId: null
};

let sidePanelOpen = false;
let sidePanelPort = null;

// URL Rewrite Rules Storage
let urlRewriteRules = [];

// Pending flow storage for PWA communication
let pendingFlow = null;

// Load URL rewrite rules on startup
chrome.runtime.onStartup.addListener(async () => {
  const result = await chrome.storage.local.get('url_rewrite_rules');
  urlRewriteRules = (result.url_rewrite_rules || []).filter(r => r.enabled);
  setupURLInterception();
});

// Also load rules when service worker is installed
chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.local.get('url_rewrite_rules');
  urlRewriteRules = (result.url_rewrite_rules || []).filter(r => r.enabled);
  setupURLInterception();
});

// Track side panel connection state
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel') {
    sidePanelOpen = true;
    sidePanelPort = port;

    port.onDisconnect.addListener(async () => {
      sidePanelOpen = false;
      sidePanelPort = null;

      // Disable X-ray on all tabs when panel closes
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'toggle-xray',
            enabled: false,
            segments: []
          });
        } catch (e) {
          // Ignore errors (tab may not have content script)
        }
      }
    });
  }
});

// Re-enable X-ray when page finishes loading (if panel is open)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && sidePanelOpen) {
    // Check if this is the active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && activeTab.id === tabId) {
      // Send message to side panel to re-enable X-ray
      if (sidePanelPort) {
        try {
          sidePanelPort.postMessage({ action: 'page-reloaded', tabId });
        } catch (e) {
          // Port may be disconnected
        }
      }
    }
  }
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

/**
 * Capture full-page screenshot using Chrome Debugger API
 */
async function captureFullPageScreenshot(tabId) {
  try {
    // Attach debugger
    await chrome.debugger.attach({ tabId }, '1.3');

    // Get page dimensions from JavaScript (in CSS pixels)
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Get the bounding box of all content to find actual content height
        const bodyRect = document.body.getBoundingClientRect();
        const htmlRect = document.documentElement.getBoundingClientRect();

        // Get bottom-most element position
        let maxBottom = Math.max(bodyRect.bottom, htmlRect.bottom);

        // Check all positioned elements that might extend beyond
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
          const rect = el.getBoundingClientRect();
          if (rect.bottom > maxBottom) {
            maxBottom = rect.bottom;
          }
        }

        return {
          width: Math.max(
            document.documentElement.scrollWidth,
            document.body.scrollWidth
          ),
          height: Math.ceil(maxBottom + window.scrollY),
          scrollHeight: document.documentElement.scrollHeight,
          devicePixelRatio: window.devicePixelRatio
        };
      }
    });

    const { width, height, devicePixelRatio } = result.result;

    // Capture with explicit dimensions in CSS pixels
    const { data } = await chrome.debugger.sendCommand(
      { tabId },
      'Page.captureScreenshot',
      {
        format: 'png',
        captureBeyondViewport: true,
        clip: {
          x: 0,
          y: 0,
          width: width,
          height: height,
          scale: 1
        }
      }
    );

    // Detach debugger
    await chrome.debugger.detach({ tabId });

    return data; // base64 PNG
  } catch (error) {
    console.error('Screenshot capture failed:', error);
    // Try to detach debugger on error
    try {
      await chrome.debugger.detach({ tabId });
    } catch (e) {
      // Ignore detach errors
    }
    throw error;
  }
}

/**
 * Extract text and metadata from current page
 */
async function extractPageMetadata(tabId) {
  try {
    // Inject extractor script if not already injected
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/extractor.js']
    });

    // Request extraction
    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'extract-metadata'
    });

    return response;
  } catch (error) {
    console.error('Metadata extraction failed:', error);
    throw error;
  }
}

/**
 * Capture current page (screenshot + metadata)
 */
async function capturePage(tabId) {
  if (captureState.isCapturing) {
    throw new Error('Capture already in progress');
  }

  captureState.isCapturing = true;
  captureState.currentTabId = tabId;

  try {
    // Get tab info
    const tab = await chrome.tabs.get(tabId);

    // Hide X-ray overlay if present (so it doesn't appear in screenshot)
    try {
      await chrome.tabs.sendMessage(tabId, {
        action: 'hide-xray-temporarily'
      });
    } catch (e) {
      // Ignore if xray script not injected
    }

    // Capture screenshot
    const screenshotBase64 = await captureFullPageScreenshot(tabId);

    // Extract metadata
    const extractionResult = await extractPageMetadata(tabId);

    // Note: X-ray will be restored by cart.js after successful capture
    // with updated match colors (green/red)

    if (extractionResult.error) {
      throw new Error(extractionResult.error);
    }

    const segments = extractionResult.textElements || [];

    // Validate segments were detected
    if (segments.length === 0) {
      throw new Error('No segments detected on this page');
    }

    // Fetch TUs for each segment if TM endpoint is configured
    let segmentsWithMatches = segments;
    const matchedTUs = new Map(); // guid -> TU object
    let matchedCount = 0;
    let warnings = [];

    // Get settings from storage
    const result = await chrome.storage.sync.get('lqaboss_settings');
    const settings = result.lqaboss_settings || {};

    if (settings.tmEndpointUrl && segments.length > 0) {
      // Fetch TUs for all segments in one batch request
      const tmResult = await fetchTUsForSegments(segments, settings);

      // Check for TM service errors
      if (tmResult.error) {
        throw new Error(tmResult.error);
      }

      const tus = tmResult.tus;
      warnings = tmResult.warnings || [];

      // Mark which segments matched and store the matched guid
      segmentsWithMatches = segments.map((seg, i) => {
        const tu = tus[i];
        if (tu && tu.guid) {
          return {
            ...seg,
            g: tu.guid,
            matched: true
          };
        } else {
          return {
            ...seg,
            matched: false
          };
        }
      });

      // Collect unique TUs
      tus.forEach(tu => {
        if (tu && tu.guid && !matchedTUs.has(tu.guid)) {
          matchedTUs.set(tu.guid, tu);
          matchedCount++;
        }
      });

      // Validate at least one TU was matched
      if (matchedCount === 0) {
        throw new Error(`No TUs matched for ${segments.length} segment${segments.length !== 1 ? 's' : ''}`);
      }
    }

    const pageData = {
      id: `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url: tab.url,
      title: tab.title,
      timestamp: new Date().toISOString(),
      screenshotBase64,
      segments: segmentsWithMatches,
      matchedTUs: Array.from(matchedTUs.values()),
      matchedCount,
      favicon: tab.favIconUrl,
      warnings
    };

    return pageData;
  } finally {
    captureState.isCapturing = false;
    captureState.currentTabId = null;
  }
}

/**
 * Fetch TUs from TM endpoint using batch POST request
 * Returns { tus: Array, warnings: Array, error: string|null }
 */
async function fetchTUsForSegments(segments, settings) {
  if (!settings.tmEndpointUrl || segments.length === 0) {
    return { tus: [], warnings: [], error: null };
  }

  try {
    // Filter out fields added by extractor, keep only decoded metadata
    const excludeFields = new Set(['text', 'x', 'y', 'width', 'height', 'decodingError', 'matched']);
    const cleanSegments = segments.map(seg => {
      const cleaned = {};
      for (const [key, value] of Object.entries(seg)) {
        if (value !== undefined && value !== null && !excludeFields.has(key)) {
          cleaned[key] = value;
        }
      }
      return cleaned;
    });

    // Build POST body
    const body = {
      sourceLang: settings.sourceLang,
      targetLang: settings.targetLang,
      segments: cleanSegments
    };

    const response = await fetch(settings.tmEndpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      return {
        tus: [],
        warnings: [],
        error: `TM service error: ${response.status} ${response.statusText}`
      };
    }

    const data = await response.json();

    // New format: { results, warnings }
    if (data && typeof data === 'object' && Array.isArray(data.results)) {
      return {
        tus: data.results,
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
        error: null
      };
    }

    // Legacy format: array of TUs
    if (Array.isArray(data)) {
      return { tus: data, warnings: [], error: null };
    }

    return {
      tus: [],
      warnings: [],
      error: 'TM service returned invalid response format'
    };
  } catch (error) {
    // Network error, invalid URL, etc.
    return {
      tus: [],
      warnings: [],
      error: `TM service unreachable: ${error.message}`
    };
  }
}

/**
 * Create ZIP file from captured pages (requires JSZip)
 */
async function createFlowZIP(capturedPages, instructions, settings) {
  const zip = new JSZip();

  // Collect unique TUs from all captured pages
  const allTUs = new Map(); // guid -> TU object

  // Add screenshots
  capturedPages.forEach((page, index) => {
    const imageName = `page_${index + 1}_${page.id}.png`;
    zip.file(imageName, page.screenshotBase64, { base64: true });

    // Collect TUs from this page
    if (page.matchedTUs && page.matchedTUs.length > 0) {
      page.matchedTUs.forEach(tu => {
        if (tu.guid && !allTUs.has(tu.guid)) {
          allTUs.set(tu.guid, tu);
        }
      });
    }
  });

  // Add flow metadata
  const flowMetadata = {
    createdAt: new Date().toISOString(),
    pages: capturedPages.map((page, index) => ({
      pageId: page.id,
      originalUrl: page.url,
      title: page.title,
      timestamp: page.timestamp,
      imageFile: `page_${index + 1}_${page.id}.png`,
      segments: page.segments.map(seg => ({
        g: seg.g,
        text: seg.text,
        x: seg.x,
        y: seg.y,
        width: seg.width,
        height: seg.height
      }))
    }))
  };

  zip.file('flow_metadata.json', JSON.stringify(flowMetadata, null, 2));

  // Add TM entries to job.json if we have any
  if (allTUs.size > 0) {
    const job = {
      sourceLang: settings.sourceLang,
      targetLang: settings.targetLang,
      tus: Array.from(allTUs.values())
    };

    // Add instructions if provided
    if (instructions) {
      job.instructions = instructions;
    }

    zip.file('job.json', JSON.stringify(job, null, 2));
  }

  // Generate ZIP as arraybuffer (for message passing compatibility)
  const zipArrayBuffer = await zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  return zipArrayBuffer;
}

/**
 * Save flow to shared IndexedDB for PWA access
 */
async function saveFlowToSharedDB(flowArrayBuffer, flowMetadata) {
  const flowId = `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Convert ArrayBuffer to Blob for storage
  const flowBlob = new Blob([flowArrayBuffer], { type: 'application/zip' });

  // Open IndexedDB
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('lqaboss-shared', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('flows')) {
        db.createObjectStore('flows', { keyPath: 'id' });
      }
    };
  });

  // Store flow
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(['flows'], 'readwrite');
    const store = transaction.objectStore('flows');

    const request = store.put({
      id: flowId,
      zipBlob: flowBlob,
      metadata: flowMetadata,
      timestamp: Date.now()
    });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  db.close();

  // Notify PWA via BroadcastChannel
  const channel = new BroadcastChannel('lqaboss-sync');
  channel.postMessage({
    type: 'new-flow',
    id: flowId,
    metadata: flowMetadata
  });
  channel.close();

  return flowId;
}

/**
 * Message handler for side panel communication
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle async operations
  (async () => {
    try {
      switch (request.action) {
        case 'capture-page': {
          const pageData = await capturePage(request.tabId);
          sendResponse({ success: true, data: pageData });
          break;
        }

        case 'create-flow': {
          const zipArrayBuffer = await createFlowZIP(
            request.pages,
            request.instructions,
            request.settings
          );
          // Convert ArrayBuffer to Array for message passing
          const zipData = Array.from(new Uint8Array(zipArrayBuffer));
          sendResponse({ success: true, zipData });
          break;
        }

        case 'save-to-pwa': {
          // Convert array back to ArrayBuffer
          const zipArrayBuffer = new Uint8Array(request.zipData).buffer;
          const flowId = await saveFlowToSharedDB(
            zipArrayBuffer,
            request.metadata
          );
          sendResponse({ success: true, flowId });
          break;
        }

        case 'get-capture-state': {
          sendResponse({ success: true, state: captureState });
          break;
        }

        case 'update-url-rewrite-rules': {
          urlRewriteRules = request.rules || [];
          setupURLInterception();
          sendResponse({ success: true });
          break;
        }

        case 'store-pending-flow': {
          // Store flow data temporarily for PWA to retrieve
          pendingFlow = {
            zipData: request.zipData,
            fileName: request.fileName,
            timestamp: Date.now()
          };
          sendResponse({ success: true });
          break;
        }

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      // Don't log expected/normal errors
      const normalErrors = [
        'No segments detected',
        'No TUs matched',
        'Cannot capture restricted pages'
      ];
      const isNormalError = normalErrors.some(msg => error.message.includes(msg));

      if (!isNormalError) {
        console.error('Background action failed:', error);
      }

      sendResponse({ success: false, error: error.message });
    }
  })();

  return true; // Keep message channel open for async response
});

// Handle debugger detach events
chrome.debugger.onDetach.addListener((source, reason) => {
  if (captureState.currentTabId === source.tabId) {
    captureState.isCapturing = false;
    captureState.currentTabId = null;
  }
});

/**
 * URL Rewrite Functionality
 */

// Set up URL interception
function setupURLInterception() {
  // Remove existing listener if any
  if (chrome.webNavigation.onBeforeNavigate.hasListener(handleNavigation)) {
    chrome.webNavigation.onBeforeNavigate.removeListener(handleNavigation);
  }

  // Only add listener if we have rules
  if (urlRewriteRules.length > 0) {
    chrome.webNavigation.onBeforeNavigate.addListener(handleNavigation);
  }
}

// Handle navigation events
async function handleNavigation(details) {
  // Only process main frame navigations
  if (details.frameId !== 0) return;

  try {
    const url = new URL(details.url);

    // Check each rule
    for (const rule of urlRewriteRules) {
      // Check if hostname matches
      if (url.hostname === rule.hostname || url.hostname === `www.${rule.hostname}`) {
        // Test regex against pathname
        const regex = new RegExp(rule.regex);
        const match = url.pathname.match(regex);

        if (match && match[1]) {
          // Build new URL with suffix added to first capture group
          const newPath = url.pathname.replace(regex, (fullMatch, captureGroup) => {
            return fullMatch.replace(captureGroup, captureGroup + rule.suffix);
          });
          url.pathname = newPath;

          // Redirect to modified URL
          await chrome.tabs.update(details.tabId, {
            url: url.toString()
          });

          break; // Stop after first matching rule
        }
      }
    }
  } catch (error) {
    console.error('URL rewrite error:', error);
  }
}

// Initialize rules on service worker start
(async () => {
  const result = await chrome.storage.local.get('url_rewrite_rules');
  urlRewriteRules = (result.url_rewrite_rules || []).filter(r => r.enabled);
  setupURLInterception();
})();

// Handle external messages from PWA
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'ping': {
          // Health check - just respond with success
          sendResponse({ success: true });
          break;
        }

        case 'requestFlow': {
          // PWA is requesting flow data
          // If no pendingFlow, check if we have captured pages in cart
          if (!pendingFlow) {
            // Load captured pages and instructions from storage
            const result = await chrome.storage.local.get(['capturedPages', 'instructions']);
            const capturedPages = result.capturedPages || [];
            const instructions = result.instructions || '';

            if (capturedPages.length === 0) {
              sendResponse({
                success: false,
                error: 'No flow available. Please capture pages in the extension first.'
              });
              return;
            }

            // Create flow from captured pages
            try {
              const settings = await chrome.storage.sync.get('lqaboss_settings');

              const zipArrayBuffer = await createFlowZIP(
                capturedPages,
                instructions,
                settings.lqaboss_settings || {}
              );

              const zipData = Array.from(new Uint8Array(zipArrayBuffer));
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
              const fileName = `lqa-flow-${timestamp}.lqaboss`;

              sendResponse({
                success: true,
                data: { zipData, fileName }
              });
              return;
            } catch (error) {
              console.error('[ServiceWorker] Failed to create flow:', error);
              sendResponse({
                success: false,
                error: `Failed to create flow: ${error.message}`
              });
              return;
            }
          }

          // Check if flow is not too old (within 5 minutes)
          const flowAge = Date.now() - pendingFlow.timestamp;

          if (flowAge > 5 * 60 * 1000) {
            pendingFlow = null;
            sendResponse({
              success: false,
              error: 'Flow data expired. Please send from extension again.'
            });
            return;
          }

          // Send the flow data
          const flowData = {
            zipData: pendingFlow.zipData,
            fileName: pendingFlow.fileName
          };

          // Clear pending flow after sending
          pendingFlow = null;

          sendResponse({
            success: true,
            data: flowData
          });
          break;
        }

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('[ServiceWorker] External message handler failed:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true; // Keep message channel open for async response
});
