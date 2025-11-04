# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
```bash
npm install          # Install dependencies
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # TypeScript check with strict mode
npm run semantic-release  # Manual semantic release (automated via GitHub Actions)
```

### Type Checking
Always run `npm run lint` after making changes - it performs strict TypeScript checking with `npx tsc --noEmit --strict`.

### Semantic Versioning & Releases
This project follows semantic versioning with automated changelog generation:

- **Commit Format**: Use conventional commit format (configured via `.gitmessage` template)
  - `feat:` for new features (minor version bump)
  - `fix:` for bug fixes (patch version bump)
  - `BREAKING CHANGE:` in footer for breaking changes (major version bump)
  - `chore:`, `docs:`, `style:`, `refactor:`, `test:`, `ci:` for other changes (no version bump)

- **Automated Releases**: Single GitHub Actions workflow handles both release and deployment
  - **Release Job**: Analyzes commits, bumps version, generates changelog, creates GitHub release
  - **Deploy Job**: Builds with updated version and deploys to GitHub Pages
  - Ensures deployment always happens with the latest released version
  - Version number is displayed in app footer

## Architecture Overview

### Core Application Structure
This is a React 19 PWA for editing LQA Boss (.lqaboss) files, which are ZIP archives containing translation job data and optional screenshot flow metadata.

**Two Operating Modes:**
1. **With Screenshots** (dual-pane): Screenshot viewer + text editor when `flow_metadata.json` exists
2. **Without Screenshots** (single-pane): Text editor only when only `job.json` exists

### Key Data Structures

**Job Data (job.json):**
- `JobData`: Contains `tus` (Translation Units) array with normalized source/target text
- `TranslationUnit`: Core editing unit with `nsrc`/`ntgt` normalized text arrays
- `NormalizedItem`: String or placeholder object for tags/variables

**Flow Data (flow_metadata.json - optional):**
- `FlowData`: Contains `pages` array for screenshot navigation
- `Page`: Links to image files and contains `segments` with coordinates
- `Segment`: Positioned text overlay on screenshots

### Critical Components

**App.tsx** (`src/App.tsx:22`):
- Main state management for `jobData`, `flowData`, `zipFile`
- File loading logic with ZIP parsing
- Two-pane vs single-pane layout switching
- Keyboard navigation integration

**TextSegmentEditor.tsx**:
- Core editing interface using Lexical editor
- Visual indicators: green (unmodified), red (modified), blue (active)
- Handles both flow segments and standalone translation units

**ScreenshotViewer.tsx**:
- Displays screenshots with clickable segment overlays
- Handles coordinate scaling and DPR calculations
- Only rendered when flow metadata exists

**Normalized Text System** (`src/utils/normalizedText.ts`):
- `normalizedToString()`: Converts arrays to editable text
- `normalizedToDisplayString()`: Shows placeholders distinctly
- Handles tags (`bx`/`ex`) and variables (`x`) in translation content

### Build Configuration

**Vite Setup** (`vite.config.ts:5`):
- Base path: `/` for GitHub Pages
- Dev server on port 3000
- Optimized Lexical imports in `optimizeDeps`
- Manual chunking for vendor libraries

**TypeScript Config**:
- Strict mode enabled with unused parameter/local checking
- React JSX transform, ES2020 target
- Only `src/` directory included

### Key Dependencies
- **Chakra UI 3.0**: Modern component library (note API changes from v2)
- **Lexical 0.32**: Rich text editor framework
- **JSZip 3.10**: ZIP file handling for .lqaboss files
- **Lodash**: Deep equality checking for change detection
- **React 19 RC**: Latest React with performance improvements

### Change Detection & Export
The app tracks modifications by comparing current `ntgt` arrays with original data using `isEqual()` from lodash. Only changed translation units are exported via `saveChangedTus()` in `src/utils/saveHandler.ts:10`.

### Three-State System (CRITICAL - READ CAREFULLY)

**IMPORTANT**: Understanding this system is critical for working with translation state management.

The application uses a **three-state system** to track translation changes:

1. **`originalJobData`**: The **ORIGINAL TRANSLATION** from the loaded .lqaboss file
   - Contains the `ntgt` values as they were in job.json
   - **NOT the source text (nsrc)** - this is the target language translation
   - Used for the "Original" button (FiHome icon) to restore the file's original translation
   - Visual indicator: GREEN border (segment matches original translation from file)

2. **`savedJobData`**: The auto-saved translation (three-state mode) or same as original (two-state mode)
   - In three-state mode: Contains translations from a previous editing session (auto-save)
   - In two-state mode: Initially identical to originalJobData
   - Used for the "Undo" button (FiRotateCcw icon) to revert recent edits
   - Visual indicator: YELLOW border (segment matches saved translation)

3. **`jobData` (current)**: The working copy being actively edited
   - Contains the current state with user's edits
   - Visual indicator: RED border when modified (different from both original and saved)
   - Visual indicator: BLUE border when active/selected

**Common Mistake to Avoid**:
- ❌ **NEVER** set `originalJobData.ntgt` to `nsrc` (source text)
- ✅ **ALWAYS** preserve `originalJobData.ntgt` as the translation from the file
- The "original" is the original **translation** (target language), NOT the source text

**When Operating Modes**:
- **Two-State System** (status "NEW"): Used for local files without auto-save
  - `originalJobData` = `savedJobData` = copy of loaded `jobData`
  - All three have identical ntgt values initially

