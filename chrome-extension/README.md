# LQA Boss Chrome Extension

A Chrome extension for capturing web pages with screenshots and translation metadata for LQA (Language Quality Assurance) review. Designed to work seamlessly with the LQA Boss PWA via Chrome Extension Messaging API.

## Features

- 📸 **Full-Page Screenshot Capture** - Uses Chrome Debugger API for complete page capture
- 🔍 **X-Ray Vision** - Visual overlay showing detected translation segments
- 🛒 **Cart Management** - Collect multiple pages before sending to review
- 🔗 **TM Integration** - Fetch translation memory entries from configurable endpoint
- 🚀 **PWA Integration** - Seamless transfer to PWA via Chrome Extension Messaging API
- 💾 **Offline Export** - Download captured flows as .lqaboss ZIP files
- ⚡ **Vanilla JS** - No framework dependencies, lightweight and fast

## Architecture

### Core Components

1. **Background Service Worker** (`background/service-worker.js`)
   - Orchestrates capture process
   - Full-page screenshot via Chrome Debugger API
   - Creates ZIP files with JSZip
   - Handles cross-origin messaging with PWA via `chrome.runtime.onMessageExternal`

2. **Content Scripts**
   - `content/extractor.js` - Extracts text segments with metadata (ported from flowCapture.js)
   - `content/xray-overlay.js` - X-Ray Vision overlay feature

3. **Side Panel** (`sidepanel/`)
   - `index.html` - Cart UI
   - `cart.js` - Cart management and capture orchestration
   - `settings.js` - Settings management
   - `styles.css` - Styling (no Tailwind, pure CSS)

4. **Utilities** (`lib/`)
   - `fe00-decoder.js` - Unicode metadata decoder
   - `jszip.min.js` - ZIP file generation (external dependency)

## Installation

### Prerequisites

- Chrome 114+ (for Manifest V3 and Side Panel API)
- Node.js (for downloading dependencies)

### Setup

1. **Clone or navigate to the extension directory:**
   ```bash
   cd chrome-extension
   ```

2. **Download JSZip library:**
   ```bash
   # Option 1: Using curl
   curl -o lib/jszip.min.js https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js

   # Option 2: Using npm
   npm install jszip
   cp node_modules/jszip/dist/jszip.min.js lib/
   ```

3. **Create placeholder icons:**
   ```bash
   # The extension needs icons. You can:
   # - Create your own PNG icons (16x16, 32x32, 48x48, 128x128)
   # - Use a tool like ImageMagick to generate them:

   # For now, create a simple placeholder
   # (You'll need to replace these with actual icons)
   ```

4. **Load extension in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `chrome-extension` directory
   - The extension should now appear in your extensions list

5. **Pin the extension:**
   - Click the puzzle icon in Chrome toolbar
   - Find "LQA Boss Capture"
   - Click the pin icon to keep it visible

## Usage

### Basic Flow

1. **Navigate to a page** you want to capture (e.g., a localized website)

2. **Open the extension** by clicking the LQA Boss icon

3. **Capture pages:**
   - Click "📸 Capture Page" to capture the current page
   - Extension will capture full-page screenshot and extract metadata
   - Page is added to the cart

4. **Enable X-Ray Vision** (optional):
   - Toggle "X-Ray Vision" to see detected segments highlighted
   - Hover over highlights to see metadata
   - Click highlights to copy GUID

5. **Configure settings** (gear icon):
   - **TM Endpoint URL**: API endpoint for fetching translation memory
   - **TM API Key**: Authentication token (optional)
   - **Source/Target Language**: Language pair for TM lookup
   - **PWA URL**: Base URL of your PWA application

6. **Send to LQA Boss:**
   - Enter a flow name (or use auto-generated)
   - Click "🚀 Send to LQA Boss"
   - Extension creates ZIP, stores temporarily, and opens PWA
   - PWA receives flow via Chrome Extension Messaging API

