/**
 * X-Ray Vision Overlay
 * Visualizes detected segments with colored overlays and tooltips
 */

// Guard against multiple injections
if (typeof window.LQABOSS_XRAY_LOADED === 'undefined') {
  window.LQABOSS_XRAY_LOADED = true;

const XRAY_OVERLAY_ID = 'lqaboss-xray-overlay';
const XRAY_STYLE_ID = 'lqaboss-xray-styles';

// Track current state for temporary hide/restore
let currentSegments = [];
let isCurrentlyVisible = false;

function createStyles() {
  if (document.getElementById(XRAY_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = XRAY_STYLE_ID;
  style.textContent = `
    .lqaboss-segment-highlight {
      position: absolute;
      pointer-events: auto;
      cursor: pointer;
      transition: background 0.2s ease;
      box-sizing: border-box;
      min-width: 20px;
      min-height: 16px;
    }

    .lqaboss-segment-highlight.default {
      background: rgba(100, 100, 100, 0.15);
      border: 2px dashed rgba(100, 100, 100, 0.8);
    }

    .lqaboss-segment-highlight.default:hover {
      background: rgba(100, 100, 100, 0.3);
      border-color: rgba(100, 100, 100, 1);
      border-style: solid;
    }

    .lqaboss-segment-highlight.matched {
      background: rgba(0, 255, 0, 0.15);
      border: 2px dashed rgba(0, 255, 0, 0.7);
    }

    .lqaboss-segment-highlight.matched:hover {
      background: rgba(0, 255, 0, 0.3);
      border-color: rgba(0, 255, 0, 1);
      border-style: solid;
    }

    .lqaboss-segment-highlight.unmatched {
      background: rgba(255, 0, 0, 0.15);
      border: 2px dashed rgba(255, 0, 0, 0.7);
    }

    .lqaboss-segment-highlight.unmatched:hover {
      background: rgba(255, 0, 0, 0.3);
      border-color: rgba(255, 0, 0, 1);
      border-style: solid;
    }

    .lqaboss-tooltip {
      position: absolute;
      background: rgba(0, 0, 0, 0.95);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      white-space: pre-wrap;
      display: none;
      z-index: 1000001;
      max-width: 300px;
      word-wrap: break-word;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      pointer-events: none;
      direction: ltr;
      text-align: left;
    }

    .lqaboss-segment-highlight:hover .lqaboss-tooltip {
      display: block;
    }

    .lqaboss-tooltip-label {
      color: #888;
      font-size: 10px;
      text-transform: uppercase;
      margin-top: 4px;
    }
  `;

  document.head.appendChild(style);
}

function removeOverlay() {
  const existingOverlay = document.getElementById(XRAY_OVERLAY_ID);
  if (existingOverlay) {
    existingOverlay.remove();
  }

  const existingStyle = document.getElementById(XRAY_STYLE_ID);
  if (existingStyle) {
    existingStyle.remove();
  }
}

function createOverlay(segments) {
  removeOverlay();
  createStyles();

  const overlay = document.createElement('div');
  overlay.id = XRAY_OVERLAY_ID;

  // Get full document dimensions
  const docHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight
  );
  const docWidth = Math.max(
    document.documentElement.scrollWidth,
    document.body.scrollWidth
  );

  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: ${docWidth}px;
    height: ${docHeight}px;
    pointer-events: none;
    z-index: 999999;
  `;

  segments.forEach((seg, index) => {
    const highlight = document.createElement('div');

    // Determine color class based on matched status
    let colorClass = 'default';
    if (seg.matched === true) {
      colorClass = 'matched';
    } else if (seg.matched === false) {
      colorClass = 'unmatched';
    }

    highlight.className = `lqaboss-segment-highlight ${colorClass}`;

    // Add padding around the segment (4px on all sides)
    const padding = 4;
    const width = Math.max(seg.width, 20) + (padding * 2);
    const height = Math.max(seg.height, 16) + (padding * 2);

    highlight.style.cssText = `
      left: ${seg.x - padding}px;
      top: ${seg.y - padding}px;
      width: ${width}px;
      height: ${height}px;
    `;


    // Create tooltip content
    const tooltipLines = [];
    tooltipLines.push(`Segment #${index + 1}`);
    tooltipLines.push(`Text: ${seg.text.substring(0, 60)}${seg.text.length > 60 ? '...' : ''}`);

    // Show extracted metadata (exclude fields added by extractor)
    const excludeFields = new Set(['text', 'x', 'y', 'width', 'height', 'decodingError', 'matched']);
    const metadataLines = [];

    for (const [key, value] of Object.entries(seg)) {
      if (!excludeFields.has(key) && value !== undefined && value !== null) {
        // Format the key nicely
        const displayKey = key.charAt(0).toUpperCase() + key.slice(1);
        // Truncate long values
        const displayValue = String(value).length > 40
          ? String(value).substring(0, 40) + '...'
          : String(value);
        metadataLines.push(`${displayKey}: ${displayValue}`);
      }
    }

    if (metadataLines.length > 0) {
      tooltipLines.push(''); // Empty line
      tooltipLines.push(...metadataLines);
    }

    if (seg.decodingError) {
      tooltipLines.push('');
      tooltipLines.push(`⚠️ Decode Error: ${seg.decodingError}`);
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'lqaboss-tooltip';
    tooltip.textContent = tooltipLines.join('\n');

    // Position tooltip above or below highlight
    if (seg.y > 100) {
      tooltip.style.bottom = `${seg.height + 5}px`;
    } else {
      tooltip.style.top = `${seg.height + 5}px`;
    }
    tooltip.style.left = '0px';

    // Click to copy GUID
    highlight.addEventListener('click', (e) => {
      e.stopPropagation();
      if (seg.g) {
        navigator.clipboard.writeText(seg.g).then(() => {
          // Visual feedback - flash white
          const originalBg = highlight.style.background;
          highlight.style.background = 'rgba(255, 255, 255, 0.6)';
          setTimeout(() => {
            highlight.style.background = originalBg;
          }, 300);
        });
      }
    });

    highlight.appendChild(tooltip);
    overlay.appendChild(highlight);
  });

  document.body.appendChild(overlay);
}

function toggleXRayVision(enabled, segments = []) {
  if (enabled && segments.length > 0) {
    createOverlay(segments);
    currentSegments = segments;
    isCurrentlyVisible = true;
  } else {
    removeOverlay();
    currentSegments = [];
    isCurrentlyVisible = false;
  }
}

// Listen for messages from background/side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggle-xray') {
    toggleXRayVision(request.enabled, request.segments || []);
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'remove-xray') {
    removeOverlay();
    currentSegments = [];
    isCurrentlyVisible = false;
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'hide-xray-temporarily') {
    const wasVisible = isCurrentlyVisible;
    if (wasVisible) {
      removeOverlay();
    }
    sendResponse({ success: true, wasVisible });
    return true;
  }

  if (request.action === 'restore-xray') {
    if (currentSegments.length > 0) {
      createOverlay(currentSegments);
      isCurrentlyVisible = true;
    }
    sendResponse({ success: true });
    return true;
  }
});

