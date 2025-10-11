# LLM Development Guide: LQA Boss React Application

This document provides context and guidance for Large Language Models (LLMs) assisting with the development and maintenance of the LQA Boss application - now a modern React-based Progressive Web Application.

## Project Overview

The LQA Boss is a Progressive Web Application designed to open, display, and allow text editing for `.lqaboss` files. These files are ZIP archives containing:
1. A `flow_metadata.json` file detailing a "flow" of captured web pages
2. Multiple PNG image files, one for each captured page in the flow

The application allows users to:
- Navigate through pages of a flow
- View screenshots with highlighted text segments
- Edit text content using a rich text editor
- Export a JSON file containing only modified segments
- Work offline as a PWA with file association support

**Core Technologies:**
- **React 19.1.0**: Latest React with improved performance
- **TypeScript 5.4**: Type safety and modern JavaScript features
- **Chakra UI 3.21.0**: Modern component library with glass-morphic design
- **Lexical 0.32.1**: Meta's extensible text editor framework
- **Vite 6.3.5**: Ultra-fast build tool and dev server
- **JSZip 3.10**: ZIP file handling
- **Framer Motion 12.18**: Advanced animations
- **ESM Modules**: Modern JavaScript module system

## File Structure (Key Files)

```
├── index.html                    # Entry HTML file
├── package.json                  # Dependencies and scripts (ESM module)
├── vite.config.ts               # Vite configuration
├── tsconfig.json                # TypeScript configuration
├── src/
│   ├── main.tsx                 # React app entry point
│   ├── App.tsx                  # Main application component
│   ├── theme.ts                 # Chakra UI theme configuration
│   ├── components/
│   │   ├── ScreenshotViewer.tsx # Screenshot display with highlights
│   │   ├── TextSegmentEditor.tsx # Text editing interface
│   │   ├── LexicalEditor.tsx    # Lexical rich text editor
│   │   └── GlassBox.tsx         # Glassmorphic container component
│   ├── hooks/
│   │   └── useKeyboardNavigation.ts # Keyboard navigation logic
│   ├── types/
│   │   └── index.ts             # TypeScript type definitions
│   └── utils/
│       └── saveHandler.ts       # Export functionality
├── public/
│   ├── manifest.webmanifest     # PWA manifest
│   ├── sw.js                    # Service worker
│   └── icons/                   # PWA icons
└── dist/                        # Build output
```

## Core Data Structures

### TypeScript Types (src/types/index.ts)

```typescript
export interface Segment {
  x: number              // Logical 1x coordinate
  y: number              // Logical 1x coordinate
  width: number          // Logical 1x dimension
  height: number         // Logical 1x dimension
  text: string          // Segment text content
  [key: string]: any    // Additional metadata
}

export interface Page {
  pageId: string
  originalUrl?: string
  imageFile: string     // Filename in ZIP
  segments: Segment[]
}

export interface FlowData {
  pages: Page[]
  [key: string]: any
}

export interface ChangedSegment {
  segmentIndex: number
  originalText: string
  currentText: string
  [key: string]: any
}
```

## Key Components

### App.tsx
Main application component managing:
- File loading via `handleFileLoad`
- State management (flowData, currentPage, activeSegment)
- Navigation between pages
- Keyboard navigation integration
- Glassmorphic UI layout

### ScreenshotViewer.tsx
- Displays page screenshots from ZIP
- Renders highlight boxes over text segments
- Handles click-to-focus segment interaction
- Calculates proper scaling for different DPR displays

### TextSegmentEditor.tsx
- Lists all text segments for current page
- Visual indicators: green (unmodified), red (modified), blue (active)
- Integrates LexicalEditor for each segment
- Undo functionality per segment
- Smooth scrolling to active segment

### LexicalEditor.tsx
- Rich text editing using Lexical framework
- Plain text mode configuration
- Custom styling for glassmorphic design
- Change tracking integration

### GlassBox.tsx
- Reusable glassmorphic container
- Backdrop blur effects
- Hover animations
- Consistent styling across app

## Key Functionality

### File Loading
```typescript
const handleFileLoad = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)
  const metadataFile = zip.file("flow_metadata.json")
  const flowData = JSON.parse(await metadataFile.async("string"))
  // Initialize original texts for change tracking
  // Set state and render first page
}
```

### Navigation
- Tab/Shift+Tab: Navigate between segments
- Ctrl+Arrow keys: Navigate between pages
- Automatic page switching at segment boundaries

### Change Detection
- Compares current text with originalTexts map
- Visual indicators update in real-time
- Only exports actually modified segments

### Export Format
```json
{
  "savedAt": "ISO_timestamp",
  "pages": [{
    "pageId": "unique_id",
    "originalUrl": "http://...",
    "imageFile": "page_1.png",
    "changedSegments": [{
      "segmentIndex": 0,
      "originalText": "Before edit",
      "currentText": "After edit",
      // ...other metadata
    }]
  }]
}
```

## Build Configuration

### Vite Configuration
- ESM module support
- Optimized dependency pre-bundling for Lexical
- Manual chunking for better code splitting
- Port 3000 for development

### TypeScript Configuration
- Strict mode enabled
- React JSX transform
- ES2020 target
- Module resolution for bundler

## Development Commands

```bash
npm install      # Install dependencies
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run preview  # Preview production build
```

## Common Issues & Solutions

### Lexical Import Errors
The application uses specific imports from Lexical submodules:
```typescript
import { LexicalComposer } from '@lexical/react/LexicalComposer'
// NOT: import { LexicalComposer } from '@lexical/react'
```

### ESM Module Requirements
- Package.json includes `"type": "module"`
- All imports use ESM syntax
- Vite handles module resolution

### Chakra UI 3 Changes
- `useToast` → `createToaster`
- `spacing` → `gap` 
- `isDisabled` → `disabled`
- No `leftIcon` prop, use children instead

## Future Considerations

- **Performance**: Virtual scrolling for many segments
- **Offline**: Enhanced service worker caching
- **Features**: Multi-select editing, batch operations
- **Accessibility**: ARIA labels, screen reader support
- **Testing**: Unit and integration test setup
- **i18n**: Internationalization support

This guide provides comprehensive context for LLMs working with the modernized React-based LQA Boss application.