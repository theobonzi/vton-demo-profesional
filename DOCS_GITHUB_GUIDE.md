# Guide Documentation GitHub

## 🎯 Objectif
Déployer proprement la documentation sur GitHub Pages avec une interface professionnelle.

## 🚀 Méthode 1: GitHub Pages avec MkDocs (Recommandée)

### Étape 1: Préparer le repository GitHub

1. **Créer le repository sur GitHub**:
   - Nom: `vton-demo-professional`
   - Description: `Virtual Try-On Demo Professional - Modern virtual fitting application`
   - Public ou Privé selon vos besoins

2. **Connecter le repository local**:
   ```bash
   # Ajouter le remote GitHub
   git remote add origin https://github.com/YOUR_USERNAME/vton-demo-professional.git
   
   # Pousser le code
   git push -u origin main
   ```

### Étape 2: Configurer GitHub Pages

1. **Aller dans Settings** du repository GitHub
2. **Scroller vers "Pages"** dans le menu de gauche
3. **Source**: Sélectionner "Deploy from a branch"
4. **Branch**: Sélectionner "gh-pages"
5. **Folder**: Sélectionner "/ (root)"
6. **Cliquer "Save"**

### Étape 3: Déployer la documentation

```bash
# Installer MkDocs (si pas déjà fait)
pip install mkdocs mkdocs-material mkdocs-git-revision-date-localized-plugin

# Déployer automatiquement
./deploy-docs-github.sh
```

**Résultat**: Documentation disponible à `https://YOUR_USERNAME.github.io/vton-demo-professional/`

## 🔧 Méthode 2: Déploiement manuel

### Option A: Avec MkDocs

```bash
# Construire le site
mkdocs build

# Déployer sur GitHub Pages
mkdocs gh-deploy

# Vérifier le déploiement
git push origin gh-pages
```

### Option B: Avec GitHub Actions (Automatique)

Créer `.github/workflows/docs.yml`:

```yaml
name: Deploy Documentation

on:
  push:
    branches: [ main ]
    paths: [ 'docs/**', 'mkdocs.yml' ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.x'
    
    - name: Install dependencies
      run: |
        pip install mkdocs mkdocs-material
    
    - name: Deploy to GitHub Pages
      uses: mhausenblas/mkdocs-deploy-gh-pages@master
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## 📋 Configuration MkDocs optimisée

### mkdocs.yml (déjà configuré)

```yaml
site_name: VTON Demo Professional
site_description: Virtual Try-On Demo Professional Documentation
site_author: Development Team
site_url: https://YOUR_USERNAME.github.io/vton-demo-professional/

theme:
  name: material
  palette:
    - scheme: default
      primary: blue
      accent: blue
      toggle:
        icon: material/brightness-7
        name: Switch to dark mode
    - scheme: slate
      primary: blue
      accent: blue
      toggle:
        icon: material/brightness-4
        name: Switch to light mode
  features:
    - navigation.tabs
    - navigation.sections
    - navigation.expand
    - navigation.path
    - navigation.top
    - search.highlight
    - search.share
    - content.code.copy
    - content.code.annotate

nav:
  - Home: README.md
  - API Documentation: API.md
  - Backend: backend/README.md
  - Frontend: frontend/README.md
  - Deployment: DEPLOYMENT.md

plugins:
  - search
  - git-revision-date-localized:
      enable_creation_date: true

markdown_extensions:
  - pymdownx.highlight:
      anchor_linenums: true
  - pymdownx.inlinehilite
  - pymdownx.superfences
  - pymdownx.tabbed:
      alternate_style: true
  - tables
  - toc:
      permalink: true
```

## 🎨 Personnalisation avancée

### Ajouter un logo

```yaml
theme:
  logo: assets/logo.png
  favicon: assets/favicon.ico
```

### Ajouter des liens sociaux

```yaml
extra:
  social:
    - icon: fontawesome/brands/github
      link: https://github.com/YOUR_USERNAME
    - icon: fontawesome/brands/twitter
      link: https://twitter.com/YOUR_USERNAME
```

### Ajouter des analytics

```yaml
extra:
  analytics:
    provider: google
    property: G-XXXXXXXXXX
```

## 🔄 Workflow de mise à jour

### Mise à jour simple

```bash
# 1. Modifier les fichiers dans docs/
# 2. Committer les changements
git add docs/
git commit -m "Update documentation"

# 3. Déployer
./deploy-docs-github.sh

# 4. Pousser les changements
git push origin main
```

### Mise à jour avec GitHub Actions

1. **Modifier les fichiers** dans `docs/`
2. **Committer et pousser**:
   ```bash
   git add docs/
   git commit -m "Update documentation"
   git push origin main
   ```
3. **GitHub Actions** déploie automatiquement

## 📊 Résultat final

### Interface professionnelle avec :
- ✅ **Design Material** moderne
- ✅ **Navigation intuitive** avec onglets
- ✅ **Recherche intégrée** dans toute la documentation
- ✅ **Thème sombre/clair** automatique
- ✅ **Responsive design** pour mobile/desktop
- ✅ **Copie de code** en un clic
- ✅ **Liens permanents** vers les sections
- ✅ **Mise à jour automatique** avec Git

### URL finale :
`https://YOUR_USERNAME.github.io/vton-demo-professional/`

## 🛠️ Dépannage

### Problème: "gh-pages branch not found"
```bash
# Créer la branche gh-pages
git checkout --orphan gh-pages
git rm -rf .
git commit --allow-empty -m "Initial gh-pages commit"
git push origin gh-pages
git checkout main
```

### Problème: "Permission denied"
```bash
# Vérifier les permissions GitHub Pages
# Settings > Pages > Source: gh-pages branch
```

### Problème: "Site not updating"
```bash
# Forcer le déploiement
mkdocs gh-deploy --force
```

## 🎯 Checklist finale

- [ ] Repository GitHub créé
- [ ] Code poussé vers GitHub
- [ ] GitHub Pages activé
- [ ] MkDocs installé
- [ ] Documentation déployée
- [ ] Site accessible en ligne
- [ ] Navigation fonctionnelle
- [ ] Recherche opérationnelle
- [ ] Thème sombre/clair actif

Votre documentation sera maintenant **professionnelle et accessible en ligne** ! 🚀
