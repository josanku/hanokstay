// Hanokstay by Wehome — minimal interactions

// Chip-to-search wiring
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const input = document.querySelector('.hero__search input');
    if (input) {
      input.value = chip.textContent.trim();
      input.focus();
    }
  });
});

// Language switcher (UI only — actual i18n later)
document.querySelectorAll('.lang').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.lang').forEach(b => b.classList.remove('lang--active'));
    btn.classList.add('lang--active');
    const lang = btn.textContent.trim();
    if (lang === '한') {
      // Will route to /ko once translation is wired
      console.log('Korean version coming soon — currently EN-first.');
    }
  });
});

// Smooth scroll for nav anchors
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length > 1) {
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });
});

// Hero search → AI curator placeholder
const searchBtn = document.querySelector('.hero__search button');
if (searchBtn) {
  searchBtn.addEventListener('click', () => {
    const q = document.querySelector('.hero__search input').value.trim();
    if (!q) return;
    alert(`AI Curator search (stub):\n\n"${q}"\n\nThis will connect to the Wehome AI hanok search backend.`);
  });
}
