'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import styles from './page.module.css';

/* ─── Custom Cursor Component ─────────────────────────────────────────────── */
const CustomCursor = () => {
  const dotRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    // Touch devices: keep the default cursor, skip tracking
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;

    const interactiveSel = 'button, a, [role="button"], input, select, textarea';

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;
    let targetScale = 1;
    let scale = 1;
    let raf = null;

    const onMove = (e) => {
      mx = e.clientX;
      my = e.clientY;
      // Dot follows the pointer instantly (offset = half the 8px size)
      dot.style.transform = `translate3d(${mx - 4}px, ${my - 4}px, 0)`;
    };

    const onOver = (e) => {
      if (e.target.closest && e.target.closest(interactiveSel)) targetScale = 1.6;
    };

    const onOut = (e) => {
      if (e.target.closest && e.target.closest(interactiveSel)) {
        const related = e.relatedTarget;
        if (!related || !related.closest || !related.closest(interactiveSel)) {
          targetScale = 1;
        }
      }
    };

    const loop = () => {
      // Ring eases toward the pointer (offset = half the 36px size)
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      scale += (targetScale - scale) * 0.2;
      ring.style.transform =
        `translate3d(${rx - 18}px, ${ry - 18}px, 0) scale(${scale})`;
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseover', onOver, { passive: true });
    window.addEventListener('mouseout', onOut, { passive: true });
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onOver);
      window.removeEventListener('mouseout', onOut);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className={styles.cursorDot} />
      <div ref={ringRef} className={styles.cursorRing} />
    </>
  );
};

/* ─── Translations ─────────────────────────────────────────────────────────── */
const TRANSLATIONS = {
  en: {
    lines: [
      'Nature provided everything we needed',
      'But all of this changed suddenly',
      'Together they arrived',
      'They took our precious things',
      'But history has passed, and we are ready to',
      'share what is ours with you once again',
    ],
    toggleLabel: 'ID',
  },
  id: {
    lines: [
      'Alam memberikan semua yang kami butuhkan',
      'Tapi semua ini berubah tiba-tiba',
      'Bersama mereka datang',
      'Mereka merampas hal berharga kami',
      'Tapi sejarah sudah berlalu, dan kami siap untuk',
      'kembali berbagi milik kami dengan anda',
    ],
    toggleLabel: 'EN',
  },
};

/* ─── Product Catalog Data ─────────────────────────────────────────────────── */
const CATEGORIES = [
  'Semua Kategori',
  'Rempah',
  'Olahan bahan makanan',
  'Kerajinan',
];

