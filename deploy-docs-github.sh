#!/bin/bash

# Deploy Documentation to GitHub Pages
echo "🚀 Deploying VTON Demo Professional Documentation to GitHub Pages..."

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

# Setup virtual environment if it doesn't exist
if [ ! -d "docs-env" ]; then
    echo "📦 Creating virtual environment for documentation..."
    python3 -m venv docs-env
    source docs-env/bin/activate
    pip install mkdocs mkdocs-material
else
    echo "🔧 Activating existing virtual environment..."
    source docs-env/bin/activate
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
        echo "   Make sure GitHub Pages is enabled in repository Settings > Pages"
    fi
else
    echo "❌ Build failed. Check your mkdocs.yml configuration."
fi
