# CLAUDE.md - Chrome Extension

This file provides guidance for working with the LQA Boss Capture Chrome Extension.

## Architecture Overview

This is a Manifest V3 Chrome extension for capturing web pages with screenshots and translation metadata. It integrates seamlessly with the LQA Boss PWA via Chrome Extension Messaging API.

### Technology Stack

- **Vanilla JavaScript**: No framework dependencies
- **Chrome Extension APIs**: Manifest V3
- **JSZip**: For creating .lqaboss ZIP files
- **Chrome Debugger API**: For full-page screenshot capture
- **Chrome Extension Messaging API**: For PWA communication

### Core Components

1. **Background Service Worker** (`background/service-worker.js`)
   - Orchestrates capture process
   - Handles screenshot capture via Chrome Debugger API
   - Creates ZIP files with JSZip
   - Manages PWA communication via `chrome.runtime.onMessageExternal`
   - Stores pending flows temporarily in memory (5-minute expiration)

2. **Content Scripts**
   - `content/extractor.js`: Extracts text segments with FE00-encoded metadata
   - `content/xray-overlay.js`: X-Ray Vision overlay showing detected segments

3. **Side Panel** (`sidepanel/`)
   - `index.html`: Cart UI
   - `cart.js`: Cart management and capture orchestration
   - `settings.js`: Settings persistence (TM endpoint, languages)
   - `styles.css`: Pure CSS styling (no Tailwind)

4. **Utilities** (`lib/`)
   - `fe00-decoder.js`: Unicode metadata decoder for LQA markers
   - `jszip.min.js`: ZIP file generation

## PWA Integration Architecture

### Communication Method: Chrome Extension Messaging API

**Why this approach:**
- Cross-origin communication between `chrome-extension://` and `https://` origins
- No same-origin requirements (unlike IndexedDB/BroadcastChannel)
- Secure with `externally_connectable` restrictions
- Bidirectional messaging support

### Configuration Requirements

1. **Extension Side** (`manifest.json`):
   ```json
   {
     "externally_connectable": {
       "matches": [
         "http://localhost:*/*",
         "https://lqaboss.l10n.monster/*"
       ]
     }
   }
   ```

2. **PWA Side** (`src/plugins/ChromeExtensionPlugin.ts:14`):
   ```typescript
   const EXTENSION_ID = 'kikdgalghgdmaabcjbbkdbjchmnonlhb'
   ```
   - Update with actual extension ID from `chrome://extensions`
   - ID changes when extension is reloaded in development
   - ID is stable for published extensions

### Message Protocol

**Messages FROM PWA (External Messages)**:

1. `ping`: Health check to verify extension is installed
   ```javascript
   Request: { action: 'ping' }
   Response: { success: true }
   ```

2. `requestFlow`: Request pending flow data
   ```javascript
   Request: { action: 'requestFlow' }
   Response: {
     success: true,
     data: { zipData: [1,2,3,...], fileName: 'flow.lqaboss' }
   }
   // OR
   Response: { success: false, error: 'No flow available' }
   ```

**Messages TO PWA** (via opening PWA with URL):
- Extension opens: `https://pwa-url/?plugin=extension`
- PWA detects parameter and sends `requestFlow` message back

### Flow Storage

**Temporary In-Memory Storage**:
- Flows stored in `pendingFlow` variable in service worker
- Automatically expires after 5 minutes
- Cleared after successful retrieval
- No persistence to storage APIs

**Why temporary:**
- Simple implementation
- No storage quota concerns
- Encourages immediate transfer to PWA
- Security: data not left in storage

### PWA Launch Behavior

