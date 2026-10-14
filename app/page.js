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
  { id: 'Rempah', label: { id: 'Rempah', en: 'Spices' } },
  { id: 'Olahan bahan makanan', label: { id: 'Olahan Bahan Makanan', en: 'Processed Foods' } },
  { id: 'Kerajinan', label: { id: 'Kerajinan', en: 'Handicrafts' } },
];

const PRODUCTS = [
  // Rempah
  {
    id: 'bawang-merah',
    name: { id: 'Bawang Merah', en: 'Shallots' },
    category: 'Rempah',
    image: '/Pictures/rempah/bawang merah.webp',
  },
  {
    id: 'bunga-lawang',
    name: { id: 'Bunga Lawang', en: 'Star Anise' },
    category: 'Rempah',
    image: '/Pictures/rempah/bunga lawang.webp',
  },
  {
    id: 'cabai-kering',
    name: { id: 'Cabai Kering', en: 'Dried Chili' },
    category: 'Rempah',
    image: '/Pictures/rempah/cabai kering.webp',
  },
  {
    id: 'cengkeh',
    name: { id: 'Cengkeh', en: 'Cloves' },
    category: 'Rempah',
    image: '/Pictures/rempah/cengkeh.webp',
  },
  {
    id: 'daun-salam-kering',
    name: { id: 'Daun Salam Kering', en: 'Dried Bay Leaves' },
    category: 'Rempah',
    image: '/Pictures/rempah/daun salam kering.webp',
  },
  {
    id: 'jintan',
    name: { id: 'Jintan', en: 'Cumin' },
    category: 'Rempah',
    image: '/Pictures/rempah/jintan.webp',
  },
  {
    id: 'kayu-manis',
    name: { id: 'Kayu Manis', en: 'Cinnamon' },
    category: 'Rempah',
    image: '/Pictures/rempah/kayu manis.webp',
  },
  {
    id: 'kemiri',
    name: { id: 'Kemiri', en: 'Candlenut' },
    category: 'Rempah',
    image: '/Pictures/rempah/kemiri.webp',
  },
  {
    id: 'ketumbar',
    name: { id: 'Ketumbar', en: 'Coriander' },
    category: 'Rempah',
    image: '/Pictures/rempah/ketumbar.webp',
  },
  {
    id: 'kunyit',
    name: { id: 'Kunyit', en: 'Turmeric' },
    category: 'Rempah',
    image: '/Pictures/rempah/kunyit.webp',
  },
  {
    id: 'lada-hitam',
    name: { id: 'Lada Hitam', en: 'Black Pepper' },
    category: 'Rempah',
    image: '/Pictures/rempah/lada hitam.webp',
  },
  {
    id: 'lengkuas',
    name: { id: 'Lengkuas', en: 'Galangal' },
    category: 'Rempah',
    image: '/Pictures/rempah/lengkuas.webp',
  },
  {
    id: 'pala',
    name: { id: 'Pala', en: 'Nutmeg' },
    category: 'Rempah',
    image: '/Pictures/rempah/pala.webp',
  },
  {
    id: 'serai',
    name: { id: 'Serai', en: 'Lemongrass' },
    category: 'Rempah',
    image: '/Pictures/rempah/serai.webp',
  },

  // Olahan bahan makanan
  {
    id: 'cireng',
    name: { id: 'Cireng', en: 'Cireng' },
    category: 'Olahan bahan makanan',
    image: '/Pictures/Olahan bahan makanan/cireng.webp',
  },
  {
    id: 'emping',
    name: { id: 'Emping', en: 'Emping (Melinjo Crackers)' },
    category: 'Olahan bahan makanan',
    image: '/Pictures/Olahan bahan makanan/emping.webp',
  },
  {
    id: 'kerupuk-rambak',
    name: { id: 'Kerupuk Rambak', en: 'Skin Crackers' },
    category: 'Olahan bahan makanan',
    image: '/Pictures/Olahan bahan makanan/kerupuk rambak.webp',
  },
  {
    id: 'kerupuk-udang',
    name: { id: 'Kerupuk Udang', en: 'Prawn Crackers' },
    category: 'Olahan bahan makanan',
    image: '/Pictures/Olahan bahan makanan/kerupuk udang.webp',
  },
  {
    id: 'pempek',
    name: { id: 'Pempek', en: 'Pempek (Fish Cake)' },
    category: 'Olahan bahan makanan',
    image: '/Pictures/Olahan bahan makanan/pempek.webp',
  },

  // Kerajinan
  {
    id: 'arang-briket-kubus',
    name: { id: 'Arang Briket Kubus', en: 'Cube Charcoal Briquettes' },
    category: 'Kerajinan',
    image: '/Pictures/Kerajinan/Arang Briket kubus.webp',
  },
  {
    id: 'dupa-kerucut',
    name: { id: 'Dupa Kerucut', en: 'Cone Incense' },
    category: 'Kerajinan',
    image: '/Pictures/Kerajinan/dupa kerucut.webp',
  },
  {
    id: 'baju-baduy-jokowi',
    name: { id: 'Baju Baduy Model Jokowi', en: 'Jokowi Model Baduy Shirt' },
    category: 'Kerajinan',
    image: '/Pictures/Kerajinan/SET BAJU BADUY/Model baju baduy jokowi.webp',
  },
  {
    id: 'set-baju-baduy-hitam',
    name: { id: 'Set Baju Baduy Hitam', en: 'Black Baduy Shirt Set' },
    category: 'Kerajinan',
    image: '/Pictures/Kerajinan/SET BAJU BADUY/Model baju hitam (gambar katalog).webp',
  },
  {
    id: 'set-baju-baduy-putih',
    name: { id: 'Set Baju Baduy Putih', en: 'White Baduy Shirt Set' },
    category: 'Kerajinan',
    image: '/Pictures/Kerajinan/SET BAJU BADUY/Model putih.webp',
  },
  {
    id: 'set-baju-baduy-pria',
    name: { id: 'Set Baju Baduy Model Pria', en: 'Men Model Baduy Shirt' },
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
  const [searchQuery,            setSearchQuery]            = useState('');
  const [isInShop,               setIsInShop]               = useState(false);
  const [isShopDocked,           setIsShopDocked]           = useState(false);
  const [shopTransitionProgress, setShopTransitionProgress] = useState(0);
  const [activeDropdownCat,      setActiveDropdownCat]      = useState(null);

  const videoRef        = useRef(null);
  const checkpointRefs  = useRef([]);   // invisible block divs – provide scroll height
  const activeIndexRef  = useRef(0);    // mirrors activeIndex for the wheel stepper
  const shopSectionRef  = useRef(null);
  const categoryBlockRefs = useRef({});

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

  /* ── Filtered Products (Search) ────────── */
  const filteredProducts = useMemo(() => {
    return PRODUCTS.filter((item) => {
      const q = searchQuery.trim().toLowerCase();
      return (
        q === '' ||
        item.name.id.toLowerCase().includes(q) ||
        item.name.en.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [searchQuery]);

  /* ── Close dropdown when clicking outside ── */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(`.${styles.stickyCategoryBar}`)) {
        setActiveDropdownCat(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

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

      if (shopOffset >= 0) {
        const progress = Math.min(shopOffset / 550, 1);
        setShopTransitionProgress(progress);
      } else {
        setShopTransitionProgress(0);
      }

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

  const scrollToCategory = useCallback((catId) => {
    setActiveDropdownCat(null);
    const el = categoryBlockRefs.current[catId];
    if (el) {
      const y = el.getBoundingClientRect().top + window.pageYOffset - 85;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, []);

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
        <div 
          className={styles.shopPaperBg}
          style={{ opacity: shopTransitionProgress }} 
        />
        <div className={styles.shopSectionInner}>
          
          {/* Sticky Controls Header: YouTube-style Search Bar */}
          <div 
            className={`${styles.shopStickyHeader} ${shopTransitionProgress > 0.85 ? styles.headerDocked : ''}`}
            style={{
              paddingTop: `calc(${Math.max(12, 42 - shopTransitionProgress * 38)}vh)`,
              paddingBottom: `calc(${Math.max(12, 42 - shopTransitionProgress * 38)}vh)`,
              backgroundColor: `rgba(10, 8, 6, ${1 - shopTransitionProgress})`
            }}
          >
            <div className={`${styles.searchBarWrapper} ${shopTransitionProgress > 0.85 ? styles.searchBarDocked : styles.searchBarHero}`}>
              <div className={styles.searchInner}>
                <span className={styles.searchIcon} aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="let me fill your kitchen"
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
                <button
                  type="button"
                  className={styles.searchSubmitBtn}
                  aria-label="Cari"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Spacer so the search bar moves upward as user scrolls */}
          <div style={{ height: '50vh' }} />

          {/* Item Cards Grid Grouped */}
          <div 
            className={styles.catalogContent}
            style={{
              opacity: Math.max(0, (shopTransitionProgress - 0.15) / 0.85),
              transform: `translateY(${(1 - shopTransitionProgress) * 120}px)`,
              pointerEvents: shopTransitionProgress > 0.2 ? 'auto' : 'none'
            }}
          >
            {filteredProducts.length > 0 ? (
              CATEGORIES.map((categoryObj) => {
                const catProducts = filteredProducts.filter(p => p.category === categoryObj.id);
                if (catProducts.length === 0) return null;
                const isDropdownOpen = activeDropdownCat === categoryObj.id;

                return (
                  <div 
                    key={categoryObj.id} 
                    ref={(el) => (categoryBlockRefs.current[categoryObj.id] = el)}
                    className={styles.categoryBlock}
                  >
                    <div 
                      className={styles.stickyCategoryBar}
                      onClick={() => setActiveDropdownCat(isDropdownOpen ? null : categoryObj.id)}
                      role="button"
                      tabIndex={0}
                      aria-haspopup="listbox"
                      aria-expanded={isDropdownOpen}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setActiveDropdownCat(isDropdownOpen ? null : categoryObj.id);
                        }
                      }}
                    >
                      <div className={styles.categoryBarLeft}>
                        <span className={styles.categoryOrnament}>✦</span>
                        <span className={styles.categoryTitle}>{categoryObj.label[lang]}</span>
                        <span className={`${styles.categoryChevron} ${isDropdownOpen ? styles.chevronOpen : ''}`}>
                          ▼
                        </span>
                      </div>
                      <div className={styles.categoryBarRight}>
                        <span className={styles.categoryCountBadge}>
                          {catProducts.length} {lang === 'id' ? 'Barang' : 'Items'}
                        </span>
                      </div>

                      {/* Interactive Dropdown Menu */}
                      {isDropdownOpen && (
                        <div 
                          className={styles.categoryDropdownMenu} 
                          role="listbox"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className={styles.dropdownHeader}>
                            <span>{lang === 'id' ? 'PILIH KATEGORI PRODUK' : 'CHOOSE PRODUCT CATEGORY'}</span>
                          </div>
                          {CATEGORIES.map((c) => {
                            const count = filteredProducts.filter(p => p.category === c.id).length;
                            const isCurrent = c.id === categoryObj.id;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                className={`${styles.dropdownOption} ${isCurrent ? styles.dropdownOptionActive : ''}`}
                                onClick={() => scrollToCategory(c.id)}
                                role="option"
                                aria-selected={isCurrent}
                              >
                                <span className={styles.dropdownOptionName}>
                                  {isCurrent ? '● ' : '○ '} {c.label[lang]}
                                </span>
                                <span className={styles.dropdownOptionCount}>
                                  ({count} {lang === 'id' ? 'barang' : 'items'})
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className={styles.cardsGrid}>
                      {catProducts.map((item) => (
                        <div key={item.id} className={styles.itemCard}>
                          <div className={styles.cardFrame}>
                            <div className={styles.cardInner}>
                              <div className={styles.imageContainer}>
                                <img
                                  src={encodeURI(item.image)}
                                  alt={item.name[lang]}
                                  className={styles.itemImage}
                                  loading="lazy"
                                />
                                <div className={styles.imageOverlay} />
                              </div>
                              <div className={styles.cardBottom}>
                                <h3 className={styles.itemName}>{item.name[lang]}</h3>
                                <div className={styles.itemOrnament} />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>
                  {lang === 'id' ? 'Barang Tidak Ditemukan' : 'No Items Found'}
                </p>
                <p className={styles.emptySubtitle}>
                  {lang === 'id'
                    ? 'Coba gunakan kata kunci lain.'
                    : 'Try another keyword.'}
                </p>
              </div>
            )}
          </div>

        </div>
      </section>

    </main>
  );
}
