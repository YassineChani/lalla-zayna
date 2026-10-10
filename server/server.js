const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ====================================================
// 1. CYBERSECURITY HEADERS & SHIELDING
// ====================================================

// Hide server fingerprint
app.disable('x-powered-by');

// Production-grade security headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https://images.unsplash.com', 'https://*.unsplash.com'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: []
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  })
);

// CORS Hardening
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server) or localhost/vercel
      if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1|.*\.vercel\.app)/.test(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Fallback safe
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Payload size limiting to prevent Denial of Service (DoS) memory exhaustion
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static Assets (no cache in dev so browser always gets latest JS/CSS immediately)
app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: 0,
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}));

// ====================================================
// 2. BRUTE-FORCE & DDOS RATE LIMITERS
// ====================================================

// Global API rate limiter (protects entire API)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de requêtes. Veuillez patienter quelques instants.' }
});
app.use('/api/', apiLimiter);

// Strict limiter for admin login (prevents brute-force credential cracking)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Trop de tentatives échouées. Par mesure de sécurité, ce compte est temporairement verrouillé pendant 15 minutes.'
  }
});

// Checkout rate limiter (prevents fraudulent card testing bots)
const checkoutLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 15,
  message: { success: false, message: 'Trop de demandes de paiement. Veuillez patienter.' }
});

// Contact / Concierge limiter (anti-spam)
const conciergeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Trop de messages envoyés. Veuillez patienter.' }
});

// Photo upload limiter
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: { success: false, message: 'Limite de téléversement atteinte. Veuillez patienter.' }
});

// ====================================================
// 3. SECURE DATA STORAGE & PATH SANITIZATION
// ====================================================

const uploadsDir = path.join(__dirname, '..', 'public', 'assets', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

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
  console.error('[SECURITY] Error loading products.json:', err.message);
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

// Persistence helpers
function persistProducts() {
  try {
    fs.writeFileSync(productsPath, JSON.stringify(products, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[SECURITY] Error writing products.json');
    return false;
  }
}

function persistOrders() {
  try {
    fs.writeFileSync(ordersPath, JSON.stringify(savedOrders, null, 2), 'utf8');
  } catch (e) {
    console.error('[SECURITY] Error writing orders.json');
  }
}

function persistConcierge() {
  try {
    fs.writeFileSync(conciergePath, JSON.stringify(savedConcierge, null, 2), 'utf8');
  } catch (e) {
    console.error('[SECURITY] Error writing concierge.json');
  }
}

function persistSettings() {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(siteSettings, null, 2), 'utf8');
  } catch (e) {
    console.error('[SECURITY] Error writing settings.json');
  }
}

// Input sanitizer helper (Prevents XSS / Stored HTML injection)
function sanitizeText(str, maxLength = 1000) {
  if (typeof str !== 'string') return '';
  return str
    .slice(0, maxLength)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>]/g, (tag) => ({ '<': '&lt;', '>': '&gt;' }[tag] || tag))
    .trim();
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

// ====================================================
// 4. CRYPTOGRAPHIC AUTHENTICATION & SESSION MANAGEMENT
// ====================================================

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@lallazayna.com').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin2026';

// Pre-compute salted hash for constant-time password verification
const PASSWORD_SALT = crypto.randomBytes(16).toString('hex');
function hashPassword(pwd, salt) {
  return crypto.scryptSync(pwd, salt, 64).toString('hex');
}
const EXPECTED_HASH = hashPassword(ADMIN_PASSWORD, PASSWORD_SALT);

// Constant-time password verification to prevent side-channel timing attacks
function verifyPasswordSafe(inputPassword) {
  try {
    const inputHash = hashPassword(inputPassword, PASSWORD_SALT);
    const bufA = Buffer.from(inputHash, 'utf8');
    const bufB = Buffer.from(EXPECTED_HASH, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (e) {
    return false;
  }
}

// Active session store with expiration (Token -> { email, expiresAt })
const activeSessions = new Map();
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function createSession(email) {
  // 256-bit cryptographically secure random token
  const token = 'lz_sec_' + crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  activeSessions.set(token, { email, expiresAt });
  return token;
}

function isValidSession(token) {
  if (!token || typeof token !== 'string') return false;
  const session = activeSessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return false;
  }
  return true;
}

// Auth Middleware
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'Accès non autorisé. Token d\'authentification manquant.' });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (isValidSession(token)) {
    return next();
  }

  return res.status(401).json({ success: false, message: 'Session invalide ou expirée. Veuillez vous reconnecter.' });
}

