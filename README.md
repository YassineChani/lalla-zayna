# 🌟 MAISON LALA ZAYNA — Haute Maroquinerie & Maroquinerie de Luxe

Boutique e-commerce haut de gamme conçue spécialement pour la marque de sacs pour femmes **LALA ZAYNA**.

---

## 🔗 Accès Immédiat en Local
> **URL Locale de Test :** **[http://localhost:3000](http://localhost:3000)**

---

## ✨ Fonctionnalités Majeures

### 1. 🌍 Multilingue Intégral (4 Langues au choix)
- 🇫🇷 **Français (FR)**
- 🇬🇧 **English (EN)**
- 🇪🇸 **Español (ES)**
- 🇳🇱 **Nederlands (NL)** *(Hollandais)*
> Changement instantané en un clic dans la barre d'annonces supérieure sans rechargement de page.

### 2. 💱 Multi-Devises avec Conversion en Temps Réel
- **EUR (€)**
- **MAD (Dirham Marocain)**
- **USD ($)**
- **GBP (£)**

### 3. 💳 Paiement en Ligne Sécurisé par Carte (Simulation 3D Interactive)
- **Carte bancaire 3D animée** avec retournement automatique au verso lors de la saisie du code CVC.
- Formatage intelligent du numéro de carte (espaces automatiques) et détection en direct du réseau (Visa, Mastercard, Amex).
- Bouton **"✨ Remplir avec une carte de test"** pour tester le paiement en 1 seconde.
- Calcul de la livraison (offerte dès 300€ ou option Concierge VIP en gants blancs).
- Génération d'un **numéro de commande unique**, **référence de transaction**, récapitulatif détaillé et impression du reçu.

### 4. 📜 Storytelling & Héritage ("Notre Histoire")
- Section narrative dédiée et modale immersive racontant l'histoire de la Maison :
  - L'artisanat ancestral des tanneries de la Médina de Fès et Marrakech.
  - Le tannage végétal naturel et les maîtres artisans (*Maâlems*).
  - Les ornements sculptés dorés à l'or pur 24 carats inspirés des palais andalous.
  - Citations et vision de la créatrice Zayna Benslimane.

### 5. 👜 Catalogue Haute Couture & Sacs pour Femmes
- **Le Zayna Royal** (Sac à main signature avec fermoir architectural 24k)
- **Le Marrakech Cabas** (Grand cabas de voyage en cuir grainé souple)
- **La Soirée Zayna** (Minaudière rigide de gala avec chaîne joaillière)
- **L'Atlas Crossbody** (Sac bandoulière besace demi-lune)
- **Le Palais Seau** (Sac seau architectural avec poignée sculptée)
- **L'Andalouse Matelassée** (Sac à rabat en cuir d'agneau et motif géométrique)
- Filtres par catégorie, barre de recherche en temps réel, tri par prix et popularité.
- **Aperçu Rapide (Quick View)** avec galerie photos, échantillons de teintes, dimensions et conseils d'entretien du cuir.
- **Liste d'envies (Wishlist)** avec sauvegarde locale.

### 6. 🎟️ Codes Privilèges / Promo Inclus
- `ROYAL10` : 10% de remise de bienvenue immédiate.
- `ZAYNA20` : 20% de remise VIP Maison.
- `FREESHIP` : Frais de port offerts.

---

## 📁 Architecture du Projet

```
LALA ZAYNA/
├── package.json               # Dépendances (Express, Cors) et scripts de démarrage
├── README.md                  # Documentation du projet
├── server/
│   ├── server.js              # Serveur Express, APIs produits, panier, paiement et devises
│   └── data/
│       └── products.json      # Base de données complète des sacs avec traductions FR/EN/ES/NL
└── public/
    ├── index.html             # Interface vitrine de luxe complète
    ├── css/
    │   └── style.css          # Design haute couture, carte 3D, typographies et responsive
    └── js/
        ├── i18n.js            # Moteur multilingue complet (FR, EN, ES, NL)
        ├── cart.js            # Gestion du panier, devises, remises et jauge de livraison
        ├── products.js        # Catalogue, filtres, recherche et modale Quick View
        ├── checkout.js        # Checkout interactif, carte 3D et validation bancaire
        └── main.js            # Initialisation globale, menu mobile, toasts et formulaires
```

---

## 🚀 Comment Relancer le Serveur (si nécessaire)

Dans le dossier du projet :
```bash
npm start
```
Ou avec Node directement :
```bash
node server/server.js
```
Puis ouvrez votre navigateur sur : **`http://localhost:3000`**
