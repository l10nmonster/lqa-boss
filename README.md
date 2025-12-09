# LQA Boss - Modern React Edition

A modern, glassmorphic viewer and editor for LQA Boss (.lqaboss) files, built with React, Chakra UI, and Lexical.

## Features

- **Modern Tech Stack**: Built with React 19, TypeScript, Chakra UI, and Lexical editor
- **Glassmorphic Design**: Beautiful, modern UI with glass-like effects and smooth animations
- **Rich Text Editing**: Powered by Meta's Lexical editor framework with advanced features
- **Smart File Status Tracking**: Real-time status badges (NEW, SAVED, CHANGED, LOADED) with intelligent state management
- **Modal-Based File Loading**: Centered modal dialogs with blurred backgrounds for professional GCS file selection
- **Real-Time Search & Filtering**: Advanced filtering system with customizable field selection and instant results
- **Original Size Screenshots**: Images display at their native resolution for better readability and accurate overlay positioning
- **Resizable Split View**: Drag to adjust the space between screenshot and text editor
- **Integrated Navigation**: Page navigation controls overlaid on the screenshot viewer to save space
- **Full-Screen Interface**: Uses entire screen width for maximum workspace
- **Keyboard Navigation**: Navigate between segments and pages using Tab/Shift+Tab and Ctrl+Arrow keys
- **Visual Feedback**: Color-coded segments (green for unmodified, red for modified, blue for active)
- **Streamlined Menu System**: Consolidated GCS operations in archive icon dropdown with cloud-based icons
- **Google Cloud Storage Integration**: Direct file loading and saving from/to GCS buckets with OAuth2 authentication
- **URL-Driven GCS Access**: Automatic file loading via GCS URLs with persistent authentication
- **Performance Optimizations**: Reduced editor lag, prevented unnecessary status changes, and optimized re-renders
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
5. **Use the search filter** to quickly find specific segments by typing in the filter box or pressing Cmd+K
6. **Customize filter fields** using the sliders menu to search in source, target, notes, or IDs
7. Edit text in the Lexical editor on the right
8. Use CMD+Enter (Mac) / Ctrl+Enter (Windows) to navigate to the next segment
9. Click "Save Changes" to download a JSON file with all modifications
10. Monitor file status via the colored badge in the header (NEW/SAVED/CHANGED/LOADED)

### Google Cloud Storage Mode
Access files directly from GCS buckets using URL patterns:

**Load Specific File:**
```
http://localhost:3000/gcs/<bucket>/<prefix>/<filename>.lqaboss
```

**Browse Files in Bucket:**
```
http://localhost:3000/gcs/<bucket>/<prefix>/
```

**First-time Setup:**
1. Enter your Google OAuth2 Client ID (saved permanently)
2. Sign in to Google (tokens saved with expiry)
3. Files load automatically with saved credentials

**GCS Operations:**
- **Archive Menu**: Click the archive icon (📁) to access GCS operations
- **Load Job**: Opens a centered modal to browse and select .lqaboss files
- **Save Job**: Saves current changes to GCS bucket
- **Sign Out**: Clear authentication (grayed out when not signed in)
- **Modal File Browser**: Professional file picker with status badges (DONE/WIP)
- **Automatic Loading**: Files load automatically with saved credentials
- **Smart Authentication**: Persistent tokens with automatic expiration handling

## UI Layout

The app features a modern, space-efficient layout with intelligent status tracking:

### Header Elements
- **Status Badge**: Real-time file status indicator with 4 states:
  - 🔵 **NEW**: Fresh file, no changes made
  - 🟢 **SAVED**: All changes saved to storage
  - 🔴 **CHANGED**: Unsaved modifications present
  - 🟡 **LOADED**: File loaded with existing saved changes
- **Archive Menu**: Dropdown with GCS operations (📁 icon)
- **Instructions Button**: Shows job instructions when available (ℹ️ icon)

### Editor Panel Controls
- **Search Filter**: Real-time text filter with keyboard shortcut (Cmd+K/Ctrl+K)
- **Filter Settings Menu**: Customizable field selection (⚙️ sliders icon)
- **Segment Navigation**: CMD+Enter (Mac) / Ctrl+Enter (Windows) for moving to next segment