7. **Alternative: Download ZIP:**
   - Click "💾 Download ZIP" to save .lqaboss file locally
   - File can be manually uploaded to PWA or processed elsewhere

### Settings Configuration

#### TM Integration

If you have a Translation Memory service:

```json
{
  "endpoint": "https://your-tm-service.com/api/tm/entries",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer YOUR_API_KEY"
  },
  "body": {
    "guids": ["guid1", "guid2", ...],
    "sourceLang": "en",
    "targetLang": "es"
  }
}
```

Expected response:
```json
{
  "tus": [
    {
      "guid": "abc123...",
      "sid": "string_id",
      "source": "Source text",
      "target": "Translated text",
      "q": 100,
      "ts": "2025-01-15T10:30:00Z"
    }
  ]
}
```

#### PWA URL

Set this to your PWA's base URL. When sending to PWA, the extension will:
1. Save flow to IndexedDB at the PWA's origin
2. Broadcast notification via BroadcastChannel
3. Open `{pwaUrl}/review/{flowId}` in new tab

**Important**: Extension and PWA must be on the same origin for IndexedDB sharing to work.

## File Format

The extension creates `.lqaboss` ZIP files with this structure:

```
lqa-flow-YYYY-MM-DDTHH-MM-SS.lqaboss
├── page_1_<id>.png           # Screenshots
├── page_2_<id>.png
├── flow_metadata.json         # Flow metadata
└── job.json                   # TM entries (if configured)
```

### flow_metadata.json

```json
{
  "createdAt": "2025-01-15T10:30:00.000Z",
  "pages": [
    {
      "pageId": "page_1234567890_abc123",
      "originalUrl": "https://example.com/page",
      "title": "Page Title",
      "timestamp": "2025-01-15T10:30:00.000Z",
      "imageFile": "page_1_page_1234567890_abc123.png",
      "segments": [
        {
          "text": "Hello World",
          "x": 100,
          "y": 200,
          "width": 150,
          "height": 20,
          "g": "guid-abc123...",
          "sid": "hello_world"
        }
      ]
    }
  ]
}
```

### job.json (Optional)

```json
{
  "sourceLang": "en",
  "targetLang": "es",
  "instructions": "Optional instructions for the translation job",
  "tus": [
    {
      "guid": "guid-abc123...",
      "sid": "hello_world",
      "source": "Hello World",
      "target": "Hola Mundo",
      "q": 100,
      "ts": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

## PWA Integration

### Setup Requirements

1. **Extension Configuration:**
   - Extension must have `externally_connectable` in manifest.json
   - Add PWA origins to `matches` array

2. **PWA Configuration:**
   - Update `EXTENSION_ID` in `src/plugins/ChromeExtensionPlugin.ts`
   - Extension ID is found at `chrome://extensions` (enable Developer mode)

### Extension manifest.json

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

### Communication Flow

#### Extension → PWA ("Send to LQA Boss")

1. User clicks "Send to LQA Boss" in extension
2. Extension creates ZIP file
3. Extension stores ZIP temporarily in memory
4. Extension opens PWA in new tab: `https://pwa-url/?plugin=extension`
5. PWA detects `?plugin=extension` parameter
6. PWA sends `requestFlow` message to extension via `chrome.runtime.sendMessage`
7. Extension responds with ZIP data
8. PWA loads the file

#### PWA → Extension ("New From Extension" menu)

1. User clicks "New From Extension" in PWA File menu
2. PWA sends `requestFlow` message to extension
3. Extension responds with pending flow (if available within 5 minutes)
4. PWA loads the file

### PWA Implementation Example

```typescript
// In ChromeExtensionPlugin.ts
async loadFile(): Promise<File> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      EXTENSION_ID,
      { action: 'requestFlow' },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response.success) {
          reject(new Error(response.error));
          return;
        }

        const uint8Array = new Uint8Array(response.data.zipData);
        const blob = new Blob([uint8Array], { type: 'application/zip' });
        const file = new File([blob], response.data.fileName);
        resolve(file);
      }
    );
  });
}
```

