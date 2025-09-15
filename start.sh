#!/bin/bash

echo "🚀 Démarrage de VTON Demo Professional..."

# Vérifier si Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé. Veuillez installer Docker d'abord."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose n'est pas installé. Veuillez installer Docker Compose d'abord."
    exit 1
fi

# Vérifier si le fichier .env existe
if [ ! -f .env ]; then
    echo "⚠️  Fichier .env manquant. Copie de .env.example..."
    cp .env.example .env
    echo "📝 Veuillez éditer le fichier .env avec vos clés API avant de continuer."
    echo "   - FASHN_API_KEY=votre_cle_fashn"
    echo "   - GEMINI_API_KEY=votre_cle_gemini"
    echo "   - SECRET_KEY=votre-secret-jwt"
    exit 1
fi

# Construire et démarrer les services
echo "🔨 Construction des images Docker..."
docker-compose build

echo "🚀 Démarrage des services..."
docker-compose up -d

echo "⏳ Attente du démarrage des services..."
sleep 10

# Vérifier le statut des services
echo "📊 Statut des services:"
docker-compose ps

echo ""
echo "✅ Application démarrée avec succès!"
echo ""
echo "🌐 Accès à l'application:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:8000"
echo "   Documentation API: http://localhost:8000/docs"
echo ""
echo "📝 Pour voir les logs:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 Pour arrêter l'application:"
echo "   docker-compose down"