### Layout Features
- **Full-width interface**: Uses the entire screen width for maximum workspace
- **Resizable panes**: Drag the divider between screenshot and editor to customize your view
- **Integrated controls**: Navigation buttons are overlaid on the screenshot to save vertical space
- **Smart scrolling**: Screenshots display at their native resolution with automatic scrollbars when needed
- **Modal Dialogs**: Centered modals with blurred backgrounds for file operations
- **Responsive Design**: Adapts to different screen sizes with mobile-friendly controls

## Keyboard Shortcuts

- **CMD+Enter** (Mac) / **Ctrl+Enter** (Windows): Next segment
- **Ctrl+Left**: Previous page
- **Ctrl+Right**: Next page
- **CMD+K** (Mac) / **Ctrl+K** (Windows): Focus search filter

## Advanced Filtering System

The app includes a powerful real-time filtering system for both screenshot and text-only modes:

### Filter Interface
- **Search Input**: Located in the top-right corner of the editor panel
- **Filter Settings Menu**: Click the sliders icon (⚙️) to customize searchable fields
- **Real-Time Results**: Segments are filtered instantly as you type
- **Keyboard Shortcut**: Use `Cmd+K` (Mac) or `Ctrl+K` (Windows) to quickly focus the search

### Searchable Fields
Configure which fields to include in your search via the filter settings menu:

- ✅ **Source**: Search in source text content
- ✅ **Target**: Search in target/translated text content  
- ✅ **Notes**: Search in segment notes and descriptions
- ✅ **RID**: Search by Resource ID numbers
- ✅ **SID**: Search by Segment ID numbers
- ✅ **GUID**: Search by unique segment identifiers

### Filter Behavior
- **Case-Insensitive**: All searches ignore letter case
- **Partial Matching**: Matches any text containing your search term
- **Multi-Field**: Search across multiple selected fields simultaneously  
- **Smart Navigation**: Active segment auto-deselects when filtered out
- **Preserve Context**: Filter persists across page navigation in screenshot mode

## File Format

The app works with .lqaboss files, which are ZIP archives containing:
- `job.json`: Translation units with normalized source/target text
- `flow_metadata.json`: (Optional) Metadata about pages and text segments for screenshot mode
- Image files: Screenshots referenced in the metadata (when flow_metadata.json exists)

### Data Structure
- **Translation Units**: Core editing elements with source (`nsrc`) and target (`ntgt`) normalized text arrays
- **Normalized Text**: Supports strings and placeholders for HTML tags and variables
- **Dual Mode**: Screenshot mode (with flow metadata) or text-only mode (job data only)
- **State Management**: Three-state system tracking original, saved, and current versions for accurate change detection
- **Smart Exports**: Only exports changed translation units to optimize file sizes and performance

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

3. **Access your site** at: `https://lqaboss.l10n.monster/`

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

## Google Drive Setup for External Users

If you're accessing LQA Boss files shared by another organization and cannot use their OAuth Client ID, you can create your own.

### Step 1: Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown (top left) → **New Project**
3. Name it (e.g., "LQA Boss") → **Create**

### Step 2: Enable Google Drive API
1. Go to **APIs & Services** → **Library**
2. Search for **"Google Drive API"**
3. Click it → **Enable**

### Step 3: Configure OAuth Consent Screen
1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** → **Create**
3. Fill in required fields:
   - App name: "LQA Boss"
   - User support email: your email
   - Developer contact email: your email
4. Click **Save and Continue**
5. On **Scopes** page, click **Add or Remove Scopes**
   - Add: `https://www.googleapis.com/auth/drive`
   - Click **Update** → **Save and Continue**
6. On **Test users** page, add your email → **Save and Continue**
7. Click **Back to Dashboard**

### Step 4: Create OAuth Client ID
1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: "LQA Boss Web"
5. Under **Authorized JavaScript origins**, add:
   - `https://lqaboss.l10n.monster` (production)
   - `http://localhost:3000` (local development)
6. Click **Create**
7. Copy the **Client ID** (format: `123456789-xxx.apps.googleusercontent.com`)

### Step 5: Use in LQA Boss
1. Open LQA Boss
2. Go to **Settings** (gear icon)
3. Find **Google Drive** section
4. Paste your Client ID
5. Authenticate when prompted

> **Note**: With an "External" app in testing mode, only emails listed as test users can authenticate. You don't need Google verification for personal use.

## License

[Original License]