// Update overlay positions with new segment coordinates
function updateOverlayPositions(newSegments) {
  const overlay = document.getElementById(XRAY_OVERLAY_ID);
  if (!overlay) return;

  const highlights = overlay.querySelectorAll('.lqaboss-segment-highlight');

  // Update full document dimensions
  const docHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight
  );
  const docWidth = Math.max(
    document.documentElement.scrollWidth,
    document.body.scrollWidth
  );

  overlay.style.width = `${docWidth}px`;
  overlay.style.height = `${docHeight}px`;

  // Update each highlight position and size
  newSegments.forEach((seg, index) => {
    if (highlights[index]) {
      // Add padding around the segment (4px on all sides)
      const padding = 4;
      const width = Math.max(seg.width, 20) + (padding * 2);
      const height = Math.max(seg.height, 16) + (padding * 2);

      highlights[index].style.left = `${seg.x - padding}px`;
      highlights[index].style.top = `${seg.y - padding}px`;
      highlights[index].style.width = `${width}px`;
      highlights[index].style.height = `${height}px`;
    }
  });

  // Update current segments with new positions
  currentSegments = newSegments.map((newSeg, i) => ({
    ...currentSegments[i],
    x: newSeg.x,
    y: newSeg.y,
    width: newSeg.width,
    height: newSeg.height
  }));
}

// Listen for window resize and update positions
let resizeTimeout;
window.addEventListener('resize', () => {
  if (isCurrentlyVisible && currentSegments.length > 0) {
    // Debounce resize events
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // Re-extract segments to get new positions
      try {
        // Check if extraction function is available
        if (!window.LQABOSS_extractTextAndMetadata) {
          return;
        }

        const result = window.LQABOSS_extractTextAndMetadata();

        if (result && result.textElements) {
          const newSegments = result.textElements;

          // Update overlay with new positions
          if (newSegments.length === currentSegments.length) {
            updateOverlayPositions(newSegments);
          } else {
            // Segment count changed, disable overlay
            removeOverlay();
            currentSegments = [];
            isCurrentlyVisible = false;

            try {
              if (chrome.runtime?.id) {
                chrome.runtime.sendMessage({
                  action: 'xray-disabled-by-resize'
                }).catch(() => {
                  // Ignore if side panel is not open or extension reloaded
                });
              }
            } catch (e) {
              // Ignore messaging errors
            }
          }
        }
      } catch (error) {
        // Extraction failed, keep existing positions
      }
    }, 250);
  }
});

// Shift-hold to temporarily hide X-ray
let shiftHeldDown = false;
let savedSegmentsForShift = [];

window.addEventListener('keydown', (e) => {
  if (e.key === 'Shift' && !shiftHeldDown && isCurrentlyVisible) {
    shiftHeldDown = true;
    savedSegmentsForShift = [...currentSegments];

    // Hide overlay
    const overlay = document.getElementById(XRAY_OVERLAY_ID);
    if (overlay) {
      overlay.style.display = 'none';
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'Shift' && shiftHeldDown) {
    shiftHeldDown = false;

    // Re-extract segments in case DOM changed
    try {
      if (window.LQABOSS_extractTextAndMetadata && savedSegmentsForShift.length > 0) {
        const result = window.LQABOSS_extractTextAndMetadata();

        if (result && result.textElements) {
          const newSegments = result.textElements;

          // Preserve matched status from saved segments
          const segmentsWithMatchStatus = newSegments.map((seg, i) => {
            const savedSeg = savedSegmentsForShift[i];
            return {
              ...seg,
              matched: savedSeg?.matched
            };
          });

          // Recreate overlay with updated segments
          createOverlay(segmentsWithMatchStatus);
          currentSegments = segmentsWithMatchStatus;
          isCurrentlyVisible = true;
        }
      } else {
        // Just show existing overlay if extraction not available
        const overlay = document.getElementById(XRAY_OVERLAY_ID);
        if (overlay) {
          overlay.style.display = '';
        }
      }
    } catch (error) {
      // Just show existing overlay on error
      const overlay = document.getElementById(XRAY_OVERLAY_ID);
      if (overlay) {
        overlay.style.display = '';
      }
    }

    savedSegmentsForShift = [];
  }
});

} // End guard against multiple injections
