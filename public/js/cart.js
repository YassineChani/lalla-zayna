// Cart and Currency Management for Lala Zayna

window.CartManager = {
  items: [],
  promoCode: null,
  promoDiscount: 0,
  hasFreeShippingPromo: false,
  currentCurrency: 'EUR',
  rates: {
    EUR: { symbol: '€', rate: 1.0, position: 'after' },
    MAD: { symbol: 'MAD', rate: 10.9, position: 'after' },
    USD: { symbol: '$', rate: 1.08, position: 'before' },
    GBP: { symbol: '£', rate: 0.85, position: 'before' }
  },

  init() {
    const savedCart = localStorage.getItem('lz_cart');
    if (savedCart) {
      try {
        this.items = JSON.parse(savedCart);
      } catch (e) {
        this.items = [];
      }
    }

    const savedCurrency = localStorage.getItem('lz_currency');
    if (savedCurrency && this.rates[savedCurrency]) {
      this.currentCurrency = savedCurrency;
    }

    this.renderBadge();
    this.renderDrawer();
    this.updateCurrencyButtons();

    // Listeners for cart drawer toggles
    document.querySelectorAll('[data-open-cart]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openDrawer();
      });
    });

    const closeBtn = document.getElementById('close-cart-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeDrawer());
    }

    const overlay = document.getElementById('cart-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => this.closeDrawer());
    }
  },

  save() {
    localStorage.setItem('lz_cart', JSON.stringify(this.items));
    this.renderBadge();
    this.renderDrawer();
  },

  setCurrency(curr) {
    if (!this.rates[curr]) return;
    this.currentCurrency = curr;
    localStorage.setItem('lz_currency', curr);
    this.updateCurrencyButtons();
    this.renderDrawer();
    window.dispatchEvent(new CustomEvent('currencyChanged', { detail: { currency: curr } }));
  },

  updateCurrencyButtons() {
    document.querySelectorAll('.curr-btn').forEach(btn => {
      if (btn.getAttribute('data-curr') === this.currentCurrency) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  },

  formatMoney(amountEUR) {
    const rateInfo = this.rates[this.currentCurrency] || this.rates.EUR;
    const converted = (amountEUR * rateInfo.rate).toFixed(0);
    const formatted = Number(converted).toLocaleString();
    return rateInfo.position === 'before'
      ? `${rateInfo.symbol}${formatted}`
      : `${formatted} ${rateInfo.symbol}`;
  },

  addItem(product, quantity = 1, color = null) {
    const selectedColor = color || (product.colors && product.colors[0] ? product.colors[0].name : 'Noir Ébène');
    const existingIndex = this.items.findIndex(
      item => item.id === product.id && item.color === selectedColor
    );

    let articleNumber = 1;
    let isNewArticle = false;
    if (existingIndex > -1) {
      this.items[existingIndex].quantity += quantity;
      articleNumber = existingIndex + 1;
    } else {
      this.items.push({
        id: product.id,
        slug: product.slug,
        name: (product.translations && product.translations[window.I18N?.currentLang]?.name) || (product.translations && product.translations.fr?.name) || product.name || 'Sac d\'exception',
        price: product.price,
        image: (product.images && product.images[0]) || 'assets/logo.jpg',
        color: selectedColor,
        quantity
      });
      articleNumber = this.items.length;
      isNewArticle = true;
    }

    this.save();

    const activeItem = existingIndex > -1 ? this.items[existingIndex] : this.items[this.items.length - 1];
    const totalCount = this.items.reduce((acc, it) => acc + it.quantity, 0);

    // ✅ Save to server-side DB (async, non-blocking)
    const sessionId = this._getOrCreateSessionId();
    fetch('/api/cart/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        product: {
          id: activeItem.id,
          name: activeItem.name,
          price: activeItem.price,
          image: activeItem.image
        },
        quantity,
        color: selectedColor
      })
    }).catch(() => {}); // silent fail — localStorage is fallback

    // Trigger prominent luxury top floating notification
    window.showTopNotification({
      articleNumber: articleNumber,
      isNewArticle: isNewArticle,
      item: activeItem,
      totalItems: totalCount,
      totalEUR: this.getSubtotalEUR()
    });
  },

  _getOrCreateSessionId() {
    let sid = localStorage.getItem('lz_session_id');
    if (!sid) {
      sid = 'lzs_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('lz_session_id', sid);
    }
    return sid;
  },

  updateQuantity(index, delta) {
    if (!this.items[index]) return;
    this.items[index].quantity += delta;
    if (this.items[index].quantity <= 0) {
      this.items.splice(index, 1);
    }
    this.save();
  },

  removeItem(index) {
    if (this.items[index]) {
      this.items.splice(index, 1);
      this.save();
    }
  },

  clear() {
    this.items = [];
    this.promoCode = null;
    this.promoDiscount = 0;
    this.hasFreeShippingPromo = false;
    this.save();
  },

  getSubtotalEUR() {
    return this.items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  },

  getDiscountEUR() {
    const sub = this.getSubtotalEUR();
    return sub * this.promoDiscount;
  },

  getShippingEUR() {
    const sub = this.getSubtotalEUR();
    if (sub === 0) return 0;
    if (sub >= 300 || this.hasFreeShippingPromo) return 0;
    return 15;
  },

  getTotalEUR() {
    const sub = this.getSubtotalEUR();
    if (sub === 0) return 0;
    return Math.max(0, sub - this.getDiscountEUR() + this.getShippingEUR());
  },

  applyPromo(code) {
    const clean = (code || '').toUpperCase().trim();
    if (!clean) return { success: false, message: 'Veuillez saisir un code' };

    if (clean === 'ROYAL10') {
      this.promoCode = clean;
      this.promoDiscount = 0.10;
      this.renderDrawer();
      return { success: true, message: '10% de réduction appliqués !' };
    } else if (clean === 'ZAYNA20') {
      this.promoCode = clean;
      this.promoDiscount = 0.20;
      this.renderDrawer();
      return { success: true, message: '20% VIP Maison appliqués !' };
    } else if (clean === 'FREESHIP') {
      this.promoCode = clean;
      this.hasFreeShippingPromo = true;
      this.renderDrawer();
      return { success: true, message: 'Livraison offerte appliquée !' };
    } else {
      return { success: false, message: 'Code privilège invalide' };
    }
  },

  openDrawer() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    if (drawer && overlay) {
      drawer.classList.add('open');
      overlay.classList.add('open');
      document.body.classList.add('no-scroll');
    }
  },

  closeDrawer() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    if (drawer && overlay) {
      drawer.classList.remove('open');
      overlay.classList.remove('open');
      document.body.classList.remove('no-scroll');
    }
  },

  renderBadge() {
    const count = this.items.reduce((sum, item) => sum + item.quantity, 0);
    document.querySelectorAll('.cart-count-badge').forEach(badge => {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    });
  },

  renderDrawer() {
    const container = document.getElementById('cart-items-container');
    const emptyState = document.getElementById('cart-empty-state');
    const summaryContainer = document.getElementById('cart-summary');
    const progressText = document.getElementById('shipping-progress-text');
    const progressBar = document.getElementById('shipping-progress-bar');

    if (!container) return;

    const count = this.items.reduce((sum, item) => sum + item.quantity, 0);

    if (count === 0) {
      if (emptyState) emptyState.style.display = 'block';
      if (container) container.innerHTML = '';
      if (summaryContainer) summaryContainer.style.display = 'none';
      if (progressText) progressText.parentElement.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (summaryContainer) summaryContainer.style.display = 'block';
    if (progressText) progressText.parentElement.style.display = 'block';

    // Free shipping threshold (300 EUR)
    const subtotalEUR = this.getSubtotalEUR();
    const threshold = 300;
    const remaining = Math.max(0, threshold - subtotalEUR);

    if (remaining === 0 || this.hasFreeShippingPromo) {
      progressText.innerHTML = window.I18N.get('cart.freeShippingUnlocked');
      progressBar.style.width = '100%';
      progressBar.classList.add('completed');
    } else {
      const remainingFormatted = this.formatMoney(remaining);
      const text = window.I18N.get('cart.freeShippingProgress').replace('{amount}', `<strong>${remainingFormatted}</strong>`);
      progressText.innerHTML = text;
      const pct = Math.min(100, Math.round((subtotalEUR / threshold) * 100));
      progressBar.style.width = `${pct}%`;
      progressBar.classList.remove('completed');
    }

    // Render items
    container.innerHTML = this.items.map((item, idx) => `
      <div class="cart-item">
        <img src="${item.image}" alt="${item.name}" class="cart-item-img">
        <div class="cart-item-info">
          <div class="cart-item-header">
            <h4 class="cart-item-name">${item.name}</h4>
            <button class="cart-item-remove" onclick="CartManager.removeItem(${idx})" aria-label="Supprimer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="cart-item-color">Finition: <span>${item.color}</span></div>
          <div class="cart-item-footer">
            <div class="quantity-stepper">
              <button onclick="CartManager.updateQuantity(${idx}, -1)" aria-label="Diminuer">-</button>
              <span>${item.quantity}</span>
              <button onclick="CartManager.updateQuantity(${idx}, 1)" aria-label="Augmenter">+</button>
            </div>
            <div class="cart-item-price">${this.formatMoney(item.price * item.quantity)}</div>
          </div>
        </div>
      </div>
    `).join('');

    // Summary calculations
    const discountEUR = this.getDiscountEUR();
    const shippingEUR = this.getShippingEUR();
    const totalEUR = this.getTotalEUR();

    document.getElementById('cart-subtotal').textContent = this.formatMoney(subtotalEUR);
    
    const discountRow = document.getElementById('cart-discount-row');
    if (discountRow) {
      if (discountEUR > 0) {
        discountRow.style.display = 'flex';
        document.getElementById('cart-discount').textContent = `-${this.formatMoney(discountEUR)}`;
      } else {
        discountRow.style.display = 'none';
      }
    }

    const shippingEl = document.getElementById('cart-shipping');
    if (shippingEl) {
      shippingEl.textContent = shippingEUR === 0 ? window.I18N.get('cart.free') : this.formatMoney(shippingEUR);
    }

    document.getElementById('cart-total').textContent = this.formatMoney(totalEUR);
  }
};

