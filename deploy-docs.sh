#!/bin/bash

# Deploy Documentation Script
echo "🚀 Deploying VTON Demo Professional Documentation..."

# Check if mkdocs is installed
if ! command -v mkdocs &> /dev/null; then
    echo "📦 Installing MkDocs..."
    pip install mkdocs mkdocs-material
fi

# Build the documentation site
echo "🔨 Building documentation site..."
mkdocs build

# Check if we're in a git repository
if [ -d ".git" ]; then
    echo "�� Documentation built successfully!"
    echo ""
    echo "🌐 To deploy online, you can:"
    echo "1. Push to GitHub and enable GitHub Pages"
    echo "2. Use mkdocs gh-deploy for automatic deployment"
    echo "3. Upload the 'site' folder to any web server"
    echo ""
    echo "📁 Built files are in the 'site' directory"
    echo "🔍 Preview locally with: mkdocs serve"
else
    echo "📁 Documentation built in 'site' directory"
    echo "🔍 Preview with: mkdocs serve"
fi

echo ""
echo "✅ Documentation deployment ready!"
