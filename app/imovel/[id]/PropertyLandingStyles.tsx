export default function PropertyLandingStyles() {
    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Plus+Jakarta+Sans:wght@300;400;600&display=swap" rel="stylesheet" />
            <style dangerouslySetInnerHTML={{ __html: `
                /* =============================================
                   PILGER LANDING PAGE — DARK LUXURY THEME
                   ============================================= */
                .plp-page {
                    min-height: 100vh;
                    background: #0e0e0e;
                    color: #e4e2e2;
                    font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
                    font-size: 16px;
                    line-height: 1.6;
                    letter-spacing: 0.03em;
                    overflow-x: hidden;
                }

                /* === HEADER === */
                .plp-header {
                    position: fixed;
                    top: 0;
                    width: 100%;
                    z-index: 50;
                    background: rgba(19, 19, 20, 0.1);
                    backdrop-filter: blur(24px);
                    -webkit-backdrop-filter: blur(24px);
                    border-bottom: 1px solid rgba(68, 71, 72, 0.3);
                }
                .plp-header-inner {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    max-width: 1440px;
                    margin: 0 auto;
                    padding: 20px 64px;
                }
                .plp-logo {
                    font-family: 'Noto Serif', serif;
                    font-size: 22px;
                    letter-spacing: -0.02em;
                    color: #e4e2e2;
                    text-decoration: none;
                    font-weight: 400;
                }
                .plp-nav {
                    display: none;
                    gap: 32px;
                    align-items: center;
                }
                .plp-nav-link {
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    font-size: 12px;
                    font-weight: 600;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    color: #c4c7c7;
                    text-decoration: none;
                    transition: color 0.3s;
                }
                .plp-nav-link:hover { color: #e4e2e2; }
                .plp-nav-cta {
                    padding: 10px 24px;
                    background: #e9c176;
                    color: #0a0a0a;
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    font-size: 12px;
                    font-weight: 600;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    text-decoration: none;
                    border: none;
                    cursor: pointer;
                    transition: opacity 0.3s;
                }
                .plp-nav-cta:hover { opacity: 0.85; }

                /* === HERO === */
                .plp-hero {
                    position: relative;
                    height: 100vh;
                    min-height: 600px;
                    width: 100%;
                    display: flex;
                    align-items: flex-end;
                }
                .plp-hero-gradient {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to bottom, rgba(14,14,14,0.15) 0%, rgba(14,14,14,0.85) 100%);
                    z-index: 1;
                    pointer-events: none;
                }
                .plp-hero-content {
                    position: relative;
                    z-index: 2;
                    width: 100%;
                    padding: 0 64px 80px;
                }
                .plp-hero-inner {
                    max-width: 1440px;
                    margin: 0 auto;
                }
                .plp-hero-kicker {
                    display: inline-block;
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    font-size: 12px;
                    font-weight: 600;
                    letter-spacing: 0.3em;
                    color: #e9c176;
                    margin-bottom: 20px;
                }
                .plp-hero-title {
                    font-family: 'Noto Serif', serif;
                    font-size: clamp(2.5rem, 5vw, 80px);
                    font-weight: 400;
                    line-height: 1.1;
                    letter-spacing: -0.02em;
                    margin: 0 0 16px;
                    color: #e4e2e2;
                    text-shadow: 0 4px 12px rgba(0,0,0,0.5);
                    max-width: 900px;
                }
                .plp-hero-subtitle {
                    font-size: 18px;
                    font-weight: 300;
                    letter-spacing: 0.05em;
                    color: #c4c7c7;
                    margin: 0 0 32px;
                    max-width: 700px;
                }
                .plp-hero-actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 16px;
                    margin-bottom: 48px;
                }
                .plp-btn-gold {
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    padding: 16px 40px;
                    background: #e9c176;
                    color: #0a0a0a;
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    font-size: 12px;
                    font-weight: 600;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    text-decoration: none;
                    border: none;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .plp-btn-gold:hover { opacity: 0.9; transform: scale(1.02); }
                .plp-btn-ghost {
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    padding: 16px 40px;
                    background: transparent;
                    color: #e9c176;
                    border: 1px solid #e9c176;
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    font-size: 12px;
                    font-weight: 600;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    text-decoration: none;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .plp-btn-ghost:hover { background: rgba(233,193,118,0.1); }
                .plp-btn-ghost-white {
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    padding: 16px 48px;
                    background: transparent;
                    color: #fff;
                    border: 1px solid #fff;
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    font-size: 12px;
                    font-weight: 600;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    text-decoration: none;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .plp-btn-ghost-white:hover { background: rgba(255,255,255,0.1); }
                .plp-hero-price-bar {
                    padding-top: 24px;
                    border-top: 1px solid rgba(68,71,72,0.3);
                }
                .plp-price-label {
                    font-size: 10px;
                    font-weight: 600;
                    letter-spacing: 0.2em;
                    color: #78797a;
                    margin: 0 0 4px;
                }
                .plp-price-value {
                    font-family: 'Noto Serif', serif;
                    font-size: 32px;
                    font-weight: 400;
                    color: #e9c176;
                    margin: 0;
                }

                /* === SECTIONS === */
                .plp-section { padding: 120px 0; }
                .plp-container { max-width: 1440px; margin: 0 auto; padding: 0 64px; }
                .plp-narrow { max-width: 800px; margin: 0 auto; text-align: center; padding: 0 64px; }
                .plp-section-head { text-align: center; margin-bottom: 64px; }

                /* === TYPOGRAPHY === */
                .plp-headline-lg {
                    font-family: 'Noto Serif', serif;
                    font-size: clamp(28px, 3.5vw, 48px);
                    font-weight: 400;
                    line-height: 1.2;
                    letter-spacing: -0.01em;
                    color: #e4e2e2;
                    margin: 0 0 24px;
                }
                .plp-headline-md {
                    font-family: 'Noto Serif', serif;
                    font-size: clamp(24px, 2.5vw, 32px);
                    font-weight: 400;
                    line-height: 1.3;
                    color: #e4e2e2;
                    margin: 16px 0 20px;
                }
                .plp-display {
                    font-family: 'Noto Serif', serif;
                    font-size: clamp(28px, 5vw, 64px);
                    font-weight: 400;
                    line-height: 1.1;
                    letter-spacing: -0.02em;
                    color: #e4e2e2;
                    margin: 0 0 40px;
                    max-width: 900px;
                    margin-left: auto;
                    margin-right: auto;
                }
                .plp-body-lg {
                    font-size: 18px;
                    font-weight: 300;
                    line-height: 1.6;
                    letter-spacing: 0.05em;
                    color: #c4c7c7;
                    margin: 0;
                }
                .plp-kicker {
                    display: block;
                    font-size: 12px;
                    font-weight: 600;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    color: #e9c176;
                    margin-bottom: 12px;
                }
                .plp-gold { color: #e9c176; }
                .plp-sparkle {
                    display: block;
                    font-size: 32px;
                    color: #e9c176;
                    margin-bottom: 24px;
                }

                /* === NARRATIVE === */
                .plp-narrative .plp-headline-lg { font-style: italic; }

                /* === STATS CARDS === */
                .plp-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 32px;
                }
                .plp-glass-card {
                    background: rgba(255,255,255,0.05);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid rgba(68,71,72,0.2);
                    padding: 40px;
                    transition: border-color 0.3s;
                }
                .plp-glass-card:hover { border-color: rgba(233,193,118,0.4); }
                .plp-stat-number {
                    font-family: 'Noto Serif', serif;
                    font-size: 48px;
                    font-weight: 400;
                    line-height: 1.2;
                    color: #e9c176;
                    margin: 0 0 8px;
                    transition: transform 0.3s;
                    transform-origin: left;
                }
                .plp-glass-card:hover .plp-stat-number { transform: scale(1.08); }
                .plp-stat-label {
                    font-size: 12px;
                    font-weight: 600;
                    letter-spacing: 0.2em;
                    color: #c4c7c7;
                    margin: 0;
                }

                /* === EDITORIAL GALLERY === */
                .plp-editorial { padding: 80px 0 0; }
                .plp-editorial-row {
                    display: flex;
                    align-items: center;
                    gap: 80px;
                    padding: 0 64px;
                    max-width: 1440px;
                    margin: 0 auto 120px;
                }
                .plp-editorial-row.reversed { flex-direction: row-reverse; }
                .plp-editorial-text { flex: 1; }
                .plp-editorial-num {
                    font-size: 12px;
                    font-weight: 600;
                    letter-spacing: 0.2em;
                    color: #78797a;
                }
                .plp-editorial-img {
                    flex: 1;
                }
                .plp-editorial-img img {
                    width: 100%;
                    aspect-ratio: 4 / 5;
                    object-fit: cover;
                    display: block;
                }

                /* === HIGHLIGHTS BG === */
                .plp-highlights-bg {
                    background: #1b1c1c;
                    border-top: 1px solid rgba(68,71,72,0.1);
                    border-bottom: 1px solid rgba(68,71,72,0.1);
                }
                .plp-amenities-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 0;
                }
                .plp-amenity-item {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 20px 0;
                    border-bottom: 1px solid rgba(68,71,72,0.3);
                    font-size: 16px;
                    color: #e4e2e2;
                    transition: transform 0.2s;
                }
                .plp-amenity-item:hover { transform: translateX(8px); }
                .plp-amenity-arrow {
                    color: #e9c176;
                    font-size: 18px;
                    flex-shrink: 0;
                    transition: transform 0.2s;
                }
                .plp-amenity-item:hover .plp-amenity-arrow { transform: translateX(4px); }

                /* === FICHA TÉCNICA === */
                .plp-ficha-title {
                    border-left: 4px solid #e9c176;
                    padding-left: 32px;
                    margin-bottom: 64px;
                }
                .plp-ficha-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 48px 32px;
                }
                .plp-ficha-item {
                    border-bottom: 1px solid rgba(68,71,72,0.3);
                    padding-bottom: 16px;
                }
                .plp-ficha-label {
                    font-size: 10px;
                    font-weight: 600;
                    letter-spacing: 0.2em;
                    color: #78797a;
                    margin: 0 0 8px;
                }
                .plp-ficha-value {
                    font-size: 18px;
                    font-weight: 300;
                    letter-spacing: 0.05em;
                    color: #e4e2e2;
                    margin: 0;
                }

                /* === MAP / LOCATION === */
                .plp-map-layout {
                    display: grid;
                    grid-template-columns: 1fr 2fr;
                    gap: 80px;
                    align-items: center;
                }
                .plp-map-text { }
                .plp-map-text .plp-headline-lg { margin-bottom: 20px; }
                .plp-map-text .plp-body-lg { margin-bottom: 32px; }
                .plp-map-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 12px;
                    font-weight: 600;
                    letter-spacing: 0.2em;
                    color: #e9c176;
                    text-decoration: none;
                    border-bottom: 1px solid #e9c176;
                    padding-bottom: 4px;
                    transition: opacity 0.3s;
                }
                .plp-map-link:hover { opacity: 0.7; }
                .plp-map-embed {
                    position: relative;
                    height: 500px;
                    background: #1f2020;
                    overflow: hidden;
                    border: 1px solid rgba(68,71,72,0.3);
                }

                /* === BROKER === */
                .plp-broker-card {
                    background: rgba(255,255,255,0.05);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    padding: 48px 80px;
                    display: flex;
                    align-items: center;
                    gap: 64px;
                }
                .plp-broker-photo {
                    width: 200px;
                    height: 200px;
                    flex-shrink: 0;
                    overflow: hidden;
                }
                .plp-broker-photo img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    filter: grayscale(1);
                    transition: filter 0.7s;
                }
                .plp-broker-card:hover .plp-broker-photo img { filter: grayscale(0); }
                .plp-broker-info { flex: 1; }
                .plp-broker-info .plp-headline-lg { margin-bottom: 16px; }
                .plp-broker-info .plp-body-lg { margin-bottom: 32px; max-width: 600px; }

                /* === COLLECTIONS === */
                .plp-collections-head {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    margin-bottom: 64px;
                }
                .plp-collections-head .plp-headline-lg { margin-bottom: 0; }
                .plp-see-all {
                    font-size: 12px;
                    font-weight: 600;
                    letter-spacing: 0.2em;
                    color: #e9c176;
                    text-decoration: none;
                    border-bottom: 1px solid #e9c176;
                    padding-bottom: 4px;
                }
                .plp-collections-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 32px;
                }

                /* === FINAL CTA === */
                .plp-final-cta {
                    position: relative;
                    padding: 160px 64px;
                    text-align: center;
                    overflow: hidden;
                }
                .plp-final-cta-bg {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transform: scale(1.1);
                    filter: blur(4px) brightness(0.4);
                }
                .plp-final-cta-overlay {
                    position: absolute;
                    inset: 0;
                    background: rgba(0,0,0,0.4);
                }
                .plp-final-cta-content {
                    position: relative;
                    z-index: 2;
                }
                .plp-final-cta-actions {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: center;
                    gap: 24px;
                }

                /* === FOOTER === */
                .plp-footer {
                    background: #0e0e0e;
                    border-top: 1px solid rgba(68,71,72,0.2);
                    padding: 120px 64px;
                }
                .plp-footer-inner {
                    max-width: 1440px;
                    margin: 0 auto;
                }
                .plp-footer-logo {
                    font-family: 'Noto Serif', serif;
                    font-size: 32px;
                    color: #e4e2e2;
                    display: block;
                    margin-bottom: 16px;
                }
                .plp-footer-copy {
                    font-size: 12px;
                    font-weight: 600;
                    letter-spacing: 0.2em;
                    color: #78797a;
                    margin: 0;
                }

                /* === HERO CAROUSEL OVERRIDES (dark theme) === */
                .plp-page .hero-bottom-fade {
                    background: linear-gradient(
                        to bottom,
                        rgba(14,14,14,0) 0%,
                        rgba(14,14,14,0.15) 25%,
                        rgba(14,14,14,0.5) 50%,
                        rgba(14,14,14,0.85) 75%,
                        #0e0e0e 100%
                    ) !important;
                }
                .plp-page .hero-carousel-arrow {
                    background: rgba(255,255,255,0.08);
                    backdrop-filter: blur(8px);
                    color: #e4e2e2;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .plp-page .hero-view-photos-btn {
                    background: rgba(255,255,255,0.08);
                    backdrop-filter: blur(8px);
                    color: #e4e2e2;
                    border: 1px solid rgba(255,255,255,0.1);
                }

                /* === MOBILE NAV DARK === */
                .plp-page .mobile-nav {
                    background: rgba(14,14,14,0.95);
                    backdrop-filter: blur(12px);
                    border-top: 1px solid rgba(68,71,72,0.3);
                }
                .plp-page .nav-item { color: #78797a; }
                .plp-page .nav-item:hover { color: #c4c7c7; }
                .plp-page .nav-item.active { color: #e9c176; }

                /* === RESPONSIVE === */
                @media (min-width: 769px) {
                    .plp-nav { display: flex; }
                }

                @media (max-width: 1024px) {
                    .plp-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 16px; }
                    .plp-glass-card { padding: 28px; }
                    .plp-stat-number { font-size: 36px; }
                    .plp-ficha-grid { grid-template-columns: repeat(2, 1fr); gap: 32px 24px; }
                    .plp-editorial-row { gap: 40px; }
                    .plp-collections-grid { grid-template-columns: repeat(2, 1fr); }
                    .plp-broker-card { padding: 40px; gap: 40px; }
                    .plp-map-layout { grid-template-columns: 1fr 1fr; gap: 40px; }
                    .plp-map-embed { height: 400px; }
                }

                @media (max-width: 768px) {
                    .plp-header-inner { padding: 16px 20px; }
                    .plp-logo { font-size: 18px; }
                    .plp-hero { height: 85vh; min-height: 500px; }
                    .plp-hero-content { padding: 0 24px 48px; }
                    .plp-hero-title { font-size: 2rem; }
                    .plp-hero-subtitle { font-size: 15px; }
                    .plp-hero-actions { flex-direction: column; }
                    .plp-btn-gold, .plp-btn-ghost, .plp-btn-ghost-white {
                        width: 100%;
                        justify-content: center;
                        padding: 14px 24px;
                    }
                    .plp-price-value { font-size: 24px; }

                    .plp-section { padding: 80px 0; }
                    .plp-container, .plp-narrow { padding: 0 24px; }
                    .plp-headline-lg { font-size: 24px; }
                    .plp-body-lg { font-size: 16px; }
                    .plp-section-head { margin-bottom: 40px; }

                    .plp-stats-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
                    .plp-glass-card { padding: 24px 20px; }
                    .plp-stat-number { font-size: 28px; }

                    .plp-editorial-row,
                    .plp-editorial-row.reversed {
                        flex-direction: column;
                        gap: 32px;
                        padding: 0 24px;
                        margin-bottom: 80px;
                    }
                    .plp-editorial-img img { aspect-ratio: 16 / 10; }

                    .plp-ficha-grid { grid-template-columns: 1fr 1fr; gap: 24px 16px; }
                    .plp-ficha-title { padding-left: 20px; margin-bottom: 40px; }

                    .plp-map-layout { grid-template-columns: 1fr; gap: 32px; }
                    .plp-map-embed { height: 300px; }
                    .plp-map-text { text-align: center; }

                    .plp-broker-card {
                        flex-direction: column;
                        padding: 32px 24px;
                        text-align: center;
                        gap: 32px;
                    }
                    .plp-broker-photo { width: 160px; height: 160px; margin: 0 auto; }
                    .plp-broker-info .plp-body-lg { margin-left: auto; margin-right: auto; }

                    .plp-collections-head { flex-direction: column; gap: 16px; align-items: flex-start; margin-bottom: 40px; }
                    .plp-collections-grid { grid-template-columns: 1fr; gap: 24px; }

                    .plp-final-cta { padding: 100px 24px; }
                    .plp-display { font-size: 24px; }
                    .plp-final-cta-actions { flex-direction: column; }

                    .plp-footer { padding: 64px 24px; }
                    .plp-footer-logo { font-size: 24px; }

                    .plp-page { padding-bottom: 60px; }
                }

                @media (min-width: 769px) and (max-width: 768px) {
                    .mobile-nav { display: none; }
                }
                @media (min-width: 769px) {
                    .plp-page .mobile-nav { display: none; }
                }
            ` }} />
        </>
    )
}
