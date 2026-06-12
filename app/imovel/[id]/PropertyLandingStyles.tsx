export default function PropertyLandingStyles() {
    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: `
                :root {
                    --plp-bg: #f3f4f1;
                    --plp-surface: #ffffff;
                    --plp-soft: #eceff1;
                    --plp-ink: #1f2428;
                    --plp-muted: #687078;
                    --plp-line: #dde2e4;
                    --plp-dark: #171a1d;
                    --plp-dark-2: #24292d;
                    --plp-gold: #bd9551;
                    --plp-gold-dark: #8f6930;
                    --plp-green: #0f9f7a;
                    --plp-radius: 8px;
                    --plp-shadow: 0 16px 44px rgba(19, 24, 29, 0.12);
                    --plp-photo-aspect: 4 / 3;
                }

                .plp-page {
                    min-height: 100vh;
                    background: var(--plp-bg);
                    color: var(--plp-ink);
                    font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    letter-spacing: 0;
                    overflow-x: hidden;
                }

                .plp-page * {
                    box-sizing: border-box;
                }

                .plp-shell {
                    width: min(calc(100% - clamp(28px, 5vw, 96px)), 1760px);
                    margin: 0 auto;
                    background: var(--plp-surface);
                    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
                }

                .plp-header {
                    display: grid;
                    grid-template-columns: minmax(210px, 280px) minmax(0, 1fr) 42px;
                    align-items: center;
                    min-height: 70px;
                    padding: 0 44px;
                    border-bottom: 1px solid var(--plp-line);
                    background: #fff;
                }

                .plp-logo {
                    display: inline-flex;
                    flex-direction: column;
                    color: var(--plp-ink);
                    text-decoration: none;
                }

                .plp-logo span {
                    color: var(--plp-gold);
                    font-size: 22px;
                    font-weight: 900;
                    line-height: 1;
                    text-transform: uppercase;
                }

                .plp-logo small {
                    margin-top: 4px;
                    color: var(--plp-muted);
                    font-size: 11px;
                    font-weight: 800;
                    text-transform: uppercase;
                }

                .plp-nav {
                    display: flex;
                    justify-content: center;
                    gap: 28px;
                }

                .plp-nav a,
                .plp-search-link {
                    color: var(--plp-ink);
                    font-size: 13px;
                    font-weight: 800;
                    text-decoration: none;
                    text-transform: uppercase;
                }

                .plp-nav a:hover,
                .plp-search-link:hover {
                    color: var(--plp-gold-dark);
                }

                .plp-search-link {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 38px;
                    height: 38px;
                    border-radius: var(--plp-radius);
                }

                .plp-search-link:hover {
                    background: var(--plp-soft);
                }

                .plp-mobile-menu {
                    display: none;
                }

                .plp-mobile-menu-button {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 38px;
                    height: 38px;
                    border: 0;
                    border-radius: var(--plp-radius);
                    background: transparent;
                    color: var(--plp-ink);
                    cursor: pointer;
                }

                .plp-mobile-menu-button:hover {
                    background: var(--plp-soft);
                    color: var(--plp-gold-dark);
                }

                .plp-mobile-menu-layer {
                    position: fixed;
                    inset: 0;
                    z-index: 1000;
                    display: flex;
                    justify-content: flex-end;
                    background: rgba(21, 26, 29, 0.44);
                    backdrop-filter: blur(3px);
                }

                .plp-mobile-menu-panel {
                    width: min(88vw, 360px);
                    height: 100%;
                    padding: 18px;
                    overflow-y: auto;
                    background: #fff;
                    box-shadow: -18px 0 44px rgba(19, 24, 29, 0.22);
                }

                .plp-mobile-menu-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    padding-bottom: 16px;
                    border-bottom: 1px solid var(--plp-line);
                }

                .plp-mobile-menu-head strong,
                .plp-mobile-menu-head span {
                    display: block;
                    text-transform: uppercase;
                }

                .plp-mobile-menu-head strong {
                    color: var(--plp-gold);
                    font-size: 18px;
                    font-weight: 900;
                    line-height: 1;
                }

                .plp-mobile-menu-head span {
                    margin-top: 4px;
                    color: var(--plp-muted);
                    font-size: 11px;
                    font-weight: 850;
                }

                .plp-mobile-menu-head button {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 38px;
                    height: 38px;
                    border: 1px solid var(--plp-line);
                    border-radius: var(--plp-radius);
                    background: #fff;
                    color: var(--plp-ink);
                }

                .plp-mobile-menu-links {
                    display: grid;
                    gap: 8px;
                    padding-top: 16px;
                }

                .plp-mobile-menu-links a {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    min-height: 48px;
                    padding: 0 12px;
                    border: 1px solid var(--plp-line);
                    border-radius: var(--plp-radius);
                    background: #f8f8f6;
                    color: var(--plp-ink);
                    font-size: 14px;
                    font-weight: 850;
                    text-decoration: none;
                }

                .plp-mobile-menu-links a:hover {
                    border-color: rgba(189, 149, 81, 0.34);
                    color: var(--plp-gold-dark);
                }

                .plp-mobile-menu-links .plp-mobile-menu-contact {
                    margin-top: 8px;
                    border-color: rgba(15, 159, 122, 0.22);
                    background: var(--plp-green);
                    color: #fff !important;
                }

                .plp-title-band {
                    padding: 20px 44px 24px;
                    background: #f7f8f6;
                    border-bottom: 1px solid var(--plp-line);
                }

                .plp-breadcrumbs {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 12px;
                    color: var(--plp-muted);
                    font-size: 12px;
                    font-weight: 700;
                }

                .plp-breadcrumbs a {
                    color: var(--plp-muted);
                    text-decoration: none;
                }

                .plp-breadcrumbs strong {
                    color: var(--plp-gold-dark);
                }

                .plp-title-row {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    align-items: end;
                    gap: 24px;
                }

                .plp-kicker {
                    display: block;
                    margin-bottom: 7px;
                    color: var(--plp-gold-dark);
                    font-size: 11px;
                    font-weight: 900;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                }

                .plp-title-row h1 {
                    margin: 0;
                    color: var(--plp-ink);
                    font-size: 26px;
                    font-weight: 850;
                    line-height: 1.16;
                    overflow-wrap: anywhere;
                }

                .plp-rating-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-top: 8px;
                    color: #3f464c;
                    font-size: 12px;
                }

                .plp-rating-row span {
                    display: inline-flex;
                    gap: 2px;
                    color: var(--plp-gold);
                }

                .plp-rating-row strong {
                    font-weight: 900;
                }

                .plp-rating-row small {
                    color: var(--plp-muted);
                    font-weight: 700;
                }

                .plp-view-count {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    white-space: nowrap;
                }

                .plp-view-count svg {
                    width: 14px;
                    height: 14px;
                    color: var(--plp-muted);
                    stroke-width: 2.35;
                }

                .plp-detail-layout {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) clamp(355px, 22vw, 400px);
                    align-items: start;
                    gap: 30px;
                    padding: 28px 44px 36px;
                }

                .plp-main-column {
                    min-width: 0;
                }

                .plp-gallery-composer {
                    position: relative;
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) 104px;
                    gap: 12px;
                    min-height: 0;
                }

                .plp-gallery-composer.single {
                    grid-template-columns: 1fr;
                }

                .plp-main-photo,
                .plp-thumb-item {
                    position: relative;
                    display: block;
                    width: 100%;
                    border: 0;
                    padding: 0;
                    overflow: hidden;
                    border-radius: var(--plp-radius);
                    background: #d9dee0;
                    cursor: pointer;
                    text-decoration: none;
                }

                .plp-main-photo {
                    aspect-ratio: var(--plp-photo-aspect);
                    min-height: 0;
                }

                .plp-main-photo img,
                .plp-thumb-item img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    object-position: center;
                    display: block;
                }

                .plp-main-photo img {
                    position: absolute;
                    inset: 0;
                }

                .plp-photo-badge {
                    position: absolute;
                    left: 14px;
                    bottom: 14px;
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    min-height: 34px;
                    padding: 0 12px;
                    border-radius: var(--plp-radius);
                    background: rgba(23, 26, 29, 0.82);
                    color: #fff;
                    font-size: 12px;
                    font-weight: 850;
                }

                .plp-gallery-top-bar {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-bottom: 8px;
                }

                .plp-gallery-top-bar button {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 5px 11px;
                    border: 1px solid var(--plp-line);
                    border-radius: 20px;
                    background: rgba(255, 255, 255, 0.92);
                    color: var(--plp-ink);
                    font: inherit;
                    font-size: 11px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: background 0.18s;
                }

                .plp-gallery-top-bar button:hover {
                    background: #fff;
                }

                .plp-gallery-top-bar button svg {
                    color: var(--plp-gold-dark);
                    flex-shrink: 0;
                }

                .plp-gallery-count {
                    background: var(--plp-gold-dark);
                    color: #fff;
                    font-size: 10px;
                    font-weight: 900;
                    line-height: 1.4;
                    border-radius: 10px;
                    padding: 1px 5px;
                }

                .plp-thumb-rail {
                    display: grid;
                    grid-template-rows: repeat(5, minmax(0, 1fr));
                    gap: 10px;
                }

                .plp-thumb-item.active {
                    box-shadow: 0 0 0 3px rgba(189, 149, 81, 0.9);
                }

                .plp-thumb-item:hover img,
                .plp-main-photo:hover img,
                .plp-related-card:hover img {
                    transform: scale(1.035);
                }

                .plp-main-photo img,
                .plp-thumb-item img,
                .plp-related-card img {
                    transition: transform 0.32s ease;
                }

                .plp-gallery-modal-backdrop {
                    position: fixed;
                    inset: 0;
                    z-index: 7000;
                    display: flex;
                    align-items: flex-end;
                    justify-content: center;
                    padding: 28px;
                    background: rgba(12, 14, 16, 0.64);
                    backdrop-filter: blur(12px);
                }

                .plp-gallery-modal {
                    width: min(1120px, 100%);
                    max-height: min(92vh, 980px);
                    display: grid;
                    grid-template-rows: auto minmax(0, 1fr);
                    overflow: hidden;
                    border-radius: 14px 14px 0 0;
                    background: #fff;
                    box-shadow: 0 28px 80px rgba(0, 0, 0, 0.34);
                    animation: plp-gallery-rise 0.22s ease-out both;
                }

                .plp-gallery-modal-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 18px;
                    padding: 18px 22px;
                    border-bottom: 1px solid var(--plp-line);
                    background: #fff;
                }

                .plp-gallery-modal-header strong {
                    display: block;
                    margin: 0;
                    color: var(--plp-ink);
                    font-size: 20px;
                    line-height: 1.2;
                }

                .plp-gallery-modal-header button {
                    flex: 0 0 auto;
                    width: 42px;
                    height: 42px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid var(--plp-line);
                    border-radius: 999px;
                    background: #fff;
                    color: var(--plp-ink);
                    cursor: pointer;
                }

                .plp-gallery-modal-scroll {
                    overflow-y: auto;
                    padding: 12px 12px 18px;
                    background: #f6f7f5;
                    scroll-behavior: smooth;
                }

                .plp-gallery-modal-item {
                    width: min(100%, 960px);
                    aspect-ratio: var(--plp-photo-aspect);
                    margin: 0 auto 10px;
                    padding: 0;
                    border-radius: 8px;
                    overflow: hidden;
                    background: #eceff1;
                    border: 0;
                }

                .plp-gallery-modal-item img {
                    display: block;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    object-position: center;
                }

                @keyframes plp-gallery-rise {
                    from {
                        opacity: 0;
                        transform: translateY(28px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .plp-video-card {
                    margin-top: 18px;
                    padding: 18px;
                    border: 1px solid var(--plp-line);
                    border-radius: var(--plp-radius);
                    background: #fff;
                }

                .plp-video-card iframe {
                    display: block;
                    width: 100%;
                    aspect-ratio: 16 / 9;
                    border: 0;
                    border-radius: var(--plp-radius);
                    background: #111;
                }

                .plp-instagram-strip {
                    margin-top: 12px;
                    padding: 12px;
                    border: 1px solid var(--plp-line);
                    border-radius: var(--plp-radius);
                    background: #fbfaf7;
                }

                .plp-social-mini-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    margin-bottom: 10px;
                }

                .plp-social-mini-head span,
                .plp-social-mini-head a,
                .plp-youtube-channel-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    color: var(--plp-gold-dark);
                    font-size: 11px;
                    font-weight: 900;
                    letter-spacing: 0.08em;
                    text-decoration: none;
                    text-transform: uppercase;
                }

                .plp-social-mini-head a {
                    color: var(--plp-muted);
                    font-size: 10px;
                    letter-spacing: 0;
                    text-transform: none;
                    white-space: nowrap;
                }

                .plp-instagram-grid {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 8px;
                }

                .plp-instagram-card {
                    position: relative;
                    display: block;
                    aspect-ratio: 1 / 0.82;
                    overflow: hidden;
                    border-radius: var(--plp-radius);
                    background: #ece8de;
                    color: #fff;
                    text-decoration: none;
                }

                .plp-instagram-card.loading span {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(90deg, #ece8de, #f7f4ee, #ece8de);
                    background-size: 220% 100%;
                    animation: plpSocialSkeleton 1.3s ease-in-out infinite;
                }

                .plp-instagram-card img {
                    display: block;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 0.35s ease;
                }

                .plp-instagram-card:hover img {
                    transform: scale(1.04);
                }

                .plp-instagram-card::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to top, rgba(0,0,0,0.48), rgba(0,0,0,0.02) 62%);
                    opacity: 0.85;
                }

                .plp-instagram-card strong {
                    position: absolute;
                    left: 8px;
                    right: 8px;
                    bottom: 8px;
                    z-index: 1;
                    display: -webkit-box;
                    overflow: hidden;
                    font-size: 10px;
                    font-weight: 800;
                    line-height: 1.2;
                    -webkit-box-orient: vertical;
                    -webkit-line-clamp: 2;
                }

                .plp-youtube-latest {
                    margin-top: 22px;
                    padding: 18px;
                    border: 1px solid var(--plp-line);
                    border-radius: var(--plp-radius);
                    background: linear-gradient(180deg, #fff 0%, #fbfaf7 100%);
                }

                .plp-youtube-thumb,
                .plp-youtube-frame,
                .plp-youtube-loading {
                    position: relative;
                    display: block;
                    width: 100%;
                    aspect-ratio: 16 / 9;
                    overflow: hidden;
                    border: 0;
                    border-radius: var(--plp-radius);
                    background: #111;
                }

                .plp-youtube-loading {
                    display: grid;
                    place-items: center;
                    color: var(--plp-muted);
                    background: #f1eee8;
                    font-size: 13px;
                    font-weight: 800;
                }

                .plp-youtube-thumb {
                    cursor: pointer;
                    text-align: left;
                }

                .plp-youtube-thumb img {
                    display: block;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 0.4s ease;
                }

                .plp-youtube-thumb:hover img {
                    transform: scale(1.035);
                }

                .plp-youtube-thumb::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to top, rgba(0,0,0,0.64), rgba(0,0,0,0.08) 60%);
                }

                .plp-youtube-play {
                    position: absolute;
                    left: 50%;
                    top: 50%;
                    z-index: 2;
                    display: grid;
                    place-items: center;
                    width: 58px;
                    height: 58px;
                    border-radius: 999px;
                    background: var(--plp-gold);
                    color: #fff;
                    transform: translate(-50%, -50%);
                    box-shadow: 0 16px 34px rgba(0,0,0,0.28);
                }

                .plp-youtube-play svg {
                    margin-left: 3px;
                }

                .plp-youtube-thumb strong {
                    position: absolute;
                    left: 16px;
                    right: 16px;
                    bottom: 14px;
                    z-index: 2;
                    display: -webkit-box;
                    overflow: hidden;
                    color: #fff;
                    font-size: clamp(17px, 2vw, 22px);
                    line-height: 1.15;
                    -webkit-box-orient: vertical;
                    -webkit-line-clamp: 2;
                }

                .plp-youtube-frame iframe {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    border: 0;
                }

                .plp-youtube-channel-link {
                    width: fit-content;
                    margin-top: 12px;
                }

                @keyframes plpSocialSkeleton {
                    0% { background-position: 0% 50%; }
                    100% { background-position: -220% 50%; }
                }

                .plp-section {
                    padding: 34px 0 0;
                }

                .plp-section-head {
                    display: flex;
                    align-items: end;
                    justify-content: space-between;
                    gap: 22px;
                    margin-bottom: 20px;
                }

                .plp-section-head.compact {
                    display: block;
                    margin-bottom: 14px;
                }

                .plp-section-head h2,
                .plp-copy-section h2,
                .plp-related-head h2,
                .plp-final-cta h2 {
                    margin: 0;
                    color: var(--plp-ink);
                    font-size: 24px;
                    font-weight: 900;
                    line-height: 1.2;
                }

                .plp-copy-section h2 {
                    margin-bottom: 8px;
                }

                .plp-intro-line {
                    margin: 0 0 16px;
                    color: #4d565d;
                    font-size: 17px;
                    font-weight: 700;
                    line-height: 1.55;
                }

                .plp-highlight-list {
                    display: grid;
                    gap: 8px;
                    margin: 18px 0 22px;
                    padding: 0;
                    list-style: none;
                }

                .plp-highlight-list li {
                    display: grid;
                    grid-template-columns: 22px minmax(0, 1fr);
                    gap: 8px;
                    color: #30373d;
                    font-size: 14px;
                    line-height: 1.52;
                }

                .plp-highlight-list svg {
                    margin-top: 2px;
                    color: var(--plp-green);
                }

                .plp-narrative {
                    display: grid;
                    gap: 13px;
                    max-width: 850px;
                }

                .plp-narrative p,
                .plp-thesis-card p,
                .plp-final-cta p {
                    margin: 0;
                    color: var(--plp-muted);
                    font-size: 14px;
                    line-height: 1.7;
                }

                .plp-spec-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 12px;
                }

                .plp-spec-card {
                    display: grid;
                    grid-template-columns: 42px minmax(0, 1fr);
                    align-items: center;
                    gap: 12px;
                    min-height: 88px;
                    padding: 16px;
                    border: 1px solid var(--plp-line);
                    border-radius: var(--plp-radius);
                    background: #fff;
                }

                .plp-spec-card > span {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 42px;
                    height: 42px;
                    border-radius: var(--plp-radius);
                    background: #f1f3f2;
                    color: var(--plp-gold-dark);
                }

                .plp-spec-card small {
                    display: block;
                    margin-bottom: 4px;
                    color: var(--plp-muted);
                    font-size: 11px;
                    font-weight: 850;
                    text-transform: uppercase;
                }

                .plp-spec-card strong {
                    display: block;
                    color: var(--plp-ink);
                    font-size: 15px;
                    line-height: 1.25;
                    overflow-wrap: anywhere;
                }

                .plp-classic-lists {
                    display: grid;
                    gap: 24px;
                }

                .plp-info-list h3 {
                    margin: 0 0 12px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid var(--plp-line);
                    color: var(--plp-ink);
                    font-size: 18px;
                    font-weight: 900;
                }

                .plp-info-list > div {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 18px;
                }

                .plp-info-list ul {
                    display: grid;
                    gap: 8px;
                    margin: 0;
                    padding: 0;
                    list-style: none;
                }

                .plp-info-list li {
                    position: relative;
                    padding-left: 16px;
                    color: #354049;
                    font-size: 14px;
                    line-height: 1.45;
                }

                .plp-info-list li::before {
                    content: '›';
                    position: absolute;
                    left: 0;
                    color: var(--plp-gold-dark);
                    font-weight: 900;
                }

                .plp-sidebar {
                    position: sticky;
                    top: 16px;
                    display: grid;
                    gap: 14px;
                }

                .plp-side-card {
                    border: 1px solid var(--plp-line);
                    border-radius: var(--plp-radius);
                    background: #fff;
                    box-shadow: 0 12px 30px rgba(19, 24, 29, 0.08);
                }

                .plp-price-card {
                    padding: 14px;
                }

                .plp-side-location {
                    display: flex;
                    align-items: center;
                    gap: 7px;
                    padding: 8px 10px;
                    border: 1px solid rgba(201, 169, 110, 0.2);
                    border-radius: 8px;
                    background: linear-gradient(135deg, rgba(201, 169, 110, 0.1), rgba(248, 250, 249, 0.96));
                }

                .plp-side-location > svg {
                    width: 13px;
                    height: 13px;
                    flex-shrink: 0;
                    color: var(--plp-gold-dark);
                }

                .plp-side-loc-text {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 1px;
                }

                .plp-loc-name {
                    font-size: 10px;
                    font-weight: 700;
                    color: var(--plp-ink);
                    line-height: 1.2;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .plp-loc-sub {
                    font-size: 10px;
                    font-weight: 400;
                    color: var(--plp-muted);
                    line-height: 1.2;
                }

                .plp-loc-price {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    flex-shrink: 0;
                    padding-left: 9px;
                    border-left: 1px solid rgba(201, 169, 110, 0.3);
                }

                .plp-loc-price strong {
                    font-size: 13px;
                    font-weight: 900;
                    color: var(--plp-ink);
                    line-height: 1.15;
                    white-space: nowrap;
                }

                .plp-loc-price > span {
                    font-size: 8px;
                    color: var(--plp-muted);
                    line-height: 1.2;
                }

                .plp-payment-note,
                .plp-lead-card p,
                .plp-broker-card p {
                    margin: 0;
                    color: var(--plp-muted);
                    font-size: 10px;
                    line-height: 1.28;
                }

                .plp-side-facts {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(54px, 1fr));
                    gap: 4px;
                    padding: 7px 0 9px;
                    border-bottom: 1px solid var(--plp-line);
                }

                .plp-side-facts div {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 1px;
                    min-height: 0;
                    padding: 5px 3px;
                    border: 1px solid rgba(53, 64, 73, 0.08);
                    border-radius: 7px;
                    background: #f6f8f7;
                    color: #354049;
                    font-size: 11px;
                    text-align: center;
                }

                .plp-side-facts svg {
                    width: 13px;
                    height: 13px;
                    color: var(--plp-muted);
                    margin-bottom: 1px;
                }

                .plp-side-facts strong {
                    font-size: 11px;
                    font-weight: 900;
                    line-height: 1.1;
                }

                .plp-side-facts span {
                    color: var(--plp-muted);
                    font-size: 8px;
                    line-height: 1.1;
                }

                .plp-price-extras {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px 10px;
                    padding: 0 2px 8px;
                    border-bottom: 1px solid var(--plp-line);
                }

                .plp-price-extras small {
                    color: #5b646b;
                    font-size: 11px;
                    font-weight: 750;
                }

                .plp-whatsapp-button,
                .plp-primary-btn,
                .plp-dark-button,
                .plp-mobile-cta-button {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    min-height: 44px;
                    border-radius: var(--plp-radius);
                    font-size: 13px;
                    font-weight: 900;
                    text-decoration: none;
                    transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
                }

                .plp-whatsapp-button {
                    width: 100%;
                    background: var(--plp-green);
                    color: #fff;
                    box-shadow: 0 12px 24px rgba(15, 159, 122, 0.2);
                }

                .plp-whatsapp-button:hover,
                .plp-primary-btn:hover,
                .plp-dark-button:hover,
                .plp-mobile-cta-button:hover {
                    transform: translateY(-1px);
                }

                .plp-payment-note {
                    margin-top: 6px;
                    font-size: 10px;
                }

                .plp-action-list {
                    display: grid;
                    gap: 5px;
                    margin-top: 9px;
                }

                .plp-action-list button {
                    display: grid;
                    grid-template-columns: 21px minmax(0, 1fr);
                    align-items: center;
                    min-height: 32px;
                    padding: 0 10px;
                    border: 0;
                    border-radius: var(--plp-radius);
                    background: #f1f3f2;
                    color: #3a4249;
                    cursor: pointer;
                    font: inherit;
                    font-size: 12px;
                    font-weight: 800;
                    text-align: left;
                }

                .plp-action-list button:hover {
                    background: #e7ece9;
                }

                .plp-action-list svg {
                    width: 15px;
                    height: 15px;
                    justify-self: center;
                    color: var(--plp-gold-dark);
                }

                .plp-lead-card {
                    padding: 16px;
                }

                .plp-lead-card h3 {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 0 0 10px;
                    color: var(--plp-ink);
                    font-size: 16px;
                }

                .plp-form-preview {
                    display: grid;
                    gap: 8px;
                    margin: 14px 0;
                }

                .plp-form-preview span {
                    display: flex;
                    align-items: center;
                    min-height: 38px;
                    padding: 0 11px;
                    border: 1px solid var(--plp-line);
                    border-radius: var(--plp-radius);
                    color: #8b949b;
                    font-size: 12px;
                    background: #fbfbfa;
                }

                .plp-dark-button {
                    width: 100%;
                    background: #c8a862;
                    color: #10100e;
                    box-shadow: 0 10px 22px rgba(31, 27, 21, 0.14);
                }

                .plp-dark-button:hover {
                    background: #dfc18e;
                }

                .plp-broker-card {
                    display: grid;
                    grid-template-columns: 78px minmax(0, 1fr);
                    gap: 12px;
                    padding: 11px;
                    align-items: center;
                }

                .plp-broker-card img {
                    width: 78px;
                    height: 86px;
                    object-fit: cover;
                    object-position: 28% center;
                    border-radius: var(--plp-radius);
                    background: #d8dde0;
                }

                .plp-broker-card h3 {
                    margin: 0 0 7px;
                    color: var(--plp-ink);
                    font-size: 16px;
                    line-height: 1.2;
                }

                .plp-broker-card p {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-bottom: 5px;
                }

                .plp-broker-card small {
                    color: var(--plp-gold-dark);
                    font-size: 11px;
                    font-weight: 900;
                    line-height: 1.25;
                }

                .plp-gallery-section,
                .plp-thesis-section {
                    padding-left: 44px;
                    padding-right: 44px;
                    padding-bottom: 8px;
                }

                .plp-section-head.with-count {
                    align-items: center;
                }

                .plp-photo-count {
                    display: inline-flex;
                    align-items: center;
                    min-height: 34px;
                    padding: 0 12px;
                    border: 1px solid var(--plp-line);
                    border-radius: var(--plp-radius);
                    color: var(--plp-muted);
                    font-size: 12px;
                    font-weight: 850;
                    white-space: nowrap;
                }

                .plp-page .pd-gallery-grid {
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 10px;
                }

                .plp-page .pd-gallery-item {
                    aspect-ratio: var(--plp-photo-aspect);
                    border-radius: var(--plp-radius);
                    box-shadow: none;
                }

                .plp-page .pd-gallery-overlay span {
                    border-radius: var(--plp-radius);
                }

                .plp-location-band {
                    margin-top: 34px;
                    padding: 34px 44px 44px;
                    border-top: 1px solid var(--plp-line);
                    background: #f7f8f6;
                    color: var(--plp-ink);
                }

                .plp-location-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 18px;
                    margin-bottom: 16px;
                }

                .plp-location-head span {
                    color: var(--plp-ink);
                    font-size: 22px;
                    font-weight: 900;
                }

                .plp-location-head strong {
                    font-size: 13px;
                    color: var(--plp-gold-dark);
                }

                .plp-map-frame {
                    position: relative;
                    min-height: clamp(360px, 34vw, 540px);
                    height: clamp(360px, 34vw, 540px);
                    overflow: hidden;
                    border: 1px solid rgba(35, 31, 26, 0.08);
                    border-radius: var(--plp-radius);
                    background: #111;
                    box-shadow:
                        0 18px 48px rgba(30, 25, 18, 0.16),
                        0 0 0 1px rgba(255, 255, 255, 0.78) inset;
                }

                .plp-map-frame > div,
                .plp-map-frame .leaflet-container {
                    width: 100%;
                    height: 100%;
                    min-height: inherit;
                }

                .plp-map-empty {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 28px;
                    color: rgba(255, 255, 255, 0.78);
                    text-align: center;
                    background:
                        radial-gradient(circle at 50% 30%, rgba(189, 149, 81, 0.22), transparent 34%),
                        #151719;
                }

                .plp-map-empty strong {
                    color: #fff;
                    font-size: 17px;
                }

                .plp-map-empty span {
                    max-width: 420px;
                    font-size: 13px;
                    line-height: 1.5;
                }

                .plp-thesis-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 12px;
                }

                .plp-thesis-card {
                    min-height: 170px;
                    padding: 20px;
                    border: 1px solid var(--plp-line);
                    border-radius: var(--plp-radius);
                    background: #fff;
                }

                .plp-thesis-card span {
                    display: block;
                    margin-bottom: 12px;
                    color: var(--plp-gold-dark);
                    font-size: 11px;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .plp-thesis-card h3 {
                    margin: 0 0 10px;
                    color: var(--plp-ink);
                    font-size: 18px;
                }

                .plp-related-band {
                    margin: 36px 44px 0;
                    padding: 30px;
                    border: 1px solid var(--plp-line);
                    border-radius: var(--plp-radius);
                    background: linear-gradient(180deg, #fbfaf7 0%, #f2eee6 100%);
                    color: var(--plp-ink);
                }

                .plp-related-head {
                    display: flex;
                    align-items: end;
                    justify-content: space-between;
                    gap: 22px;
                    margin-bottom: 18px;
                }

                .plp-related-head span {
                    display: block;
                    margin-bottom: 5px;
                    color: var(--plp-gold-dark);
                    font-size: 12px;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .plp-related-head h2 {
                    color: var(--plp-ink);
                }

                .plp-related-head a {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--plp-gold-dark);
                    font-size: 13px;
                    font-weight: 850;
                    text-decoration: none;
                }

                .plp-related-grid {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 14px;
                }

                .plp-related-card {
                    position: relative;
                    overflow: hidden;
                    border-radius: var(--plp-radius);
                    border: 1px solid var(--plp-line);
                    background: #fff;
                    color: var(--plp-ink);
                    text-decoration: none;
                    box-shadow: 0 14px 32px rgba(36, 29, 20, 0.08);
                }

                .plp-related-card img {
                    display: block;
                    width: 100%;
                    aspect-ratio: var(--plp-photo-aspect);
                    height: auto;
                    object-fit: cover;
                    object-position: center;
                }

                .plp-card-ribbon {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    min-height: 24px;
                    padding: 5px 8px;
                    border-radius: var(--plp-radius);
                    background: var(--plp-gold);
                    color: #fff;
                    font-size: 10px;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .plp-related-card > div {
                    padding: 13px;
                }

                .plp-related-card small {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    margin-bottom: 8px;
                    color: var(--plp-muted);
                    font-size: 10px;
                    font-weight: 850;
                    text-transform: uppercase;
                }

                .plp-related-card h3 {
                    min-height: 42px;
                    margin: 0 0 10px;
                    color: var(--plp-ink);
                    font-size: 14px;
                    line-height: 1.28;
                }

                .plp-related-meta {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 6px;
                    padding-top: 10px;
                    border-top: 1px solid var(--plp-line);
                }

                .plp-related-meta span,
                .plp-related-meta strong {
                    color: #4a535a;
                    font-size: 11px;
                    font-weight: 850;
                    line-height: 1.25;
                }

                .plp-related-meta strong {
                    grid-column: 1 / -1;
                    color: var(--plp-ink);
                    font-size: 13px;
                    white-space: nowrap;
                }

                .plp-final-cta {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    align-items: center;
                    gap: 24px;
                    margin: 34px 44px 0;
                    padding: 28px;
                    border-radius: var(--plp-radius);
                    background: #f7f8f6;
                    border: 1px solid var(--plp-line);
                }

                .plp-final-cta p {
                    max-width: 740px;
                    margin-top: 10px;
                }

                .plp-primary-btn {
                    min-width: 180px;
                    padding: 0 20px;
                    background: var(--plp-gold);
                    color: #fff;
                    box-shadow: 0 10px 24px rgba(189, 149, 81, 0.24);
                }

                .plp-mobile-sticky-cta {
                    position: fixed;
                    right: clamp(22px, 3vw, 44px);
                    bottom: calc(26px + env(safe-area-inset-bottom));
                    z-index: 80;
                    display: flex;
                    justify-content: flex-end;
                    pointer-events: none;
                }

                .plp-mobile-sticky-cta .plp-mobile-cta-button {
                    position: relative;
                    pointer-events: auto;
                    width: 58px;
                    min-width: 58px;
                    height: 58px;
                    min-height: 58px;
                    padding: 0;
                    border-radius: 0;
                    background: transparent;
                    color: var(--plp-ink) !important;
                    box-shadow: none;
                    overflow: visible;
                }

                .plp-mobile-sticky-cta .plp-mobile-cta-prompt {
                    position: absolute;
                    right: 66px;
                    bottom: 0;
                    display: block;
                    width: max-content;
                    max-width: min(320px, calc(100vw - 128px));
                    min-height: 58px;
                    padding: 10px 13px 10px 15px;
                    border: 1px solid rgba(31, 36, 40, 0.12);
                    border-radius: calc(var(--plp-radius) + 2px);
                    background: rgba(255, 255, 255, 0.97);
                    color: #343b42;
                    font-size: 11px;
                    font-weight: 800;
                    line-height: 1.32;
                    box-shadow: 0 16px 38px rgba(18, 24, 31, 0.16);
                    opacity: 0;
                    pointer-events: none;
                    transform: translateX(12px) scale(0.96);
                    transform-origin: right center;
                    animation: plp-mobile-cta-prompt-loop 10s ease-in-out 3s infinite;
                }

                .plp-mobile-sticky-cta .plp-mobile-cta-prompt strong {
                    color: #3d454c;
                    font-weight: 900;
                }

                .plp-mobile-sticky-cta .plp-mobile-cta-prompt svg {
                    display: inline;
                    margin-left: 4px;
                    vertical-align: -2px;
                    color: #7067d9;
                }

                .plp-mobile-sticky-cta .plp-mobile-cta-icon {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 58px;
                    min-width: 58px;
                    height: 58px;
                    border-radius: 999px;
                    background: var(--plp-green);
                    color: #fff;
                    box-shadow: 0 16px 34px rgba(15, 159, 122, 0.32);
                }

                .plp-mobile-sticky-cta .plp-mobile-cta-icon svg {
                    width: 30px;
                    height: 30px;
                }

                .plp-mobile-sticky-cta .plp-mobile-cta-label {
                    position: absolute;
                    width: 1px;
                    height: 1px;
                    margin: -1px;
                    padding: 0;
                    overflow: hidden;
                    clip: rect(0, 0, 0, 0);
                    white-space: nowrap;
                }

                @keyframes plp-mobile-cta-prompt-loop {
                    0%,
                    48% {
                        opacity: 1;
                        pointer-events: auto;
                        transform: translateX(0) scale(1);
                    }

                    52%,
                    100% {
                        opacity: 0;
                        pointer-events: none;
                        transform: translateX(12px) scale(0.96);
                    }
                }

                .plp-page .mobile-nav {
                    position: fixed;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    justify-content: center !important;
                    gap: clamp(3px, 1.5vw, 8px) !important;
                    min-height: 58px;
                    padding: 0 6px env(safe-area-inset-bottom) !important;
                    border-top: 1px solid rgba(31, 36, 40, 0.1);
                    background: rgba(255, 255, 255, 0.96);
                    box-shadow: 0 -10px 28px rgba(18, 24, 31, 0.08);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                }

                .plp-page .nav-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    width: 58px;
                    height: 48px;
                    padding: 0;
                    border: 0;
                    background: transparent;
                    gap: 2px;
                    color: #7b858d;
                    font-family: inherit;
                    font-size: 0.55rem;
                    font-weight: 500;
                    line-height: 1.1;
                    white-space: nowrap;
                    cursor: pointer;
                    transition: color 0.2s ease;
                }

                .plp-page .nav-item.active {
                    color: var(--plp-gold-dark);
                }

                .plp-page .nav-icon {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 1px;
                }

                .plp-page .mobile-nav > div:last-child {
                    flex: 0 0 auto;
                    min-width: 0;
                    width: clamp(156px, 45vw, 184px);
                    max-width: clamp(156px, 45vw, 184px);
                    justify-content: center;
                    padding: 10px !important;
                    font-size: 0.62rem !important;
                }

                @media (max-width: 1120px) {
                    .plp-header {
                        grid-template-columns: minmax(210px, 1fr) 42px 42px;
                    }

                    .plp-nav {
                        display: none;
                    }

                    .plp-mobile-menu {
                        display: flex;
                        justify-content: flex-end;
                    }

                    .plp-detail-layout {
                        grid-template-columns: 1fr;
                    }

                    .plp-sidebar {
                        position: static;
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }

                    .plp-price-card {
                        grid-column: 1 / -1;
                    }

                    .plp-side-facts {
                        grid-template-columns: repeat(auto-fit, minmax(54px, 1fr));
                    }

                    .plp-related-grid,
                    .plp-page .pd-gallery-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }
                }

                @media (max-width: 760px) {
                    .plp-page {
                        padding-bottom: 132px;
                    }

                    .plp-shell {
                        width: 100%;
                    }

                    .plp-header {
                        grid-template-columns: minmax(0, 1fr) 40px 40px;
                        min-height: 62px;
                        padding: 0 14px;
                    }

                    .plp-logo span {
                        font-size: 19px;
                    }

                    .plp-logo small {
                        font-size: 10px;
                    }

                    .plp-title-band {
                        padding: 14px;
                    }

                    .plp-breadcrumbs {
                        font-size: 11px;
                    }

                    .plp-title-row {
                        grid-template-columns: 1fr;
                        gap: 14px;
                    }

                    .plp-title-row h1 {
                        font-size: 22px;
                    }

                    .plp-detail-layout,
                    .plp-gallery-section,
                    .plp-thesis-section {
                        padding-left: 14px;
                        padding-right: 14px;
                    }

                    .plp-detail-layout {
                        gap: 18px;
                        padding-top: 14px;
                    }

                    .plp-gallery-composer {
                        grid-template-columns: 1fr;
                        min-height: 0;
                    }

                    .plp-main-photo {
                        min-height: 0;
                        aspect-ratio: var(--plp-photo-aspect);
                    }

                    .plp-instagram-strip {
                        padding: 10px;
                    }

                    .plp-instagram-grid {
                        grid-template-columns: repeat(4, minmax(74px, 1fr));
                        overflow-x: auto;
                        padding-bottom: 2px;
                        scrollbar-width: none;
                    }

                    .plp-instagram-grid::-webkit-scrollbar {
                        display: none;
                    }

                    .plp-instagram-card {
                        min-width: 74px;
                    }

                    .plp-instagram-card strong {
                        display: none;
                    }

                    .plp-youtube-latest {
                        margin-top: 20px;
                        padding: 12px;
                    }

                    .plp-youtube-play {
                        width: 48px;
                        height: 48px;
                    }

                    .plp-thumb-rail {
                        display: flex;
                        overflow-x: auto;
                        padding-bottom: 2px;
                        scroll-snap-type: x mandatory;
                    }

                    .plp-thumb-item {
                        flex: 0 0 86px;
                        height: 72px;
                        scroll-snap-align: start;
                    }

                    .plp-gallery-view-button {
                        top: 12px;
                        right: 12px;
                        min-height: 36px;
                        padding: 0 12px;
                        font-size: 12px;
                    }

                    .plp-gallery-modal-backdrop {
                        padding: 0;
                    }

                    .plp-gallery-modal {
                        width: 100%;
                        max-height: 96vh;
                        border-radius: 14px 14px 0 0;
                    }

                    .plp-gallery-modal-header {
                        padding: 14px;
                    }

                    .plp-gallery-modal-header strong {
                        font-size: 16px;
                    }

                    .plp-gallery-modal-scroll {
                        padding: 0 0 8px;
                    }

                    .plp-gallery-modal-item {
                        margin-bottom: 4px;
                        border-radius: 0;
                    }

                    .plp-section {
                        padding-top: 28px;
                    }

                    .plp-section-head,
                    .plp-section-head.with-count,
                    .plp-related-head,
                    .plp-final-cta {
                        display: block;
                    }

                    .plp-section-head h2,
                    .plp-copy-section h2,
                    .plp-related-head h2,
                    .plp-final-cta h2 {
                        font-size: 22px;
                    }

                    .plp-spec-grid,
                    .plp-info-list > div,
                    .plp-thesis-grid,
                    .plp-related-grid,
                    .plp-page .pd-gallery-grid,
                    .plp-sidebar {
                        grid-template-columns: 1fr;
                    }

                    .plp-side-facts {
                        grid-template-columns: repeat(auto-fit, minmax(54px, 1fr));
                    }

                    .plp-photo-count {
                        margin-top: 12px;
                    }

                    .plp-location-band {
                        padding: 26px 14px 30px;
                    }

                    .plp-location-head {
                        display: block;
                        margin-bottom: 12px;
                    }

                    .plp-location-head span {
                        display: block;
                        margin-bottom: 5px;
                    }

                    .plp-map-frame {
                        min-height: 330px;
                        height: 330px;
                    }

                    .plp-related-band {
                        margin: 28px 14px 0;
                        padding: 22px 14px 26px;
                    }

                    .plp-related-head a {
                        margin-top: 12px;
                    }

                    .plp-final-cta {
                        margin: 28px 14px 0;
                        padding: 20px;
                    }

                    .plp-final-cta .plp-primary-btn {
                        width: 100%;
                        margin-top: 18px;
                    }

                    .plp-mobile-sticky-cta {
                        position: fixed;
                        left: 14px;
                        right: 14px;
                        bottom: calc(72px + env(safe-area-inset-bottom));
                        z-index: 80;
                        display: flex;
                        justify-content: flex-end;
                    }

                    .plp-mobile-sticky-cta .plp-mobile-cta-button {
                        position: relative;
                        width: 58px;
                        min-width: 58px;
                        height: 58px;
                        min-height: 58px;
                        padding: 0;
                        border-radius: 0;
                        background: transparent;
                        color: var(--plp-ink) !important;
                        box-shadow: none;
                        overflow: visible;
                    }

                    .plp-mobile-sticky-cta .plp-mobile-cta-prompt {
                        position: absolute;
                        right: 66px;
                        bottom: 0;
                        display: block;
                        width: max-content;
                        max-width: min(270px, calc(100vw - 96px));
                        min-height: 58px;
                        padding: 10px 13px 10px 15px;
                        border: 1px solid rgba(31, 36, 40, 0.12);
                        border-radius: calc(var(--plp-radius) + 2px);
                        background: rgba(255, 255, 255, 0.98);
                        box-shadow: 0 14px 34px rgba(23, 26, 29, 0.18);
                        color: #6b7379;
                        font-size: 15px;
                        font-weight: 600;
                        line-height: 1.35;
                        opacity: 0;
                        pointer-events: none;
                        transform: translateX(12px) scale(0.96);
                        transform-origin: right center;
                        animation: plp-mobile-cta-prompt-loop 10s ease-in-out 3s infinite;
                    }

                    .plp-mobile-sticky-cta .plp-mobile-cta-prompt strong {
                        color: #3d454c;
                        font-weight: 900;
                    }

                    .plp-mobile-sticky-cta .plp-mobile-cta-prompt svg {
                        display: inline;
                        margin-left: 4px;
                        vertical-align: -2px;
                        color: #7067d9;
                    }

                    .plp-mobile-sticky-cta .plp-mobile-cta-icon {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 58px;
                        min-width: 58px;
                        height: 58px;
                        border-radius: 999px;
                        background: var(--plp-green);
                        color: #fff;
                        box-shadow: 0 16px 34px rgba(15, 159, 122, 0.32);
                    }

                    .plp-mobile-sticky-cta .plp-mobile-cta-icon svg {
                        width: 30px;
                        height: 30px;
                    }

                    .plp-mobile-sticky-cta .plp-mobile-cta-label {
                        position: absolute;
                        width: 1px;
                        height: 1px;
                        margin: -1px;
                        padding: 0;
                        overflow: hidden;
                        clip: rect(0, 0, 0, 0);
                        white-space: nowrap;
                    }

                    @keyframes plp-mobile-cta-prompt-loop {
                        0%,
                        48% {
                            opacity: 1;
                            pointer-events: auto;
                            transform: translateX(0) scale(1);
                        }

                        52%,
                        100% {
                            opacity: 0;
                            pointer-events: none;
                            transform: translateX(12px) scale(0.96);
                        }
                    }
                }

                @media (min-width: 761px) {
                    .plp-page .mobile-nav {
                        display: none;
                    }
                }

                .plp-shell {
                    width: min(calc(100% - clamp(24px, 4vw, 72px)), 1220px);
                }

                .plp-title-band {
                    padding: 12px 22px 14px;
                }

                .plp-breadcrumbs {
                    gap: 6px;
                    margin-bottom: 7px;
                    font-size: 11px;
                }

                .plp-title-row {
                    gap: 16px;
                }

                .plp-kicker {
                    margin-bottom: 4px;
                    font-size: 10px;
                    letter-spacing: 0.06em;
                }

                .plp-title-row h1 {
                    font-size: 21px;
                    line-height: 1.18;
                }

                .plp-rating-row {
                    gap: 6px;
                    margin-top: 5px;
                    font-size: 11px;
                }

                .plp-detail-layout {
                    grid-template-columns: minmax(0, 1fr) 330px;
                    gap: 22px;
                    padding: 14px 22px 24px;
                }

                .plp-gallery-column,
                .plp-content-column {
                    min-width: 0;
                }

                @media (min-width: 1121px) {
                    .plp-gallery-column {
                        grid-column: 1;
                        grid-row: 1;
                    }

                    .plp-content-column {
                        grid-column: 1;
                        grid-row: 2;
                    }

                    #localizacao.plp-location-band {
                        grid-column: 1 / -1;
                        grid-row: 3;
                    }

                    .plp-sidebar {
                        grid-column: 2;
                        grid-row: 1 / span 2;
                    }
                }

                .plp-gallery-composer {
                    grid-template-columns: minmax(0, 1fr) 82px;
                    gap: 9px;
                    min-height: 0;
                }

                .plp-main-photo {
                    min-height: 0;
                }

                .plp-thumb-rail {
                    gap: 7px;
                }

                .plp-photo-badge {
                    left: 10px;
                    bottom: 10px;
                    min-height: 28px;
                    padding: 0 10px;
                    font-size: 11px;
                }

                .plp-gallery-view-button {
                    top: 10px;
                    right: 10px;
                    min-height: 32px;
                    padding: 0 10px;
                    font-size: 12px;
                }

                .plp-section {
                    padding-top: 22px;
                }

                .plp-section-head {
                    gap: 14px;
                    margin-bottom: 12px;
                }

                .plp-section-head h2,
                .plp-copy-section h2,
                .plp-related-head h2,
                .plp-final-cta h2 {
                    font-size: 20px;
                    line-height: 1.18;
                }

                .plp-copy-section h2 {
                    margin-bottom: 6px;
                }

                .plp-intro-line {
                    margin-bottom: 10px;
                    font-size: 14px;
                    line-height: 1.38;
                }

                .plp-highlight-list {
                    gap: 5px;
                    margin: 10px 0 12px;
                }

                .plp-highlight-list li {
                    grid-template-columns: 18px minmax(0, 1fr);
                    gap: 6px;
                    font-size: 13px;
                    line-height: 1.36;
                }

                .plp-highlight-list svg {
                    width: 14px;
                    height: 14px;
                }

                .plp-narrative {
                    gap: 8px;
                    max-width: 760px;
                }

                .plp-narrative p,
                .plp-thesis-card p,
                .plp-final-cta p {
                    font-size: 13px;
                    line-height: 1.5;
                }

                .plp-spec-grid {
                    gap: 8px;
                }

                .plp-spec-card {
                    grid-template-columns: 32px minmax(0, 1fr);
                    gap: 8px;
                    min-height: 58px;
                    padding: 9px 10px;
                }

                .plp-spec-card > span {
                    width: 32px;
                    height: 32px;
                }

                .plp-spec-card > span svg {
                    width: 17px;
                    height: 17px;
                }

                .plp-spec-card small {
                    margin-bottom: 2px;
                    font-size: 9px;
                }

                .plp-spec-card strong {
                    font-size: 13px;
                }

                .plp-classic-lists {
                    gap: 15px;
                }

                .plp-info-list h3 {
                    margin-bottom: 8px;
                    padding-bottom: 5px;
                    font-size: 16px;
                }

                .plp-info-list > div {
                    gap: 12px;
                }

                .plp-info-list ul {
                    gap: 4px;
                }

                .plp-info-list li {
                    padding-left: 13px;
                    font-size: 13px;
                    line-height: 1.34;
                }

                .plp-sidebar {
                    gap: 10px;
                }

                .plp-side-card {
                    box-shadow: none;
                }

                .plp-price-card,
                .plp-lead-card {
                    padding: 12px;
                }

                .plp-price-card {
                    padding: 10px;
                }

                .plp-side-location {
                    gap: 6px;
                    padding: 8px;
                }

                .plp-payment-note,
                .plp-lead-card p,
                .plp-broker-card p {
                    font-size: 11px;
                    line-height: 1.38;
                }

                .plp-side-facts {
                    grid-template-columns: repeat(auto-fit, minmax(54px, 1fr));
                    gap: 4px;
                    padding: 6px 0 8px;
                }

                .plp-side-facts div {
                    min-height: 0;
                    gap: 1px;
                    padding: 5px 3px;
                    font-size: 11px;
                }

                .plp-side-facts strong {
                    font-size: 11px;
                }

                .plp-side-facts span {
                    font-size: 8px;
                }

                .plp-price-extras {
                    gap: 4px 8px;
                    padding-bottom: 6px;
                }

                .plp-price-extras small {
                    font-size: 9px;
                }

                .plp-whatsapp-button,
                .plp-primary-btn,
                .plp-dark-button,
                .plp-mobile-cta-button {
                    min-height: 36px;
                    font-size: 12px;
                }

                .plp-payment-note {
                    margin-top: 5px;
                    font-size: 8px;
                    line-height: 1.25;
                }

                .plp-action-list {
                    gap: 4px;
                    margin-top: 6px;
                }

                .plp-action-list button {
                    grid-template-columns: 19px minmax(0, 1fr);
                    min-height: 27px;
                    padding: 0 9px;
                    border-radius: 999px;
                    font-size: 10px;
                }

                .plp-action-list svg {
                    width: 13px;
                    height: 13px;
                }

                .plp-lead-card h3 {
                    margin-bottom: 7px;
                    font-size: 15px;
                }

                .plp-form-preview {
                    gap: 6px;
                    margin: 10px 0;
                }

                .plp-form-preview span {
                    min-height: 32px;
                    padding: 0 9px;
                    font-size: 11px;
                    border-radius: 3px;
                }

                .plp-form-preview .plp-form-message {
                    min-height: 54px;
                    align-items: flex-start;
                    padding: 8px 9px;
                    line-height: 1.35;
                    overflow-wrap: anywhere;
                }

                .plp-broker-card {
                    grid-template-columns: 78px minmax(0, 1fr);
                    gap: 10px;
                    padding: 9px;
                }

                .plp-broker-card img {
                    width: 78px;
                    height: 86px;
                }

                .plp-broker-card h3 {
                    margin-bottom: 5px;
                    font-size: 15px;
                }

                .plp-gallery-section,
                .plp-thesis-section {
                    padding-left: 22px;
                    padding-right: 22px;
                }

                .plp-location-band {
                    margin-top: 24px;
                    padding: 22px 22px 28px;
                }

                .plp-location-head {
                    margin-bottom: 10px;
                }

                .plp-location-head span {
                    font-size: 18px;
                }

                .plp-map-frame {
                    min-height: clamp(220px, 24vw, 320px);
                    height: clamp(220px, 24vw, 320px);
                    box-shadow: none;
                }

                @media (min-width: 1121px) {
                    #localizacao .plp-map-frame {
                        min-height: clamp(420px, 34vw, 560px);
                        height: clamp(420px, 34vw, 560px);
                    }
                }

                .plp-thesis-grid {
                    gap: 9px;
                }

                .plp-thesis-card {
                    min-height: 126px;
                    padding: 14px;
                }

                .plp-thesis-card span {
                    margin-bottom: 7px;
                    font-size: 10px;
                }

                .plp-thesis-card h3 {
                    margin-bottom: 6px;
                    font-size: 15px;
                }

                .plp-related-band {
                    margin: 26px 22px 0;
                    padding: 22px;
                }

                .plp-related-head {
                    margin-bottom: 12px;
                }

                .plp-related-grid {
                    gap: 10px;
                }

                .plp-related-card img {
                    height: auto;
                }

                .plp-related-card > div {
                    padding: 10px;
                }

                .plp-related-card h3 {
                    min-height: 34px;
                    font-size: 13px;
                }

                .plp-final-cta {
                    margin: 24px 22px 0;
                    padding: 18px;
                }

                @media (max-width: 1120px) {
                    .plp-detail-layout {
                        grid-template-columns: 1fr;
                    }

                    .plp-gallery-column {
                        order: 1;
                        grid-column: auto;
                        grid-row: auto;
                    }

                    .plp-content-column {
                        order: 2;
                        grid-column: auto;
                        grid-row: auto;
                    }

                    #localizacao.plp-location-band {
                        order: 3;
                        grid-column: auto;
                        grid-row: auto;
                    }

                    .plp-sidebar {
                        order: 4;
                        grid-column: auto;
                        grid-row: auto;
                    }
                }

                @media (max-width: 760px) {
                    .plp-page {
                        padding-bottom: 112px;
                    }

                    .plp-title-band {
                        padding: 10px 9px 11px;
                    }

                    .plp-breadcrumbs {
                        margin-bottom: 5px;
                        font-size: 10px;
                    }

                    .plp-title-row {
                        gap: 8px;
                    }

                    .plp-title-row h1 {
                        font-size: 18px;
                    }

                    .plp-rating-row {
                        margin-top: 4px;
                    }

                    .plp-view-count {
                        font-size: 10px;
                    }

                    .plp-detail-layout {
                        display: grid;
                        gap: 10px;
                        padding: 8px 9px 18px;
                    }

                    .plp-gallery-column {
                        order: 1;
                    }

                    .plp-gallery-composer {
                        min-height: 0;
                    }

                    .plp-main-photo {
                        min-height: 0;
                        aspect-ratio: var(--plp-photo-aspect);
                    }

                    /* Dissolve sidebar: cards viram filhos diretos do grid */
                    .plp-sidebar {
                        display: contents;
                    }

                    /* Ordem no mobile:
                       1 = foto | 2 = card localização/preço | 3 = descrição
                       10 = formulário | 11 = corretor               */
                    .plp-price-card {
                        order: 2;
                        border-radius: var(--plp-radius);
                    }

                    .plp-content-column {
                        order: 3;
                    }

                    .plp-lead-card {
                        order: 10;
                    }

                    .plp-broker-card {
                        order: 11;
                    }

                    .plp-section {
                        padding-top: 16px;
                    }

                    .plp-section-head h2,
                    .plp-copy-section h2,
                    .plp-related-head h2,
                    .plp-final-cta h2 {
                        font-size: 18px;
                    }

                    .plp-intro-line {
                        font-size: 13px;
                    }

                    .plp-spec-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }

                    .plp-info-list > div {
                        grid-template-columns: 1fr;
                    }

                    .plp-location-band {
                        margin-top: 18px;
                        padding: 18px 9px 22px;
                    }

                    .plp-map-frame {
                        min-height: 220px;
                        height: 220px;
                    }

                    .plp-gallery-section,
                    .plp-thesis-section {
                        padding-left: 9px;
                        padding-right: 9px;
                    }

                    .plp-thesis-grid {
                        grid-template-columns: 1fr;
                    }

                    .plp-related-band {
                        margin: 20px 9px 0;
                        padding: 16px 10px 18px;
                    }

                    .plp-related-grid {
                        grid-template-columns: 1fr;
                    }

                    .plp-final-cta {
                        margin: 20px 9px 0;
                        padding: 16px;
                    }

                    .plp-mobile-sticky-cta {
                        display: none;
                    }
                }
            ` }} />
        </>
    )
}
