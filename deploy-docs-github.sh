#!/bin/bash

# Deploy Documentation to GitHub Pages
echo "🚀 Deploying VTON Demo Professional Documentation to GitHub Pages..."

# Check if mkdocs is installed
if ! command -v mkdocs &> /dev/null; then
    echo "📦 Installing MkDocs and Material theme..."
    pip install mkdocs mkdocs-material mkdocs-git-revision-date-localized-plugin
fi

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Not in a git repository. Please run 'git init' first."
    exit 1
fi

# Check if we have a remote origin
if ! git remote get-url origin &> /dev/null; then
    echo "❌ No remote origin found. Please add your GitHub repository:"
    echo "   git remote add origin https://github.com/YOUR_USERNAME/vton-demo-professional.git"
    exit 1
fi

echo "🔨 Building documentation site..."
mkdocs build

if [ $? -eq 0 ]; then
    echo "✅ Documentation built successfully!"
    echo ""
    echo "📤 Deploying to GitHub Pages..."
    mkdocs gh-deploy
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 Documentation deployed successfully!"
        echo ""
        echo "🌐 Your documentation is now available at:"
        echo "   https://$(git remote get-url origin | sed 's/.*github.com[:/]\([^/]*\)\/\([^.]*\).*/\1.github.io\/\2/')"
        echo ""
        echo "📝 To update documentation:"
        echo "   1. Make changes to docs/ files"
        echo "   2. Run: ./deploy-docs-github.sh"
        echo "   3. Changes will be live in a few minutes"
    else
        echo "❌ Deployment failed. Check your GitHub repository settings."
    fi
else
    echo "❌ Build failed. Check your mkdocs.yml configuration."
fi
