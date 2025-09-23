# 📋 Schéma complet du flux Virtual Try-On

Ce document décrit le flux complet de l'application d'essayage virtuel, depuis la sélection des produits jusqu'à l'affichage des résultats.

## 🎯 **1. GALERIE → "Continuer"**

**Fichier:** `frontend/src/pages/ProductSelection.tsx`

### Fonctions clés:
```typescript
// ProductSelection.tsx:67-96
handleProductSelect(productId: number) → sélection/désélection produits
handleContinue() → préparation productConfigs + navigation
```

### Flux:
1. L'utilisateur sélectionne des produits dans la galerie
2. `handleProductSelect()` met à jour `selectedProducts[]`
3. `handleContinue()` prépare les `productConfigs` avec métadonnées
4. Navigation vers `/selfie-capture` avec état partagé

### Données transmises:
```javascript
navigate("/selfie-capture", {
  state: { 
    selectedProducts: [1001, 1002], 
    productConfigs: [
      { id, name, brand, price, displayImage, apiImage }
    ]
  }
})
```

---

## 📸 **2. UPLOAD IMAGE → "Continuer"**

**Fichier:** `frontend/src/pages/SelfieCapture.tsx`

### Fonctions clés:
```typescript
// SelfieCapture.tsx:19-56
handleFileUpload(event) → lecture fichier via FileReader
handleCapture() → capture webcam via canvas
handleContinue() → navigation avec image
```

### Flux:
1. **Option A - Upload:** `fileInputRef.click()` → `FileReader.readAsDataURL()`
2. **Option B - Capture:** `videoRef` → `canvas.drawImage()` → `toDataURL('image/jpeg')`
3. `setCapturedImage()` stocke l'image en base64
4. `handleContinue()` navigue vers `/loading`

### Données transmises:
```javascript
navigate("/loading", {
  state: {
    selectedProducts,
    productConfigs,
    personImage: "data:image/jpeg;base64,..."
  }
})
```

---

## ⏳ **3. ÉCRAN DE CHARGEMENT**

**Fichier:** `frontend/src/pages/LoadingScreen.tsx`

### Fonctions clés:
```typescript
// LoadingScreen.tsx:21-95
startTryOn() → orchestration complète du try-on
createTryOn(tryOnRequest) → appel API initial
waitForTryOnCompletion(sessionId) → polling status
```

### Flux:
1. **Validation:** Vérification `personImage` + `selectedProducts`
2. **Préparation:** Construction `tryOnRequest` avec metadata
3. **Initiation:** `createTryOn()` → création session backend
4. **Attente:** `waitForTryOnCompletion()` → polling toutes les 2s
5. **Navigation:** Vers `/virtual-fitting` avec résultats

### Structure de requête:
```typescript
const tryOnRequest = {
  person_image_url: personImage,      // Base64 image
  product_ids: selectedProducts,      // [1001, 1002]
  products_info: [{                   // Metadata produits
    id: 1001,
    name: "Produit 1",
    price: "59.99 €",
    image_url: "/src/save_images2/img_000_0568.png"
  }],
  session_id: `session_${Date.now()}` // ID unique
};
```

---

## 🔄 **4. APPELS API FRONTEND**

**Fichier:** `frontend/src/services/tryOnService.ts`

### Fonctions clés:
```typescript
// tryOnService.ts:41-67
createTryOn(request: TryOnRequest) → POST /api/v1/tryon/
getTryOnStatus(sessionId: string) → GET /api/v1/tryon/{sessionId}/status/
waitForTryOnCompletion(sessionId, maxAttempts=10, delay=2000) → polling loop
```

### Interface de données:
```typescript
interface TryOnRequest {
  person_image_url: string;
  product_ids: number[];
  products_info?: ProductInfo[];
  session_id?: string;
}

interface TryOnResponse {
  session_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message: string;
  results?: Record<string, TryOnResult>;
}
```

### Logique polling:
- **Tentatives:** 10 maximum
- **Délai:** 2 secondes entre chaque vérification
- **Timeout:** 20 secondes total
- **Statuts:** `pending` → `processing` → `completed`

---

## 🏗️ **5. TRAITEMENT BACKEND**

**Fichier:** `backend/app/api/tryon.py`

