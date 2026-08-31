'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
      'Once, our life was very prosperous and harmonious',
      'We all depended our lives on nature',
      'Nature provided everything we needed',
      'But all of this changed suddenly',
      'Together with their armada they arrived',
    ],
    toggleLabel: 'ID',
  },
  id: {
    lines: [
      'Sebelumnya hidup kami sangat makmur dan rukun',
      'Kami semua menggantungkan hidup kepada alam',
      'Alam memberikan semua yang kami butuhkan',
      'Tapi semua ini berubah tiba-tiba',
      'Bersama armada mereka berdatangan',
    ],
    toggleLabel: 'EN',
  },
};

/* ─── Main Page ─────────────────────────────────────────────────────────────── */
export default function Home() {
  console.log('Home component rendered - checking for updates');
  const [lang,          setLang]          = useState('en');
  const [activeIndex,   setActiveIndex]   = useState(0);
  const [scrollProgress,setScrollProgress]= useState(0);
  const [videoOpacity,  setVideoOpacity]  = useState(1);
  const [videoReady,    setVideoReady]    = useState(false);

  const videoRef        = useRef(null);
  const checkpointRefs  = useRef([]);   // invisible block divs – provide scroll height
  const activeIndexRef  = useRef(0);    // mirrors activeIndex for the wheel stepper

  const t = TRANSLATIONS[lang];
  const sections = t.lines.length;
  const isUsingNewVideo = activeIndex === sections - 1;
  const videoSrc = isUsingNewVideo ? "/videos/Video Project 3.mp4" : "/videos/scene-01.mp4";

  /* ── Video: 0.75x speed, ping-pong playback (forward ↔ reverse) ─────────
     Manual reverse via seek, because browsers don't support negative
     playbackRate reliably (would freeze at the end). */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.loop = false;
    video.playbackRate = 0.75;

    const SPEED = 0.75;
    const FRAME_STEP = SPEED / 60; // ~0.0125s per frame at 60fps → same 0.75x speed

    let forward = true;
    let raf = null;

    const step = () => {
      raf = requestAnimationFrame(step);

      const ready = video.duration && video.duration !== Infinity;
      if (!ready) return;

      if (forward) {
        if (video.currentTime >= video.duration - 0.03) {
          // Reached the end → reverse
          forward = false;
          video.pause();
        }
      } else {
        // Reverse: step the timeline backwards
        video.currentTime = Math.max(0, video.currentTime - FRAME_STEP);
        if (video.currentTime <= 0) {
          video.currentTime = 0;
          forward = true;
          video.playbackRate = SPEED;
          video.play().catch(() => {/* ignore */});
        }
      }
    };

    video.play().catch(() => {/* ignore */});
    raf = requestAnimationFrame(step);

    return () => cancelAnimationFrame(raf);
  }, []);

  /* ── Scroll → active sentence + progress + video fade ────────────────── */
  useEffect(() => {
    const onScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const scrollY = window.pageYOffset;

      const progress = maxScroll > 0 ? Math.min(Math.max(scrollY / maxScroll, 0), 1) : 0;
      const step = maxScroll / (sections - 1);
      const active = step > 0 ? Math.min(Math.round(scrollY / step), sections - 1) : 0;

      activeIndexRef.current = active;
      setActiveIndex(active);
      setScrollProgress(progress);

      // Video logic:
      // - For the NEW last section (index = sections-1): show the new video (Video Project 3.mp4)
      // - For the ORIGINAL last section (index = sections-2): fade to dark (preserve original behavior)
      // - For all other sections: show the original video (scene-01.mp4)
      if (active === sections - 1) {
        // New last section: show new video
        setVideoOpacity(1);
      } else if (active === sections - 2) {
        // Original last section: fade to dark (preserve original behavior)
        setVideoOpacity(0);
      } else {
        // All other sections: show original video
        setVideoOpacity(1);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    requestAnimationFrame(onScroll);
    return () => window.removeEventListener('scroll', onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Desktop wheel stepper: 1 wheel tick = 1 sentence ─────────────────── */
  useEffect(() => {
    // Only intercept the wheel on fine-pointer (desktop) devices
    const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!isFinePointer) return;

    let cooldown = false;

    const onWheel = (e) => {
      // Desktop scrolling is fully controlled here
      e.preventDefault();

      if (cooldown) return;

      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(delta) < 10) return; // ignore jitter

      const dir = delta > 0 ? 1 : -1;
      const next = Math.min(Math.max(activeIndexRef.current + dir, 0), sections - 1);
      if (next === activeIndexRef.current) return;

      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const top = maxScroll > 0 ? (next / (sections - 1)) * maxScroll : 0;
      window.scrollTo({ top, behavior: 'smooth' });

      cooldown = true;
      setTimeout(() => { cooldown = false; }, 600);
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleLang = useCallback(
    () => setLang((p) => (p === 'en' ? 'id' : 'en')),
    []
  );

  const scrollToSentence = useCallback((idx) => {
    const target = Math.min(Math.max(idx, 0), sections - 1);
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const top = maxScroll > 0 ? (target / (sections - 1)) * maxScroll : 0;
    activeIndexRef.current = target;
    window.scrollTo({ top, behavior: 'smooth' });
  }, [sections]);

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
          src={videoSrc}
          autoPlay
          muted
          playsInline
          preload="auto"
          style={{
            opacity: videoReady ? 1 : 0,
            // subtle scroll-linked zoom effect
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
        No position change → pure cross-fade.
      */}
      <div className={styles.textOverlay}>
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
      <nav className={styles.scrollRail} aria-label="Navigasi kalimat">
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
          activeIndex > 0 ? styles.scrollHintHidden : ''
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

    </main>
  );
}