### Extension ID Discovery

1. Load extension in Chrome (`chrome://extensions`)
2. Enable "Developer mode"
3. Copy the Extension ID (e.g., `abcdefghijklmnopqrstuvwxyz123456`)
4. Update `EXTENSION_ID` in PWA's `src/plugins/ChromeExtensionPlugin.ts`

### Security

- **Origin Restrictions**: Only origins in `externally_connectable.matches` can communicate with extension
- **Temporary Storage**: Flow data expires after 5 minutes
- **No Persistence**: Flow data stored in memory only, not in storage APIs

### Troubleshooting

**"Extension ID not configured" error:**
- Update `EXTENSION_ID` constant in ChromeExtensionPlugin.ts

**"New From Extension" menu grayed out:**
- Extension is not installed
- Extension ID is incorrect
- Using non-Chrome browser

**"No flow available" error:**
- No flow has been sent from extension recently
- Flow expired (older than 5 minutes)
- Send flow from extension again

**PWA times out waiting for extension:**
- Check `externally_connectable` includes PWA origin
- Verify extension is loaded and enabled
- Check extension ID matches

## Development

### Project Structure

```
chrome-extension/
├── manifest.json              # Extension manifest (Manifest V3)
├── background/
│   └── service-worker.js      # Background orchestration
├── content/
│   ├── extractor.js          # Metadata extraction
│   └── xray-overlay.js       # X-Ray Vision overlay
├── sidepanel/
│   ├── index.html            # Side panel UI
│   ├── cart.js               # Cart management
│   ├── settings.js           # Settings management
│   └── styles.css            # Styling
├── lib/
│   ├── fe00-decoder.js       # Metadata decoder
│   └── jszip.min.js          # JSZip library
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

### Debugging

1. **Background Service Worker:**
   - Go to `chrome://extensions/`
   - Click "Service Worker" link under extension
   - Opens DevTools for background script

2. **Side Panel:**
   - Open side panel
   - Right-click in side panel
   - Select "Inspect"

3. **Content Scripts:**
   - Open regular DevTools on target page
   - Console will show content script logs

### Common Issues

**"Debugger attached" warning:**
- This is expected when capturing screenshots
- Debugger detaches automatically after capture
- Users doing LQA work should understand this

**X-Ray Vision not showing:**
- Ensure page has LQA metadata markers (U+200B, U+200C, U+FE00-FE0F)
- Check browser console for errors
- Try re-capturing the page

**PWA not receiving flows:**
- Verify `externally_connectable` includes PWA origin in manifest.json
- Check extension ID is correctly configured in ChromeExtensionPlugin.ts
- Open browser console to check for messaging errors
- Ensure extension is loaded and enabled at `chrome://extensions`

**TM fetch failing:**
- Check TM endpoint URL in settings
- Verify API key if required
- Check network tab for request/response
- Ensure endpoint returns expected JSON format

## Permissions Explained

- `activeTab`: Access current tab for screenshots and extraction
- `scripting`: Inject content scripts dynamically
- `sidePanel`: Show side panel UI
- `storage`: Store settings in sync storage
- `debugger`: Full-page screenshot capture
- `<all_urls>`: Access any page for capture (can be restricted to specific domains)

## License

This extension is part of the L10n Monster project.

## Related

- **L10n Monster Core**: https://github.com/l10nmonster/l10nmonster
- **helpers-lqaboss**: The original CLI-based capture tool
- **flowCapture.js**: Source of extraction logic

## Support

For issues or questions:
- Check the [L10n Monster documentation](https://github.com/l10nmonster/l10nmonster)
- File issues on GitHub
- Review the existing `helpers-lqaboss` implementation for reference
