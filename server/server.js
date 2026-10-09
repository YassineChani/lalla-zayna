const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware (with generous payload limit for base64 photo uploads)
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Ensure upload directory exists
const uploadsDir = path.join(__dirname, '..', 'public', 'assets', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ----------------------------------------------------
// Data Files & Persistence Helpers
// ----------------------------------------------------
const productsPath = path.join(__dirname, 'data', 'products.json');
const ordersPath = path.join(__dirname, 'data', 'orders.json');
const conciergePath = path.join(__dirname, 'data', 'concierge.json');
const settingsPath = path.join(__dirname, 'data', 'settings.json');

// In-memory data caches
let products = [];
try {
  if (fs.existsSync(productsPath)) {
    products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
  }
} catch (err) {
  console.error('Error loading products.json:', err);
  products = [];
}

let savedOrders = [];
try {
  if (fs.existsSync(ordersPath)) {
    savedOrders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
  }
} catch (err) {
  savedOrders = [];
}

let savedConcierge = [];
try {
  if (fs.existsSync(conciergePath)) {
    savedConcierge = JSON.parse(fs.readFileSync(conciergePath, 'utf8'));
  }
} catch (err) {
  savedConcierge = [];
}

let siteSettings = {
  announcement: "✨ LIVRAISON MONDIALE EXPRESS OFFERTE DÈS 300€ — ÉCRIN CADEAU SIGNÉ INCLUS",
  phone: "+212 6 00 00 00 00",
  email: "contact.lalazayna@gmail.com",
  freeShippingThresholdEUR: 300
};
try {
  if (fs.existsSync(settingsPath)) {
    siteSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  }
} catch (err) {}

const newsletterSubscribers = new Set();

// Helper to save products
function persistProducts() {
  try {
    fs.writeFileSync(productsPath, JSON.stringify(products, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error writing products.json:', e);
    return false;
  }
}

// Helper to save orders
function persistOrders() {
  try {
    fs.writeFileSync(ordersPath, JSON.stringify(savedOrders, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing orders.json:', e);
  }
}

// Helper to save concierge
function persistConcierge() {
  try {
    fs.writeFileSync(conciergePath, JSON.stringify(savedConcierge, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing concierge.json:', e);
  }
}

// Helper to save settings
function persistSettings() {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(siteSettings, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing settings.json:', e);
  }
}

// Currencies
const CURRENCY_RATES = {
  EUR: { symbol: '€', rate: 1.0, position: 'after' },
  MAD: { symbol: 'MAD', rate: 10.9, position: 'after' },
  USD: { symbol: '$', rate: 1.08, position: 'before' },
  GBP: { symbol: '£', rate: 0.85, position: 'before' }
};

// Promo codes
const PROMO_CODES = {
  ROYAL10: { discount: 0.10, description: '10% Privilège Bienvenue' },
  ZAYNA20: { discount: 0.20, description: '20% VIP Maison' },
  FREESHIP: { freeShipping: true, description: 'Livraison Offerte' }
};

// Admin Credentials
const ADMIN_CREDENTIALS = {
  email: process.env.ADMIN_EMAIL || 'admin@lallazayna.com',
  password: process.env.ADMIN_PASSWORD || 'admin2026'
};
const ADMIN_TOKEN = 'lz_auth_token_' + Buffer.from('lallazayna_secure_admin').toString('base64');

// Auth middleware for protected admin endpoints
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && (authHeader === `Bearer ${ADMIN_TOKEN}` || authHeader === ADMIN_TOKEN)) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Accès non autorisé. Veuillez vous connecter.' });
}

// ====================================================
// PUBLIC API ROUTES
// ====================================================

// 1. Get configurations & currencies
app.get('/api/config', (req, res) => {
  res.json({
    currencies: CURRENCY_RATES,
    languages: ['fr', 'en', 'es', 'nl'],
    defaultLanguage: 'fr',
    defaultCurrency: 'EUR',
    brand: {
      name: 'LALA ZAYNA',
      tagline: 'Maison de Haute Maroquinerie',
      foundedYear: 2021,
      freeShippingThresholdEUR: siteSettings.freeShippingThresholdEUR || 300,
      announcement: siteSettings.announcement,
      phone: siteSettings.phone,
      email: siteSettings.email
    }
  });
});

// 2. Get all products with filters
app.get('/api/products', (req, res) => {
  const { category, search, lang = 'fr', sort } = req.query;
  let filtered = [...products];

  if (category && category !== 'all') {
    filtered = filtered.filter(p => p.category === category);
  }

  if (search) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(p => {
      const trans = p.translations[lang] || p.translations.fr || {};
      const name = (trans.name || '').toLowerCase();
      const desc = (trans.description || '').toLowerCase();
      const sub = (trans.subtitle || '').toLowerCase();
      return name.includes(q) || desc.includes(q) || sub.includes(q);
    });
  }

  if (sort === 'price-asc') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sort === 'price-desc') {
    filtered.sort((a, b) => b.price - a.price);
  } else if (sort === 'rating') {
    filtered.sort((a, b) => (b.rating || 5) - (a.rating || 5));
  }

  res.json({
    success: true,
    count: filtered.length,
    products: filtered
  });
});

// 3. Get single product
app.get('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const product = products.find(p => p.id === id || p.slug === id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Produit introuvable / Product not found' });
  }
  res.json({ success: true, product });
});