const PRODUCTS = [
  // Rempah
  {
    id: 'bawang-merah',
    name: 'Bawang Merah',
    category: 'Rempah',
    image: '/Pictures/rempah/bawang merah.webp',
  },
  {
    id: 'bunga-lawang',
    name: 'Bunga Lawang',
    category: 'Rempah',
    image: '/Pictures/rempah/bunga lawang.webp',
  },
  {
    id: 'cabai-kering',
    name: 'Cabai Kering',
    category: 'Rempah',
    image: '/Pictures/rempah/cabai kering.webp',
  },
  {
    id: 'cengkeh',
    name: 'Cengkeh',
    category: 'Rempah',
    image: '/Pictures/rempah/cengkeh.webp',
  },
  {
    id: 'daun-salam-kering',
    name: 'Daun Salam Kering',
    category: 'Rempah',
    image: '/Pictures/rempah/daun salam kering.webp',
  },
  {
    id: 'jintan',
    name: 'Jintan',
    category: 'Rempah',
    image: '/Pictures/rempah/jintan.webp',
  },
  {
    id: 'kayu-manis',
    name: 'Kayu Manis',
    category: 'Rempah',
    image: '/Pictures/rempah/kayu manis.webp',
  },
  {
    id: 'kemiri',
    name: 'Kemiri',
    category: 'Rempah',
    image: '/Pictures/rempah/kemiri.webp',
  },
  {
    id: 'ketumbar',
    name: 'Ketumbar',
    category: 'Rempah',
    image: '/Pictures/rempah/ketumbar.webp',
  },
  {
    id: 'kunyit',
    name: 'Kunyit',
    category: 'Rempah',
    image: '/Pictures/rempah/kunyit.webp',
  },
  {
    id: 'lada-hitam',
    name: 'Lada Hitam',
    category: 'Rempah',
    image: '/Pictures/rempah/lada hitam.webp',
  },
  {
    id: 'lengkuas',
    name: 'Lengkuas',
    category: 'Rempah',
    image: '/Pictures/rempah/lengkuas.webp',
  },
  {
    id: 'pala',
    name: 'Pala',
    category: 'Rempah',
    image: '/Pictures/rempah/pala.webp',
  },
  {
    id: 'serai',
    name: 'Serai',
    category: 'Rempah',
    image: '/Pictures/rempah/serai.webp',
  },

  // Olahan bahan makanan
  {
    id: 'cireng',
    name: 'Cireng',
    category: 'Olahan bahan makanan',
    image: '/Pictures/Olahan bahan makanan/cireng.webp',
  },
  {
    id: 'emping',
    name: 'Emping',
    category: 'Olahan bahan makanan',
    image: '/Pictures/Olahan bahan makanan/emping.webp',
  },
  {
    id: 'kerupuk-rambak',
    name: 'Kerupuk Rambak',
    category: 'Olahan bahan makanan',
    image: '/Pictures/Olahan bahan makanan/kerupuk rambak.webp',
  },
  {
    id: 'kerupuk-udang',
    name: 'Kerupuk Udang',
    category: 'Olahan bahan makanan',
    image: '/Pictures/Olahan bahan makanan/kerupuk udang.webp',
  },
  {
    id: 'pempek',
    name: 'Pempek',
    category: 'Olahan bahan makanan',
    image: '/Pictures/Olahan bahan makanan/pempek.webp',
  },

  // Kerajinan
  {
    id: 'arang-briket-kubus',
    name: 'Arang Briket Kubus',
    category: 'Kerajinan',
    image: '/Pictures/Kerajinan/Arang Briket kubus.webp',
  },
  {
    id: 'dupa-kerucut',
    name: 'Dupa Kerucut',
    category: 'Kerajinan',
    image: '/Pictures/Kerajinan/dupa kerucut.webp',
  },
  {
    id: 'baju-baduy-jokowi',
    name: 'Baju Baduy Model Jokowi',
    category: 'Kerajinan',
    image: '/Pictures/Kerajinan/SET BAJU BADUY/Model baju baduy jokowi.webp',
  },
  {
    id: 'set-baju-baduy-hitam',
    name: 'Set Baju Baduy Hitam',
    category: 'Kerajinan',
    image: '/Pictures/Kerajinan/SET BAJU BADUY/Model baju hitam (gambar katalog).webp',
  },
  {
    id: 'set-baju-baduy-putih',
    name: 'Set Baju Baduy Putih',
    category: 'Kerajinan',
    image: '/Pictures/Kerajinan/SET BAJU BADUY/Model baju putih.webp',
  },
  {
    id: 'set-baju-baduy-pria',
    name: 'Set Baju Baduy Model Pria',
    category: 'Kerajinan',
    image: '/Pictures/Kerajinan/SET BAJU BADUY/Model pria (gambar katalog).webp',
  },
];