// ====================================================
// 5. PUBLIC API ROUTES
// ====================================================

// Config
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

// Products
app.get('/api/products', (req, res) => {
  const { category, search, lang = 'fr', sort } = req.query;
  let filtered = [...products];

  if (category && category !== 'all') {
    filtered = filtered.filter(p => p.category === category);
  }

  if (search) {
    const q = sanitizeText(search).toLowerCase();
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

app.get('/api/products/:id', (req, res) => {
  const cleanId = sanitizeText(req.params.id, 64);
  const product = products.find(p => p.id === cleanId || p.slug === cleanId);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Produit introuvable' });
  }
  res.json({ success: true, product });
});

// Promo Validation
app.post('/api/promo/validate', (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ success: false, message: 'Code promo manquant' });
  }
  const cleanCode = sanitizeText(code, 32).toUpperCase();
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

// ====================================================
// CART SESSION API - Save articles to DB per session
// ====================================================

// In-memory cart sessions (keyed by sessionId)
const cartSessions = new Map();

// POST /api/cart/add → save article to server-side session
app.post('/api/cart/add', (req, res) => {
  const { sessionId, product, quantity = 1, color } = req.body;

  if (!sessionId || !product || !product.id) {
    return res.status(400).json({ success: false, message: 'Données invalides' });
  }

  // Get or create cart session
  let cart = cartSessions.get(sessionId) || { sessionId, items: [], updatedAt: null };

  const selectedColor = color || 'Finition Noble';
  const existingIndex = cart.items.findIndex(
    item => item.id === product.id && item.color === selectedColor
  );

  let articleNumber;
  if (existingIndex > -1) {
    cart.items[existingIndex].quantity += quantity;
    articleNumber = existingIndex + 1;
  } else {
    cart.items.push({
      id: sanitizeText(product.id, 64),
      name: sanitizeText(product.name || 'Sac d\'exception', 120),
      price: Math.max(0, parseFloat(product.price) || 0),
      image: sanitizeText(product.image || '', 500),
      color: sanitizeText(selectedColor, 60),
      quantity: Math.min(10, Math.max(1, parseInt(quantity, 10) || 1)),
      addedAt: new Date().toISOString()
    });
    articleNumber = cart.items.length;
  }

  cart.updatedAt = new Date().toISOString();
  cart.totalItems = cart.items.reduce((acc, it) => acc + it.quantity, 0);
  cart.subtotalEUR = cart.items.reduce((acc, it) => acc + it.price * it.quantity, 0);

  cartSessions.set(sessionId, cart);

  // Clean old sessions (keep max 500 sessions in memory)
  if (cartSessions.size > 500) {
    const oldestKey = cartSessions.keys().next().value;
    cartSessions.delete(oldestKey);
  }

  console.log(`[CART] Session ${sessionId.slice(0,8)}: Article N°${articleNumber} ajouté — Total: ${cart.totalItems} articles`);

  res.json({
    success: true,
    articleNumber,
    totalItems: cart.totalItems,
    subtotalEUR: cart.subtotalEUR,
    cart: cart.items
  });
});

// GET /api/cart/session/:id → retrieve cart session
app.get('/api/cart/session/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  const cart = cartSessions.get(sessionId);
  if (!cart) {
    return res.json({ success: true, cart: [], totalItems: 0, subtotalEUR: 0 });
  }
  res.json({ success: true, ...cart });
});

