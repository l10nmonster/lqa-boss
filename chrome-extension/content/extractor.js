/* eslint-disable complexity */
/**
 * Text and metadata extraction content script
 * Ported from flowCapture.js:extractTextAndMetadataInPageContext
 */

// Import fe00 decoder (included via manifest)
// Note: This will be loaded via chrome.scripting.executeScript

function fe00RangeToUtf8_browser(encoded) {
  const encodingOffset = 0xfe00;
  const decoder = new TextDecoder();
  const length = encoded.length;

  if (length % 2 !== 0) throw new Error('Invalid fe00 encoded input length');

  const bytes = new Uint8Array(length / 2);
  let byteIndex = 0;

  for (let i = 0; i < length; i += 2) {
    const highNibble = encoded.charCodeAt(i) - encodingOffset;
    const lowNibble = encoded.charCodeAt(i + 1) - encodingOffset;

    if (highNibble < 0 || highNibble > 15 || lowNibble < 0 || lowNibble > 15) {
      throw new Error('Invalid char code in fe00 encoded input');
    }

    bytes[byteIndex++] = (highNibble << 4) | lowNibble;
  }

  return decoder.decode(bytes);
}

function extractTextAndMetadata() {
  const textElements = [];
  const START_MARKER_REGEX = /(?<![''<])\u200B([\uFE00-\uFE0F]+)/g;
  const END_MARKER = '\u200C';

  if (!document.body) {
    return { error: 'Document body not found.' };
  }

  const treeWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);

  let activeSegment = null;
  let node;

  while (node = treeWalker.nextNode()) {
    const parentElement = node.parentElement;

    if (parentElement) {
      const styles = window.getComputedStyle(parentElement);
      if (styles.display === 'none' || styles.visibility === 'hidden' || parseFloat(styles.opacity) === 0) continue;
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'HEAD'].includes(parentElement.tagName)) continue;
    } else {
      continue;
    }

    let searchPos = 0;
    const text = node.nodeValue;

    while (searchPos < text.length) {
      if (activeSegment) {
        const endMarkerPos = text.indexOf(END_MARKER, searchPos);

        if (endMarkerPos !== -1) {
          activeSegment.text += text.substring(searchPos, endMarkerPos);

          const range = document.createRange();
          range.setStart(activeSegment.startNode, activeSegment.startOffset);
          range.setEnd(node, endMarkerPos);

          const rect = range.getBoundingClientRect();
          if (rect.width > 0 || rect.height > 0) {
            let parsedMetadata = {};
            try {
              const decodedJsonMetadata = fe00RangeToUtf8_browser(activeSegment.encodedMetadata);
              if (decodedJsonMetadata && decodedJsonMetadata.trim() !== '') {
                parsedMetadata = JSON.parse(decodedJsonMetadata);
              }
            } catch (e) {
              parsedMetadata.decodingError = e.message;
            }

            textElements.push({
              text: activeSegment.text,
              x: rect.left + window.scrollX,
              y: rect.top + window.scrollY,
              width: rect.width,
              height: rect.height,
              ...parsedMetadata
            });
          }

          searchPos = endMarkerPos + 1;
          activeSegment = null;
        } else {
          activeSegment.text += text.substring(searchPos);
          break;
        }
      } else {
        START_MARKER_REGEX.lastIndex = searchPos;
        const match = START_MARKER_REGEX.exec(text);

        if (match) {
          const textAfterStart = text.substring(match.index + match[0].length);
          const endMarkerPosInSubstring = textAfterStart.indexOf(END_MARKER);

          if (endMarkerPosInSubstring !== -1) {
            const capturedText = textAfterStart.substring(0, endMarkerPosInSubstring);

            const range = document.createRange();
            range.setStart(node, match.index);
            const endOffset = match.index + match[0].length + endMarkerPosInSubstring;
            range.setEnd(node, endOffset);

            const rect = range.getBoundingClientRect();
            if (rect.width > 0 || rect.height > 0) {
              let parsedMetadata = {};
              try {
                const decodedJsonMetadata = fe00RangeToUtf8_browser(match[1]);
                if (decodedJsonMetadata && decodedJsonMetadata.trim() !== '') {
                  parsedMetadata = JSON.parse(decodedJsonMetadata);
                }
              } catch (e) {
                parsedMetadata.decodingError = e.message;
              }

              textElements.push({
                text: capturedText,
                x: rect.left + window.scrollX,
                y: rect.top + window.scrollY,
                width: rect.width,
                height: rect.height,
                ...parsedMetadata
              });
            }
            searchPos = endOffset + 1;
          } else {
            activeSegment = {
              startNode: node,
              startOffset: match.index,
              encodedMetadata: match[1],
              text: textAfterStart
            };
            break;
          }
        } else {
          break;
        }
      }
    }
  }

  return { textElements };
}

// Expose extraction function globally for use by other content scripts
window.LQABOSS_extractTextAndMetadata = extractTextAndMetadata;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extract-metadata') {
    const result = extractTextAndMetadata();
    sendResponse(result);
    return true;
  }
});
