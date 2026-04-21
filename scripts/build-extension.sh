#!/bin/bash

# Build script for browser extension

echo "🔧 Building Password Manager Extension..."

# Set environment for extension build
export BUILD_TARGET=extension

# Build the Next.js app for static export
echo "📦 Building Next.js app..."
npm run build

# Create extension directory
echo "📁 Creating extension directory..."
mkdir -p extension

# Copy built files
echo "📋 Copying built files..."
cp -r out/* extension/
cp manifest.json extension/
cp -r public/icons extension/ 2>/dev/null || echo "⚠️  Icons directory not found, skipping..."

# Copy extension-specific files
cp public/popup.html extension/
cp public/background.js extension/
cp public/content.js extension/

# Create popup.js that loads the React app
echo "⚛️  Creating popup.js..."
cat > extension/popup.js << 'EOF'
// Load the React app in the popup
document.addEventListener('DOMContentLoaded', function() {
  // The popup.html will load the built React app
  console.log('Password Manager Extension loaded');
});
EOF

# Create options.html that points to the main app
echo "🔧 Creating options.html..."
cat > extension/options.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Password Manager - Options</title>
    <style>
        body { margin: 0; padding: 0; }
        iframe { width: 100vw; height: 100vh; border: none; }
    </style>
</head>
<body>
    <iframe src="index.html"></iframe>
</body>
</html>
EOF

# Update popup.html to load the React app
echo "🔄 Updating popup.html..."
cat > extension/popup.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Manager</title>
    <style>
        body {
            width: 400px;
            height: 600px;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        iframe {
            width: 100%;
            height: 100%;
            border: none;
        }
    </style>
</head>
<body>
    <iframe src="index.html"></iframe>
</body>
</html>
EOF

echo "✅ Extension built successfully!"
echo "📦 Extension files are in the 'extension' directory"
echo "🚀 Load the extension in Chrome by:"
echo "   1. Go to chrome://extensions/"
echo "   2. Enable 'Developer mode'"
echo "   3. Click 'Load unpacked' and select the 'extension' directory"