/* ─── Main Page ─────────────────────────────────────────────────────────────── */
export default function Home() {
  console.log('Home component rendered - checking for updates');
  const [lang,             setLang]             = useState('en');
  const [activeIndex,      setActiveIndex]      = useState(0);
  const [scrollProgress,   setScrollProgress]   = useState(0);
  const [videoOpacity,     setVideoOpacity]     = useState(1);
  const [videoReady,       setVideoReady]       = useState(false);

  // Shop Catalog states
  const [searchQuery,      setSearchQuery]      = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua Kategori');
  const [isDropdownOpen,   setIsDropdownOpen]   = useState(false);
  const [isInShop,         setIsInShop]         = useState(false);
  const [isShopDocked,     setIsShopDocked]     = useState(false);

  const videoRef        = useRef(null);
  const checkpointRefs  = useRef([]);   // invisible block divs – provide scroll height
  const activeIndexRef  = useRef(0);    // mirrors activeIndex for the wheel stepper
  const shopSectionRef  = useRef(null);
  const categoryBarRef  = useRef(null);

  const t = TRANSLATIONS[lang];
  const sections = t.lines.length;
  
  let videoSrc = "/videos/scene-01.mp4";
  if (activeIndex === 2) {
    videoSrc = "/videos/Video Project 3.mp4";
  } else if (activeIndex === 3) {
    videoSrc = "/videos/scene-04.mp4";
  } else if (activeIndex === 4) {
    videoSrc = "";
  } else if (activeIndex === 5) {
    videoSrc = "/videos/scene-05.mp4";
  }

  /* ── Video: normal playback, endless looping ───────── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = 1.0;
  }, []);

  /* ── Close category dropdown when clicking outside ── */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (categoryBarRef.current && !categoryBarRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isDropdownOpen]);

  /* ── Filtered Products (Search + Category) ────────── */
  const filteredProducts = useMemo(() => {
    return PRODUCTS.filter((item) => {
      const matchCat =
        selectedCategory === 'Semua Kategori' ||
        item.category.toLowerCase() === selectedCategory.toLowerCase();

      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        q === '' ||
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);

      return matchCat && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  /* ── Scroll → active sentence + progress + shop detection ─────────── */
  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.pageYOffset;
      const shopEl = shopSectionRef.current;
      const shopTop = shopEl ? shopEl.offsetTop : document.documentElement.scrollHeight;

      const inShop = scrollY >= shopTop - window.innerHeight * 0.45;
      setIsInShop(inShop);

      const shopOffset = scrollY - shopTop;
      setIsShopDocked(shopOffset > 60);

      if (scrollY < shopTop) {
        const narrativeScrollHeight = Math.max(shopTop - window.innerHeight, 1);
        const progress = Math.min(Math.max(scrollY / narrativeScrollHeight, 0), 1);
        const step = narrativeScrollHeight / (sections - 1);
        const active = step > 0 ? Math.min(Math.round(scrollY / step), sections - 1) : 0;

        activeIndexRef.current = active;
        setActiveIndex(active);
        setScrollProgress(progress);
      } else {
        activeIndexRef.current = sections - 1;
        setActiveIndex(sections - 1);
        setScrollProgress(1);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    requestAnimationFrame(onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [sections]);

  const scrollToSentence = useCallback((idx) => {
    const target = Math.min(Math.max(idx, 0), sections - 1);
    const shopEl = shopSectionRef.current;
    const shopTop = shopEl ? shopEl.offsetTop : document.documentElement.scrollHeight;
    const narrativeScrollHeight = Math.max(shopTop - window.innerHeight, 1);
    const top = (target / (sections - 1)) * narrativeScrollHeight;
    activeIndexRef.current = target;
    window.scrollTo({ top, behavior: 'smooth' });
  }, [sections]);

  /* ── Desktop wheel stepper: narrative tick vs shop free-scroll ───── */
  useEffect(() => {
    const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!isFinePointer) return;

    let cooldown = false;

    const onWheel = (e) => {
      const scrollY = window.pageYOffset;
      const shopEl = shopSectionRef.current;
      const shopTop = shopEl ? shopEl.offsetTop : document.documentElement.scrollHeight;

      // Inside shop catalog
      if (scrollY >= shopTop - 20) {
        // At the very top of shop and scrolling upwards with intent
        if (scrollY <= shopTop + 15 && e.deltaY < -20) {
          e.preventDefault();
          if (cooldown) return;
          scrollToSentence(sections - 1);
          cooldown = true;
          setTimeout(() => { cooldown = false; }, 600);
          return;
        }
        // Allow natural browser scrolling
        return;
      }

      // In narrative: 1 wheel tick = 1 sentence
      e.preventDefault();
      if (cooldown) return;

      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(delta) < 10) return; // ignore jitter

      const dir = delta > 0 ? 1 : -1;

      // At last sentence and scrolling down -> scroll into shop catalog!
      if (activeIndexRef.current === sections - 1 && dir > 0) {
        if (shopEl) {
          window.scrollTo({ top: shopTop, behavior: 'smooth' });
        }
        cooldown = true;
        setTimeout(() => { cooldown = false; }, 700);
        return;
      }

      const next = Math.min(Math.max(activeIndexRef.current + dir, 0), sections - 1);
      if (next === activeIndexRef.current) return;

      scrollToSentence(next);
      cooldown = true;
      setTimeout(() => { cooldown = false; }, 600);
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [sections, scrollToSentence]);

  const toggleLang = useCallback(
    () => setLang((p) => (p === 'en' ? 'id' : 'en')),
    []
  );

  return (
    <main className={styles.main}>

      {/* Custom cursor — only shown on pointer devices */}
      <CustomCursor />

      {/* ── Top scroll progress bar ── */}
      <div
        className={styles.topProgress}
        style={{ width: `${scrollProgress * 100}%` }}
        aria-hidden="true"
      />

      {/* ── Language toggle ── */}
      <button
        className={styles.langToggle}
        onClick={toggleLang}
        aria-label="Toggle language"
      >
        <span className={styles.langActive}>{lang.toUpperCase()}</span>
        <span className={styles.langSep}>|</span>
        <span className={styles.langInactive}>{t.toggleLabel}</span>
      </button>

      {/* ── Fullscreen video background ── */}
      <div className={styles.videoWrapper} style={{ opacity: videoOpacity }}>
        <video
          ref={videoRef}
          className={styles.videoBg}
          src={videoSrc || undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          style={{
            opacity: (videoReady && videoSrc) ? 1 : 0,
            transform: `scale(${1 + scrollProgress * 0.08})`,
          }}
          onLoadedData={() => setVideoReady(true)}
          onCanPlay={() => setVideoReady(true)}
          onError={() => setVideoReady(false)}
        />
        <div className={styles.videoOverlay} />
      </div>

      {/*
        ── Fixed centered text overlay ──
        ALL sentences sit at the EXACT same center position.
        Only the active one is visible (opacity 1), others are opacity 0.
      */}
      <div
        className={styles.textOverlay}
        style={{
          opacity: isInShop ? 0 : 1,
          pointerEvents: 'none',
          transition: 'opacity 0.4s ease',
        }}
      >
        {t.lines.map((line, idx) => (
          <div
            key={idx}
            className={`${styles.textItem} ${
              activeIndex === idx ? styles.textVisible : styles.textHidden
            }`}
          >
            <p className={styles.lineText}>{line}</p>
            <div className={styles.lineDecor} />
          </div>
        ))}
      </div>

      {/* ── Sentence navigation rail (clickable dots) ── */}
      <nav
        className={styles.scrollRail}
        style={{
          opacity: isInShop ? 0 : 1,
          pointerEvents: isInShop ? 'none' : 'auto',
          transition: 'opacity 0.4s ease',
        }}
        aria-label="Navigasi kalimat"
      >
        {t.lines.map((_, idx) => (
          <button
            key={idx}
            className={`${styles.railDot} ${
              activeIndex === idx ? styles.railDotActive : ''
            }`}
            onClick={() => scrollToSentence(idx)}
            aria-label={`Ke kalimat ${idx + 1}`}
          />
        ))}
      </nav>

      {/* ── Scroll hint (fades after the first sentence) ── */}
      <div
        className={`${styles.scrollHint} ${
          activeIndex > 0 || isInShop ? styles.scrollHintHidden : ''
        }`}
      >
        <span className={styles.scrollHintLabel}>SCROLL</span>
        <div className={styles.scrollHintMouse}>
          <span className={styles.scrollHintWheel} />
        </div>
      </div>

      {/*
        ── Invisible scroll canvas ──
        One block per sentence — these divs simply make the page tall
        enough to scroll through the narrative.
      */}
      <div className={styles.scrollCanvas}>
        {t.lines.map((_, idx) => (
          <div
            key={idx}
            ref={(el) => (checkpointRefs.current[idx] = el)}
            className={styles.checkpoint}
          />
        ))}
      </div>

      {/* ── Sesi Katalog Toko Rempah Nusantara ── */}
      <section
        ref={shopSectionRef}
        className={styles.shopSection}
        id="katalog-toko"
      >
        <div className={styles.shopSectionInner}>

          {/* Sticky Controls Header: Search Bar + Category Bar */}
          <div className={`${styles.shopStickyHeader} ${isShopDocked ? styles.headerDocked : ''}`}>
            
            {/* Search Bar: Large at first, shrinks as user scrolls */}
            <div className={`${styles.searchBarWrapper} ${isShopDocked ? styles.searchBarDocked : styles.searchBarHero}`}>
              <div className={styles.searchInner}>
                <span className={styles.searchIcon} aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={lang === 'id' ? 'Cari rempah, olahan pangan, atau kerajinan...' : 'Search spices, foods, or handicrafts...'}
                  className={styles.searchInput}
                  aria-label="Cari barang"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className={styles.clearSearchBtn}
                    aria-label="Bersihkan pencarian"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Category Bar: Kotak memanjang di bawah search bar, muncul perlahan saat scroll */}
            <div
              ref={categoryBarRef}
              className={`${styles.categoryBarContainer} ${isShopDocked ? styles.categoryBarVisible : styles.categoryBarHidden}`}
            >
              <button
                type="button"
                className={styles.categoryBarBox}
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                aria-expanded={isDropdownOpen}
                aria-haspopup="listbox"
              >
                <div className={styles.categoryBarLeft}>
                  <span className={styles.categoryOrnament}>✦</span>
                  <span className={styles.categoryBarLabel}>
                    {lang === 'id' ? 'Kategori Produk' : 'Product Category'}
                  </span>
                  <span className={styles.categorySeparator}>|</span>
                  <span className={styles.categoryCurrent}>
                    {selectedCategory}
                  </span>
                </div>
                <div className={styles.categoryBarRight}>
                  <span className={styles.categoryCountBadge}>
                    {filteredProducts.length} {lang === 'id' ? 'Barang' : 'Items'}
                  </span>
                  <span className={`${styles.categoryChevron} ${isDropdownOpen ? styles.chevronOpen : ''}`}>
                    ▼
                  </span>
                </div>
              </button>

              {/* Dropdown Menu Kategori */}
              {isDropdownOpen && (
                <div className={styles.categoryDropdownMenu} role="listbox">
                  {CATEGORIES.map((cat) => {
                    const count = cat === 'Semua Kategori'
                      ? PRODUCTS.length
                      : PRODUCTS.filter((p) => p.category.toLowerCase() === cat.toLowerCase()).length;
                    const isSelected = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        className={`${styles.dropdownOption} ${isSelected ? styles.dropdownOptionActive : ''}`}
                        onClick={() => {
                          setSelectedCategory(cat);
                          setIsDropdownOpen(false);
                        }}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <span className={styles.dropdownOptionName}>
                          {isSelected ? '● ' : '○ '} {cat}
                        </span>
                        <span className={styles.dropdownOptionCount}>
                          ({count} {lang === 'id' ? 'item' : 'items'})
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Item Cards Grid */}
          <div className={styles.catalogContent}>
            {filteredProducts.length > 0 ? (
              <div className={styles.cardsGrid}>
                {filteredProducts.map((item) => (
                  <div key={item.id} className={styles.itemCard}>
                    <div className={styles.cardFrame}>
                      <div className={styles.cardInner}>
                        <div className={styles.imageContainer}>
                          <img
                            src={encodeURI(item.image)}
                            alt={item.name}
                            className={styles.itemImage}
                            loading="lazy"
                          />
                          <div className={styles.imageOverlay} />
                        </div>
                        <div className={styles.cardBottom}>
                          <h3 className={styles.itemName}>{item.name}</h3>
                          <div className={styles.itemOrnament} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>
                  {lang === 'id' ? 'Barang Tidak Ditemukan' : 'No Items Found'}
                </p>
                <p className={styles.emptySubtitle}>
                  {lang === 'id'
                    ? 'Coba gunakan kata kunci lain atau pilih kategori yang berbeda.'
                    : 'Try another keyword or select a different category.'}
                </p>
              </div>
            )}
          </div>

        </div>
      </section>

    </main>
  );
}