// 4. Validate Promo Code
app.post('/api/promo/validate', (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, message: 'Code promo manquant' });
  }
  const cleanCode = code.trim().toUpperCase();
  const promo = PROMO_CODES[cleanCode];

  if (promo) {
    res.json({
      success: true,
      valid: true,
      code: cleanCode,
      discount: promo.discount || 0,
      freeShipping: !!promo.freeShipping,
      description: promo.description
    });
  } else {
    res.status(400).json({
      success: false,
      valid: false,
      message: 'Code privilège non reconnu ou expiré'
    });
  }
});

// 5. Checkout simulation
app.post('/api/checkout', (req, res) => {
  const {
    customer,
    items,
    shippingMethod = 'standard',
    promoCode,
    currency = 'EUR',
    cardNumber
  } = req.body;

  if (!customer || !customer.fullName || !customer.email || !customer.address) {
    return res.status(400).json({ success: false, message: 'Coordonnées de livraison incomplètes' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Le panier est vide' });
  }

  const cleanCard = (cardNumber || '').replace(/\s+/g, '');
  if (cleanCard.length < 13) {
    return res.status(400).json({ success: false, message: 'Numéro de carte bancaire invalide' });
  }

  let subtotalEUR = 0;
  const verifiedItems = items.map(item => {
    const prod = products.find(p => p.id === item.productId);
    const price = prod ? prod.price : item.price;
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    subtotalEUR += price * qty;
    return {
      productId: item.productId,
      name: prod ? (prod.translations?.fr?.name || prod.id) : (item.name || 'Sac d\'exception'),
      price,
      quantity: qty,
      color: item.color || null,
      image: prod ? prod.images[0] : null
    };
  });

  let discountAmountEUR = 0;
  let hasFreeShipping = false;
  if (promoCode && PROMO_CODES[promoCode.toUpperCase()]) {
    const promo = PROMO_CODES[promoCode.toUpperCase()];
    if (promo.discount) discountAmountEUR = subtotalEUR * promo.discount;
    if (promo.freeShipping) hasFreeShipping = true;
  }

  let shippingEUR = 0;
  if (shippingMethod === 'express') {
    shippingEUR = 25;
  } else {
    shippingEUR = (subtotalEUR >= (siteSettings.freeShippingThresholdEUR || 300) || hasFreeShipping) ? 0 : 15;
  }

  const totalEUR = Math.max(0, subtotalEUR - discountAmountEUR + shippingEUR);
  const rateInfo = CURRENCY_RATES[currency] || CURRENCY_RATES.EUR;

  const orderId = `LZ-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const transactionId = `TXN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

  const orderData = {
    orderId,
    transactionId,
    status: 'PAID_CONFIRMED',
    createdAt: new Date().toISOString(),
    customer: {
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone || '',
      address: customer.address,
      city: customer.city,
      postalCode: customer.postalCode,
      country: customer.country
    },
    payment: {
      method: 'CARD',
      cardLast4: cleanCard.slice(-4),
      brand: detectCardBrand(cleanCard),
      status: 'APPROVED'
    },
    items: verifiedItems,
    pricing: {
      subtotalEUR,
      discountEUR: discountAmountEUR,
      shippingEUR,
      totalEUR,
      currency,
      totalFormatted: formatCurrency(totalEUR, currency)
    }
  };

  savedOrders.unshift(orderData);
  persistOrders();

  res.json({
    success: true,
    message: 'Paiement effectué avec succès / Payment successful',
    order: orderData
  });
});

function detectCardBrand(num) {
  if (/^4/.test(num)) return 'Visa';
  if (/^5[1-5]/.test(num)) return 'Mastercard';
  if (/^3[47]/.test(num)) return 'American Express';
  return 'Carte Bancaire';
}

function formatCurrency(amountEUR, currencyCode) {
  const conf = CURRENCY_RATES[currencyCode] || CURRENCY_RATES.EUR;
  const val = (amountEUR * conf.rate).toFixed(2);
  return conf.position === 'before' ? `${conf.symbol}${val}` : `${val} ${conf.symbol}`;
}

// 6. Get order details
app.get('/api/orders/:orderId', (req, res) => {
  const { orderId } = req.params;
  const order = savedOrders.find(o => o.orderId === orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Commande introuvable' });
  }
  res.json({ success: true, order });
});

// 7. Newsletter subscription
app.post('/api/newsletter', (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'Email invalide' });
  }
  newsletterSubscribers.add(email);
  res.json({
    success: true,
    message: 'Bienvenue au Club Privé Lala Zayna. Votre code privilège 10% : ROYAL10',
    code: 'ROYAL10'
  });
});

