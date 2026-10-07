// Main Orchestrator for Lala Zayna Luxury Storefront

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize i18n
  window.I18N.init();
  window.I18N.applyTranslations();

  // 2. Initialize Cart
  window.CartManager.init();

  // 3. Initialize Products Catalog
  await window.ProductsManager.init();

  // 4. Initialize Checkout
  window.CheckoutManager.init();

  // 5. Setup Language Switcher Buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const lang = e.currentTarget.getAttribute('data-lang');
      window.I18N.setLanguage(lang);
      window.showToast(`Langue changée : ${lang.toUpperCase()}`);
    });
  });

  // 6. Setup Currency Switcher Buttons
  document.querySelectorAll('.curr-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const curr = e.currentTarget.getAttribute('data-curr');
      window.CartManager.setCurrency(curr);
      window.showToast(`Devise sélectionnée : ${curr}`);
    });
  });

  // 7. Sticky Header on Scroll
  const header = document.querySelector('.site-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  // 8. Mobile Navigation Drawer Toggle & Close
  const mobileToggle = document.getElementById('mobile-nav-toggle');
  const navMenu = document.getElementById('nav-menu');
  const mobileNavOverlay = document.getElementById('mobile-nav-overlay');
  const closeMobileNavBtn = document.getElementById('close-mobile-nav');

  const openMobileNav = () => {
    if (navMenu && mobileNavOverlay) {
      navMenu.classList.add('open');
      mobileNavOverlay.classList.add('open');
      document.body.classList.add('no-scroll');
      if (mobileToggle) mobileToggle.classList.add('active');
    }
  };

  const closeMobileNav = () => {
    if (navMenu && mobileNavOverlay) {
      navMenu.classList.remove('open');
      mobileNavOverlay.classList.remove('open');
      document.body.classList.remove('no-scroll');
      if (mobileToggle) mobileToggle.classList.remove('active');
    }
  };

  if (mobileToggle) mobileToggle.addEventListener('click', openMobileNav);
  if (closeMobileNavBtn) closeMobileNavBtn.addEventListener('click', closeMobileNav);
  if (mobileNavOverlay) mobileNavOverlay.addEventListener('click', closeMobileNav);

  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', closeMobileNav);
  });

  // 9. Promo code application in Cart Drawer
  const promoInput = document.getElementById('cart-promo-input');
  const promoApplyBtn = document.getElementById('apply-promo-btn');
  if (promoApplyBtn && promoInput) {
    promoApplyBtn.addEventListener('click', () => {
      const res = window.CartManager.applyPromo(promoInput.value);
      window.showToast(res.message);
      if (res.success) {
        promoInput.value = '';
      }
    });
  }

  // 10. Story Modal
  const openStoryBtns = document.querySelectorAll('[data-open-story]');
  const storyModal = document.getElementById('story-modal');
  const closeStoryBtn = document.getElementById('close-story-btn');
  const storyOverlay = document.getElementById('story-overlay');

  openStoryBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (storyModal && storyOverlay) {
        storyModal.classList.add('open');
        storyOverlay.classList.add('open');
        document.body.classList.add('no-scroll');
      }
    });
  });

  const closeStory = () => {
    if (storyModal && storyOverlay) {
      storyModal.classList.remove('open');
      storyOverlay.classList.remove('open');
      document.body.classList.remove('no-scroll');
    }
  };

  if (closeStoryBtn) closeStoryBtn.addEventListener('click', closeStory);
  if (storyOverlay) storyOverlay.addEventListener('click', closeStory);

  // 11. Concierge Form Submission
  const conciergeForm = document.getElementById('concierge-form');
  if (conciergeForm) {
    conciergeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: document.getElementById('concierge-name').value,
        email: document.getElementById('concierge-email').value,
        bagModel: document.getElementById('concierge-bag').value,
        message: document.getElementById('concierge-msg').value
      };

      try {
        const res = await fetch('/api/concierge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        window.showToast(data.message || 'Demande envoyée à votre concierge privé.');
        conciergeForm.reset();
      } catch (err) {
        window.showToast('Demande enregistrée. Nous vous contacterons très prochainement.');
        conciergeForm.reset();
      }
    });
  }

  // 12. Newsletter Form
  const newsletterForm = document.getElementById('newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('newsletter-email');
      const email = emailInput.value;
      try {
        const res = await fetch('/api/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        window.showToast(data.message || window.I18N.get('newsletter.successMsg'));
        emailInput.value = '';
      } catch (err) {
        window.showToast(window.I18N.get('newsletter.successMsg'));
        emailInput.value = '';
      }
    });
  }

  // 13. Search Header Trigger
  const searchToggle = document.getElementById('search-toggle-btn');
  const catalogSearch = document.getElementById('catalog-search');
  if (searchToggle && catalogSearch) {
    searchToggle.addEventListener('click', () => {
      document.getElementById('collection').scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => {
        catalogSearch.focus();
      }, 500);
    });
  }
});

// Toast notification helper
window.showToast = function (message, duration = 3200) {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = 'luxury-toast';
  toast.innerHTML = `
    <span class="toast-dot"></span>
    <span class="toast-text">${message}</span>
  `;

  toastContainer.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 400);
  }, duration);
};
