# LQA Boss - Modern React Edition

A modern, glassmorphic viewer and editor for LQA Boss (.lqaboss) files, built with React, Chakra UI, and Lexical.

## Features

- **Modern Tech Stack**: Built with React 19, TypeScript, Chakra UI, and Lexical editor
- **Glassmorphic Design**: Beautiful, modern UI with glass-like effects and smooth animations
- **Rich Text Editing**: Powered by Meta's Lexical editor framework
- **Keyboard Navigation**: Navigate between segments and pages using Tab/Shift+Tab and Ctrl+Arrow keys
- **Visual Feedback**: Color-coded segments (green for unmodified, red for modified, blue for active)
- **PWA Support**: Works as a Progressive Web App with file association support
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Future-Ready**: Using React 19, Chakra UI 3, Lexical 0.32, Framer Motion 12, and Vite 6 for cutting-edge performance

## Getting Started

### Prerequisites

- Node.js 16+ and npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Usage

1. Click "Load .lqaboss File" to select a file
2. Navigate between pages using the arrow buttons or Ctrl+Left/Right
3. Click on highlighted segments in the screenshot to jump to that text
4. Edit text in the Lexical editor on the right
5. Use Tab/Shift+Tab to navigate between segments
6. Click "Save Changes" to download a JSON file with all modifications

## Keyboard Shortcuts

- **Tab**: Next segment
- **Shift+Tab**: Previous segment
- **Ctrl+Left**: Previous page
- **Ctrl+Right**: Next page

## File Format

The app works with .lqaboss files, which are ZIP archives containing:
- `flow_metadata.json`: Metadata about pages and text segments
- Image files: Screenshots referenced in the metadata

## Technologies Used

- **React 19.1.0**: Latest React with improved performance and features
- **TypeScript 5.4**: Type safety and modern JavaScript features
- **Chakra UI 3.21.0**: Next-generation component library with modern design system
- **Lexical 0.32.1**: Meta's latest extensible text editor framework
- **Vite 6.3.5**: Ultra-fast build tool with enhanced bundling capabilities
- **JSZip 3.10**: ZIP file handling
- **Framer Motion 12.18**: Advanced animations and gestures

## GitHub Pages Deployment

The project includes a GitHub Actions workflow for automatic deployment to GitHub Pages:

1. **Enable GitHub Pages** in your repository settings:
   - Go to Settings → Pages
   - Source: Deploy from GitHub Actions

2. **Push to main branch** to trigger deployment:
   ```bash
   git add .
   git commit -m "Deploy to GitHub Pages"
   git push origin main
   ```

3. **Access your site** at: `https://[your-username].github.io/lqa-boss/`

The workflow automatically:
- Builds the React app
- Uploads artifacts
- Deploys to GitHub Pages
- Handles service worker and PWA manifest paths

## License

[Original License]