// 8. Concierge VIP inquiry
app.post('/api/concierge', (req, res) => {
  const { name, email, bagModel, message } = req.body;
  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'Informations requises manquantes' });
  }
  const entry = {
    id: `REQ-${Date.now().toString(36).toUpperCase()}`,
    name,
    email,
    bagModel: bagModel || 'Non spécifié',
    message: message || '',
    createdAt: new Date().toISOString(),
    status: 'NOUVEAU'
  };
  savedConcierge.unshift(entry);
  persistConcierge();

  res.json({
    success: true,
    message: 'Merci. Votre conseiller privé Lala Zayna vous contactera sous 24h.'
  });
});

// ====================================================
// ADMIN API ROUTES (PROTECTED / SECURE)
// ====================================================

// A1. Admin Login
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Veuillez saisir votre email et mot de passe.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (cleanEmail === ADMIN_CREDENTIALS.email.toLowerCase() && password === ADMIN_CREDENTIALS.password) {
    return res.json({
      success: true,
      token: ADMIN_TOKEN,
      user: {
        email: ADMIN_CREDENTIALS.email,
        name: 'Maison Lalla Zayna — Direction',
        role: 'SUPER_ADMIN'
      }
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Identifiants incorrects. Veuillez vérifier votre adresse email et mot de passe.'
  });
});

// A2. Verify Admin Token
app.get('/api/admin/verify', requireAdmin, (req, res) => {
  res.json({
    success: true,
    user: {
      email: ADMIN_CREDENTIALS.email,
      name: 'Maison Lalla Zayna — Direction',
      role: 'SUPER_ADMIN'
    }
  });
});

// A3. Upload Photo (Base64 data or multipart)
app.post('/api/admin/upload', requireAdmin, (req, res) => {
  const { dataUrl, filename } = req.body;
  if (!dataUrl) {
    return res.status(400).json({ success: false, message: 'Données image manquantes' });
  }

  try {
    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ success: false, message: 'Format d\'image base64 invalide' });
    }

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');

    let ext = 'jpg';
    if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('webp')) ext = 'webp';

    const safeName = `bag_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
    const filePath = path.join(uploadsDir, safeName);

    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/assets/uploads/${safeName}`;
    res.json({
      success: true,
      message: 'Photo téléversée avec succès !',
      url: publicUrl
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: 'Erreur lors du traitement de l\'image' });
  }
});

// A4. Get All Products (Admin)
app.get('/api/admin/products', requireAdmin, (req, res) => {
  res.json({ success: true, count: products.length, products });
});