- **Three-State System** (status "LOADED"): Used when auto-save data exists
  - `originalJobData` = translations from the originally loaded file
  - `savedJobData` = translations from auto-save (previous editing session)
  - `jobData` = current working copy (starts as copy of savedJobData)

**State Setup Functions** (`src/hooks/useTranslationData.ts`):
- `setupTwoStateSystem()`: Creates three identical copies of job data
- `setupThreeStateSystem()`: Sets up original/saved/current with different translations

### Quality Model System

The application supports configurable quality models for translation quality assessment, following standards like MQM (Multidimensional Quality Metrics).

**Quality Menu** (`src/components/headers/UnifiedHeader.tsx:158`):
- Located next to the File menu in the header
- **New Model…**: Creates a new empty quality model
- **Load Model…**: Loads a quality model from a local JSON file
- **Edit Model…**: Opens editor for the current model (disabled when no model loaded)
- Displays current model name with version (e.g., "Model: MQM Standard v1.0")
- Shows TER (Translation Error Rate) score

**Quality Model Structure** (`src/types/qualityModel.ts`):
- `QualityModel`: Top-level model definition with id, name, version, description
- `Severity`: Error severity levels with weights (e.g., Minor: 1, Major: 5, Critical: 10)
- `ErrorCategory`: Main error categories with subcategories (two-level hierarchy)
- `ErrorSubcategory`: Specific error types within categories

**Model Editor** (`src/components/ModelEditor.tsx`):
- Full-featured modal editor for creating/editing quality models
- Validates all required fields before saving
- Features:
  - Basic info: Model ID, name, version, description (all in one row)
  - Severities: ID, label, weight (accepts 0+), description
  - Categories: ID, label, description with nested subcategories
  - Subcategories: Indented layout showing hierarchy
  - Add/remove items with trash icons inline with fields
  - Export: Saves as `{model-id}-{version}.json`

**Example Model**: See `mqm.json` for a complete MQM standard model with:
- 3 severity levels (Minor/Major/Critical)
- 6 error categories (Accuracy, Fluency, Terminology, Style, Locale Convention, Other)
- Multiple subcategories per category

**State Management** (`src/pages/EditorPage.tsx`):
- `qualityModel`: Currently loaded model
- `editingModel`: Model being edited in the modal
- `showModelEditor`: Controls modal visibility
- Models persist in memory during the session
- Load/save operations use local file system only

### Plugin System Architecture

The application uses a plugin-based architecture for file persistence and loading, supporting multiple sources:

**Plugin Registry** (`src/plugins/PluginRegistry.ts`):
- Central registry managing all persistence plugins
- Handles plugin initialization, availability checks, and lifecycle
- Plugins registered in `src/main.tsx`

**Available Plugins**:
1. **LocalFilePlugin** (`src/plugins/LocalFilePlugin.ts`)
   - Default plugin for local file system access
   - Uses browser File API for reading/writing .lqaboss files
   - No authentication required

2. **GCSPlugin** (`src/plugins/GCSPlugin.ts`)
   - Google Cloud Storage integration
   - OAuth 2.0 authentication with Google Identity Services
   - Auto-save support with companion files
   - Requires client ID configuration

3. **ChromeExtensionPlugin** (`src/plugins/ChromeExtensionPlugin.ts`)
   - Integrates with LQA Boss Capture Chrome extension
   - Uses `chrome.runtime.sendMessage` API for cross-origin communication
   - Extension ID configured at line 14 of ChromeExtensionPlugin.ts
   - Bidirectional communication:
     - Extension → PWA: "Send to LQA Boss" button opens PWA and transfers flow
     - PWA → Extension: "New From Extension" menu loads pending flow
   - Availability check disables menu if extension not installed

**Plugin Interface** (`src/plugins/types.ts`):
- `IPersistencePlugin`: Core interface all plugins implement
- `isAvailable()`: Optional method to check if plugin is ready (used by extension plugin)
- `loadFile()`, `saveFile()`: Core file operations
- `parseUrl()`, `buildUrl()`: Deep linking support
- `LocationPromptComponent`: Optional React component for location prompts

### Chrome Extension Integration

**Architecture**: Chrome Extension Messaging API (`chrome.runtime.onMessageExternal`)

**Communication Flow**:

1. **Extension → PWA ("Send to LQA Boss")**:
   - Extension captures pages and creates ZIP file
   - Stores ZIP temporarily in memory (expires after 5 minutes)
   - Opens PWA with `?plugin=extension` parameter
   - PWA detects parameter and requests flow via `chrome.runtime.sendMessage`
   - Extension responds with ZIP data
   - PWA loads file automatically

2. **PWA → Extension ("New From Extension" menu)**:
   - PWA sends `ping` message to check extension availability
   - Menu item disabled if extension not installed
   - User clicks "New From Extension"
   - PWA sends `requestFlow` message
   - Extension responds with pending flow (if available)
   - PWA loads file

**Configuration**:
- Extension must have `externally_connectable` in manifest.json with PWA origins
- PWA must have extension ID configured in `src/plugins/ChromeExtensionPlugin.ts:14`
- Extension ID found at `chrome://extensions` with Developer mode enabled

**Extension Location**: `chrome-extension/` directory (see chrome-extension/README.md)

### PWA Features
- File association for .lqaboss files via `launchQueue` API
- Service worker and manifest for offline functionality
- Progressive enhancement when PWA features unavailable
- Multi-source file loading via plugin system