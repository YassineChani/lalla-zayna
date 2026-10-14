// Products Catalog and Quick View Manager for Lala Zayna

window.ProductsManager = {
  products: [],
  currentCategory: 'all',
  currentSort: 'featured',
  searchQuery: '',
  wishlist: new Set(),
  activeQuickViewProduct: null,
  selectedColor: null,

  async init() {
    // Load wishlist from localStorage
    const savedWish = localStorage.getItem('lz_wishlist');
    if (savedWish) {
      try {
        this.wishlist = new Set(JSON.parse(savedWish));
      } catch (e) {
        this.wishlist = new Set();
      }
    }
    this.updateWishlistBadge();

    // Fetch products from API
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (data.success && data.products) {
        this.products = data.products;
      }
    } catch (e) {
      console.warn('Using embedded products fallback');
    }

    this.renderProducts();
    this.bindEvents();

    // Listen to language or currency changes
    window.addEventListener('languageChanged', () => {
      this.renderProducts();
      if (this.activeQuickViewProduct) {
        this.renderQuickView(this.activeQuickViewProduct);
      }
    });

    window.addEventListener('currencyChanged', () => {
      this.renderProducts();
      if (this.activeQuickViewProduct) {
        this.renderQuickView(this.activeQuickViewProduct);
      }
    });
  },

  bindEvents() {
    // Category filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentCategory = e.currentTarget.getAttribute('data-category');
        this.renderProducts();
      });
    });

    // Sort select
    const sortSelect = document.getElementById('catalog-sort');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.currentSort = e.target.value;
        this.renderProducts();
      });
    }

    // Search input
    const searchInput = document.getElementById('catalog-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderProducts();
      });
    }

    // Modal Close
    const modalClose = document.getElementById('close-quickview-btn');
    const modalOverlay = document.getElementById('quickview-overlay');
    if (modalClose) modalClose.addEventListener('click', () => this.closeQuickView());
    if (modalOverlay) modalOverlay.addEventListener('click', () => this.closeQuickView());

    // Delegated click listener for Add to Cart
    document.addEventListener('click', (e) => {
      const addBtn = e.target.closest('.btn-add-bag');
      if (addBtn) {
        e.preventDefault();
        e.stopPropagation();
        const prodId = addBtn.getAttribute('data-product-id') || addBtn.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
        if (prodId) {
          console.log('[ProductsManager] Add to bag clicked for product:', prodId);
          this.quickAddToCart(prodId);
        }
      }
    });
  },

  getFilteredProducts() {
    let list = [...this.products];
    const lang = window.I18N.currentLang;

    // Filter by category
    if (this.currentCategory && this.currentCategory !== 'all') {
      list = list.filter(p => p.category === this.currentCategory);
    }

    // Filter by search query
    if (this.searchQuery) {
      list = list.filter(p => {
        const trans = p.translations[lang] || p.translations.fr;
        return (
          trans.name.toLowerCase().includes(this.searchQuery) ||
          trans.subtitle.toLowerCase().includes(this.searchQuery) ||
          trans.description.toLowerCase().includes(this.searchQuery)
        );
      });
    }

    // Sorting
    if (this.currentSort === 'price-asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (this.currentSort === 'price-desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (this.currentSort === 'rating') {
      list.sort((a, b) => b.rating - a.rating);
    }

    return list;
  },

  renderProducts() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    const list = this.getFilteredProducts();
    const lang = window.I18N.currentLang;

    if (list.length === 0) {
      grid.innerHTML = `
        <div class="empty-catalog">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <p>Aucun sac trouvé correspondant à votre recherche.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = list.map(product => {
      const trans = product.translations[lang] || product.translations.fr;
      const isFav = this.wishlist.has(product.id);
      const formattedPrice = window.CartManager.formatMoney(product.price);

      return `
        <article class="product-card" data-id="${product.id}">
          <div class="product-media">
            ${product.isBestseller ? `<span class="product-badge badge-gold">${window.I18N.get('catalog.badgeBestseller')}</span>` : ''}
            ${product.isNew ? `<span class="product-badge badge-new">${window.I18N.get('catalog.badgeNew')}</span>` : ''}

            <button class="wishlist-btn ${isFav ? 'active' : ''}" onclick="ProductsManager.toggleWishlist('${product.id}', event)" aria-label="Favoris">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="${isFav ? '#c59b27' : 'none'}" stroke="${isFav ? '#c59b27' : 'currentColor'}" stroke-width="2">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
              </svg>
            </button>

            <img src="${product.images[0]}" alt="${trans.name}" class="product-img" loading="lazy" onclick="ProductsManager.openQuickView('${product.id}')">
            ${product.images[1] ? `<img src="${product.images[1]}" alt="${trans.name}" class="product-img-hover" loading="lazy" onclick="ProductsManager.openQuickView('${product.id}')">` : ''}

            <div class="product-overlay-actions">
              <button class="btn-quickview" onclick="ProductsManager.openQuickView('${product.id}')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                <span>${window.I18N.get('catalog.quickView')}</span>
              </button>
            </div>
          </div>

          <div class="product-details">
            <div class="product-rating">
              <span class="stars">★★★★★</span>
              <span class="rating-val" style="color:var(--color-gold); font-size:0.7rem; font-weight:600; letter-spacing:0.08em; text-transform:uppercase">Cuir d'Exception</span>
            </div>

            <h3 class="product-title" onclick="ProductsManager.openQuickView('${product.id}')">${trans.name}</h3>
            <p class="product-subtitle">${trans.subtitle}</p>

            <div class="product-colors-swatch">
              ${(product.colors || []).map((col, i) => `
                <span class="color-swatch-dot ${i === 0 ? 'active' : ''}" style="background-color: ${col.hex}" title="${col.name}"></span>
              `).join('')}
            </div>

            <div class="product-footer">
              <div class="product-price">${formattedPrice}</div>
              <button type="button" class="btn-add-bag" data-product-id="${product.id}">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                <span>${window.I18N.get('catalog.addToCart')}</span>
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  },

  quickAddToCart(id) {
    const product = this.products.find(p => p.id === id);
    if (product) {
      window.CartManager.addItem(product, 1, product.colors[0]?.name);
    }
  },

  toggleWishlist(id, event) {
    if (event) event.stopPropagation();
    if (this.wishlist.has(id)) {
      this.wishlist.delete(id);
      window.showToast('Retiré des favoris');
    } else {
      this.wishlist.add(id);
      window.showToast('Ajouté à votre liste de souhaits dorée ✨');
    }
    localStorage.setItem('lz_wishlist', JSON.stringify(Array.from(this.wishlist)));
    this.updateWishlistBadge();
    this.renderProducts();
  },

  updateWishlistBadge() {
    const count = this.wishlist.size;
    document.querySelectorAll('.wishlist-count-badge').forEach(badge => {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    });
  },

  openQuickView(id) {
    const product = this.products.find(p => p.id === id);
    if (!product) return;
    this.activeQuickViewProduct = product;
    this.selectedColor = product.colors[0]?.name || 'Noir Ébène';
    this.renderQuickView(product);

    const modal = document.getElementById('quickview-modal');
    const overlay = document.getElementById('quickview-overlay');
    if (modal && overlay) {
      modal.classList.add('open');
      overlay.classList.add('open');
      document.body.classList.add('no-scroll');
    }
  },

  closeQuickView() {
    const modal = document.getElementById('quickview-modal');
    const overlay = document.getElementById('quickview-overlay');
    if (modal && overlay) {
      modal.classList.remove('open');
      overlay.classList.remove('open');
      document.body.classList.remove('no-scroll');
    }
    this.activeQuickViewProduct = null;
  },

  renderQuickView(product) {
    const lang = window.I18N.currentLang;
    const trans = product.translations[lang] || product.translations.fr;
    const formattedPrice = window.CartManager.formatMoney(product.price);

    document.getElementById('qv-title').textContent = trans.name;
    document.getElementById('qv-subtitle').textContent = trans.subtitle;
    document.getElementById('qv-price').textContent = formattedPrice;
    document.getElementById('qv-description').textContent = trans.description;
    const qvRating = document.getElementById('qv-rating-val');
    if (qvRating) qvRating.textContent = "Édition Numérotée d'Exception";
    const qvRev = document.getElementById('qv-reviews-count');
    if (qvRev) qvRev.textContent = "";
    document.getElementById('qv-dimensions').textContent = trans.dimensions;
    document.getElementById('qv-leather').textContent = trans.leatherType;

    // Gallery main image
    const mainImg = document.getElementById('qv-main-image');
    mainImg.src = product.images[0];
    mainImg.alt = trans.name;

    // Gallery thumbnails
    const thumbsContainer = document.getElementById('qv-thumbnails');
    thumbsContainer.innerHTML = product.images.map((img, idx) => `
      <img src="${img}" class="qv-thumb ${idx === 0 ? 'active' : ''}" onclick="ProductsManager.selectQuickViewImage('${img}', this)" alt="Vue ${idx + 1}">
    `).join('');

    // Color Swatches
    const colorContainer = document.getElementById('qv-colors');
    colorContainer.innerHTML = (product.colors || []).map((col, idx) => `
      <button class="qv-color-btn ${idx === 0 ? 'active' : ''}" data-color="${col.name}" onclick="ProductsManager.selectQuickViewColor('${col.name}', this)">
        <span class="qv-color-dot" style="background-color: ${col.hex}"></span>
        <span>${col.name}</span>
      </button>
    `).join('');

    // Details bullet list
    const detailsContainer = document.getElementById('qv-details-list');
    detailsContainer.innerHTML = (trans.details || []).map(item => `
      <li>${item}</li>
    `).join('');

    // Add to cart action button in modal
    const addBtn = document.getElementById('qv-add-to-cart');
    addBtn.onclick = () => {
      const qty = parseInt(document.getElementById('qv-qty-input').value, 10) || 1;
      window.CartManager.addItem(product, qty, this.selectedColor);
      this.closeQuickView();
    };
  },

  selectQuickViewImage(src, el) {
    document.getElementById('qv-main-image').src = src;
    document.querySelectorAll('.qv-thumb').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
  },

  selectQuickViewColor(colorName, el) {
    this.selectedColor = colorName;
    document.querySelectorAll('.qv-color-btn').forEach(btn => btn.classList.remove('active'));
    el.classList.add('active');
  }
};