// A5. Add New Product
app.post('/api/admin/products', requireAdmin, (req, res) => {
  const {
    name,
    subtitle,
    price,
    category,
    images = [],
    colors = [],
    description,
    leatherType,
    dimensions,
    isBestseller = false,
    isNew = true
  } = req.body;

  if (!name || !price) {
    return res.status(400).json({ success: false, message: 'Le nom et le prix sont obligatoires.' });
  }

  const numPrice = parseFloat(price);
  if (isNaN(numPrice) || numPrice <= 0) {
    return res.status(400).json({ success: false, message: 'Le prix doit être un nombre positif.' });
  }

  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  const id = `lz-${Date.now().toString(36).toLowerCase()}`;

  // Default images if empty
  const finalImages = images.length > 0 ? images : [
    'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80'
  ];

  // Default colors if empty
  const finalColors = colors.length > 0 ? colors : [
    { name: 'Noir Ébène', hex: '#1a1a1a' },
    { name: 'Cognac Royal', hex: '#8c4e28' }
  ];

  const catMap = {
    handbag: { fr: 'Sacs à Main', en: 'Handbags', es: 'Bolsos de Mano', nl: 'Handtassen' },
    tote: { fr: 'Cabas & Shoppers', en: 'Totes & Shoppers', es: 'Bolsos Tote', nl: 'Shoppers & Totes' },
    crossbody: { fr: 'Bandoulière', en: 'Crossbody Bags', es: 'Bandoleras', nl: 'Crossbody Tassen' },
    clutch: { fr: 'Pochettes & Soirée', en: 'Clutches & Evening', es: 'Bolsos de Fiesta', nl: 'Clutches & Avondtassen' },
    bucket: { fr: 'Sacs Seau', en: 'Bucket Bags', es: 'Bolsos Saco', nl: 'Buideltassen' }
  };

  const catNames = catMap[category] || { fr: 'Haute Maroquinerie', en: 'Haute Leather', es: 'Alta Costura', nl: 'Haute Lederwaren' };

  const newProduct = {
    id,
    slug,
    price: numPrice,
    rating: 5.0,
    reviewsCount: 1,
    isBestseller: !!isBestseller,
    isNew: !!isNew,
    category: category || 'handbag',
    images: finalImages,
    colors: finalColors,
    translations: {
      fr: {
        name,
        subtitle: subtitle || 'Création d\'exception en cuir noble',
        categoryName: catNames.fr,
        description: description || 'Façonné à la main dans nos ateliers de prestige avec des finitions d\'orfèvre.',
        details: [
          'Cuir pleine fleur sélectionné à la main',
          'Finitions et fermoirs dorés à l\'or fin 24k',
          'Doublure intérieure raffinée en satin de soie',
          'Confection artisanale sur-mesure'
        ],
        leatherType: leatherType || 'Cuir de veau pleine fleur d\'exception',
        dimensions: dimensions || '28 x 20 x 10 cm'
      },
      en: {
        name,
        subtitle: subtitle || 'Exceptional full-grain leather creation',
        categoryName: catNames.en,
        description: description || 'Handcrafted in our historic ateliers with goldsmith precision.',
        details: [
          'Hand-selected full-grain leather',
          '24k fine gold plated bespoke hardware',
          'Silk satin inner lining',
          'Signature artisan tailoring'
        ],
        leatherType: leatherType || 'Ultra-grade full-grain calfskin',
        dimensions: dimensions || '28 x 20 x 10 cm'
      },
      es: {
        name,
        subtitle: subtitle || 'Creación insignia en piel noble',
        categoryName: catNames.es,
        description: description || 'Elaborado artesanalmente en nuestros talleres con acabados dorados.',
        details: [
          'Piel de primera flor seleccionada a mano',
          'Herrajes bañados en oro de 24k',
          'Forro en satén de seda',
          'Confección artesanal'
        ],
        leatherType: leatherType || 'Piel flor de curtición vegetal',
        dimensions: dimensions || '28 x 20 x 10 cm'
      },
      nl: {
        name,
        subtitle: subtitle || 'Uitzonderlijke creatie in edel leer',
        categoryName: catNames.nl,
        description: description || 'Ambachtelijk vervaardigd in onze historische ateliers.',
        details: [
          'Handgeselecteerd volnerf leder',
          '24-karaats vergulde details',
          'Zijden satijnen voering',
          'Vakmanschap van topniveau'
        ],
        leatherType: leatherType || 'Edele volnerf leersoort',
        dimensions: dimensions || '28 x 20 x 10 cm'
      }
    }
  };

  products.unshift(newProduct);
  persistProducts();

  res.json({
    success: true,
    message: `Le sac "${name}" a été ajouté avec succès au catalogue officiel ! ✨`,
    product: newProduct
  });
});

