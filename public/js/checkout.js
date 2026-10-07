// Checkout and Interactive 3D Credit Card Payment for Lala Zayna

window.CheckoutManager = {
  currentStep: 1,
  shippingMethod: 'standard',
  selectedCountry: 'France',
  lastOrder: null,

  init() {
    this.bindEvents();
    this.setupCreditCardInteractivity();
  },

  bindEvents() {
    // Open checkout from cart drawer
    const proceedBtn = document.getElementById('proceed-checkout-btn');
    if (proceedBtn) {
      proceedBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.CartManager.closeDrawer();
        this.openCheckoutModal();
      });
    }

    // Modal Close
    const closeBtn = document.getElementById('close-checkout-btn');
    const overlay = document.getElementById('checkout-overlay');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeCheckoutModal());
    if (overlay) overlay.addEventListener('click', () => this.closeCheckoutModal());

    // Step navigation
    const toPaymentBtn = document.getElementById('btn-to-payment');
    if (toPaymentBtn) {
      toPaymentBtn.addEventListener('click', () => this.validateAndGoToPayment());
    }

    const backToShippingBtn = document.getElementById('btn-back-to-shipping');
    if (backToShippingBtn) {
      backToShippingBtn.addEventListener('click', () => this.goToStep(1));
    }

    // Shipping selection change
    document.querySelectorAll('input[name="shipping_option"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.shippingMethod = e.target.value;
        this.updateOrderSummary();
      });
    });

    // Test card fill helper
    const quickFillBtn = document.getElementById('quick-fill-card-btn');
    if (quickFillBtn) {
      quickFillBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.fillSampleCard();
      });
    }

    // Submit payment
    const payForm = document.getElementById('payment-form');
    if (payForm) {
      payForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.processPayment();
      });
    }
  },

  openCheckoutModal() {
    if (window.CartManager.items.length === 0) {
      window.showToast('Votre panier est vide');
      return;
    }

    this.goToStep(1);
    this.updateOrderSummary();

    const modal = document.getElementById('checkout-modal');
    const overlay = document.getElementById('checkout-overlay');
    if (modal && overlay) {
      modal.classList.add('open');
      overlay.classList.add('open');
      document.body.classList.add('no-scroll');
    }
  },

  closeCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    const overlay = document.getElementById('checkout-overlay');
    if (modal && overlay) {
      modal.classList.remove('open');
      overlay.classList.remove('open');
      document.body.classList.remove('no-scroll');
    }
  },

  goToStep(stepNumber) {
    this.currentStep = stepNumber;

    // Update step tabs UI
    document.querySelectorAll('.checkout-step-indicator').forEach((indicator, idx) => {
      if (idx + 1 === stepNumber) {
        indicator.classList.add('active');
        indicator.classList.remove('completed');
      } else if (idx + 1 < stepNumber) {
        indicator.classList.remove('active');
        indicator.classList.add('completed');
      } else {
        indicator.classList.remove('active', 'completed');
      }
    });

    // Toggle panels
    document.getElementById('checkout-step-1').style.display = stepNumber === 1 ? 'block' : 'none';
    document.getElementById('checkout-step-2').style.display = stepNumber === 2 ? 'block' : 'none';
    document.getElementById('checkout-step-3').style.display = stepNumber === 3 ? 'block' : 'none';

    if (stepNumber === 2) {
      this.updateCardPayButton();
    }
  },

  updateOrderSummary() {
    const items = window.CartManager.items;
    const subtotalEUR = window.CartManager.getSubtotalEUR();
    const discountEUR = window.CartManager.getDiscountEUR();
    
    let shippingEUR = 0;
    if (this.shippingMethod === 'vip') {
      shippingEUR = 25;
    } else {
      shippingEUR = (subtotalEUR >= 300 || window.CartManager.hasFreeShippingPromo) ? 0 : 15;
    }

    const totalEUR = Math.max(0, subtotalEUR - discountEUR + shippingEUR);

    // Summary items preview
    const miniItemsEl = document.getElementById('checkout-mini-items');
    if (miniItemsEl) {
      miniItemsEl.innerHTML = items.map(item => `
        <div class="checkout-mini-item">
          <img src="${item.image}" alt="${item.name}">
          <div class="mini-info">
            <span class="mini-name">${item.name}</span>
            <span class="mini-meta">Qté: ${item.quantity} · ${item.color}</span>
          </div>
          <span class="mini-price">${window.CartManager.formatMoney(item.price * item.quantity)}</span>
        </div>
      `).join('');
    }

    // Amounts
    const subEl = document.getElementById('checkout-subtotal');
    if (subEl) subEl.textContent = window.CartManager.formatMoney(subtotalEUR);

    const shipEl = document.getElementById('checkout-shipping');
    if (shipEl) shipEl.textContent = shippingEUR === 0 ? window.I18N.get('cart.free') : window.CartManager.formatMoney(shippingEUR);

    const discRow = document.getElementById('checkout-discount-row');
    if (discRow) {
      if (discountEUR > 0) {
        discRow.style.display = 'flex';
        document.getElementById('checkout-discount').textContent = `-${window.CartManager.formatMoney(discountEUR)}`;
      } else {
        discRow.style.display = 'none';
      }
    }

    const totalEl = document.getElementById('checkout-total');
    if (totalEl) totalEl.textContent = window.CartManager.formatMoney(totalEUR);

    this.calculatedTotalEUR = totalEUR;
    this.calculatedShippingEUR = shippingEUR;
  },

  updateCardPayButton() {
    const btn = document.getElementById('pay-submit-btn');
    if (btn) {
      const amountFormatted = window.CartManager.formatMoney(this.calculatedTotalEUR || window.CartManager.getTotalEUR());
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
        <span>${window.I18N.get('checkout.payBtn')} ${amountFormatted}</span>
      `;
    }
  },

  validateAndGoToPayment() {
    const form = document.getElementById('shipping-form');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    this.shippingData = {
      fullName: document.getElementById('ship-name').value.trim(),
      email: document.getElementById('ship-email').value.trim(),
      phone: document.getElementById('ship-phone').value.trim(),
      address: document.getElementById('ship-address').value.trim(),
      city: document.getElementById('ship-city').value.trim(),
      postalCode: document.getElementById('ship-zip').value.trim(),
      country: document.getElementById('ship-country').value.trim()
    };

    this.goToStep(2);
  },

  setupCreditCardInteractivity() {
    const cardEl = document.getElementById('interactive-card');
    const numInput = document.getElementById('card-number-input');
    const nameInput = document.getElementById('card-name-input');
    const expInput = document.getElementById('card-exp-input');
    const cvvInput = document.getElementById('card-cvv-input');

    const cardNumDisplay = document.getElementById('card-display-number');
    const cardNameDisplay = document.getElementById('card-display-name');
    const cardExpDisplay = document.getElementById('card-display-exp');
    const cardCvvDisplay = document.getElementById('card-display-cvv');
    const cardBrandLogo = document.getElementById('card-brand-logo');

    if (!numInput || !cardEl) return;

    // Card number formatting
    numInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/\D/g, '').substring(0, 16);
      let formatted = val.match(/.{1,4}/g)?.join(' ') || '';
      e.target.value = formatted;

      // Update card face
      if (val.length === 0) {
        cardNumDisplay.textContent = '•••• •••• •••• ••••';
      } else {
        // Pad with bullet points for unfilled spots
        let padded = val.padEnd(16, '•');
        let formattedDisplay = padded.match(/.{1,4}/g).join(' ');
        cardNumDisplay.textContent = formattedDisplay;
      }

      // Detect Brand
      if (val.startsWith('4')) {
        cardBrandLogo.textContent = 'VISA';
        cardBrandLogo.className = 'card-brand visa';
      } else if (/^5[1-5]/.test(val)) {
        cardBrandLogo.textContent = 'MASTERCARD';
        cardBrandLogo.className = 'card-brand mastercard';
      } else if (/^3[47]/.test(val)) {
        cardBrandLogo.textContent = 'AMEX';
        cardBrandLogo.className = 'card-brand amex';
      } else {
        cardBrandLogo.textContent = 'LALA ZAYNA VIP';
        cardBrandLogo.className = 'card-brand vip';
      }
    });

    // Cardholder Name
    nameInput.addEventListener('input', (e) => {
      const val = e.target.value.toUpperCase();
      cardNameDisplay.textContent = val || 'VOTRE NOM COMPLET';
    });

    // Expiry Date MM/YY
    expInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/\D/g, '').substring(0, 4);
      if (val.length >= 2) {
        val = val.substring(0, 2) + '/' + val.substring(2, 4);
      }
      e.target.value = val;
      cardExpDisplay.textContent = val || 'MM/AA';
    });

    // CVV & 3D Flip
    cvvInput.addEventListener('focus', () => {
      cardEl.classList.add('flipped');
    });

    cvvInput.addEventListener('blur', () => {
      cardEl.classList.remove('flipped');
    });

    cvvInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/\D/g, '').substring(0, 4);
      e.target.value = val;
      cardCvvDisplay.textContent = val ? '•'.repeat(val.length) : '•••';
    });
  },

  fillSampleCard() {
    const numInput = document.getElementById('card-number-input');
    const nameInput = document.getElementById('card-name-input');
    const expInput = document.getElementById('card-exp-input');
    const cvvInput = document.getElementById('card-cvv-input');

    numInput.value = '4532 8920 1284 9472';
    numInput.dispatchEvent(new Event('input'));

    nameInput.value = (this.shippingData?.fullName || 'LALLA ZAYNA').toUpperCase();
    nameInput.dispatchEvent(new Event('input'));

    expInput.value = '08/28';
    expInput.dispatchEvent(new Event('input'));

    cvvInput.value = '888';
    cvvInput.dispatchEvent(new Event('input'));

    window.showToast('Données de carte de démonstration insérées ✨');
  },

  async processPayment() {
    const numInput = document.getElementById('card-number-input').value.replace(/\s+/g, '');
    const expInput = document.getElementById('card-exp-input').value;
    const cvvInput = document.getElementById('card-cvv-input').value;

    if (numInput.length < 13) {
      alert('Veuillez saisir un numéro de carte valide');
      return;
    }
    if (!expInput || expInput.length < 5) {
      alert('Veuillez saisir une date d\'expiration valide (MM/AA)');
      return;
    }
    if (cvvInput.length < 3) {
      alert('Veuillez saisir un code CVC valide');
      return;
    }

    const payBtn = document.getElementById('pay-submit-btn');
    const originalText = payBtn.innerHTML;
    payBtn.disabled = true;
    payBtn.innerHTML = `
      <span class="luxury-spinner"></span>
      <span>${window.I18N.get('checkout.processing')}</span>
    `;

    const payload = {
      items: window.CartManager.items,
      customer: this.shippingData,
      payment: {
        cardNumber: numInput,
        expiry: expInput,
        cvv: cvvInput
      },
      promoCode: window.CartManager.promoCode,
      shippingMethod: this.shippingMethod,
      currency: window.CartManager.currentCurrency
    };

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      setTimeout(() => {
        payBtn.disabled = false;
        payBtn.innerHTML = originalText;

        if (result.success && result.order) {
          this.lastOrder = result.order;
          this.showOrderConfirmation(result.order);
          window.CartManager.clear();
        } else {
          alert(result.message || 'Une erreur est survenue lors du traitement du paiement.');
        }
      }, 1400); // 1.4s luxury animation delay for genuine high-security feel

    } catch (err) {
      payBtn.disabled = false;
      payBtn.innerHTML = originalText;
      console.error(err);
      alert('Erreur réseau. Veuillez réessayer.');
    }
  },

  showOrderConfirmation(order) {
    this.goToStep(3);

    document.getElementById('confirm-order-id').textContent = order.orderId;
    document.getElementById('confirm-txn-id').textContent = order.transactionId;
    document.getElementById('confirm-client-name').textContent = order.customer.fullName;
    document.getElementById('confirm-client-email').textContent = order.customer.email;
    document.getElementById('confirm-address').textContent = `${order.customer.address}, ${order.customer.postalCode} ${order.customer.city}, ${order.customer.country}`;
    document.getElementById('confirm-total').textContent = order.pricing.totalFormatted;

    const itemsContainer = document.getElementById('confirm-items-list');
    itemsContainer.innerHTML = order.items.map(item => `
      <div class="confirm-item-row">
        <img src="${item.image}" alt="${item.name}" class="confirm-thumb">
        <div class="confirm-item-details">
          <strong>${item.name}</strong>
          <span>${item.color} — Quantité: ${item.quantity}</span>
        </div>
        <span class="confirm-item-price">${window.CartManager.formatMoney(item.price * item.quantity)}</span>
      </div>
    `).join('');

    // Trigger celebration toast
    window.showToast('✨ Félicitations ! Votre commande a été confirmée avec succès.');
  }
};