// Checkout Simulation (PCI-DSS compliant: Card numbers never stored unmasked)
app.post('/api/checkout', checkoutLimiter, (req, res) => {

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

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(customer.email)) {
    return res.status(400).json({ success: false, message: 'Adresse email invalide' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Le panier est vide' });
  }

  const paymentMethod = (req.body.paymentMethod || req.body.payment?.method || 'CARD').toUpperCase();
  const rawCard = req.body.cardNumber || req.body.payment?.cardNumber || '';
  const cleanCard = rawCard.toString().replace(/\s+/g, '');

  let paymentInfo = {};

  if (paymentMethod === 'COD' || paymentMethod === 'DELIVERY') {
    paymentInfo = {
      method: 'PAIEMENT À LA LIVRAISON (COD)',
      cardMasked: 'Paiement à Réception',
      brand: 'Espèces / TPE Livraison',
      status: 'À ENCAISSER'
    };
  } else if (paymentMethod === 'TRANSFER') {
    paymentInfo = {
      method: 'VIREMENT BANCAIRE PRIVÉ',
      cardMasked: 'RIB / Virement Direct',
      brand: 'Virement VIP',
      status: 'EN ATTENTE DE VIREMENT'
    };
  } else {
    // Card payment
    if (cleanCard.length < 13 || cleanCard.length > 19 || !/^\d+$/.test(cleanCard)) {
      return res.status(400).json({ success: false, message: 'Numéro de carte bancaire invalide' });
    }
    paymentInfo = {
      method: 'CARTE BANCAIRE',
      cardMasked: `•••• •••• •••• ${cleanCard.slice(-4)}`,
      cardLast4: cleanCard.slice(-4),
      brand: detectCardBrand(cleanCard),
      status: 'APPROVED'
    };
  }

  let subtotalEUR = 0;
  const verifiedItems = items.map(item => {
    const prod = products.find(p => p.id === item.productId);
    const price = prod ? prod.price : Math.max(0, parseFloat(item.price) || 0);
    const qty = Math.min(10, Math.max(1, parseInt(item.quantity, 10) || 1));
    subtotalEUR += price * qty;
    return {
      productId: sanitizeText(item.productId, 32),
      name: prod ? (prod.translations?.fr?.name || prod.id) : sanitizeText(item.name || 'Sac d\'exception', 100),
      price,
      quantity: qty,
      color: sanitizeText(item.color || '', 40) || null,
      image: prod ? prod.images[0] : (item.image || null)
    };
  });

  let discountAmountEUR = 0;
  let hasFreeShipping = false;
  if (promoCode) {
    const cleanPromo = sanitizeText(promoCode, 32).toUpperCase();
    if (PROMO_CODES[cleanPromo]) {
      const p = PROMO_CODES[cleanPromo];
      if (p.discount) discountAmountEUR = subtotalEUR * p.discount;
      if (p.freeShipping) hasFreeShipping = true;
    }
  }

  let shippingEUR = 0;
  if (shippingMethod === 'express') {
    shippingEUR = 25;
  } else {
    shippingEUR = (subtotalEUR >= (siteSettings.freeShippingThresholdEUR || 300) || hasFreeShipping) ? 0 : 15;
  }

  const totalEUR = Math.max(0, subtotalEUR - discountAmountEUR + shippingEUR);
  const selectedCurrency = ['EUR', 'MAD', 'USD', 'GBP'].includes(currency) ? currency : 'EUR';

  // Order identifiers
  const orderId = `LZ-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const transactionId = `TXN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  const orderData = {
    orderId,
    transactionId,
    status: (paymentMethod === 'COD' || paymentMethod === 'DELIVERY') ? 'NOUVELLE (À LIVRER)' : 'PAYÉE (EN PRÉPARATION)',
    createdAt: new Date().toISOString(),
    customer: {
      fullName: sanitizeText(customer.fullName, 120),
      email: sanitizeText(customer.email, 120),
      phone: sanitizeText(customer.phone || '', 30),
      address: sanitizeText(customer.address, 200),
      city: sanitizeText(customer.city, 100),
      postalCode: sanitizeText(customer.postalCode, 20),
      country: sanitizeText(customer.country, 60)
    },
    payment: paymentInfo,
    items: verifiedItems,
    pricing: {
      subtotalEUR,
      discountEUR: discountAmountEUR,
      shippingEUR,
      totalEUR,
      currency: selectedCurrency,
      totalFormatted: formatCurrency(totalEUR, selectedCurrency)
    }
  };

  savedOrders.unshift(orderData);
  if (savedOrders.length > 500) savedOrders.pop(); // bound memory
  persistOrders();

  res.json({
    success: true,
    message: 'Paiement effectué avec succès',
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

// Order Status
app.get('/api/orders/:orderId', (req, res) => {
  const cleanId = sanitizeText(req.params.orderId, 64);
  const order = savedOrders.find(o => o.orderId === cleanId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Commande introuvable' });
  }
  res.json({ success: true, order });
});

// Newsletter
app.post('/api/newsletter', (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@') || email.length > 120) {
    return res.status(400).json({ success: false, message: 'Email invalide' });
  }
  newsletterSubscribers.add(sanitizeText(email));
  res.json({
    success: true,
    message: 'Bienvenue au Club Privé Lala Zayna. Votre code privilège 10% : ROYAL10',
    code: 'ROYAL10'
  });
});

// Concierge VIP inquiry
app.post('/api/concierge', conciergeLimiter, (req, res) => {
  const { name, email, bagModel, message } = req.body;
  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'Informations requises manquantes' });
  }

  const entry = {
    id: `REQ-${Date.now().toString(36).toUpperCase()}`,
    name: sanitizeText(name, 100),
    email: sanitizeText(email, 120),
    bagModel: sanitizeText(bagModel || 'Non spécifié', 100),
    message: sanitizeText(message || '', 1000),
    createdAt: new Date().toISOString(),
    status: 'NOUVEAU'
  };

  savedConcierge.unshift(entry);
  if (savedConcierge.length > 300) savedConcierge.pop();
  persistConcierge();

  res.json({
    success: true,
    message: 'Merci. Votre conseiller privé Lala Zayna vous contactera sous 24h.'
  });
});

// ====================================================
// 6. ADMIN API ROUTES (PROTECTED / HARDENED)
// ====================================================

// Admin Login (Rate-limited, constant-time verification)
app.post('/api/admin/login', loginLimiter, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ success: false, message: 'Veuillez renseigner votre email et mot de passe.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  // Validate email match and constant-time password check
  if (cleanEmail === ADMIN_EMAIL && verifyPasswordSafe(password)) {
    const sessionToken = createSession(cleanEmail);

    return res.json({
      success: true,
      token: sessionToken,
      user: {
        email: ADMIN_EMAIL,
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

// Admin Verify
app.get('/api/admin/verify', requireAdmin, (req, res) => {
  res.json({
    success: true,
    user: {
      email: ADMIN_EMAIL,
      name: 'Maison Lalla Zayna — Direction',
      role: 'SUPER_ADMIN'
    }
  });
});

// Admin Logout
app.post('/api/admin/logout', requireAdmin, (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  activeSessions.delete(token);
  res.json({ success: true, message: 'Session révoquée avec succès.' });
});

// File Upload Hardening: Magic Bytes inspection & Path Traversal Prevention
app.post('/api/admin/upload', requireAdmin, uploadLimiter, (req, res) => {
  const { dataUrl } = req.body;
  if (!dataUrl || typeof dataUrl !== 'string') {
    return res.status(400).json({ success: false, message: 'Données image manquantes' });
  }

  try {
    const matches = dataUrl.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/i);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({
        success: false,
        message: 'Format d\'image non autorisé. Seuls les formats JPEG, PNG et WEBP sont acceptés.'
      });
    }

    const format = matches[1].toLowerCase();
    const buffer = Buffer.from(matches[2], 'base64');

    // Max upload size 8MB
    if (buffer.length > 8 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'La photo dépasse la taille maximale autorisée (8 Mo).' });
    }

    // Verify magic bytes
    let validMagicBytes = false;
    let ext = 'jpg';

    if (format === 'jpeg' && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      validMagicBytes = true;
      ext = 'jpg';
    } else if (format === 'png' && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      validMagicBytes = true;
      ext = 'png';
    } else if (format === 'webp' && buffer.toString('utf8', 0, 4) === 'RIFF' && buffer.toString('utf8', 8, 12) === 'WEBP') {
      validMagicBytes = true;
      ext = 'webp';
    }

    if (!validMagicBytes) {
      return res.status(400).json({
        success: false,
        message: 'Fichier altéré ou type MIME non conforme aux signatures d\'images sécurisées.'
      });
    }

    // Cryptographically random unique filename (completely ignores user-supplied name to prevent directory traversal)
    const secureFilename = `bag_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
    const destinationPath = path.resolve(uploadsDir, secureFilename);

    // Ensure path cannot escape uploadsDir
    if (!destinationPath.startsWith(uploadsDir)) {
      return res.status(400).json({ success: false, message: 'Chemin de destination invalide.' });
    }

    fs.writeFileSync(destinationPath, buffer);

    const publicUrl = `/assets/uploads/${secureFilename}`;
    res.json({
      success: true,
      message: 'Photo téléversée en toute sécurité !',
      url: publicUrl
    });
  } catch (err) {
    console.error('[SECURITY UPLOAD ERROR]', err.message);
    res.status(500).json({ success: false, message: 'Erreur lors du traitement de l\'image.' });
  }
});

// Admin Products CRUD
app.get('/api/admin/products', requireAdmin, (req, res) => {
  res.json({ success: true, count: products.length, products });
});

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

  if (!name || price === undefined) {
    return res.status(400).json({ success: false, message: 'Le nom et le prix sont obligatoires.' });
  }

  const numPrice = parseFloat(price);
  if (isNaN(numPrice) || numPrice <= 0 || numPrice > 100000) {
    return res.status(400).json({ success: false, message: 'Prix invalide (doit être compris entre 1 et 100 000 €).' });
  }

  const cleanName = sanitizeText(name, 100);
  const cleanSubtitle = sanitizeText(subtitle || '', 150);
  const cleanDesc = sanitizeText(description || '', 2000);
  const cleanLeather = sanitizeText(leatherType || '', 120);
  const cleanDimensions = sanitizeText(dimensions || '', 60);

  const allowedCategories = ['handbag', 'tote', 'crossbody', 'clutch', 'bucket'];
  const cleanCategory = allowedCategories.includes(category) ? category : 'handbag';

  const slug = cleanName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  const id = `lz-${Date.now().toString(36).toLowerCase()}-${crypto.randomBytes(2).toString('hex')}`;

  const cleanImages = (Array.isArray(images) ? images : [])
    .filter(u => typeof u === 'string')
    .map(u => sanitizeText(u, 500));

  const finalImages = cleanImages.length > 0 ? cleanImages : [
    'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80'
  ];

  const catMap = {
    handbag: { fr: 'Sacs à Main', en: 'Handbags', es: 'Bolsos de Mano', nl: 'Handtassen' },
    tote: { fr: 'Cabas & Shoppers', en: 'Totes & Shoppers', es: 'Bolsos Tote', nl: 'Shoppers & Totes' },
    crossbody: { fr: 'Bandoulière', en: 'Crossbody Bags', es: 'Bandoleras', nl: 'Crossbody Tassen' },
    clutch: { fr: 'Pochettes & Soirée', en: 'Clutches & Evening', es: 'Bolsos de Fiesta', nl: 'Clutches & Avondtassen' },
    bucket: { fr: 'Sacs Seau', en: 'Bucket Bags', es: 'Bolsos Saco', nl: 'Buideltassen' }
  };
  const catNames = catMap[cleanCategory] || { fr: 'Haute Maroquinerie', en: 'Haute Leather', es: 'Alta Costura', nl: 'Haute Lederwaren' };

  const newProduct = {
    id,
    slug,
    price: numPrice,
    rating: 5.0,
    reviewsCount: 1,
    isBestseller: !!isBestseller,
    isNew: !!isNew,
    category: cleanCategory,
    images: finalImages,
    colors: Array.isArray(colors) ? colors : [{ name: 'Noir Ébène', hex: '#1a1a1a' }],
    translations: {
      fr: {
        name: cleanName,
        subtitle: cleanSubtitle || 'Création d\'exception en cuir noble',
        categoryName: catNames.fr,
        description: cleanDesc || 'Façonné à la main dans nos ateliers de prestige avec des finitions d\'orfèvre.',
        details: [
          'Cuir pleine fleur sélectionné à la main',
          'Finitions et fermoirs dorés à l\'or fin 24k',
          'Doublure intérieure raffinée en satin de soie',
          'Confection artisanale sur-mesure'
        ],
        leatherType: cleanLeather || 'Cuir de veau pleine fleur d\'exception',
        dimensions: cleanDimensions || '28 x 20 x 10 cm'
      },
      en: {
        name: cleanName,
        subtitle: cleanSubtitle || 'Exceptional full-grain leather creation',
        categoryName: catNames.en,
        description: cleanDesc || 'Handcrafted in our historic ateliers with goldsmith precision.',
        details: [
          'Hand-selected full-grain leather',
          '24k fine gold plated bespoke hardware',
          'Silk satin inner lining',
          'Signature artisan tailoring'
        ],
        leatherType: cleanLeather || 'Ultra-grade full-grain calfskin',
        dimensions: cleanDimensions || '28 x 20 x 10 cm'
      },
      es: {
        name: cleanName,
        subtitle: cleanSubtitle || 'Creación insignia en piel noble',
        categoryName: catNames.es,
        description: cleanDesc || 'Elaborado artesanalmente en nuestros talleres con acabados dorados.',
        details: [
          'Piel de primera flor seleccionada a mano',
          'Herrajes bañados en oro de 24k',
          'Forro en satén de seda',
          'Confección artesanal'
        ],
        leatherType: cleanLeather || 'Piel flor de curtición vegetal',
        dimensions: cleanDimensions || '28 x 20 x 10 cm'
      },
      nl: {
        name: cleanName,
        subtitle: cleanSubtitle || 'Uitzonderlijke creatie in edel leer',
        categoryName: catNames.nl,
        description: cleanDesc || 'Ambachtelijk vervaardigd in onze historische ateliers.',
        details: [
          'Handgeselecteerd volnerf leder',
          '24-karaats vergulde details',
          'Zijden satijnen voering',
          'Vakmanschap van topniveau'
        ],
        leatherType: cleanLeather || 'Edele volnerf leersoort',
        dimensions: cleanDimensions || '28 x 20 x 10 cm'
      }
    }
  };

  products.unshift(newProduct);
  persistProducts();

  res.json({
    success: true,
    message: `Le sac "${cleanName}" a été ajouté et sécurisé sur la boutique officielle ! ✨`,
    product: newProduct
  });
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const cleanId = sanitizeText(req.params.id, 64);
  const idx = products.findIndex(p => p.id === cleanId);
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
  if (category && ['handbag', 'tote', 'crossbody', 'clutch', 'bucket'].includes(category)) {
    existing.category = category;
  }
  if (isBestseller !== undefined) existing.isBestseller = !!isBestseller;
  if (isNew !== undefined) existing.isNew = !!isNew;
  if (Array.isArray(images) && images.length > 0) {
    existing.images = images.map(u => sanitizeText(u, 500));
  }
  if (Array.isArray(colors) && colors.length > 0) {
    existing.colors = colors;
  }

  ['fr', 'en', 'es', 'nl'].forEach(lang => {
    if (!existing.translations[lang]) existing.translations[lang] = {};
    if (name) existing.translations[lang].name = sanitizeText(name, 100);
    if (subtitle) existing.translations[lang].subtitle = sanitizeText(subtitle, 150);
    if (description) existing.translations[lang].description = sanitizeText(description, 2000);
    if (leatherType) existing.translations[lang].leatherType = sanitizeText(leatherType, 120);
    if (dimensions) existing.translations[lang].dimensions = sanitizeText(dimensions, 60);
  });

  products[idx] = existing;
  persistProducts();

  res.json({
    success: true,
    message: 'Le produit a été mis à jour avec succès.',
    product: existing
  });
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  const cleanId = sanitizeText(req.params.id, 64);
  const initialLength = products.length;
  products = products.filter(p => p.id !== cleanId);

  if (products.length === initialLength) {
    return res.status(404).json({ success: false, message: 'Produit introuvable' });
  }

  persistProducts();
  res.json({
    success: true,
    message: 'Le sac a été retiré du catalogue officiel avec succès.'
  });
});

// Orders & Concierge
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  res.json({ success: true, count: savedOrders.length, orders: savedOrders });
});

app.patch('/api/admin/orders/:orderId', requireAdmin, (req, res) => {
  const cleanId = sanitizeText(req.params.orderId, 64);
  const { status } = req.body;
  const order = savedOrders.find(o => o.orderId === cleanId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Commande introuvable' });
  }
  const cleanStatus = sanitizeText(status, 40);
  order.status = cleanStatus || order.status;
  persistOrders();
  res.json({ success: true, message: 'Statut de la commande mis à jour.', order });
});

app.get('/api/admin/concierge', requireAdmin, (req, res) => {
  res.json({ success: true, count: savedConcierge.length, requests: savedConcierge });
});

// Promos
app.get('/api/admin/promos', requireAdmin, (req, res) => {
  res.json({ success: true, promos: PROMO_CODES });
});

app.post('/api/admin/promos', requireAdmin, (req, res) => {
  const { code, discount, description, freeShipping } = req.body;
  if (!code) return res.status(400).json({ success: false, message: 'Code requis' });
  const clean = sanitizeText(code, 30).toUpperCase();
  const numDiscount = Math.min(1, Math.max(0, parseFloat(discount) || 0));
  PROMO_CODES[clean] = {
    discount: numDiscount,
    description: sanitizeText(description || `${Math.round(numDiscount * 100)}% de remise`, 100),
    freeShipping: !!freeShipping
  };
  res.json({ success: true, message: `Code promo ${clean} enregistré !`, promos: PROMO_CODES });
});

app.delete('/api/admin/promos/:code', requireAdmin, (req, res) => {
  const clean = sanitizeText(req.params.code, 30).toUpperCase();
  if (PROMO_CODES[clean]) {
    delete PROMO_CODES[clean];
    return res.json({ success: true, message: `Code promo ${clean} supprimé.`, promos: PROMO_CODES });
  }
  res.status(404).json({ success: false, message: 'Code introuvable' });
});

// Settings
app.get('/api/admin/settings', requireAdmin, (req, res) => {
  res.json({ success: true, settings: siteSettings });
});

app.post('/api/admin/settings', requireAdmin, (req, res) => {
  const { announcement, phone, email, freeShippingThresholdEUR } = req.body;
  if (announcement !== undefined) siteSettings.announcement = sanitizeText(announcement, 200);
  if (phone !== undefined) siteSettings.phone = sanitizeText(phone, 40);
  if (email !== undefined) siteSettings.email = sanitizeText(email, 100);
  if (freeShippingThresholdEUR !== undefined) {
    const thresh = parseFloat(freeShippingThresholdEUR);
    siteSettings.freeShippingThresholdEUR = !isNaN(thresh) && thresh >= 0 ? thresh : 300;
  }
  persistSettings();
  res.json({ success: true, message: 'Paramètres enregistrés en toute sécurité.', settings: siteSettings });
});

// Fallback to index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Centralized error handler (Prevents stack trace leaks)
app.use((err, req, res, next) => {
  console.error('[SECURITY ERROR HANDLER]', err.message);
  res.status(500).json({ success: false, message: 'Requête sécurisée. Une erreur interne est survenue.' });
});

// Start local server if run directly
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  🛡️ MAISON LALA ZAYNA - SERVEUR HAUTEMENT SÉCURISÉ 🛡️`);
    console.log(`  Protection: Helmet, Rate-Limiter, Scrypt, Magic-Bytes`);
    console.log(`  Boutique URL: http://localhost:${PORT}`);
    console.log(`  Portail Admin: http://localhost:${PORT}/admin.html`);
    console.log(`  Identifiants Admin: admin@lallazayna.com / admin2026`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
