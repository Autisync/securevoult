#!/bin/bash

# Password Manager Extension Packaging Script

echo "🔐 Packaging Password Manager Browser Extension..."

# Create extension directory
mkdir -p extension-package
mkdir -p extension-package/icons

# Copy manifest and core files
cp manifest.json extension-package/
cp public/popup.html extension-package/
cp public/options.html extension-package/
cp public/background.js extension-package/
cp public/content.js extension-package/
cp public/popup.js extension-package/

# Create simple icons (you can replace these with actual icon files)
echo "Creating placeholder icons..."

# Create a simple SVG icon and convert to different sizes
cat > extension-package/icons/icon.svg << 'EOF'
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" rx="20" fill="#007bff"/>
  <path d="M32 64c0-17.673 14.327-32 32-32s32 14.327 32 32v8h8c4.418 0 8 3.582 8 8v32c0 4.418-3.582 8-8 8H24c-4.418 0-8-3.582-8-8V80c0-4.418 3.582-8 8-8h8v-8zm16 8h32v-8c0-8.837-7.163-16-16-16s-16 7.163-16 16v8z" fill="white"/>
</svg>
EOF

# Copy CSS and build files (simplified for extension)
echo "Copying styles..."
cp src/app/globals.css extension-package/

# Create installation instructions
cat > extension-package/INSTALL.md << 'EOF'
# Password Manager Extension Installation

## Chrome/Edge Installation:
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" button
4. Select this extension-package folder
5. The Password Manager icon will appear in your toolbar

## Firefox Installation:
1. Open Firefox and navigate to `about:debugging`
2. Click "This Firefox" in the sidebar
3. Click "Load Temporary Add-on"
4. Select the manifest.json file from this folder

## Usage:
- Click the extension icon to access your passwords
- Right-click on password fields for quick access
- Use Ctrl+Shift+F (Cmd+Shift+F on Mac) to auto-fill
- Use Ctrl+Shift+P (Cmd+Shift+P on Mac) to open vault

## Vault Connection:
Your vault URL: https://d96a06d6-daf6-47a0-ab15-218359be77dd.canvases.tempo.build

The extension will automatically sync with your shared vaults and team passwords.
EOF

# Create package info
cat > extension-package/package-info.json << 'EOF'
{
  "name": "Password Manager Extension",
  "version": "1.0.0",
  "description": "Zero-knowledge password manager with team sharing",
  "author": "Password Manager Team",
  "homepage": "https://d96a06d6-daf6-47a0-ab15-218359be77dd.canvases.tempo.build",
  "features": [
    "Zero-knowledge encryption",
    "Team password sharing", 
    "Auto-fill functionality",
    "Cross-platform sync",
    "Secure vault access"
  ],
  "permissions_explained": {
    "storage": "Store encrypted vault data locally",
    "activeTab": "Access current tab for auto-fill",
    "tabs": "Open vault in new tab",
    "contextMenus": "Add right-click menu options",
    "scripting": "Inject auto-fill scripts"
  }
}
EOF

echo "✅ Extension package created in 'extension-package' directory"
echo ""
echo "📦 Package Contents:"
echo "   - manifest.json (Extension configuration)"
echo "   - popup.html/js (Extension popup interface)"
echo "   - background.js (Background service worker)"
echo "   - content.js (Page interaction script)"
echo "   - options.html (Extension options page)"
echo "   - INSTALL.md (Installation instructions)"
echo ""
echo "🚀 To install:"
echo "   1. Open Chrome and go to chrome://extensions/"
echo "   2. Enable Developer mode"
echo "   3. Click 'Load unpacked' and select the 'extension-package' folder"
echo ""
echo "🔗 Vault URL: https://d96a06d6-daf6-47a0-ab15-218359be77dd.canvases.tempo.build"