### Endpoints:
```python
# tryon.py:16-39
POST /api/v1/tryon/ → create_try_on()
GET /api/v1/tryon/{session_id}/status/ → get_try_on_status()
POST /api/v1/tryon/send-summary → send_tryon_summary()
```

### Fonctions principales:
```python
# tryon.py:16-39
create_try_on(request: TryOnRequest) → création session + traitement async
simulate_try_on_processing(session_id, request) → simulation traitement
get_try_on_status(session_id) → retour résultats

# tryon.py:95-147  
session_storage[session_id] → stockage temporaire en mémoire
fake_results → génération résultats simulés avec images produits
```

### Stockage session:
```python
session_storage[session_id] = {
    "product_ids": [1001, 1002],
    "products_info": [ProductInfo],
    "person_image_url": "data:image/jpeg;base64...",
    "created_at": timestamp
}
```

### Génération résultats:
```python
fake_results[f"product_{product_id}"] = {
    "product_id": product_id,
    "product_name": product_info.name,
    "result_image": product_info.image_url,  # Image produit comme résultat
    "status": "success"
}
```

---

## 🎨 **6. AFFICHAGE RÉSULTATS**

**Fichier:** `frontend/src/pages/VirtualFitting.tsx`

### Fonctions clés:
```typescript
// VirtualFitting.tsx:10-101
handleLike(productId) → gestion favoris
handleDownload(imageUrl, productName) → téléchargement résultat
handleShare(imageUrl) → partage via Web Share API
sendSummaryEmail() → envoi résumé par email
```

### Interface utilisateur:
- **Galerie:** Grille responsive des résultats d'essayage
- **Interactions:** Like/Unlike, Download, Share par produit
- **Plein écran:** Click sur image → modal fullscreen
- **Email:** Formulaire envoi résumé avec liste produits
- **Session:** Affichage ID session pour debug

### Données reçues:
```javascript
const { selectedProducts, productConfigs, personImage, results, sessionId } = location.state;

// results format:
[
  {
    product_id: 1001,
    product_name: "Produit 1",
    result_image: "/src/save_images2/img_000_0568.png",
    status: "success"
  }
]
```

---

## 🔗 **FLUX COMPLET RÉSUMÉ**

```
1. ProductSelection.tsx:handleContinue()
    ↓ navigate("/selfie-capture", { selectedProducts, productConfigs })
    
2. SelfieCapture.tsx:handleContinue()
    ↓ navigate("/loading", { personImage })
    
3. LoadingScreen.tsx:startTryOn()
    ↓ createTryOn(tryOnRequest)
    
4. tryOnService.ts:createTryOn()
    ↓ POST /api/v1/tryon/
    
5. tryon.py:create_try_on()
    ↓ session_storage + simulate_try_on_processing()
    
6. LoadingScreen.tsx:waitForTryOnCompletion()
    ↓ polling GET /api/v1/tryon/{sessionId}/status/
    
7. tryon.py:get_try_on_status()
    ↓ return fake_results
    
8. VirtualFitting.tsx
    ↓ affichage résultats + interactions (like, download, share, email)
```

## 📝 **POINTS TECHNIQUES IMPORTANTS**

### Navigation & État
- **React Router:** `navigate()` avec `location.state` pour partager données
- **Persistance:** Aucune - tout en mémoire pendant la session
- **Retour arrière:** Perte des données, retour à l'accueil

### Stockage Backend
- **Temporaire:** Dictionnaire en mémoire `session_storage`
- **Pas de BDD:** Les sessions disparaissent au redémarrage
- **Simulation:** Aucun vrai traitement AI, images produits retournées

### Images
- **Format:** Base64 pour person_image, URLs pour produits
- **Source produits:** `/src/save_images2/img_XXX_0568.png` (galerie)
- **Résultats:** Même images produits retournées comme "try-on results"

### Performance
- **Polling:** 2s * 10 tentatives = 20s timeout maximum
- **Async:** `simulate_try_on_processing()` en arrière-plan
- **UI:** Barre de progression simulée (10% → 100%)

### APIs Externes
- **Prévues:** Fashn API, Gemini API (non implémentées)
- **Actuelles:** Simulation complète côté backend
- **Configuration:** Variables d'environnement préparées