// ============================================================================
// TOP LUXURY FLOATING NOTIFICATION ("Article X sélectionné")
// ============================================================================
window._topNotificationTimer = null;
window._topNotificationRemaining = 6000;
window._topNotificationStartTime = 0;

window.showTopNotification = function(data) {
  let container = document.getElementById('top-notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'top-notification-container';
    container.className = 'top-notification-container';
    document.body.appendChild(container);
  }

  if (window._topNotificationTimer) {
    clearTimeout(window._topNotificationTimer);
    window._topNotificationTimer = null;
  }

  const articleNum = data.articleNumber || 1;
  const item = data.item || {};
  const totalItems = data.totalItems || 1;
  
  const formattedPrice = window.CartManager.formatMoney(item.price || 0);
  const formattedTotal = window.CartManager.formatMoney(data.totalEUR || ((item.price || 0) * (item.quantity || 1)));

  container.innerHTML = `
    <div class="top-luxury-banner" id="active-top-banner" role="alert" aria-live="assertive">
      
      <!-- Badge Header -->
      <div class="tlb-header">
        <div class="tlb-badge">
          <span class="tlb-badge-icon">✅</span>
          <span class="tlb-badge-text">Article ${articleNum} enregistré dans votre panier</span>
        </div>
        <div class="tlb-header-right">
          <span class="tlb-badge-pill" style="background:rgba(46,125,50,0.25); border-color:#4caf50; color:#a5d6a7">N° ${articleNum}</span>
          <button type="button" class="tlb-close" onclick="window.closeTopNotification()" aria-label="Fermer">✕</button>
        </div>
      </div>

      <!-- Article Info -->
      <div class="tlb-body">
        <div class="tlb-thumb-wrap">
          <img src="${item.image || 'assets/logo.jpg'}" alt="${item.name || 'Sac'}" class="tlb-thumb">
          <span class="tlb-item-num" style="background:#4caf50">✓${articleNum}</span>
        </div>
        <div class="tlb-info">
          <h4 class="tlb-product-name">${item.name || 'Sac LALLA ZAYNA'}</h4>
          <div class="tlb-meta">
            <span class="tlb-color-pill"><span class="tlb-color-dot"></span>${item.color || 'Finition Noble'}</span>
            <span class="tlb-sep">·</span>
            <span class="tlb-item-price">${formattedPrice}</span>
          </div>
          <div class="tlb-status-bar">
            <span>🛍️ Panier : <strong>${totalItems} article${totalItems > 1 ? 's' : ''}</strong> — Total : <strong style="color:#f7e096">${formattedTotal}</strong></span>
          </div>
          <div style="font-size:0.7rem; color:#a5d6a7; margin-top:3px; font-weight:600">
            ✅ Sauvegardé sur le serveur · Cliquez pour commander
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="tlb-actions">
        <button type="button" class="tlb-btn-primary" id="tlb-direct-checkout-btn" style="font-size:0.88rem; font-weight:700">
          🛍️ Commander — Entrer Email &amp; Numéro →
        </button>
        <button type="button" class="tlb-btn-secondary" id="tlb-view-cart-btn">
          Voir Panier
        </button>
      </div>

      <div class="tlb-progress-track">
        <div class="tlb-progress-bar" id="tlb-progress"></div>
      </div>
    </div>
  `;

  // ✅ Button "Commander" → ouvre directement le checkout modal (formulaire email/tel/adresse)
  const directBtn = document.getElementById('tlb-direct-checkout-btn');
  if (directBtn) {
    directBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.closeTopNotification();
      // Open checkout modal directly (not cart drawer)
      if (window.CheckoutManager) {
        window.CheckoutManager.openCheckoutModal();
      }
    });
  }

  const viewCartBtn = document.getElementById('tlb-view-cart-btn');
  if (viewCartBtn) {
    viewCartBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.closeTopNotification();
      if (window.CartManager) {
        window.CartManager.openDrawer();
      }
    });
  }

  const banner = document.getElementById('active-top-banner');
  if (banner) {
    // Hover pauses timer
    banner.addEventListener('mouseenter', () => {
      const bar = document.getElementById('tlb-progress');
      if (bar) bar.style.animationPlayState = 'paused';
      if (window._topNotificationTimer) {
        clearTimeout(window._topNotificationTimer);
        window._topNotificationTimer = null;
      }
    });

    banner.addEventListener('mouseleave', () => {
      const bar = document.getElementById('tlb-progress');
      if (bar) bar.style.animationPlayState = 'running';
      window._topNotificationTimer = setTimeout(() => {
        window.closeTopNotification();
      }, 3000);
    });

    // Animation trigger
    requestAnimationFrame(() => {
      banner.classList.add('visible');
      const bar = document.getElementById('tlb-progress');
      if (bar) {
        bar.style.animation = 'tlbCountdown 6s linear forwards';
      }
    });
  }

  // Auto dismiss after 6 seconds
  window._topNotificationTimer = setTimeout(() => {
    window.closeTopNotification();
  }, 6000);
};

window.closeTopNotification = function() {
  if (window._topNotificationTimer) {
    clearTimeout(window._topNotificationTimer);
    window._topNotificationTimer = null;
  }
  const banner = document.getElementById('active-top-banner');
  if (banner) {
    banner.classList.remove('visible');
    banner.classList.add('fade-out');
    setTimeout(() => {
      const container = document.getElementById('top-notification-container');
      if (container) container.innerHTML = '';
    }, 350);
  }
};