**Production URL (https://lqaboss.l10n.monster)**:
- Extension opens URL in a new browser tab
- Chrome recognizes the URL belongs to the installed PWA
- Shows "Open in app" button in address bar
- User clicks button to open in PWA window
- Extension shows message: "Click 'Open in app' button..."

**Note**: Chrome Extensions cannot directly launch installed PWAs. The browser tab → PWA transition is a one-click user action.

**Localhost Development**:
- Opens directly in browser tab
- No PWA detection (localhost not in scope)
- Works normally for testing

## Development Workflow

### Setup

1. **Install dependencies**:
   ```bash
   # Download JSZip
   curl -o lib/jszip.min.js https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
   ```

2. **Load in Chrome**:
   - Navigate to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `chrome-extension/` directory
   - Note the Extension ID

3. **Configure PWA**:
   - Copy Extension ID
   - Update `src/plugins/ChromeExtensionPlugin.ts:14`
   - Rebuild PWA: `npm run build` (in parent directory)

### Testing Communication

**Test Extension → PWA:**
1. Open extension side panel
2. Capture some pages
3. Click "Send to LQA Boss"
4. PWA should open and load the flow automatically

**Test PWA → Extension:**
1. Open PWA in Chrome
2. File menu → "New From Extension"
3. Should load pending flow (if available within 5 minutes)

### Debugging

**Background Service Worker:**
- `chrome://extensions` → Click "Service Worker" link
- Opens DevTools for background script
- Console shows all background logs

**Side Panel:**
- Open side panel → Right-click → "Inspect"
- Full DevTools for side panel

**Content Scripts:**
- Regular page DevTools shows content script logs
- Check Console tab

**PWA Communication:**
- Open PWA DevTools → Console
- Look for "Requesting flow from Chrome extension..." messages
- Check Network tab for extension ID errors

## Key Files to Modify

### Adding New Features

**New capture metadata:**
- Edit `content/extractor.js` → `extractTextElements()` function
- Update `flow_metadata.json` structure in `background/service-worker.js` → `createFlowZIP()`

**New PWA messages:**
- Add handler in `background/service-worker.js` → `chrome.runtime.onMessageExternal.addListener()`
- Update PWA's `ChromeExtensionPlugin.ts` to send new message

**New settings:**
- Add UI in `sidepanel/index.html`
- Add persistence in `sidepanel/settings.js`
- Access via `settingsManager.getSettings()` in other files

### Common Modifications

**Change PWA URL detection:**
- Edit `sidepanel/cart.js:377-379` (pwaUrl determination)

**Adjust flow expiration time:**
- Edit `background/service-worker.js:637` (currently 5 minutes)

**Add new external message handlers:**
- Edit `background/service-worker.js:621-672` (onMessageExternal listener)

## File Format Specification

### .lqaboss ZIP Structure

```
lqa-flow-YYYY-MM-DDTHH-MM-SS.lqaboss
├── page_1_<id>.png           # Screenshot (PNG format)
├── page_2_<id>.png
├── flow_metadata.json         # Required: Flow and segment metadata
└── job.json                   # Optional: TM entries (if TM endpoint configured)
```

### flow_metadata.json Schema

```json
{
  "createdAt": "ISO8601 timestamp",
  "pages": [
    {
      "pageId": "string",
      "originalUrl": "string",
      "title": "string",
      "timestamp": "ISO8601 timestamp",
      "imageFile": "string (filename)",
      "segments": [
        {
          "text": "string (displayed text)",
          "x": "number (pixels from left)",
          "y": "number (pixels from top)",
          "width": "number (pixels)",
          "height": "number (pixels)",
          "g": "string (GUID from metadata)",
          "sid": "string (optional string ID)",
          "matched": "boolean (true if TM match found)"
        }
      ]
    }
  ]
}
```

### job.json Schema (Optional)

```json
{
  "sourceLang": "string (e.g., 'en')",
  "targetLang": "string (e.g., 'es')",
  "instructions": "string (optional instructions for the translation job)",
  "tus": [
    {
      "guid": "string",
      "sid": "string (optional)",
      "source": "string (source text)",
      "target": "string (translated text)",
      "q": "number (quality score 0-100)",
      "ts": "ISO8601 timestamp"
    }
  ]
}
```

## Translation Memory Integration

### TM Endpoint Configuration

**Settings UI** (`sidepanel/index.html:24-52`):
- TM Lookup URL
- Source Language
- Target Language

**Request Format** (POST to TM endpoint):
```json
{
  "sourceLang": "en",
  "targetLang": "es",
  "segments": [
    {
      "g": "guid-from-metadata",
      "sid": "string-id-if-available"
      // ... other decoded metadata fields
    }
  ]
}
```

**Expected Response**:
```json
{
  "results": [
    {
      "guid": "guid-abc123",
      "sid": "hello_world",
      "source": "Hello World",
      "target": "Hola Mundo",
      "q": 100,
      "ts": "2025-01-15T10:00:00Z"
    }
  ],
  "warnings": [
    "Optional warning messages"
  ]
}
```

### TM Fetch Process

1. **Metadata Extraction** (`content/extractor.js`):
   - Detects FE00-encoded Unicode markers
   - Decodes metadata (GUID, string ID, etc.)
   - Returns array of segments with coordinates

2. **TM Lookup** (`background/service-worker.js:267-337`):
   - Sends POST request with decoded metadata
   - Matches returned TUs to segments by GUID
   - Marks segments as `matched: true/false`
   - Collects unique TUs for `job.json`

3. **ZIP Creation** (`background/service-worker.js:342-404`):
   - Screenshots saved as PNG files
   - `flow_metadata.json` includes all segments with match status
   - `job.json` includes unique TUs (if any matched)

## Common Issues & Solutions

### Extension ID Changes

**Problem**: Extension ID changes after reloading unpacked extension

**Solution**:
- Copy new ID from `chrome://extensions`
- Update `src/plugins/ChromeExtensionPlugin.ts:14`
- Rebuild PWA

### "No flow available" Error

**Problem**: PWA can't retrieve flow from extension

**Causes**:
1. No flow has been sent from extension
2. Flow expired (> 5 minutes old)
3. Extension ID mismatch

**Solution**:
- Send flow from extension again
- Check extension ID matches
- Reduce time between send and retrieve

### PWA Menu Item Grayed Out

**Problem**: "New From Extension" menu item is disabled

**Causes**:
1. Extension not installed
2. Extension ID incorrect
3. `externally_connectable` not configured
4. Using non-Chrome browser

**Solution**:
- Verify extension is loaded at `chrome://extensions`
- Check extension ID in ChromeExtensionPlugin.ts
- Verify manifest.json has PWA origin in matches array
- Use Chrome or Edge browser

### X-Ray Vision Not Working

**Problem**: X-Ray overlay doesn't show segments

**Causes**:
1. Page has no FE00-encoded metadata
2. Content script injection failed
3. Page CSP blocks scripts

**Solution**:
- Verify page has LQA metadata markers
- Check browser console for errors
- Try refreshing page after opening side panel

## Best Practices

### When Adding Features

1. **Test both communication directions**:
   - Extension → PWA (Send to LQA Boss)
   - PWA → Extension (New From Extension)

2. **Handle errors gracefully**:
   - User-friendly error messages
   - Don't crash on missing data
   - Validate before sending to PWA

3. **Update both sides**:
   - Extension code
   - PWA ChromeExtensionPlugin
   - Both CLAUDE.md files
   - README.md files

### Code Style

- Use vanilla JavaScript (ES6+)
- No frameworks or build tools
- Comment complex logic
- Use async/await for Chrome APIs
- Handle promise rejections
- Log useful debug info to console

### Security Considerations

- Only allow trusted origins in `externally_connectable`
- Validate all incoming messages
- Don't store sensitive data
- Clear temporary data after use
- Use Chrome's permission model correctly

## Related Files

**In PWA** (`../src/`):
- `plugins/ChromeExtensionPlugin.ts`: PWA side of integration
- `plugins/types.ts`: Plugin interface definitions
- `components/headers/UnifiedHeader.tsx`: Menu integration

**Documentation**:
- `chrome-extension/README.md`: User-facing documentation
- `../CLAUDE.md`: PWA architecture documentation
- `../V2_REFACTOR_SUMMARY.md`: Plugin system refactor notes
