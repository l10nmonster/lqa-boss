# LQA Boss - Modern React Edition

A modern, glassmorphic viewer and editor for LQA Boss (.lqaboss) files, built with React, Chakra UI, and Lexical.

## Features

- **Modern Tech Stack**: Built with React 19, TypeScript, Chakra UI, and Lexical editor
- **Glassmorphic Design**: Beautiful, modern UI with glass-like effects and smooth animations
- **Rich Text Editing**: Powered by Meta's Lexical editor framework
- **Original Size Screenshots**: Images display at their native resolution for better readability and accurate overlay positioning
- **Resizable Split View**: Drag to adjust the space between screenshot and text editor
- **Integrated Navigation**: Page navigation controls overlaid on the screenshot viewer to save space
- **Full-Screen Interface**: Uses entire screen width for maximum workspace
- **Keyboard Navigation**: Navigate between segments and pages using Tab/Shift+Tab and Ctrl+Arrow keys
- **Visual Feedback**: Color-coded segments (green for unmodified, red for modified, blue for active)
- **Google Cloud Storage Integration**: Direct file loading and saving from/to GCS buckets with OAuth2 authentication
- **URL-Driven GCS Access**: Automatic file loading via GCS URLs with persistent authentication
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

### Local Mode
1. Click "Load .lqaboss File" to select a file from your computer
2. Navigate between pages using the arrow buttons overlaid on the screenshot or Ctrl+Left/Right
3. Drag the vertical divider between screenshot and editor to adjust the split
4. Click on highlighted segments in the screenshot to jump to that text
5. Edit text in the Lexical editor on the right
6. Use Tab/Shift+Tab to navigate between segments
7. Click "Save Changes" to download a JSON file with all modifications

### Google Cloud Storage Mode
Access files directly from GCS buckets using URL patterns:

**Load Specific File:**
```
http://localhost:3000/lqa-boss/gcs/<bucket>/<prefix>/<filename>.lqaboss
```

**Browse Files in Bucket:**
```
http://localhost:3000/lqa-boss/gcs/<bucket>/<prefix>/
```

**First-time Setup:**
1. Enter your Google OAuth2 Client ID (saved permanently)
2. Sign in to Google (tokens saved with expiry)
3. Files load automatically with saved credentials

**GCS Features:**
- Automatic file loading from GCS URLs
- Persistent authentication (no repeated sign-ins)
- Direct saving to GCS buckets
- File browser for bucket contents
- Smart token expiration handling

## UI Layout

The app features a modern, space-efficient layout:
- **Full-width interface**: Uses the entire screen width for maximum workspace
- **Resizable panes**: Drag the divider between screenshot and editor to customize your view
- **Integrated controls**: Navigation buttons are overlaid on the screenshot to save vertical space
- **Smart scrolling**: Screenshots display at their native resolution with automatic scrollbars when needed

## Keyboard Shortcuts

- **Tab**: Next segment
- **Shift+Tab**: Previous segment
- **CMD+Enter** (Mac) / **Ctrl+Enter** (Windows): Next segment
- **Ctrl+Left**: Previous page
- **Ctrl+Right**: Next page

## File Format

The app works with .lqaboss files, which are ZIP archives containing:
- `job.json`: Translation units with normalized source/target text
- `flow_metadata.json`: (Optional) Metadata about pages and text segments for screenshot mode
- Image files: Screenshots referenced in the metadata (when flow_metadata.json exists)

### Data Structure
- **Translation Units**: Core editing elements with source (`nsrc`) and target (`ntgt`) normalized text arrays
- **Normalized Text**: Supports strings and placeholders for HTML tags and variables
- **Dual Mode**: Screenshot mode (with flow metadata) or text-only mode (job data only)

## Technologies Used

- **React 19.1.0**: Latest React with improved performance and features
- **TypeScript 5.4**: Type safety and modern JavaScript features
- **Chakra UI 3.21.0**: Next-generation component library with modern design system
- **Lexical 0.32.1**: Meta's latest extensible text editor framework
- **Vite 6.3.5**: Ultra-fast build tool with enhanced bundling capabilities
- **JSZip 3.10**: ZIP file handling
- **Framer Motion 12.18**: Advanced animations and gestures
- **Google Identity Services**: OAuth2 authentication for GCS access
- **Google Cloud Storage JSON API**: Direct browser-based file operations

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

## Google Cloud Storage Setup

### Prerequisites for GCS Integration

1. **Google Cloud Project**: Create or use existing GCP project
2. **OAuth2 Client ID**: Create web application credentials in Google Cloud Console
   - Go to APIs & Credentials → OAuth 2.0 Client IDs
   - Add your domain to authorized origins (e.g., `https://yourdomain.github.io`)
3. **GCS Bucket**: Create bucket with appropriate permissions
4. **CORS Configuration**: Configure bucket for browser access

### CORS Configuration Example
```bash
gsutil cors set cors.json gs://your-bucket-name
```

Where `cors.json` contains:
```json
[
  {
    "origin": ["https://yourdomain.github.io", "http://localhost:3000"],
    "method": ["GET", "PUT", "POST", "DELETE"],
    "responseHeader": ["*"],
    "maxAgeSeconds": 3600
  }
]
```

### IAM Permissions
Ensure your Google account has:
- `storage.objects.get` (read files)
- `storage.objects.create` (save files)
- `storage.objects.list` (browse files)

## License

[Original License]
