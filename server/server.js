const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Load products
const productsPath = path.join(__dirname, 'data', 'products.json');
let products = [];
try {
  products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
} catch (err) {
  console.error('Error loading products.json:', err);
}

// In-memory store for orders and newsletter
const orders = new Map();
const newsletterSubscribers = new Set();

// Currency exchange rates relative to EUR
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

// ======================== API ROUTES ========================

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
      freeShippingThresholdEUR: 300
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
      const trans = p.translations[lang] || p.translations.fr;
      return (
        trans.name.toLowerCase().includes(q) ||
        trans.description.toLowerCase().includes(q) ||
        trans.subtitle.toLowerCase().includes(q)
      );
    });
  }

  if (sort === 'price-asc') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sort === 'price-desc') {
    filtered.sort((a, b) => b.price - a.price);
  } else if (sort === 'rating') {
    filtered.sort((a, b) => b.rating - a.rating);
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
    return res.status(400).json({ success: false, message: 'Code requis' });
  }
  const cleanCode = code.toUpperCase().trim();
  const promo = PROMO_CODES[cleanCode];
  if (!promo) {
    return res.status(404).json({ success: false, message: 'Code promo invalide / Invalid promo code' });
  }
  res.json({
    success: true,
    code: cleanCode,
    ...promo
  });
});

// 5. Checkout & Payment Simulation
app.post('/api/checkout', (req, res) => {
  const {
    items,
    customer,
    payment,
    promoCode,
    shippingMethod = 'standard',
    currency = 'EUR'
  } = req.body;

  // Validation
  if (!items || !items.length) {
    return res.status(400).json({ success: false, message: 'Le panier est vide / Cart is empty' });
  }

  if (!customer || !customer.email || !customer.fullName || !customer.address || !customer.city || !customer.country) {
    return res.status(400).json({ success: false, message: 'Veuillez remplir toutes les informations de livraison / Please fill all shipping details' });
  }

  if (!payment || !payment.cardNumber || !payment.expiry || !payment.cvv) {
    return res.status(400).json({ success: false, message: 'Détails de carte bancaire incomplets / Incomplete card details' });
  }

  // Basic card simulation check
  const cleanCard = payment.cardNumber.replace(/\s+/g, '');
  if (cleanCard.length < 13 || cleanCard.length > 19 || !/^\d+$/.test(cleanCard)) {
    return res.status(400).json({ success: false, message: 'Numéro de carte bancaire invalide / Invalid credit card number' });
  }

  // Calculate items subtotal
  let subtotalEUR = 0;
  const verifiedItems = items.map(item => {
    const p = products.find(prod => prod.id === item.id);
    const price = p ? p.price : 400;
    const qty = parseInt(item.quantity, 10) || 1;
    subtotalEUR += price * qty;
    return {
      id: item.id,
      name: p ? p.translations.fr.name : 'Sac Lala Zayna',
      price,
      quantity: qty,
      color: item.color || 'Noir Ébène',
      image: p ? p.images[0] : ''
    };
  });

  // Calculate discount
  let discountAmountEUR = 0;
  let hasFreeShipping = false;
  if (promoCode && PROMO_CODES[promoCode.toUpperCase()]) {
    const promo = PROMO_CODES[promoCode.toUpperCase()];
    if (promo.discount) {
      discountAmountEUR = subtotalEUR * promo.discount;
    }
    if (promo.freeShipping) {
      hasFreeShipping = true;
    }
  }

  // Shipping
  let shippingEUR = 0;
  if (shippingMethod === 'express') {
    shippingEUR = 25;
  } else {
    // Free standard over 300 EUR
    shippingEUR = (subtotalEUR >= 300 || hasFreeShipping) ? 0 : 15;
  }

  const totalEUR = Math.max(0, subtotalEUR - discountAmountEUR + shippingEUR);

  // Currency conversion
  const rateInfo = CURRENCY_RATES[currency] || CURRENCY_RATES.EUR;
  const totalInSelectedCurrency = (totalEUR * rateInfo.rate).toFixed(2);

  // Generate order
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

  orders.set(orderId, orderData);

  res.json({
    success: true,
    message: 'Paiement effectué avec succès / Payment successful',
    order: orderData
  });
});

// Helper: card brand
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
  const order = orders.get(orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Commande introuvable / Order not found' });
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
  res.json({
    success: true,
    message: 'Merci. Votre conseiller privé Lala Zayna vous contactera sous 24h.'
  });
});

// Fallback to index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  🌟 MAISON LALA ZAYNA - SERVEUR DE LUXE EN LIGNE 🌟`);
  console.log(`  Local URL: http://localhost:${PORT}`);
  console.log(`  Langues supportées: Français, English, Español, Nederlands`);
  console.log(`  Paiement par carte actif (Stripe-like simulation 3D)`);
  console.log(`=======================================================`);
});