// A6. Update Product
app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Produit introuvable' });
  }

  const existing = products[idx];
  const {
    name,
    subtitle,
    price,
    category,
    images,
    colors,
    description,
    leatherType,
    dimensions,
    isBestseller,
    isNew
  } = req.body;

  if (price !== undefined) {
    const numPrice = parseFloat(price);
    if (!isNaN(numPrice) && numPrice > 0) existing.price = numPrice;
  }
  if (category) existing.category = category;
  if (isBestseller !== undefined) existing.isBestseller = !!isBestseller;
  if (isNew !== undefined) existing.isNew = !!isNew;
  if (Array.isArray(images) && images.length > 0) existing.images = images;
  if (Array.isArray(colors) && colors.length > 0) existing.colors = colors;

  // Update translations
  ['fr', 'en', 'es', 'nl'].forEach(lang => {
    if (!existing.translations[lang]) existing.translations[lang] = {};
    if (name) existing.translations[lang].name = name;
    if (subtitle) existing.translations[lang].subtitle = subtitle;
    if (description) existing.translations[lang].description = description;
    if (leatherType) existing.translations[lang].leatherType = leatherType;
    if (dimensions) existing.translations[lang].dimensions = dimensions;
  });

  products[idx] = existing;
  persistProducts();

  res.json({
    success: true,
    message: 'Le produit a été mis à jour avec succès.',
    product: existing
  });
});

// A7. Delete Product
app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const initialLength = products.length;
  products = products.filter(p => p.id !== id);

  if (products.length === initialLength) {
    return res.status(404).json({ success: false, message: 'Produit introuvable' });
  }

  persistProducts();
  res.json({
    success: true,
    message: 'Le sac a été retiré du catalogue officiel avec succès.'
  });
});

// A8. Orders List (Admin)
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  res.json({ success: true, count: savedOrders.length, orders: savedOrders });
});

// A9. Update Order Status
app.patch('/api/admin/orders/:orderId', requireAdmin, (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;
  const order = savedOrders.find(o => o.orderId === orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Commande introuvable' });
  }
  order.status = status || order.status;
  persistOrders();
  res.json({ success: true, message: 'Statut de la commande mis à jour.', order });
});

// A10. Concierge Requests List
app.get('/api/admin/concierge', requireAdmin, (req, res) => {
  res.json({ success: true, count: savedConcierge.length, requests: savedConcierge });
});

// A11. Promo Codes Management
app.get('/api/admin/promos', requireAdmin, (req, res) => {
  res.json({ success: true, promos: PROMO_CODES });
});

app.post('/api/admin/promos', requireAdmin, (req, res) => {
  const { code, discount, description, freeShipping } = req.body;
  if (!code) return res.status(400).json({ success: false, message: 'Code requis' });
  const clean = code.trim().toUpperCase();
  PROMO_CODES[clean] = {
    discount: parseFloat(discount) || 0,
    description: description || `${Math.round((parseFloat(discount) || 0) * 100)}% de remise`,
    freeShipping: !!freeShipping
  };
  res.json({ success: true, message: `Code promo ${clean} enregistré !`, promos: PROMO_CODES });
});

app.delete('/api/admin/promos/:code', requireAdmin, (req, res) => {
  const { code } = req.params;
  const clean = code.trim().toUpperCase();
  if (PROMO_CODES[clean]) {
    delete PROMO_CODES[clean];
    return res.json({ success: true, message: `Code promo ${clean} supprimé.`, promos: PROMO_CODES });
  }
  res.status(404).json({ success: false, message: 'Code introuvable' });
});

// A12. Settings
app.get('/api/admin/settings', requireAdmin, (req, res) => {
  res.json({ success: true, settings: siteSettings });
});

app.post('/api/admin/settings', requireAdmin, (req, res) => {
  const { announcement, phone, email, freeShippingThresholdEUR } = req.body;
  if (announcement !== undefined) siteSettings.announcement = announcement;
  if (phone !== undefined) siteSettings.phone = phone;
  if (email !== undefined) siteSettings.email = email;
  if (freeShippingThresholdEUR !== undefined) {
    siteSettings.freeShippingThresholdEUR = parseFloat(freeShippingThresholdEUR) || 300;
  }
  persistSettings();
  res.json({ success: true, message: 'Paramètres enregistrés avec succès.', settings: siteSettings });
});

// Fallback to index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start local server if run directly
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  🌟 MAISON LALA ZAYNA - SERVEUR EN LIGNE 🌟`);
    console.log(`  Boutique URL: http://localhost:${PORT}`);
    console.log(`  Portail Admin: http://localhost:${PORT}/admin.html`);
    console.log(`  Identifiants Admin: admin@lallazayna.com / admin2026`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
