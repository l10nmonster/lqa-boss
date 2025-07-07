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
- Base path: `/lqa-boss/` for GitHub Pages
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

### PWA Features
- File association for .lqaboss files via `launchQueue` API
- Service worker and manifest for offline functionality
- Progressive enhancement when PWA features unavailable