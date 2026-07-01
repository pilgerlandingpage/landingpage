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
                    z-index: 2147483646;
                    display: flex;
                    justify-content: flex-end;
                    background: rgba(21, 26, 29, 0.44);
                    backdrop-filter: blur(3px);
                    -webkit-backdrop-filter: blur(3px);
                }

                .plp-mobile-menu-panel {
                    width: min(88vw, 360px);
                    height: 100dvh;
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

                .plp-property-quality-kicker {
                    display: inline-flex;
                    align-items: center;
                    width: fit-content;
                    min-height: 24px;
                    padding: 0 10px;
                    border-radius: 999px;
                    letter-spacing: 0.1em;
                }

                .plp-property-quality-kicker-blue,
                .plp-side-benefit-tag-blue,
                .plp-card-ribbon-blue,
                .plp-mobile-price-badge-blue,
                .plp-mobile-related-badge-blue {
                    background: rgba(26, 111, 168, 0.12) !important;
                    color: #1a6fa8 !important;
                }

                .plp-property-quality-kicker-gold,
                .plp-side-benefit-tag-gold,
                .plp-card-ribbon-gold,
                .plp-mobile-price-badge-gold,
                .plp-mobile-related-badge-gold {
                    background: rgba(189, 149, 81, 0.15) !important;
                    color: var(--plp-gold-dark) !important;
                }

                .plp-property-quality-kicker-dark,
                .plp-side-benefit-tag-dark,
                .plp-card-ribbon-dark,
                .plp-mobile-price-badge-dark,
                .plp-mobile-related-badge-dark {
                    background: rgba(23, 26, 29, 0.86) !important;
                    color: #fff !important;
                }

                .plp-property-quality-kicker-green,
                .plp-side-benefit-tag-green,
                .plp-card-ribbon-green,
                .plp-mobile-price-badge-green,
                .plp-mobile-related-badge-green {
                    background: rgba(15, 159, 122, 0.14) !important;
                    color: #0a7f63 !important;
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

                .plp-listing-stats {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 18px;
                    min-width: 320px;
                    color: var(--plp-ink);
                }

                .plp-listing-stats span {
                    display: grid;
                    grid-template-columns: 16px max-content;
                    column-gap: 6px;
                    row-gap: 2px;
                    align-items: center;
                    min-width: max-content;
                }

                .plp-listing-stats svg {
                    grid-row: 1 / span 2;
                    color: var(--plp-gold-dark);
                    stroke-width: 2.4;
                }

                .plp-listing-stats strong {
                    width: fit-content;
                    border-bottom: 2px dotted rgba(189, 149, 81, .66);
                    color: var(--plp-ink);
                    font-size: 13px;
                    font-weight: 950;
                    line-height: 1.05;
                }

                .plp-listing-stats small {
                    color: var(--plp-muted);
                    font-size: 11px;
                    font-weight: 760;
                    line-height: 1.05;
                    white-space: nowrap;
                }

                .plp-detail-layout {
                    display: grid;
                    grid-template-columns: minmax(0, 920px) clamp(355px, 22vw, 400px);
                    align-items: start;
                    justify-content: center;
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

                .plp-gallery-top-bar button.is-saved {
                    border-color: rgba(180, 35, 75, 0.22);
                    background: #fff0f3;
                    color: #b4234b;
                }

                .plp-gallery-top-bar button svg {
                    color: var(--plp-gold-dark);
                    flex-shrink: 0;
                }

                .plp-gallery-top-bar button.is-saved svg {
                    color: currentColor;
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

                .plp-desktop-media-showcase {
                    display: grid;
                    gap: 10px;
                    width: 100%;
                }

                .plp-desktop-media-top-bar {
                    margin-bottom: 0;
                }

                .plp-desktop-media-stage {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) 164px;
                    gap: 12px;
                    min-height: 520px;
                }

                .plp-desktop-media-main {
                    position: relative;
                    min-width: 0;
                    min-height: 520px;
                    overflow: hidden;
                    border-radius: var(--plp-radius);
                    background: #111;
                    box-shadow: 0 20px 54px rgba(19, 24, 29, 0.13);
                }

                .plp-desktop-media-photo,
                .plp-desktop-media-map,
                .plp-desktop-media-video {
                    position: absolute;
                    inset: 0;
                    display: block;
                    width: 100%;
                    height: 100%;
                    min-height: inherit;
                    overflow: hidden;
                    border: 0;
                    padding: 0;
                    border-radius: inherit;
                    background: #111;
                    color: #fff;
                }

                .plp-desktop-media-photo {
                    cursor: zoom-in;
                }

                .plp-property-video-embed {
                    position: relative;
                    display: block;
                    width: 100%;
                    height: 100%;
                    min-height: inherit;
                    overflow: hidden;
                    border-radius: inherit;
                    background:
                        radial-gradient(circle at 50% 40%, rgba(189,149,81,0.18), transparent 42%),
                        #0f1113;
                    color: #fff;
                }

                .plp-property-video-embed iframe,
                .plp-property-video-embed video {
                    display: block;
                    width: 100%;
                    height: 100%;
                    min-height: inherit;
                    border: 0;
                    background: #0f1113;
                }

                .plp-property-video-embed video {
                    object-fit: contain;
                }

                .plp-property-video-embed--external {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 14px;
                    padding: 24px;
                    text-decoration: none;
                }

                .plp-property-video-embed--external > svg {
                    flex: 0 0 auto;
                    color: #dfc18e;
                }

                .plp-property-video-embed--external span {
                    display: grid;
                    gap: 4px;
                    min-width: 0;
                }

                .plp-property-video-embed--external strong {
                    color: #fff;
                    font-size: 1rem;
                    font-weight: 900;
                }

                .plp-property-video-embed--external em {
                    color: rgba(255,255,255,0.72);
                    font-size: .78rem;
                    font-style: normal;
                    font-weight: 650;
                }

                .plp-desktop-media-video .plp-property-video-embed {
                    border-radius: inherit;
                }

                .plp-desktop-media-photo img {
                    width: 100%;
                    height: 100%;
                    display: block;
                    object-fit: cover;
                    object-position: center;
                    transition: transform 0.34s ease;
                }

                .plp-desktop-media-photo:hover img {
                    transform: scale(1.025);
                }

                .plp-desktop-media-chip {
                    position: absolute;
                    left: 16px;
                    bottom: 16px;
                    z-index: 20;
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    min-height: 34px;
                    padding: 0 13px;
                    border-radius: 999px;
                    background: rgba(17, 17, 17, 0.82);
                    color: #fff;
                    font-size: 12px;
                    font-weight: 850;
                    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.24);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                }

                .plp-desktop-media-map .plp-desktop-media-chip {
                    top: 16px;
                    bottom: auto;
                    left: 16px;
                }

                .plp-desktop-media-video .plp-desktop-media-chip {
                    top: 16px;
                    bottom: auto;
                    left: 16px;
                }

                .plp-desktop-media-map .plp-location-explorer,
                .plp-desktop-media-map .property-feed-map-shell,
                .plp-desktop-media-map .property-feed-map-canvas,
                .plp-desktop-media-map .plp-nearby-map-shell,
                .plp-desktop-media-map .plp-nearby-real-map,
                .plp-desktop-media-map .property-feed-map-street-view,
                .plp-desktop-media-map .property-feed-map-street-frame,
                .plp-desktop-media-map .property-feed-map-street-native,
                .plp-desktop-media-map .property-feed-map-street-native-canvas,
                .plp-desktop-media-map .leaflet-container {
                    width: 100%;
                    height: 100% !important;
                    min-height: 100% !important;
                }

                .plp-desktop-media-map .plp-location-explorer {
                    grid-template-rows: minmax(0, 1fr);
                }

                .plp-desktop-media-map .plp-location-context,
                .plp-desktop-media-map .plp-location-actions {
                    display: none;
                }

                .plp-desktop-media-map .property-feed-map-shell {
                    border-radius: inherit;
                    overflow: hidden;
                }

                .plp-desktop-media-map .plp-nearby-map-shell {
                    border: 0;
                    border-radius: inherit;
                    box-shadow: none;
                    overflow: hidden;
                }

                .plp-desktop-media-map .property-feed-map-street-view {
                    background: #0f1113;
                    inset: 0;
                    overflow: hidden;
                    overscroll-behavior: contain;
                    pointer-events: auto;
                    position: relative;
                    touch-action: auto;
                    z-index: 2;
                }

                .plp-desktop-media-map .property-feed-map-street-native,
                .plp-desktop-media-map .property-feed-map-street-native-canvas,
                .plp-desktop-media-map .property-feed-map-street-frame {
                    border: 0;
                    display: block;
                    inset: 0;
                    pointer-events: auto !important;
                    position: absolute !important;
                    touch-action: auto !important;
                    width: 100% !important;
                    z-index: 3;
                }

                .plp-desktop-media-map .property-feed-map-street-view:not(.is-interactive) .property-feed-map-street-native,
                .plp-desktop-media-map .property-feed-map-street-view:not(.is-interactive) .property-feed-map-street-frame {
                    pointer-events: auto !important;
                }

                .plp-desktop-media-map .property-feed-map-street-view.is-interactive .property-feed-map-street-native,
                .plp-desktop-media-map .property-feed-map-street-view.is-interactive .property-feed-map-street-native-canvas {
                    touch-action: auto !important;
                }

                .plp-desktop-media-map .property-feed-map-street-scroll-shield,
                .plp-desktop-media-map .property-feed-map-street-toggle,
                .plp-desktop-media-map .property-feed-map-street-guide {
                    display: none !important;
                }

                .plp-desktop-media-map .property-feed-map-street-native-state {
                    align-items: center;
                    background: #0f1113;
                    color: rgba(255,255,255,.86);
                    display: grid;
                    gap: 9px;
                    inset: 0;
                    justify-items: center;
                    place-content: center;
                    position: absolute;
                    text-align: center;
                    z-index: 4;
                }

                .plp-desktop-media-map .property-feed-map-street-native-state svg {
                    color: #dfc18e;
                }

                .plp-desktop-media-map .property-feed-map-street-native-state strong {
                    font-size: .86rem;
                    font-weight: 900;
                }

                .plp-desktop-media-map .property-feed-map-style-control {
                    top: 16px;
                    right: 16px;
                }

                .plp-desktop-media-map .property-feed-map-street-minimap {
                    top: 18px;
                    right: 18px;
                }

                .plp-desktop-media-map .property-feed-map-caption {
                    align-items: center;
                    background: rgba(17,17,17,.72);
                    border: 1px solid rgba(255,255,255,.12);
                    border-radius: 999px;
                    bottom: 14px;
                    color: rgba(255,255,255,.9);
                    display: inline-flex;
                    font-size: .67rem;
                    font-weight: 720;
                    left: 16px;
                    max-width: min(360px, calc(100% - 32px));
                    padding: 7px 11px;
                    pointer-events: none;
                    position: absolute;
                    z-index: 2147482500;
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                }

                @keyframes propertyStreetGuideDrag {
                    0%, 100% {
                        opacity: .58;
                        transform: translateX(-3px);
                    }
                    50% {
                        opacity: 1;
                        transform: translateX(4px);
                    }
                }

                .plp-desktop-media-rail {
                    display: grid;
                    align-content: start;
                    gap: 10px;
                    max-height: 520px;
                    overflow-y: auto;
                    padding: 2px 2px 2px 0;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(143, 105, 48, 0.55) transparent;
                }

                .plp-desktop-media-rail::-webkit-scrollbar {
                    width: 6px;
                }

                .plp-desktop-media-rail::-webkit-scrollbar-thumb {
                    border-radius: 999px;
                    background: rgba(143, 105, 48, 0.45);
                }

                .plp-desktop-media-thumb {
                    position: relative;
                    display: grid;
                    width: 100%;
                    min-height: 96px;
                    border: 1px solid rgba(35, 31, 26, 0.1);
                    border-radius: var(--plp-radius);
                    padding: 0;
                    overflow: hidden;
                    background: #fff;
                    color: var(--plp-ink);
                    font: inherit;
                    cursor: pointer;
                    text-align: left;
                    box-shadow: 0 8px 22px rgba(19, 24, 29, 0.07);
                }

                .plp-desktop-media-thumb > img,
                .plp-desktop-media-thumb-preview {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    min-height: 96px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background:
                        linear-gradient(135deg, rgba(189, 149, 81, 0.2), rgba(255,255,255,0.92)),
                        #f4efe4;
                    object-fit: cover;
                }

                .plp-desktop-media-thumb > img {
                    display: block;
                }

                .plp-desktop-media-thumb-preview img {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    min-height: 100%;
                    display: block;
                    object-fit: cover;
                    transform: scale(1.01);
                }

                .plp-desktop-media-thumb-preview::after {
                    content: "";
                    position: absolute;
                    inset: 0;
                    background:
                        linear-gradient(180deg, rgba(11, 12, 13, 0) 35%, rgba(11, 12, 13, 0.52) 100%),
                        linear-gradient(135deg, rgba(189, 149, 81, 0.1), rgba(255, 255, 255, 0));
                    pointer-events: none;
                }

                .plp-desktop-media-thumb-preview-label {
                    position: absolute;
                    left: 9px;
                    bottom: 8px;
                    z-index: 2;
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    max-width: calc(100% - 18px);
                    min-height: 24px;
                    padding: 0 8px;
                    border-radius: 999px;
                    background: rgba(18, 18, 17, 0.78);
                    color: #fff;
                    font-size: 10px;
                    font-weight: 860;
                    letter-spacing: 0;
                    line-height: 1;
                    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                }

                .plp-desktop-media-thumb-preview-fallback {
                    position: relative;
                    z-index: 1;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 42px;
                    height: 42px;
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.72);
                    color: var(--plp-gold-dark);
                    box-shadow: 0 14px 30px rgba(143, 105, 48, 0.16);
                }

                .plp-desktop-media-thumb-preview.is-fallback::after {
                    background: linear-gradient(135deg, rgba(189, 149, 81, 0.12), rgba(255, 255, 255, 0.28));
                }

                .plp-desktop-media-thumb-preview--video {
                    background:
                        linear-gradient(135deg, rgba(16,16,18,0.94), rgba(88,67,36,0.86)),
                        #111;
                }

                .plp-desktop-media-thumb-preview--video::after {
                    background:
                        linear-gradient(180deg, rgba(11, 12, 13, 0.1) 25%, rgba(11, 12, 13, 0.72) 100%),
                        radial-gradient(circle at 50% 46%, rgba(255,255,255,0.16), transparent 28%);
                }

                .plp-desktop-media-thumb-preview--video .plp-desktop-media-thumb-preview-fallback {
                    position: absolute;
                    left: 50%;
                    top: 50%;
                    z-index: 2;
                    background: rgba(255,255,255,0.9);
                    color: var(--plp-gold-dark);
                    transform: translate(-50%, -50%);
                }

                .plp-desktop-media-thumb small {
                    display: none;
                }

                .plp-desktop-media-thumb.active {
                    border-color: rgba(143, 105, 48, 0.76);
                    box-shadow:
                        0 0 0 2px rgba(189, 149, 81, 0.2),
                        0 14px 34px rgba(143, 105, 48, 0.18);
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
                    align-items: center;
                    justify-content: center;
                    padding: 30px;
                    background: rgba(7, 8, 9, 0.78);
                    backdrop-filter: blur(16px);
                }

                .plp-gallery-modal {
                    width: min(1120px, calc(100vw - 60px));
                    max-height: calc(100vh - 60px);
                    position: relative;
                    display: grid;
                    grid-template-rows: minmax(0, 1fr);
                    overflow: hidden;
                    border-radius: 0;
                    background: transparent;
                    box-shadow: none;
                    animation: plp-gallery-rise 0.22s ease-out both;
                }

                .plp-gallery-modal-header {
                    position: absolute;
                    top: 16px;
                    left: 16px;
                    right: 16px;
                    z-index: 40;
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 18px;
                    padding: 0;
                    border-bottom: 0;
                    background: transparent;
                    pointer-events: none;
                }

                .plp-gallery-modal-header > div {
                    display: none;
                }

                .plp-gallery-modal-header strong {
                    display: block;
                    margin: 0;
                    color: rgba(255, 255, 255, 0.92);
                    font-size: 18px;
                    line-height: 1.2;
                    text-shadow: 0 2px 16px rgba(0, 0, 0, 0.36);
                }

                .plp-gallery-modal-header button {
                    flex: 0 0 auto;
                    width: 42px;
                    height: 42px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid rgba(255, 255, 255, 0.18);
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.9);
                    color: #171614;
                    cursor: pointer;
                    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.24);
                    pointer-events: auto;
                }

                .plp-gallery-modal-scroll {
                    overflow-y: auto;
                    padding: 0;
                    background: transparent;
                    scroll-behavior: smooth;
                    scrollbar-color: rgba(223, 193, 142, 0.62) rgba(255, 255, 255, 0.08);
                }

                .plp-gallery-modal-item {
                    width: 100%;
                    aspect-ratio: var(--plp-photo-aspect);
                    margin: 0 auto 12px;
                    padding: 0;
                    border-radius: 10px;
                    overflow: hidden;
                    background: #101010;
                    border: 0;
                    box-shadow: 0 22px 54px rgba(0, 0, 0, 0.24);
                }

                .plp-gallery-modal-item img {
                    display: block;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    object-position: center;
                }

                .plp-gallery-modal-item--video {
                    position: relative;
                    aspect-ratio: 16 / 9;
                }

                .plp-gallery-modal-item--video .plp-property-video-embed {
                    width: 100%;
                    height: 100%;
                    min-height: 100%;
                    border-radius: inherit;
                }

                .plp-gallery-modal-video-chip {
                    position: absolute;
                    left: 16px;
                    top: 16px;
                    z-index: 5;
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    min-height: 32px;
                    padding: 0 12px;
                    border-radius: 999px;
                    background: rgba(17,17,17,0.78);
                    color: #fff;
                    font-size: 12px;
                    font-weight: 850;
                    box-shadow: 0 12px 26px rgba(0,0,0,0.22);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                }

                .plp-gallery-modal-item--map {
                    position: relative;
                }

                .plp-gallery-modal-map .plp-location-explorer,
                .plp-gallery-modal-map .property-feed-map-shell,
                .plp-gallery-modal-map .property-feed-map-canvas,
                .plp-gallery-modal-map .property-feed-map-street-view,
                .plp-gallery-modal-map .property-feed-map-street-frame,
                .plp-gallery-modal-map .property-feed-map-street-native,
                .plp-gallery-modal-map .property-feed-map-street-native-canvas,
                .plp-gallery-modal-map .leaflet-container {
                    width: 100%;
                    height: 100% !important;
                    min-height: 100% !important;
                }

                .plp-gallery-modal-map .plp-location-explorer {
                    grid-template-rows: minmax(0, 1fr);
                }

                .plp-gallery-modal-map .plp-location-context,
                .plp-gallery-modal-map .plp-location-actions {
                    display: none;
                }

                .plp-gallery-modal-map .property-feed-map-shell {
                    border-radius: inherit;
                    overflow: hidden;
                }

                .plp-gallery-modal-map .property-feed-map-street-view {
                    background: #0f1113;
                    inset: 0;
                    overflow: hidden;
                    overscroll-behavior: contain;
                    pointer-events: auto;
                    position: relative;
                    touch-action: auto;
                    z-index: 2;
                }

                .plp-gallery-modal-map .property-feed-map-street-native,
                .plp-gallery-modal-map .property-feed-map-street-native-canvas,
                .plp-gallery-modal-map .property-feed-map-street-frame {
                    border: 0;
                    display: block;
                    inset: 0;
                    pointer-events: auto !important;
                    position: absolute !important;
                    touch-action: auto !important;
                    width: 100% !important;
                    z-index: 3;
                }

                .plp-gallery-modal-map .property-feed-map-street-view:not(.is-interactive) .property-feed-map-street-native,
                .plp-gallery-modal-map .property-feed-map-street-view:not(.is-interactive) .property-feed-map-street-frame {
                    pointer-events: auto !important;
                }

                .plp-gallery-modal-map .property-feed-map-street-scroll-shield,
                .plp-gallery-modal-map .property-feed-map-street-toggle,
                .plp-gallery-modal-map .property-feed-map-street-guide {
                    display: none !important;
                }

                .plp-gallery-modal-map .property-feed-map-street-minimap {
                    top: 18px;
                    right: 18px;
                }

                .plp-gallery-modal-map-chip {
                    align-items: center;
                    background: rgba(17, 17, 17, .74);
                    border: 1px solid rgba(255,255,255,.14);
                    border-radius: 999px;
                    box-shadow: 0 12px 28px rgba(0,0,0,.24);
                    color: rgba(255,255,255,.92);
                    display: inline-flex;
                    font-size: .72rem;
                    font-weight: 820;
                    gap: 7px;
                    left: 16px;
                    min-height: 34px;
                    padding: 0 12px;
                    pointer-events: none;
                    position: absolute;
                    top: 16px;
                    z-index: 2147482500;
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
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
                    font-family: 'Montserrat', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }

                .plp-narrative p,
                .plp-thesis-card p,
                .plp-final-cta p {
                    margin: 0;
                    color: var(--plp-muted);
                    font-size: 14px;
                    line-height: 1.7;
                }

                .plp-narrative p {
                    font-family: 'Montserrat', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
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

                .plp-nearby-benefits {
                    margin-top: 18px;
                    padding: 18px;
                    border: 1px solid rgba(184,148,95,0.18);
                    border-radius: var(--plp-radius);
                    background:
                        linear-gradient(135deg, rgba(255,255,255,0.98), rgba(250,247,239,0.94));
                    box-shadow: 0 18px 42px rgba(31,25,16,0.08);
                }

                .plp-nearby-benefits-head {
                    display: grid;
                    gap: 5px;
                    margin-bottom: 15px;
                }

                .plp-nearby-benefits-head h3 {
                    margin: 0;
                    color: var(--plp-ink);
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: 20px;
                    line-height: 1.18;
                    font-weight: 700;
                    letter-spacing: 0;
                }

                .plp-nearby-benefits-head p {
                    max-width: 720px;
                    margin: 0;
                    color: var(--plp-muted);
                    font-size: 13px;
                    font-weight: 450;
                    line-height: 1.55;
                }

                .plp-nearby-map-layout {
                    display: grid;
                    gap: 10px;
                }

                .plp-nearby-summary-row {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 7px;
                }

                .plp-nearby-summary-item {
                    display: grid;
                    grid-template-columns: 28px minmax(0, 1fr);
                    align-items: center;
                    gap: 7px;
                    min-width: 0;
                    min-height: 45px;
                    padding: 7px 8px;
                    border: 1px solid rgba(184,148,95,0.18);
                    border-radius: 13px;
                    background: rgba(255,255,255,0.78);
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.72);
                }

                .plp-nearby-summary-item > span {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    border-radius: 999px;
                    background: color-mix(in srgb, var(--benefit-color, var(--plp-gold-dark)) 12%, #fff);
                    color: var(--benefit-color, var(--plp-gold-dark));
                }

                .plp-nearby-summary-item svg {
                    width: 15px;
                    height: 15px;
                    stroke-width: 2.25;
                }

                .plp-nearby-summary-item div {
                    display: grid;
                    gap: 2px;
                    min-width: 0;
                }

                .plp-nearby-summary-item strong {
                    color: #252a2f;
                    font-family: 'Montserrat', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    font-size: 10px;
                    font-weight: 650;
                    line-height: 1.08;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .plp-nearby-summary-item small {
                    color: #6d5a3a;
                    font-family: 'Montserrat', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    font-size: 9px;
                    font-weight: 560;
                    line-height: 1;
                    white-space: nowrap;
                }

                .plp-nearby-map-shell {
                    position: relative;
                    min-height: 370px;
                    overflow: hidden;
                    border: 1px solid rgba(184,148,95,0.24);
                    border-radius: 20px;
                    background: #dfece5;
                    box-shadow:
                        inset 0 1px 0 rgba(255,255,255,0.7),
                        0 16px 34px rgba(31,25,16,0.1);
                    isolation: isolate;
                }

                .plp-nearby-map-shell::after {
                    display: none;
                }

                .plp-nearby-map-shell .leaflet-container {
                    width: 100%;
                    height: 100%;
                    min-height: 370px;
                    background: #dfece5;
                    font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }

                .plp-nearby-real-map {
                    position: relative;
                    z-index: 2;
                }

                .plp-nearby-map-shell .leaflet-tile-pane {
                    filter: saturate(0.84) contrast(0.98) brightness(1.03);
                }

                .plp-nearby-map-shell .plp-nearby-schematic-map,
                .plp-nearby-map-shell .plp-nearby-schematic-property,
                .plp-nearby-map-shell .plp-nearby-schematic-point {
                    display: none;
                }

                .plp-nearby-map-shell.plp-nearby-schematic {
                    background: #dfe8e4;
                }

                .plp-nearby-map-shell.plp-nearby-schematic::after {
                    display: none;
                }

                .plp-nearby-schematic-map {
                    position: absolute;
                    inset: 0;
                    z-index: 1;
                    display: block;
                    width: 100%;
                    height: 100%;
                }

                .plp-nearby-schematic-zones path {
                    fill: #b9dbb7;
                    opacity: 0.82;
                }

                .plp-nearby-schematic-water path {
                    fill: #bad4e7;
                    opacity: 0.86;
                }

                .plp-nearby-schematic-blocks path {
                    fill: #f1edb7;
                    opacity: 0.78;
                }

                .plp-nearby-schematic-roads path {
                    fill: none;
                    stroke: rgba(255,255,255,0.96);
                    stroke-linecap: round;
                    stroke-linejoin: round;
                    stroke-width: 2.9;
                    vector-effect: non-scaling-stroke;
                }

                .plp-nearby-schematic-route-halo,
                .plp-nearby-schematic-route {
                    fill: none;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                    vector-effect: non-scaling-stroke;
                }

                .plp-nearby-schematic-route-halo {
                    stroke: rgba(255,255,255,0.92);
                    stroke-width: 5.2;
                }

                .plp-nearby-schematic-route {
                    stroke-width: 2.1;
                    stroke-dasharray: 1.8 2.7;
                    filter: drop-shadow(0 1px 2px rgba(31,25,16,0.15));
                    animation: plpNearbyRouteFlow 1.6s linear infinite;
                }

                .plp-nearby-schematic-node {
                    fill: #fff;
                    stroke-width: 1.6;
                    vector-effect: non-scaling-stroke;
                }

                .plp-nearby-schematic-node.is-home {
                    fill: #1f2428;
                    stroke: #f0c85e;
                    stroke-width: 1.5;
                }

                .plp-nearby-schematic-property {
                    position: absolute;
                    left: 50%;
                    top: 50%;
                    z-index: 9;
                    display: grid;
                    justify-items: center;
                    gap: 4px;
                    transform: translate(-50%, -58%);
                    filter: drop-shadow(0 18px 22px rgba(31,25,16,0.32));
                }

                .plp-nearby-schematic-property > span {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 46px;
                    height: 46px;
                    border: 3px solid rgba(255,255,255,0.94);
                    border-radius: 50% 50% 50% 9px;
                    background: linear-gradient(145deg, #f3cc5f, #d19716 58%, #9f6e05);
                    box-shadow: 0 0 0 7px rgba(226,183,71,0.2);
                    transform: rotate(-45deg);
                }

                .plp-nearby-schematic-property > span::after {
                    content: '';
                    position: absolute;
                    inset: -8px;
                    border-radius: inherit;
                    border: 1px solid rgba(255,255,255,0.72);
                }

                .plp-nearby-schematic-property i {
                    display: block;
                    width: 13px;
                    height: 13px;
                    border: 2px solid #fff;
                    border-top-width: 6px;
                    border-radius: 2px;
                    transform: rotate(45deg);
                }

                .plp-nearby-schematic-property strong {
                    display: inline-flex;
                    align-items: center;
                    min-height: 22px;
                    padding: 4px 11px;
                    border-radius: 999px;
                    background: rgba(31,25,16,0.9);
                    color: #f4d586;
                    font-size: 10px;
                    font-weight: 900;
                    line-height: 1;
                    white-space: nowrap;
                }

                .plp-nearby-schematic-point {
                    position: absolute;
                    z-index: 8;
                    display: grid;
                    justify-items: center;
                    gap: 3px;
                    width: 76px;
                    pointer-events: none;
                    text-align: center;
                    transform: translate(-50%, -54%);
                }

                .plp-nearby-schematic-point > span {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 34px;
                    height: 34px;
                    border: 2px solid rgba(255,255,255,0.95);
                    border-radius: 50% 50% 50% 8px;
                    background: color-mix(in srgb, var(--benefit-color, #d86a33) 86%, #fff);
                    box-shadow: 0 10px 18px rgba(31,25,16,0.18);
                    transform: rotate(-45deg);
                }

                .plp-nearby-schematic-point > span::after {
                    content: '';
                    position: absolute;
                    left: 50%;
                    bottom: -7px;
                    width: 17px;
                    height: 6px;
                    border-radius: 999px;
                    background: color-mix(in srgb, var(--benefit-color, #d86a33) 34%, transparent);
                    filter: blur(1px);
                    transform: translateX(-50%) rotate(45deg);
                }

                .plp-nearby-schematic-point i {
                    color: #fff;
                    font-size: 9px;
                    font-style: normal;
                    font-weight: 900;
                    line-height: 1;
                    transform: rotate(45deg);
                }

                .plp-nearby-schematic-point strong,
                .plp-nearby-schematic-point em {
                    display: inline-flex;
                    width: fit-content;
                    max-width: 76px;
                    padding: 3px 6px;
                    border-radius: 999px;
                    box-shadow: 0 8px 16px rgba(31,25,16,0.12);
                    line-height: 1;
                    white-space: nowrap;
                }

                .plp-nearby-schematic-point strong {
                    background: rgba(255,255,255,0.94);
                    color: #1f2428;
                    font-size: 8px;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .plp-nearby-schematic-point em {
                    background: rgba(31,25,16,0.82);
                    color: #fff8ed;
                    font-size: 8px;
                    font-style: normal;
                    font-weight: 780;
                }

                .plp-nearby-map-shell .plp-nearby-gps-route {
                    filter: drop-shadow(0 2px 4px rgba(31,25,16,0.22));
                    stroke-linecap: round;
                    animation: plpNearbyRouteFlow 1.6s linear infinite;
                }

                @keyframes plpNearbyRouteFlow {
                    from {
                        stroke-dashoffset: 0;
                    }

                    to {
                        stroke-dashoffset: -24;
                    }
                }

                .plp-nearby-map-shell .leaflet-control-attribution {
                    border-radius: 999px 0 0 0;
                    background: rgba(255,255,255,0.72);
                    color: rgba(31,36,40,0.62);
                    font-size: 8px;
                    line-height: 1.2;
                }

                .plp-nearby-map-shell .leaflet-control-zoom {
                    overflow: hidden;
                    border: 1px solid rgba(184,148,95,0.28);
                    border-radius: 12px;
                    box-shadow: 0 10px 24px rgba(31,25,16,0.16);
                }

                .plp-nearby-map-shell .leaflet-control-zoom a {
                    width: 31px;
                    height: 31px;
                    border: 0;
                    background: rgba(255,255,255,0.94);
                    color: #1f2428;
                    font-size: 18px;
                    font-weight: 800;
                    line-height: 31px;
                }

                .plp-nearby-map-shell .leaflet-control-zoom a:hover {
                    background: #f7efe1;
                    color: var(--plp-gold-dark);
                }

                .plp-nearby-property-marker,
                .plp-nearby-benefit-marker {
                    border: 0 !important;
                    background: transparent !important;
                }

                .plp-nearby-property-marker-wrap {
                    display: grid;
                    justify-items: center;
                    gap: 4px;
                    filter: drop-shadow(0 16px 20px rgba(31,25,16,0.34));
                    transform: translateY(-4px);
                }

                .plp-nearby-property-pin {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 42px;
                    height: 42px;
                    border: 3px solid rgba(255,255,255,0.92);
                    border-radius: 50% 50% 50% 8px;
                    background: linear-gradient(145deg, #f0c85e, #d19716 58%, #9f6e05);
                    box-shadow: 0 0 0 6px rgba(226,183,71,0.24);
                    transform: rotate(-45deg);
                }

                .plp-nearby-property-pin::after {
                    content: '';
                    position: absolute;
                    inset: -7px;
                    border-radius: inherit;
                    border: 1px solid rgba(255,255,255,0.7);
                }

                .plp-nearby-property-pin i {
                    display: block;
                    width: 12px;
                    height: 12px;
                    border: 2px solid #fff;
                    border-top-width: 6px;
                    border-radius: 2px;
                    transform: rotate(45deg);
                }

                .plp-nearby-property-marker-wrap strong {
                    display: inline-flex;
                    align-items: center;
                    min-height: 22px;
                    padding: 4px 10px;
                    border-radius: 999px;
                    background: rgba(31,25,16,0.9);
                    color: #f4d586;
                    font-size: 10px;
                    font-weight: 900;
                    line-height: 1;
                    white-space: nowrap;
                }

                .plp-nearby-benefit-marker-wrap {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 34px;
                    height: 34px;
                    border: 2px solid rgba(255,255,255,0.92);
                    border-radius: 999px;
                    background: color-mix(in srgb, var(--benefit-color, #1478d4) 86%, #fff);
                    color: #fff;
                    box-shadow: 0 10px 22px rgba(20,34,44,0.22);
                }

                .plp-nearby-benefit-marker-wrap span {
                    font-size: 10px;
                    font-weight: 900;
                    line-height: 1;
                }

                .plp-nearby-benefit-tooltip {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 5px 7px !important;
                    border: 0 !important;
                    border-radius: 999px !important;
                    background: rgba(255,255,255,0.94) !important;
                    box-shadow: 0 8px 18px rgba(31,25,16,0.16) !important;
                    color: #1f2428 !important;
                    font-size: 9px;
                    line-height: 1;
                    white-space: nowrap;
                }

                .plp-nearby-property-tooltip {
                    padding: 5px 9px !important;
                    border: 0 !important;
                    border-radius: 999px !important;
                    background: rgba(31,25,16,0.88) !important;
                    box-shadow: 0 10px 22px rgba(31,25,16,0.2) !important;
                    color: #f4d586 !important;
                    font-size: 10px;
                    font-weight: 900;
                    line-height: 1;
                    white-space: nowrap;
                }

                .plp-nearby-property-tooltip::before {
                    display: none;
                }

                .plp-nearby-benefit-tooltip::before {
                    display: none;
                }

                .plp-nearby-benefit-tooltip span {
                    color: var(--plp-muted);
                    font-weight: 850;
                    text-transform: uppercase;
                }

                .plp-nearby-benefit-tooltip strong {
                    color: var(--plp-gold-dark);
                    font-weight: 900;
                }

                .plp-nearby-benefit-popup .leaflet-popup-content-wrapper {
                    border-radius: 14px;
                    background: rgba(255,255,255,0.98);
                    box-shadow: 0 16px 34px rgba(31,25,16,0.18);
                }

                .plp-nearby-benefit-popup .leaflet-popup-content {
                    display: grid;
                    gap: 4px;
                    min-width: 150px;
                    margin: 10px 12px;
                    color: var(--plp-ink);
                    font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }

                .plp-nearby-benefit-popup strong {
                    font-size: 12px;
                    line-height: 1.2;
                }

                .plp-nearby-benefit-popup span,
                .plp-nearby-benefit-popup em {
                    color: var(--plp-muted);
                    font-size: 11px;
                    font-style: normal;
                    line-height: 1.3;
                }

                .plp-nearby-map-status {
                    position: absolute;
                    left: 12px;
                    top: 12px;
                    z-index: 700;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    min-height: 30px;
                    padding: 0 10px;
                    border-radius: 999px;
                    background: rgba(31,25,16,0.86);
                    color: #f4d586;
                    font-size: 11px;
                    font-weight: 850;
                    box-shadow: 0 12px 26px rgba(31,25,16,0.22);
                }

                .plp-nearby-map-legend {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 8px;
                }

                .plp-nearby-map-legend article,
                .plp-nearby-map-empty {
                    display: grid;
                    grid-template-columns: 32px minmax(0, 1fr);
                    gap: 9px;
                    min-width: 0;
                    padding: 10px;
                    border: 1px solid rgba(35,31,26,0.08);
                    border-radius: 14px;
                    background: rgba(255,255,255,0.88);
                }

                .plp-nearby-map-legend article > span,
                .plp-nearby-map-empty > span {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    border-radius: 12px;
                    background: color-mix(in srgb, var(--benefit-color, var(--plp-gold-dark)) 12%, #fff);
                    color: var(--benefit-color, var(--plp-gold-dark));
                }

                .plp-nearby-map-legend div,
                .plp-nearby-map-empty div {
                    display: grid;
                    gap: 4px;
                    min-width: 0;
                }

                .plp-nearby-map-legend small,
                .plp-nearby-map-empty small {
                    color: var(--plp-muted);
                    font-size: 9px;
                    font-weight: 800;
                    letter-spacing: .04em;
                    line-height: 1;
                    text-transform: uppercase;
                }

                .plp-nearby-map-legend strong,
                .plp-nearby-map-empty strong {
                    color: var(--plp-ink);
                    font-size: 12px;
                    font-weight: 780;
                    line-height: 1.18;
                    overflow-wrap: anywhere;
                }

                .plp-nearby-map-legend em,
                .plp-nearby-map-empty em {
                    color: #596068;
                    font-size: 10px;
                    font-style: normal;
                    font-weight: 450;
                    line-height: 1.25;
                }

                .plp-nearby-map-legend b {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    width: fit-content;
                    margin-top: 1px;
                    padding: 4px 7px;
                    border-radius: 999px;
                    background: #eee7d9;
                    color: #6f4e1f;
                    font-size: 10px;
                    font-weight: 760;
                    line-height: 1;
                }

                .plp-nearby-map-legend.is-loading article strong {
                    color: transparent;
                    border-radius: 999px;
                    background: linear-gradient(90deg, #f4efe5 0%, #ffffff 48%, #f4efe5 100%);
                    background-size: 220% 100%;
                    animation: plpNearbyPulse 1.2s ease-in-out infinite;
                }

                .plp-nearby-benefits-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 10px;
                }

                .plp-nearby-benefit-card {
                    display: grid;
                    grid-template-columns: 38px minmax(0, 1fr);
                    gap: 10px;
                    min-width: 0;
                    min-height: 116px;
                    padding: 13px;
                    border: 1px solid rgba(35,31,26,0.08);
                    border-radius: 16px;
                    background: rgba(255,255,255,0.94);
                }

                .plp-nearby-benefit-card > span {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 38px;
                    height: 38px;
                    border-radius: 14px;
                    background: color-mix(in srgb, var(--benefit-color, var(--plp-gold-dark)) 12%, #fff);
                    color: var(--benefit-color, var(--plp-gold-dark));
                }

                .plp-nearby-benefit-card div {
                    min-width: 0;
                    display: grid;
                    align-content: start;
                    gap: 5px;
                }

                .plp-nearby-benefit-card small {
                    color: var(--plp-muted);
                    font-size: 10px;
                    font-weight: 700;
                    letter-spacing: .04em;
                    line-height: 1.1;
                    text-transform: uppercase;
                }

                .plp-nearby-benefit-card strong {
                    color: var(--plp-ink);
                    font-size: 13px;
                    font-weight: 740;
                    line-height: 1.2;
                    overflow-wrap: anywhere;
                }

                .plp-nearby-benefit-card em {
                    color: #596068;
                    font-size: 11px;
                    font-style: normal;
                    font-weight: 450;
                    line-height: 1.3;
                }

                .plp-nearby-benefit-card b {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    width: fit-content;
                    margin-top: 2px;
                    padding: 5px 8px;
                    border-radius: 999px;
                    background: #eee7d9;
                    color: #6f4e1f;
                    font-size: 11px;
                    font-weight: 720;
                    line-height: 1;
                }

                .plp-nearby-benefit-card.is-loading strong,
                .plp-nearby-benefit-card.is-loading em {
                    color: transparent;
                    border-radius: 999px;
                    background: linear-gradient(90deg, #f4efe5 0%, #ffffff 48%, #f4efe5 100%);
                    background-size: 220% 100%;
                    animation: plpNearbyPulse 1.2s ease-in-out infinite;
                }

                .plp-nearby-benefit-card.is-loading strong {
                    max-width: 132px;
                }

                .plp-nearby-benefit-card.is-loading em {
                    max-width: 96px;
                }

                .plp-nearby-benefit-card--wide {
                    grid-column: 1 / -1;
                    min-height: 0;
                }

                @keyframes plpNearbyPulse {
                    0% { background-position: 0% 50%; }
                    100% { background-position: -220% 50%; }
                }

                @media (max-width: 760px) {
                    .plp-nearby-benefits {
                        padding: 14px;
                    }

                    .plp-nearby-benefits-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 8px;
                    }

                    .plp-nearby-benefit-card {
                        grid-template-columns: 32px minmax(0, 1fr);
                        min-height: 104px;
                        padding: 10px;
                        border-radius: 15px;
                    }

                    .plp-nearby-benefit-card > span {
                        width: 32px;
                        height: 32px;
                        border-radius: 12px;
                    }

                    .plp-nearby-benefits--mobile {
                        margin-top: 16px;
                        padding: 13px;
                        border-radius: 18px;
                        box-shadow: none;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-benefits-head h3 {
                        font-size: 1.02rem;
                        font-weight: 700;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-benefits-head p {
                        font-size: 0.74rem;
                        font-weight: 430;
                        line-height: 1.45;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-summary-row {
                        display: grid;
                        grid-template-columns: repeat(3, minmax(0, 1fr));
                        align-items: center;
                        gap: 9px 8px;
                        margin-right: 0;
                        padding: 2px 0 1px;
                        overflow: visible;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-summary-item {
                        display: inline-flex;
                        grid-template-columns: none;
                        align-items: center;
                        justify-content: center;
                        gap: 5px;
                        min-height: 0;
                        padding: 0;
                        border: 0;
                        border-radius: 0;
                        background: transparent;
                        box-shadow: none;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-summary-item > span {
                        width: auto;
                        height: auto;
                        border-radius: 0;
                        background: transparent;
                        color: #252a2f;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-summary-item svg {
                        width: 14px;
                        height: 14px;
                        stroke-width: 2.1;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-summary-item div {
                        gap: 1px;
                        min-width: 0;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-summary-item strong {
                        color: #252a2f;
                        font-size: 9px;
                        font-weight: 600;
                        text-align: left;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-summary-item small {
                        color: #4d565d;
                        font-size: 8px;
                        font-weight: 500;
                        text-align: left;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-map-shell {
                        min-height: 390px;
                        border-radius: 16px;
                        box-shadow: 0 12px 26px rgba(31,25,16,0.08);
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-map-shell .leaflet-container {
                        min-height: 390px;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-property-pin {
                        width: 38px;
                        height: 38px;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-property-marker-wrap strong {
                        min-height: 20px;
                        padding: 4px 8px;
                        font-size: 9px;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-benefit-tooltip {
                        padding: 4px 6px !important;
                        font-size: 8px;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-map-legend {
                        display: flex;
                        gap: 7px;
                        margin-right: -13px;
                        padding: 0 13px 2px 0;
                        overflow-x: auto;
                        overscroll-behavior-x: contain;
                        scrollbar-width: none;
                        scroll-snap-type: x mandatory;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-map-legend::-webkit-scrollbar {
                        display: none;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-map-legend article,
                    .plp-nearby-benefits--mobile .plp-nearby-map-empty {
                        grid-template-columns: 28px minmax(0, 1fr);
                        flex: 0 0 168px;
                        gap: 7px;
                        min-height: 66px;
                        padding: 8px;
                        border-radius: 12px;
                        scroll-snap-align: start;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-map-empty {
                        flex-basis: auto;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-map-legend article > span,
                    .plp-nearby-benefits--mobile .plp-nearby-map-empty > span {
                        width: 28px;
                        height: 28px;
                        border-radius: 10px;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-map-legend strong,
                    .plp-nearby-benefits--mobile .plp-nearby-map-empty strong {
                        font-size: 0.68rem;
                        font-weight: 750;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-map-legend em,
                    .plp-nearby-benefits--mobile .plp-nearby-map-empty em {
                        display: none;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-map-legend b {
                        padding: 4px 6px;
                        font-size: 0.6rem;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-benefit-card {
                        grid-template-columns: 30px minmax(0, 1fr);
                        gap: 8px;
                        min-height: 98px;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-benefit-card > span {
                        width: 30px;
                        height: 30px;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-benefit-card strong {
                        font-size: 0.74rem;
                        font-weight: 720;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-benefit-card em {
                        font-size: 0.66rem;
                        font-weight: 430;
                    }

                    .plp-nearby-benefits--mobile .plp-nearby-benefit-card b {
                        padding: 4px 7px;
                        font-size: 0.64rem;
                        font-weight: 720;
                    }
                }

                .plp-classic-lists {
                    display: grid;
                    gap: 24px;
                }

                .plp-classic-lists--before-nearby {
                    margin-top: clamp(22px, 3vw, 34px);
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

                .plp-market-history {
                    border-top: 1px solid var(--plp-line);
                    margin-top: 30px;
                    padding-top: 30px;
                }

                .plp-market-history .plp-section-head {
                    display: block;
                    margin-bottom: 16px;
                }

                .plp-market-history .plp-section-head h2 {
                    margin-top: 7px;
                }

                .plp-market-grid {
                    align-items: start;
                    border: 1px solid rgba(35, 31, 26, .1);
                    border-radius: var(--plp-radius);
                    background:
                        linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,246,241,.96)),
                        radial-gradient(circle at 12% 18%, rgba(184,148,95,.16), transparent 30%);
                    box-shadow: 0 14px 34px rgba(32, 27, 18, .08);
                    display: grid;
                    gap: 14px;
                    grid-template-columns: 1fr;
                    padding: 18px;
                    width: 100%;
                }

                .plp-market-card {
                    min-width: 0;
                }

                .plp-market-main {
                    align-items: start;
                    display: grid;
                    gap: 12px 14px;
                    grid-template-columns: minmax(0, .96fr) minmax(240px, .74fr);
                }

                .plp-price-history-card {
                    border-top: 1px solid rgba(35, 31, 26, .09);
                    padding-top: 14px;
                }

                .plp-market-card-head {
                    align-items: center;
                    border-bottom: 1px solid rgba(35, 31, 26, .08);
                    display: flex;
                    gap: 12px;
                    justify-content: space-between;
                    margin-bottom: 16px;
                    padding-bottom: 12px;
                }

                .plp-market-main .plp-market-card-head {
                    grid-column: 1 / -1;
                    margin-bottom: 0;
                }

                .plp-price-history-card .plp-market-card-head {
                    margin-bottom: 12px;
                }

                .plp-market-card-head span {
                    align-items: center;
                    color: var(--plp-ink);
                    display: inline-flex;
                    font-size: 13px;
                    font-weight: 900;
                    gap: 7px;
                    min-width: 0;
                }

                .plp-market-card-head svg {
                    color: var(--plp-gold-dark);
                    flex: 0 0 auto;
                    stroke-width: 2.4;
                }

                .plp-market-card-head strong {
                    color: var(--plp-gold-dark);
                    flex: 0 0 auto;
                    font-size: 11px;
                    font-weight: 900;
                    text-transform: uppercase;
                    white-space: nowrap;
                }

                .plp-market-metrics {
                    display: grid;
                    gap: 10px;
                    grid-column: 1;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    margin-bottom: 0;
                }

                .plp-market-metrics div {
                    border: 1px solid rgba(35, 31, 26, .07);
                    border-radius: var(--plp-radius);
                    background: rgba(255,255,255,.7);
                    min-width: 0;
                    padding: 10px 12px;
                }

                .plp-market-metrics small,
                .plp-price-history-item small {
                    color: var(--plp-muted);
                    display: block;
                    font-size: 11px;
                    font-weight: 760;
                    line-height: 1.25;
                }

                .plp-market-metrics strong {
                    color: var(--plp-ink);
                    display: block;
                    font-size: clamp(14px, 1.4vw, 18px);
                    font-weight: 950;
                    line-height: 1.1;
                    margin-top: 6px;
                    overflow-wrap: anywhere;
                }

                .plp-market-chart {
                    border: 1px solid rgba(35, 31, 26, .08);
                    border-radius: var(--plp-radius);
                    background:
                        linear-gradient(90deg, rgba(184,148,95,.06) 1px, transparent 1px),
                        linear-gradient(180deg, #fff 0%, #f5f2ec 100%);
                    background-size: 25% 100%, auto;
                    grid-column: 2;
                    padding: 12px 12px 9px;
                }

                .plp-market-chart svg {
                    display: block;
                    height: 78px;
                    overflow: visible;
                    width: 100%;
                }

                .plp-market-chart path {
                    fill: none;
                    stroke: rgba(35,31,26,.16);
                    stroke-width: 1.2;
                    vector-effect: non-scaling-stroke;
                }

                .plp-market-chart polyline {
                    fill: none;
                    stroke: var(--plp-gold);
                    stroke-linecap: round;
                    stroke-linejoin: round;
                    stroke-width: 2.4;
                    vector-effect: non-scaling-stroke;
                }

                .plp-market-chart line {
                    stroke: #111;
                    stroke-dasharray: 3 3;
                    stroke-width: 1.2;
                    vector-effect: non-scaling-stroke;
                }

                .plp-market-chart circle {
                    fill: var(--plp-gold);
                    stroke: #111;
                    stroke-width: .9;
                    vector-effect: non-scaling-stroke;
                }

                .plp-market-axis {
                    color: var(--plp-muted);
                    display: flex;
                    font-size: 10px;
                    font-weight: 850;
                    justify-content: space-between;
                    line-height: 1;
                    text-transform: uppercase;
                }

                .plp-market-note {
                    align-items: flex-start;
                    color: var(--plp-muted);
                    display: grid;
                    font-size: 12px;
                    font-weight: 760;
                    gap: 8px;
                    grid-column: 2;
                    grid-template-columns: 18px minmax(0, 1fr);
                    line-height: 1.35;
                    margin: 0;
                }

                .plp-market-note svg {
                    color: #4f7a62;
                    margin-top: 1px;
                }

                .plp-market-positioning {
                    align-items: start;
                    border: 1px solid rgba(184, 148, 95, .18);
                    border-radius: var(--plp-radius);
                    background: rgba(255, 255, 255, .62);
                    display: grid;
                    gap: 4px 12px;
                    grid-column: 1;
                    grid-template-columns: 1fr;
                    margin-top: 0;
                    padding: 11px 12px;
                }

                .plp-market-positioning strong {
                    color: var(--plp-ink);
                    font-size: 14px;
                    font-weight: 950;
                    line-height: 1.15;
                }

                .plp-market-positioning span,
                .plp-market-positioning small {
                    color: var(--plp-muted);
                    font-size: 12px;
                    font-weight: 760;
                    line-height: 1.35;
                }

                .plp-market-method {
                    border-top: 1px solid rgba(35, 31, 26, .08);
                    grid-column: 1 / -1;
                    margin-top: 0;
                    padding-top: 10px;
                }

                .plp-market-method summary {
                    color: var(--plp-gold-dark);
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 900;
                    list-style-position: inside;
                }

                .plp-market-method ul {
                    color: var(--plp-muted);
                    display: grid;
                    gap: 6px;
                    margin: 10px 0 0;
                    padding-left: 18px;
                }

                .plp-market-method li {
                    font-size: 12px;
                    font-weight: 720;
                    line-height: 1.35;
                }

                .plp-price-history-list {
                    display: grid;
                    gap: 12px;
                    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
                }

                .plp-price-history-item {
                    align-items: start;
                    border: 1px solid rgba(35, 31, 26, .07);
                    border-radius: 14px;
                    background: rgba(255,255,255,.54);
                    display: grid;
                    gap: 6px 10px;
                    grid-template-columns: 86px minmax(0, 1fr) auto;
                    padding: 11px 12px;
                }

                .plp-price-history-item:first-child {
                    padding-top: 11px;
                }

                .plp-price-history-item:last-child {
                    padding-bottom: 11px;
                }

                .plp-price-history-item > span {
                    color: var(--plp-gold-dark);
                    font-size: 11px;
                    font-weight: 900;
                    line-height: 1.25;
                    text-transform: uppercase;
                }

                .plp-price-history-item strong {
                    color: var(--plp-ink);
                    display: block;
                    font-size: 13px;
                    font-weight: 900;
                    line-height: 1.2;
                    margin-bottom: 3px;
                }

                .plp-price-history-item b {
                    color: var(--plp-ink);
                    font-size: 12px;
                    font-weight: 950;
                    line-height: 1.2;
                    text-align: right;
                    white-space: nowrap;
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

                .plp-side-benefit-tag {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    max-width: 100%;
                    margin-top: 4px;
                    padding: 3px 7px;
                    border: 1px solid rgba(184, 132, 54, 0.22);
                    border-radius: 999px;
                    background: rgba(189, 149, 81, 0.12);
                    color: var(--plp-gold-dark);
                    font-family: 'Montserrat', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    font-size: 8px;
                    font-weight: 600;
                    line-height: 1.1;
                    text-align: center;
                    white-space: nowrap;
                }

                .plp-side-price-note {
                    font-size: 8px;
                    color: var(--plp-muted);
                    line-height: 1.2;
                }

                .plp-commercial-note,
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
                .plp-context-cta,
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
                .plp-context-cta:hover,
                .plp-mobile-cta-button:hover {
                    transform: translateY(-1px);
                }

                .plp-commercial-note {
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

                .plp-context-cta-list {
                    display: grid;
                    gap: 7px;
                    margin-top: 11px;
                    padding-top: 11px;
                    border-top: 1px solid var(--plp-line);
                }

                .plp-context-cta {
                    justify-content: flex-start;
                    width: 100%;
                    min-height: 38px;
                    padding: 0 10px;
                    border: 1px solid rgba(35, 31, 26, .08);
                    background: #f7f8f6;
                    color: #343b42;
                    box-shadow: none;
                    font-size: 12px;
                }

                .plp-context-cta:hover {
                    background: #eeebe3;
                }

                .plp-context-cta svg {
                    color: var(--plp-gold-dark);
                    flex: 0 0 auto;
                }

                .plp-context-cta span {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
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

                .plp-location-explorer {
                    display: grid;
                    grid-template-rows: auto minmax(0, 1fr) auto;
                    height: 100%;
                    min-height: inherit;
                    position: relative;
                    width: 100%;
                }

                .plp-location-context {
                    align-items: stretch;
                    background: #fff;
                    border-bottom: 1px solid rgba(35, 31, 26, .08);
                    display: grid;
                    gap: 1px;
                    grid-template-columns: 1.25fr .9fr .85fr;
                    min-width: 0;
                    position: relative;
                    z-index: 620;
                }

                .plp-location-context div {
                    align-items: center;
                    background: linear-gradient(180deg, #fff 0%, #f8f6f1 100%);
                    display: grid;
                    gap: 2px 8px;
                    grid-template-columns: 18px minmax(0, 1fr);
                    min-width: 0;
                    padding: 10px 12px;
                }

                .plp-location-context svg {
                    color: var(--plp-gold-dark);
                    grid-row: 1 / span 2;
                }

                .plp-location-context span {
                    color: var(--plp-muted);
                    font-size: 9px;
                    font-weight: 900;
                    letter-spacing: 0;
                    line-height: 1;
                    text-transform: uppercase;
                }

                .plp-location-context strong {
                    color: var(--plp-ink);
                    display: block;
                    font-size: 12px;
                    font-weight: 900;
                    line-height: 1.15;
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .plp-location-actions {
                    align-items: center;
                    background: rgba(17, 17, 17, .92);
                    border-top: 1px solid rgba(232, 220, 199, .14);
                    display: flex;
                    gap: 8px;
                    justify-content: flex-end;
                    padding: 10px 12px;
                    position: relative;
                    z-index: 620;
                }

                .plp-location-actions a {
                    align-items: center;
                    background: rgba(255, 255, 255, .95);
                    border: 1px solid rgba(255,255,255,.25);
                    border-radius: 999px;
                    color: #111;
                    display: inline-flex;
                    font-size: 11px;
                    font-weight: 900;
                    gap: 6px;
                    line-height: 1;
                    min-height: 34px;
                    padding: 0 12px;
                    text-decoration: none;
                    white-space: nowrap;
                }

                .plp-location-actions a:first-child {
                    background: linear-gradient(135deg, #dfc18e, #b8945f);
                }

                .plp-map-frame .property-feed-map-shell {
                    background: #111;
                    height: 100%;
                    min-height: inherit;
                    overflow: hidden;
                    position: relative;
                    width: 100%;
                }

                .plp-location-explorer .property-feed-map-shell,
                .plp-location-explorer .property-feed-map-canvas,
                .plp-location-explorer .property-feed-map-street-view,
                .plp-location-explorer .property-feed-map-street-frame,
                .plp-location-explorer .leaflet-container {
                    min-height: 0;
                }

                .plp-map-frame .property-feed-map-shell::after {
                    box-shadow: inset 0 0 96px rgba(5, 8, 10, .2);
                    content: '';
                    inset: 0;
                    mix-blend-mode: multiply;
                    pointer-events: none;
                    position: absolute;
                    z-index: 401;
                }

                .plp-map-frame .property-feed-map-canvas {
                    background: #111;
                    height: 100% !important;
                    min-height: inherit;
                    width: 100% !important;
                }

                .plp-map-frame .property-feed-map-shell.map-view-luxury .leaflet-tile-pane,
                .plp-map-frame .property-feed-map-shell.map-view-map .leaflet-tile-pane {
                    filter: saturate(1.06) contrast(1.02) brightness(1.01);
                }

                .plp-map-frame .property-feed-map-shell.map-view-satellite .leaflet-tile-pane {
                    filter: saturate(1.08) contrast(1.04) brightness(.94);
                }

                .plp-map-frame .property-feed-map-style-control {
                    display: grid;
                    gap: 7px;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    left: 12px;
                    position: absolute;
                    right: 12px;
                    top: 12px;
                    z-index: 610;
                }

                .plp-map-frame .property-feed-map-style-control button {
                    align-items: center;
                    background: rgba(18, 18, 18, .76);
                    border: 1px solid rgba(232, 220, 199, .14);
                    border-radius: 10px;
                    box-shadow: 0 10px 24px rgba(0,0,0,.18);
                    color: #e8dcc7;
                    cursor: pointer;
                    display: inline-flex;
                    font: 850 .72rem/1 Inter, sans-serif;
                    gap: 6px;
                    height: 36px;
                    justify-content: center;
                    min-width: 0;
                    padding: 0 10px;
                    transition: background .18s ease, color .18s ease, transform .18s ease;
                    white-space: nowrap;
                }

                .plp-map-frame .property-feed-map-style-control button:hover {
                    transform: translateY(-1px);
                }

                .plp-map-frame .property-feed-map-style-control button.active {
                    background: linear-gradient(135deg, #dfc18e, #b8945f);
                    border-color: rgba(255,255,255,.28);
                    color: #101010;
                }

                .plp-map-frame .property-feed-map-street-view,
                .plp-map-frame .property-feed-map-street-frame {
                    height: 100%;
                    min-height: inherit;
                    width: 100%;
                }

                .plp-map-frame .property-feed-map-street-view {
                    background: #0f1113;
                    position: relative;
                }

                .plp-map-frame .property-feed-map-street-frame {
                    border: 0;
                    display: block;
                }

                .plp-map-frame .property-feed-map-street-fallback {
                    align-items: flex-start;
                    background: rgba(15, 15, 15, .82);
                    border: 1px solid rgba(232, 220, 199, .18);
                    border-radius: 13px;
                    box-shadow: 0 16px 38px rgba(0,0,0,.28);
                    color: #fff;
                    display: grid;
                    gap: 5px;
                    left: 14px;
                    max-width: min(310px, calc(100% - 28px));
                    padding: 13px 14px;
                    position: absolute;
                    top: 62px;
                    z-index: 610;
                }

                .plp-map-frame .property-feed-map-street-fallback svg {
                    color: #f0d08f;
                }

                .plp-map-frame .property-feed-map-street-fallback strong {
                    font-size: .86rem;
                    font-weight: 900;
                    line-height: 1.1;
                }

                .plp-map-frame .property-feed-map-street-fallback span {
                    color: rgba(255,255,255,.76);
                    font-size: .73rem;
                    font-weight: 720;
                    line-height: 1.28;
                }

                .plp-map-frame .property-feed-map-caption {
                    align-items: center;
                    background: rgba(12, 12, 12, .76);
                    border: 1px solid rgba(232, 220, 199, .14);
                    border-radius: 12px;
                    bottom: 12px;
                    color: rgba(255,255,255,.86);
                    display: flex;
                    gap: 10px;
                    justify-content: space-between;
                    left: 12px;
                    max-width: calc(100% - 24px);
                    padding: 9px 10px;
                    position: absolute;
                    right: 12px;
                    z-index: 610;
                }

                .plp-map-frame .property-feed-map-caption span {
                    font-size: .74rem;
                    font-weight: 760;
                    line-height: 1.2;
                    min-width: 0;
                }

                .plp-map-frame .property-feed-map-caption a {
                    align-items: center;
                    background: #fff;
                    border-radius: 999px;
                    color: #111;
                    display: inline-flex;
                    flex: 0 0 auto;
                    font-size: .68rem;
                    font-weight: 900;
                    gap: 5px;
                    line-height: 1;
                    padding: 8px 10px;
                    text-decoration: none;
                    white-space: nowrap;
                }

                .plp-map-frame .property-feed-map-marker {
                    background: none !important;
                    border: 0 !important;
                }

                .plp-map-frame .property-feed-map-marker-wrap {
                    align-items: center;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    filter: drop-shadow(0 12px 18px rgba(0,0,0,.48));
                    gap: 3px;
                    transform-origin: center bottom;
                }

                .plp-map-frame .property-feed-map-pin {
                    align-items: center;
                    background: linear-gradient(145deg, #fff3c7 0%, #d7ad42 48%, #9c741b 100%);
                    border: 2px solid rgba(18,18,18,.88);
                    border-radius: 50% 50% 50% 8px;
                    box-shadow: 0 0 0 2px rgba(255,255,255,.18), 0 10px 28px rgba(217,172,63,.28);
                    display: inline-flex;
                    height: 34px;
                    justify-content: center;
                    position: relative;
                    transform: rotate(45deg);
                    width: 34px;
                }

                .plp-map-frame .property-feed-map-pin::before {
                    background: radial-gradient(circle, rgba(223,193,142,.32), transparent 64%);
                    border-radius: 50%;
                    content: '';
                    inset: -8px;
                    position: absolute;
                    z-index: -1;
                }

                .plp-map-frame .property-feed-map-pin span {
                    background: #15130f;
                    border-radius: 2px;
                    height: 9px;
                    position: relative;
                    transform: rotate(-45deg);
                    width: 11px;
                }

                .plp-map-frame .property-feed-map-pin span::before {
                    background: #15130f;
                    border-radius: 2px 1px 0 1px;
                    content: '';
                    height: 9px;
                    left: 1px;
                    position: absolute;
                    top: -5px;
                    transform: rotate(45deg);
                    width: 9px;
                }

                .plp-map-frame .property-feed-map-pin span::after {
                    background: #d7ad42;
                    border-radius: 1px 1px 0 0;
                    bottom: 0;
                    content: '';
                    height: 5px;
                    left: 4px;
                    position: absolute;
                    width: 3px;
                }

                .plp-map-frame .property-feed-map-marker-wrap strong {
                    background: rgba(10,10,10,.88);
                    border: 1px solid rgba(223,193,142,.54);
                    border-radius: 999px;
                    box-shadow: 0 8px 16px rgba(0,0,0,.24);
                    color: #f0d08f;
                    font-size: .66rem;
                    font-weight: 900;
                    line-height: 1.3;
                    min-width: 58px;
                    padding: 3px 9px;
                    text-align: center;
                    white-space: nowrap;
                }

                .plp-map-frame .property-feed-map-marker-wrap.is-exclusive strong::after {
                    color: #fff3c7;
                    content: 'EX';
                    font-size: .56rem;
                    margin-left: 5px;
                }

                .plp-map-frame .property-feed-map-popup .leaflet-popup-content-wrapper {
                    background: #131313;
                    border: 1px solid rgba(223,193,142,.22);
                    border-radius: 16px;
                    box-shadow: 0 18px 52px rgba(0,0,0,.5);
                    overflow: hidden;
                    padding: 0;
                    width: 250px;
                }

                .plp-map-frame .property-feed-map-popup .leaflet-popup-content {
                    margin: 0;
                    width: 250px !important;
                }

                .plp-map-frame .property-feed-map-popup .leaflet-popup-tip {
                    background: #131313;
                    border: 1px solid rgba(223,193,142,.2);
                }

                .plp-map-frame .property-feed-map-popup-content {
                    display: grid;
                    gap: 7px;
                    padding: 13px 14px;
                }

                .plp-map-frame .property-feed-map-popup-content strong {
                    color: #f4efe7;
                    display: -webkit-box;
                    font-family: 'Noto Serif', Georgia, serif;
                    font-size: .92rem;
                    font-weight: 700;
                    line-height: 1.2;
                    overflow: hidden;
                    -webkit-box-orient: vertical;
                    -webkit-line-clamp: 2;
                }

                .plp-map-frame .property-feed-map-popup-content span {
                    color: #aaa39a;
                    font-size: .72rem;
                    font-weight: 750;
                }

                .plp-map-frame .property-feed-map-popup-content b {
                    color: #f0d08f;
                    font-size: .95rem;
                    font-weight: 950;
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
                    .plp-market-grid,
                    .plp-market-main,
                    .plp-market-metrics,
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

                    .plp-market-history {
                        margin-top: 22px;
                        padding-top: 22px;
                    }

                    .plp-market-grid {
                        gap: 15px;
                        padding: 15px;
                    }

                    .plp-market-card {
                        padding: 0;
                    }

                    .plp-market-card-head {
                        align-items: flex-start;
                        flex-direction: column;
                        gap: 6px;
                    }

                    .plp-market-chart,
                    .plp-market-positioning,
                    .plp-market-metrics,
                    .plp-market-note,
                    .plp-market-method {
                        grid-column: auto;
                    }

                    .plp-market-positioning {
                        grid-template-columns: 1fr;
                    }

                    .plp-market-positioning strong,
                    .plp-market-positioning span,
                    .plp-market-positioning small {
                        grid-column: auto;
                        grid-row: auto;
                    }

                    .plp-price-history-card {
                        border-left: 0;
                        border-top: 1px solid rgba(35, 31, 26, .09);
                        padding-left: 0;
                        padding-top: 15px;
                    }

                    .plp-price-history-item {
                        gap: 7px;
                        grid-template-columns: 1fr;
                    }

                    .plp-price-history-item b {
                        grid-column: auto;
                        text-align: left;
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

                    .plp-map-frame .property-feed-map-style-control {
                        left: 8px;
                        right: 8px;
                        top: 8px;
                    }

                    .plp-map-frame .property-feed-map-style-control button {
                        font-size: .62rem;
                        gap: 4px;
                        height: 32px;
                        padding: 0 6px;
                    }

                    .plp-map-frame .property-feed-map-caption {
                        align-items: flex-end;
                        background: transparent;
                        border: 0;
                        bottom: 10px;
                        box-shadow: none;
                        justify-content: flex-end;
                        left: 8px;
                        max-width: calc(100% - 16px);
                        padding: 0;
                        right: 8px;
                    }

                    .plp-map-frame .property-feed-map-caption span {
                        display: none;
                    }

                    .plp-map-frame .property-feed-map-street-fallback {
                        left: 8px;
                        max-width: calc(100% - 16px);
                        padding: 10px 11px;
                        top: 48px;
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

                .plp-commercial-note,
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

                .plp-commercial-note {
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
                        min-height: 300px;
                        height: 300px;
                    }

                    .plp-location-context {
                        grid-template-columns: 1fr;
                    }

                    .plp-location-context div {
                        padding: 8px 10px;
                    }

                    .plp-location-context div:nth-child(2) {
                        display: none;
                    }

                    .plp-location-actions {
                        justify-content: stretch;
                        padding: 8px;
                    }

                    .plp-location-actions a {
                        flex: 1;
                        justify-content: center;
                        min-height: 32px;
                        padding: 0 8px;
                    }

                    .plp-map-frame .property-feed-map-style-control {
                        left: 8px;
                        right: 8px;
                        top: 8px;
                    }

                    .plp-map-frame .property-feed-map-style-control button {
                        font-size: .58rem;
                        gap: 4px;
                        height: 30px;
                        padding: 0 5px;
                    }

                    .plp-map-frame .property-feed-map-caption {
                        align-items: flex-end;
                        background: transparent;
                        border: 0;
                        bottom: 8px;
                        box-shadow: none;
                        justify-content: flex-end;
                        left: 8px;
                        max-width: calc(100% - 16px);
                        padding: 0;
                        right: 8px;
                    }

                    .plp-map-frame .property-feed-map-caption span {
                        display: none;
                    }

                    .plp-map-frame .property-feed-map-street-fallback {
                        left: 8px;
                        max-width: calc(100% - 16px);
                        padding: 9px 10px;
                        top: 46px;
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

                .plp-mobile-sheet-experience,
                .plp-mobile-media-feed,
                .plp-mobile-sheet-summary {
                    display: none;
                }

                @media (max-width: 760px) {
                    .gh-wrap {
                        display: none;
                    }

                    .plp-page {
                        width: 100vw;
                        max-width: none;
                        height: 100dvh;
                        overflow: hidden;
                        background: #fff;
                        margin: 0;
                        padding: 0;
                        padding-bottom: 0;
                    }

                    .plp-shell {
                        width: 100vw;
                        max-width: none;
                        height: 100%;
                        overflow: hidden;
                        background: #fff;
                        box-shadow: none;
                        margin: 0;
                        border-radius: 0;
                    }

                    .plp-title-band {
                        display: none;
                    }

                    .plp-detail-layout {
                        display: none !important;
                    }

                    .plp-mobile-sheet-experience {
                        position: fixed;
                        inset: 0;
                        z-index: 80;
                        display: block;
                        width: 100vw;
                        max-width: none;
                        height: 100dvh;
                        min-height: 100dvh;
                        margin: 0;
                        padding: 0;
                        overflow: hidden;
                        background: #fff;
                    }

                    .plp-continuation-rail {
                        display: none !important;
                    }

                    .pmds-wrap {
                        position: relative;
                        width: 100vw;
                        max-width: none;
                        height: 100%;
                        min-height: 100dvh;
                        overflow: hidden;
                        background: #fff;
                    }

                    .pmds-media {
                        position: absolute;
                        inset: 0;
                        z-index: 1;
                        width: 100vw;
                        max-width: none;
                        overflow-x: hidden;
                        overflow-y: auto;
                        padding-bottom: max(16dvh, calc(100dvh - var(--pmds-sheet-top, 55dvh)));
                        background: #fff;
                        overscroll-behavior: contain;
                        -webkit-overflow-scrolling: touch;
                        scrollbar-width: none;
                    }

                    .pmds-media::-webkit-scrollbar {
                        display: none;
                    }

                    body.property-street-view-active .pmds-media {
                        overflow-y: auto;
                        -webkit-overflow-scrolling: touch;
                    }

                    .pmds-panel {
                        position: absolute;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        z-index: 70;
                        display: flex;
                        flex-direction: column;
                        width: 100vw;
                        max-width: none;
                        overflow: hidden;
                        border-top: 1px solid rgba(184,148,95,0.16);
                        border-left: 0;
                        border-right: 0;
                        border-bottom: 0;
                        border-radius: 28px 28px 0 0;
                        background:
                            linear-gradient(180deg, rgba(255,255,255,0.99), rgba(248,246,241,0.99));
                        box-shadow:
                            0 -22px 54px rgba(15,18,20,0.24),
                            0 -1px 0 rgba(255,255,255,0.86) inset;
                        backdrop-filter: blur(18px);
                        -webkit-backdrop-filter: blur(18px);
                    }

                    .pmds-handle {
                        appearance: none;
                        display: grid;
                        align-items: center;
                        justify-items: center;
                        gap: 4px;
                        width: 100%;
                        min-height: 44px;
                        padding: 8px 0 6px;
                        border: 0;
                        background: transparent;
                        color: #8f6930;
                        cursor: grab;
                        touch-action: none;
                        user-select: none;
                        -webkit-user-select: none;
                    }

                    .pmds-handle:active {
                        cursor: grabbing;
                    }

                    .pmds-handle:focus-visible {
                        outline: 2px solid rgba(184,148,95,0.42);
                        outline-offset: -6px;
                    }

                    .pmds-handle-track {
                        width: 48px;
                        height: 5px;
                        border-radius: 999px;
                        background: linear-gradient(90deg, #d7c29a, #b8945f);
                        box-shadow: 0 1px 8px rgba(184,148,95,0.22);
                    }

                    .pmds-scroll {
                        flex: 1;
                        min-height: 0;
                        overflow-x: hidden;
                        overflow-y: auto;
                        padding: 0 18px calc(112px + env(safe-area-inset-bottom));
                        background: #f6f3ec;
                        overscroll-behavior: contain;
                        -webkit-overflow-scrolling: touch;
                    }

                    .pmds-scroll .plp-section {
                        padding-top: 24px;
                    }

                    .plp-mobile-card {
                        margin: 14px 0 0;
                        padding: 16px;
                        border: 1px solid rgba(184,148,95,0.14);
                        border-radius: 22px;
                        background: rgba(255,255,255,0.98);
                        box-shadow:
                            0 16px 34px rgba(31,25,16,0.12),
                            0 1px 0 rgba(255,255,255,0.9) inset;
                    }

                    .plp-mobile-card,
                    .plp-mobile-card * {
                        font-family: Inter, "Segoe UI", Arial, sans-serif;
                    }

                    .plp-mobile-card .plp-kicker {
                        margin-bottom: 4px;
                        color: #9a7337;
                        font-size: 0.61rem;
                        font-weight: 760;
                        letter-spacing: 0.12em;
                    }

                    .plp-mobile-card--summary {
                        margin-top: 2px;
                    }

                    .plp-mobile-card-head {
                        display: grid;
                        gap: 5px;
                        margin-bottom: 10px;
                    }

                    .plp-mobile-card-head h2 {
                        margin: 0;
                        color: #171a1d;
                        font-family: 'Playfair Display', Georgia, serif;
                        font-size: 1.02rem;
                        line-height: 1.18;
                        font-weight: 700;
                        letter-spacing: 0;
                    }

                    .plp-mobile-card p {
                        margin: 0;
                        color: #343a40;
                        font-size: 0.92rem;
                        line-height: 1.52;
                        font-weight: 440;
                    }

                    .plp-mobile-description-body {
                        display: grid;
                        gap: 12px;
                        font-family: 'Montserrat', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    }

                    .plp-mobile-description-body p {
                        color: #343a40;
                        font-family: 'Montserrat', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        font-size: 0.92rem;
                        line-height: 1.56;
                        font-weight: 430;
                    }

                    .plp-mobile-description-body p:first-child {
                        color: #202428;
                        font-weight: 560;
                    }

                    .plp-mobile-card--technical {
                        padding: 16px 15px 17px;
                    }

                    .plp-mobile-classic-lists {
                        display: grid;
                        gap: 18px;
                    }

                    .plp-mobile-card--technical .plp-info-list {
                        display: grid;
                        gap: 9px;
                    }

                    .plp-mobile-card--technical .plp-info-list h3 {
                        margin: 0;
                        padding-bottom: 8px;
                        border-bottom: 1px solid rgba(184,148,95,0.18);
                        color: #171a1d;
                        font-family: 'Montserrat', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        font-size: 0.98rem;
                        font-weight: 780;
                        line-height: 1.15;
                    }

                    .plp-mobile-card--technical .plp-info-list > div {
                        display: grid;
                        grid-template-columns: minmax(0, 1fr);
                        gap: 6px;
                    }

                    .plp-mobile-card--technical .plp-info-list ul {
                        display: grid;
                        gap: 7px;
                        margin: 0;
                        padding: 0;
                        list-style: none;
                    }

                    .plp-mobile-card--technical .plp-info-list li {
                        position: relative;
                        padding-left: 14px;
                        color: #354049;
                        font-size: 0.82rem;
                        font-weight: 520;
                        line-height: 1.38;
                    }

                    .plp-mobile-card--technical .plp-info-list li::before {
                        content: '›';
                        position: absolute;
                        left: 0;
                        top: 0;
                        color: var(--plp-gold-dark);
                        font-weight: 900;
                    }

                    .plp-mobile-market-grid small,
                    .plp-mobile-timeline-item small {
                        color: #6f756f;
                        font-size: 0.68rem;
                        font-weight: 650;
                        line-height: 1.25;
                    }

                    .plp-mobile-detail-list {
                        display: grid;
                        gap: 9px;
                        margin-top: 14px;
                    }

                    .plp-mobile-detail-list span,
                    .plp-mobile-location-grid span {
                        display: flex;
                        align-items: flex-start;
                        gap: 8px;
                        color: #2f3439;
                        font-size: 0.86rem;
                        font-weight: 560;
                        line-height: 1.35;
                    }

                    .plp-mobile-detail-list svg,
                    .plp-mobile-location-grid svg {
                        flex: 0 0 auto;
                        margin-top: 1px;
                        color: var(--plp-gold-dark);
                    }

                    .plp-mobile-card--nearby {
                        padding: 0;
                        border: 0;
                        background: transparent;
                        box-shadow: none;
                    }

                    .plp-mobile-card--nearby .plp-nearby-benefits--mobile {
                        margin-top: 0;
                    }

                    .plp-mobile-broker-head {
                        display: flex;
                        align-items: center;
                        gap: 13px;
                        margin-bottom: 0;
                    }

                    .plp-mobile-broker-head img {
                        width: 64px;
                        height: 64px;
                        border-radius: 999px;
                        object-fit: cover;
                        border: 2px solid rgba(184,148,95,0.32);
                    }

                    .plp-mobile-broker-head h2 {
                        margin: 2px 0 3px;
                        color: #171a1d;
                        font-family: 'Playfair Display', Georgia, serif;
                        font-size: 0.98rem;
                        line-height: 1.16;
                        font-weight: 700;
                    }

                    .plp-mobile-broker-head p {
                        color: #697069;
                        font-size: 0.78rem;
                        font-weight: 500;
                    }

                    .plp-mobile-broker-head > div {
                        display: grid;
                        gap: 3px;
                        min-width: 0;
                        flex: 1;
                    }

                    .plp-mobile-broker-properties-link {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        gap: 7px;
                        width: 100%;
                        margin-top: 8px;
                        min-height: 38px;
                        padding: 0 13px;
                        border-radius: 14px;
                        border: 2px solid var(--plp-gold-dark);
                        background: linear-gradient(135deg, #dfc18e, #b8945f);
                        color: #111;
                        font-size: 0.78rem;
                        font-weight: 800;
                        text-decoration: none;
                    }

                    .plp-mobile-market-grid {
                        display: grid;
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 10px;
                    }

                    .plp-mobile-market-grid > div {
                        display: grid;
                        gap: 5px;
                        min-height: 76px;
                        padding: 12px;
                        border-radius: 16px;
                        background: #f7f3ea;
                    }

                    .plp-mobile-market-grid strong {
                        color: #171a1d;
                        font-size: 0.94rem;
                        font-weight: 720;
                        line-height: 1.15;
                    }

                    .plp-mobile-market-chart {
                        margin-top: 12px;
                        padding: 12px 12px 9px;
                        border: 1px solid rgba(35,31,26,.08);
                        border-radius: 16px;
                        background:
                            linear-gradient(90deg, rgba(184,148,95,.07) 1px, transparent 1px),
                            linear-gradient(180deg, #fff 0%, #f5f2ec 100%);
                        background-size: 25% 100%, auto;
                    }

                    .plp-mobile-market-chart svg {
                        display: block;
                        width: 100%;
                        height: 72px;
                        overflow: visible;
                    }

                    .plp-mobile-market-chart path {
                        fill: none;
                        stroke: rgba(35,31,26,.16);
                        stroke-width: 1.2;
                        vector-effect: non-scaling-stroke;
                    }

                    .plp-mobile-market-chart polyline {
                        fill: none;
                        stroke: var(--plp-gold);
                        stroke-linecap: round;
                        stroke-linejoin: round;
                        stroke-width: 2.4;
                        vector-effect: non-scaling-stroke;
                    }

                    .plp-mobile-market-chart line {
                        stroke: #111;
                        stroke-dasharray: 3 3;
                        stroke-width: 1.2;
                        vector-effect: non-scaling-stroke;
                    }

                    .plp-mobile-market-chart circle {
                        fill: var(--plp-gold);
                        stroke: #111;
                        stroke-width: .9;
                        vector-effect: non-scaling-stroke;
                    }

                    .plp-mobile-market-axis {
                        display: flex;
                        justify-content: space-between;
                        color: #697069;
                        font-size: 0.62rem;
                        font-weight: 760;
                        line-height: 1;
                        text-transform: uppercase;
                    }

                    .plp-mobile-market-positioning {
                        display: grid;
                        gap: 4px;
                        margin-top: 10px;
                        padding: 11px 12px;
                        border: 1px solid rgba(184,148,95,0.18);
                        border-radius: 16px;
                        background: #fffaf0;
                    }

                    .plp-mobile-market-positioning strong {
                        color: #171a1d;
                        font-size: 0.9rem;
                        font-weight: 760;
                        line-height: 1.16;
                    }

                    .plp-mobile-market-positioning span,
                    .plp-mobile-market-positioning small {
                        color: #5e665f;
                        font-size: 0.76rem;
                        font-weight: 540;
                        line-height: 1.34;
                    }

                    .plp-mobile-card p.plp-mobile-market-reading {
                        display: grid;
                        grid-template-columns: 16px minmax(0, 1fr);
                        gap: 8px;
                        margin-top: 10px;
                        color: #4a535b;
                        font-size: 0.78rem;
                        font-weight: 560;
                        line-height: 1.36;
                    }

                    .plp-mobile-market-reading svg {
                        color: #4f7a62;
                        margin-top: 1px;
                    }

                    .plp-mobile-timeline {
                        display: grid;
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 10px;
                        margin-top: 15px;
                    }

                    .plp-mobile-timeline-item {
                        display: grid;
                        align-content: start;
                        gap: 7px;
                        min-height: 134px;
                        padding: 11px;
                        border: 1px solid rgba(21,26,28,0.08);
                        border-radius: 16px;
                        background: #fff;
                        box-shadow: 0 10px 20px rgba(31,25,16,0.08);
                    }

                    .plp-mobile-timeline-item > span {
                        color: #4d544d;
                        font-size: 0.68rem;
                        font-weight: 680;
                        line-height: 1.16;
                    }

                    .plp-mobile-timeline-item strong {
                        display: block;
                        color: #171a1d;
                        font-size: 0.8rem;
                        font-weight: 700;
                        line-height: 1.16;
                    }

                    .plp-mobile-timeline-item b {
                        width: fit-content;
                        max-width: 100%;
                        padding: 6px 8px;
                        border-radius: 999px;
                        background: #eee6d6;
                        color: #16130f;
                        font-size: 0.74rem;
                        font-weight: 720;
                        line-height: 1;
                        overflow-wrap: anywhere;
                    }

                    @media (max-width: 360px) {
                        .plp-mobile-timeline {
                            grid-template-columns: 1fr;
                        }

                        .plp-mobile-timeline-item {
                            min-height: 0;
                        }
                    }

                    .plp-mobile-location-grid {
                        display: grid;
                        gap: 9px;
                        margin-top: 13px;
                    }

                    .plp-mobile-location-map {
                        height: min(62vw, 272px);
                        min-height: 236px;
                        margin-top: 14px;
                        border-radius: 18px;
                        box-shadow: 0 16px 32px rgba(31,25,16,0.14);
                    }

                    .plp-mobile-location-map .plp-location-context {
                        display: none;
                    }

                    .plp-mobile-location-map .plp-location-explorer {
                        display: grid;
                        grid-template-rows: minmax(0, 1fr);
                        height: 100%;
                        min-height: inherit;
                    }

                    .plp-mobile-location-map .property-feed-map-shell,
                    .plp-mobile-location-map .property-feed-map-canvas,
                    .plp-mobile-location-map .leaflet-container {
                        width: 100% !important;
                        height: 100% !important;
                        min-height: inherit;
                    }

                    .plp-mobile-location-map .plp-location-actions {
                        justify-content: space-between;
                        padding: 8px 9px;
                    }

                    .plp-mobile-location-map .plp-location-actions a {
                        flex: 1 1 0;
                        justify-content: center;
                        min-height: 32px;
                        padding: 0 8px;
                        font-size: 0.7rem;
                    }

                    .plp-mobile-location-map .property-feed-map-style-control {
                        gap: 6px;
                        left: 10px;
                        right: 10px;
                        top: 10px;
                    }

                    .plp-mobile-location-map .property-feed-map-style-control button {
                        height: 32px;
                        border-radius: 999px;
                        font-size: 0.64rem;
                        padding: 0 7px;
                    }

                    .plp-mobile-location-map .property-feed-map-caption {
                        left: auto;
                        justify-content: flex-end;
                        width: max-content;
                    }

                    .plp-mobile-location-map .property-feed-map-caption span {
                        display: none;
                    }

                    .plp-mobile-related-rail {
                        display: grid;
                        grid-auto-flow: column;
                        grid-auto-columns: minmax(220px, 75%);
                        gap: 12px;
                        margin: 0 -18px;
                        padding: 0 18px 5px;
                        overflow-x: auto;
                        overscroll-behavior-x: contain;
                        scrollbar-width: none;
                    }

                    .plp-mobile-related-rail::-webkit-scrollbar {
                        display: none;
                    }

                    .plp-mobile-related-card {
                        position: relative;
                        overflow: hidden;
                        border: 1px solid rgba(184,148,95,0.16);
                        border-radius: 18px;
                        background: #fff;
                        color: inherit;
                        text-decoration: none;
                        box-shadow: 0 12px 24px rgba(31,25,16,0.12);
                    }

                    .plp-mobile-related-card img {
                        display: block;
                        width: 100%;
                        height: 132px;
                        object-fit: cover;
                    }

                    .plp-mobile-related-card > span {
                        position: absolute;
                        left: 10px;
                        top: 10px;
                        padding: 6px 9px;
                        border-radius: 999px;
                        background: rgba(18,18,18,0.72);
                        color: #fff;
                        font-size: 0.66rem;
                        font-weight: 700;
                    }

                    .plp-mobile-related-card div {
                        display: grid;
                        gap: 5px;
                        padding: 12px;
                    }

                    .plp-mobile-related-card strong {
                        color: #171a1d;
                        font-size: 1.02rem;
                        font-weight: 720;
                        line-height: 1.08;
                    }

                    .plp-mobile-related-card small {
                        color: #3c423c;
                        font-size: 0.78rem;
                        font-weight: 560;
                    }

                    .plp-mobile-related-card p {
                        color: #606860;
                        font-size: 0.86rem;
                        line-height: 1.28;
                    }

                    .plp-mobile-transparency-card {
                        margin-top: 10px;
                        margin-bottom: 18px;
                        padding: 10px 12px;
                        border-radius: 14px;
                        border-color: rgba(184,148,95,0.1);
                        background: rgba(255,252,246,0.72);
                        box-shadow: none;
                    }

                    .plp-mobile-transparency-card .plp-mobile-card-head {
                        gap: 2px;
                        margin-bottom: 4px;
                    }

                    .plp-mobile-transparency-card .plp-kicker {
                        margin-bottom: 0;
                        font-size: 0.52rem;
                        letter-spacing: 0.1em;
                    }

                    .plp-mobile-transparency-card .plp-mobile-card-head h2 {
                        font-family: Inter, "Segoe UI", Arial, sans-serif;
                        font-size: 0.78rem;
                        line-height: 1.18;
                        font-weight: 760;
                    }

                    .plp-mobile-transparency-card p {
                        color: #6a6258;
                        font-size: 0.72rem;
                        line-height: 1.32;
                        font-weight: 500;
                    }

                    .plp-mobile-media-feed {
                        position: relative;
                        display: grid;
                        gap: 4px;
                        background: #fff;
                    }

                    .plp-mobile-media-controls {
                        position: fixed;
                        left: 0;
                        right: 0;
                        top: max(12px, env(safe-area-inset-top));
                        z-index: 120;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 10px;
                        padding: 0 18px;
                        pointer-events: none;
                    }

                    .plp-mobile-back-pill,
                    .plp-mobile-action-group,
                    .plp-mobile-action-pill {
                        pointer-events: auto;
                    }

                    .plp-mobile-back-pill,
                    .plp-mobile-action-pill {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 46px;
                        height: 46px;
                        border: 1px solid rgba(184,148,95,0.2);
                        border-radius: 999px;
                        background: rgba(255,252,246,0.88);
                        color: #7d5a25;
                        text-decoration: none;
                        box-shadow: 0 10px 24px rgba(12,16,18,0.14);
                        backdrop-filter: blur(16px);
                        -webkit-backdrop-filter: blur(16px);
                    }

                    .plp-mobile-back-pill svg,
                    .plp-mobile-action-pill svg {
                        width: 18px;
                        height: 18px;
                        stroke-width: 2;
                    }

                    .plp-mobile-action-group {
                        display: inline-flex;
                        align-items: center;
                        gap: 2px;
                        min-height: 46px;
                        padding: 0 6px;
                        border: 1px solid rgba(184,148,95,0.18);
                        border-radius: 999px;
                        background: rgba(255,252,246,0.88);
                        box-shadow: 0 10px 24px rgba(12,16,18,0.14);
                        backdrop-filter: blur(16px);
                        -webkit-backdrop-filter: blur(16px);
                    }

                    .plp-mobile-action-group .plp-mobile-action-pill {
                        width: 34px;
                        height: 34px;
                        border: 0;
                        background: transparent;
                        color: #7d5a25;
                        box-shadow: none;
                        font-size: 0;
                    }

                    .plp-mobile-action-group .plp-mobile-menu {
                        display: inline-flex;
                        pointer-events: auto;
                    }

                    .plp-mobile-action-group .plp-mobile-menu-button {
                        width: 34px;
                        height: 34px;
                        border: 0;
                        border-radius: 999px;
                        background: transparent;
                        color: #7d5a25;
                        box-shadow: none;
                    }

                    .plp-mobile-action-group .plp-mobile-menu-button:hover {
                        background: rgba(184,148,95,0.12);
                        color: #7d5a25;
                    }

                    .plp-mobile-action-group .plp-mobile-action-pill svg {
                        width: 18px;
                        height: 18px;
                    }

                    .plp-mobile-action-group .plp-mobile-menu-button svg {
                        width: 18px;
                        height: 18px;
                        stroke-width: 2;
                    }

                    .plp-mobile-media-item {
                        position: relative;
                        width: 100%;
                        min-height: 0;
                        margin: 0;
                        overflow: hidden;
                        background: #e8ecee;
                    }

                    .plp-mobile-media-item img {
                        display: block;
                        width: 100%;
                        height: min(31dvh, 286px);
                        object-fit: cover;
                        object-position: center;
                    }

                    .plp-mobile-media-item:first-of-type img {
                        height: min(31dvh, 286px);
                    }

                    .plp-mobile-media-item--video {
                        height: min(34dvh, 310px);
                        min-height: 220px;
                        background: #0f1113;
                    }

                    .plp-mobile-media-item--video .plp-property-video-embed {
                        width: 100%;
                        height: 100%;
                        min-height: 100%;
                        border-radius: 0;
                    }

                    .plp-mobile-video-badge {
                        position: absolute;
                        left: 14px;
                        top: 14px;
                        z-index: 8;
                        display: inline-flex;
                        align-items: center;
                        min-height: 30px;
                        padding: 0 10px;
                        border-radius: 999px;
                        background: rgba(17,17,17,0.72);
                        color: #fff;
                        font-size: 0.7rem;
                        font-weight: 840;
                        line-height: 1;
                        box-shadow: 0 10px 20px rgba(0,0,0,0.2);
                        backdrop-filter: blur(12px);
                        -webkit-backdrop-filter: blur(12px);
                    }

                    .plp-mobile-status-pill,
                    .plp-mobile-map-label {
                        position: absolute;
                        z-index: 8;
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        border-radius: 8px;
                        background: rgba(255,255,255,0.92);
                        color: #172027;
                        font-size: 0.8rem;
                        font-weight: 720;
                        box-shadow: 0 10px 24px rgba(0,0,0,0.16);
                    }

                    .plp-mobile-status-pill {
                        left: 16px;
                        bottom: 16px;
                        min-height: 34px;
                        padding: 0 12px;
                    }

                    .plp-mobile-status-pill span {
                        width: 8px;
                        height: 8px;
                        border-radius: 999px;
                        background: #f33455;
                    }

                    .plp-mobile-media-item--map {
                        height: min(62vh, 520px);
                        min-height: 392px;
                        background: #111;
                        overscroll-behavior: contain;
                        touch-action: auto;
                    }

                    .plp-mobile-media-item--location-map {
                        background: #fff;
                        height: auto;
                        min-height: 0;
                        padding: 18px 14px 22px;
                    }

                    .plp-mobile-media-item--location-map .plp-location-explorer {
                        border: 1px solid rgba(35,31,26,0.28);
                        border-radius: 18px;
                        box-shadow: 0 16px 32px rgba(31,25,16,0.14);
                        height: min(62vw, 272px);
                        min-height: 236px;
                        overflow: hidden;
                        position: relative;
                    }

                    .plp-mobile-media-item--location-map .plp-mobile-map-label {
                        background: rgba(255,255,255,0.92);
                        border: 1px solid rgba(35,31,26,0.1);
                        color: #172027;
                        left: 26px;
                        top: 30px;
                    }

                    .plp-mobile-map-label {
                        left: 12px;
                        top: 12px;
                        padding: 9px 11px;
                        background: rgba(12,12,12,0.7);
                        color: #fff;
                        pointer-events: none;
                    }

                    body.plp-mobile-map-modal-open {
                        overflow: hidden;
                    }

                    .plp-mobile-location-strip {
                        display: grid;
                        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                        gap: 2px;
                        height: min(18dvh, 168px);
                        min-height: 136px;
                        background: #fff;
                    }

                    .plp-mobile-location-preview {
                        position: relative;
                        height: 100%;
                        min-height: 0;
                        overflow: hidden;
                        background: #e6ebee;
                        cursor: pointer;
                    }

                    .plp-mobile-location-preview-media,
                    .plp-mobile-location-preview-hit {
                        position: absolute;
                        inset: 0;
                    }

                    .plp-mobile-location-preview-media {
                        z-index: 1;
                        pointer-events: none;
                    }

                    .plp-mobile-location-preview-media * {
                        pointer-events: none !important;
                    }

                    .plp-mobile-location-preview-media::after {
                        position: absolute;
                        inset: 0;
                        z-index: 8;
                        content: "";
                        background:
                            linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.16)),
                            linear-gradient(90deg, rgba(0,0,0,0.08), rgba(0,0,0,0));
                        pointer-events: none;
                    }

                    .plp-mobile-location-preview .plp-location-explorer {
                        position: absolute;
                        inset: 0;
                        width: 100%;
                        height: 100%;
                        min-height: 0;
                        border: 0;
                        border-radius: 0;
                        overflow: hidden;
                        box-shadow: none;
                    }

                    .plp-mobile-location-preview .plp-location-context,
                    .plp-mobile-location-preview .plp-location-actions,
                    .plp-mobile-location-preview .property-feed-map-style-control,
                    .plp-mobile-location-preview .property-feed-map-caption,
                    .plp-mobile-location-preview .property-feed-map-street-toggle,
                    .plp-mobile-location-preview .property-feed-map-street-guide,
                    .plp-mobile-location-preview .property-feed-map-street-minimap {
                        display: none !important;
                    }

                    .plp-mobile-location-preview .property-feed-map-shell,
                    .plp-mobile-location-preview .property-feed-map-canvas,
                    .plp-mobile-location-preview .plp-nearby-map-shell,
                    .plp-mobile-location-preview .plp-nearby-real-map,
                    .plp-mobile-location-preview .property-feed-map-street-view,
                    .plp-mobile-location-preview .property-feed-map-street-frame,
                    .plp-mobile-location-preview .property-feed-map-street-native,
                    .plp-mobile-location-preview .property-feed-map-street-native-canvas,
                    .plp-mobile-location-preview .leaflet-container {
                        width: 100% !important;
                        height: 100% !important;
                        min-height: 0 !important;
                    }

                    .plp-mobile-location-preview .property-feed-map-shell,
                    .plp-mobile-location-preview .plp-nearby-map-shell,
                    .plp-mobile-location-preview .property-feed-map-street-view {
                        position: absolute !important;
                        inset: 0;
                        overflow: hidden;
                    }

                    .plp-mobile-location-preview .plp-nearby-map-shell {
                        border: 0;
                        border-radius: 0;
                        box-shadow: none;
                    }

                    .plp-mobile-location-preview .plp-nearby-map-status,
                    .plp-mobile-location-preview .plp-nearby-property-tooltip,
                    .plp-mobile-location-preview .plp-nearby-benefit-tooltip {
                        display: none !important;
                    }

                    .plp-mobile-location-preview .property-feed-map-street-native,
                    .plp-mobile-location-preview .property-feed-map-street-native-canvas,
                    .plp-mobile-location-preview .property-feed-map-street-frame {
                        position: absolute !important;
                        inset: 0;
                        pointer-events: none !important;
                    }

                    .plp-mobile-location-preview .property-feed-map-street-scroll-shield {
                        display: none !important;
                    }

                    .plp-mobile-location-preview .plp-mobile-map-label {
                        left: 7px;
                        top: 7px;
                        gap: 4px;
                        min-height: 22px;
                        max-width: calc(100% - 14px);
                        padding: 0 7px;
                        border-radius: 999px;
                        background: rgba(17,17,17,0.54);
                        color: rgba(255,255,255,0.94);
                        font-size: 0.58rem;
                        font-weight: 820;
                        line-height: 1;
                        box-shadow: 0 8px 16px rgba(0,0,0,0.16);
                        backdrop-filter: blur(8px);
                        -webkit-backdrop-filter: blur(8px);
                    }

                    .plp-mobile-location-preview .plp-mobile-map-label svg {
                        width: 11px;
                        height: 11px;
                    }

                    .plp-mobile-location-preview .property-feed-map-marker-wrap strong {
                        display: none;
                    }

                    .plp-mobile-location-preview .property-feed-map-pin {
                        transform: scale(0.78);
                        transform-origin: center bottom;
                    }

                    .plp-mobile-location-preview .leaflet-control-attribution {
                        max-width: calc(100% - 4px);
                        padding: 0 2px !important;
                        background: rgba(255,255,255,0.54) !important;
                        color: rgba(15,23,42,0.62) !important;
                        font-size: 0.43rem !important;
                        line-height: 1.05 !important;
                        opacity: 0.62;
                        white-space: nowrap;
                        overflow: hidden;
                    }

                    .plp-mobile-location-preview .leaflet-control-attribution a {
                        color: rgba(15,23,42,0.62) !important;
                    }

                    .plp-mobile-location-preview-hit {
                        z-index: 16;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 10px;
                        border: 0;
                        background: transparent;
                        color: #fff;
                        font: inherit;
                        text-align: center;
                    }

                    .plp-mobile-location-preview-hit span {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        gap: 4px;
                        min-height: 26px;
                        max-width: 100%;
                        padding: 0 8px;
                        border-radius: 999px;
                        background: rgba(17,17,17,0.58);
                        color: #fff;
                        font-size: 0.58rem;
                        font-weight: 820;
                        line-height: 1;
                        white-space: nowrap;
                        box-shadow: 0 8px 16px rgba(0,0,0,0.18);
                        backdrop-filter: blur(12px);
                        -webkit-backdrop-filter: blur(12px);
                    }

                    .plp-mobile-location-preview-hit span svg {
                        width: 12px;
                        height: 12px;
                    }

                    .plp-mobile-map-modal {
                        position: fixed;
                        inset: 0 0 calc(58px + env(safe-area-inset-bottom)) 0;
                        z-index: 990;
                        display: flex;
                        flex-direction: column;
                        width: 100vw;
                        height: auto;
                        background: #f8fafc;
                        color: #111827;
                    }

                    .plp-mobile-map-modal-close {
                        position: absolute;
                        left: 12px;
                        top: calc(12px + env(safe-area-inset-top));
                        z-index: 5;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 42px;
                        height: 42px;
                        border: 1px solid rgba(15,23,42,0.1);
                        border-radius: 999px;
                        background: rgba(255,255,255,0.92);
                        color: #111827;
                        box-shadow: 0 12px 28px rgba(15,23,42,0.18);
                        backdrop-filter: blur(12px);
                        -webkit-backdrop-filter: blur(12px);
                    }

                    .plp-mobile-map-modal-body {
                        position: relative;
                        z-index: 1;
                        flex: 1;
                        min-height: 0;
                        overflow: hidden;
                        background: #e9eef3;
                    }

                    .plp-mobile-map-modal-body .plp-location-explorer {
                        position: absolute;
                        inset: 0;
                        width: 100%;
                        height: 100%;
                        min-height: 0;
                        border: 0;
                        border-radius: 0;
                        overflow: hidden;
                        box-shadow: none;
                    }

                    .plp-mobile-map-modal-body .plp-location-context,
                    .plp-mobile-map-modal-body .plp-location-actions,
                    .plp-mobile-map-modal-body .property-feed-map-style-control,
                    .plp-mobile-map-modal-body .property-feed-map-street-toggle,
                    .plp-mobile-map-modal-body .property-feed-map-street-guide,
                    .plp-mobile-map-modal-body .property-feed-map-caption {
                        display: none !important;
                    }

                    .plp-mobile-map-modal-body .property-feed-map-shell,
                    .plp-mobile-map-modal-body .property-feed-map-canvas,
                    .plp-mobile-map-modal-body .plp-nearby-map-shell,
                    .plp-mobile-map-modal-body .plp-nearby-real-map,
                    .plp-mobile-map-modal-body .property-feed-map-street-view,
                    .plp-mobile-map-modal-body .property-feed-map-street-frame,
                    .plp-mobile-map-modal-body .property-feed-map-street-native,
                    .plp-mobile-map-modal-body .property-feed-map-street-native-canvas,
                    .plp-mobile-map-modal-body .leaflet-container {
                        width: 100% !important;
                        height: 100% !important;
                        min-height: 0 !important;
                    }

                    .plp-mobile-map-modal-body .property-feed-map-shell,
                    .plp-mobile-map-modal-body .plp-nearby-map-shell,
                    .plp-mobile-map-modal-body .property-feed-map-street-view,
                    .plp-mobile-map-modal-body .property-feed-map-street-native,
                    .plp-mobile-map-modal-body .property-feed-map-street-native-canvas,
                    .plp-mobile-map-modal-body .property-feed-map-street-frame {
                        position: absolute !important;
                        inset: 0;
                    }

                    .plp-mobile-map-modal-body .plp-nearby-map-shell {
                        border: 0;
                        border-radius: 0;
                        box-shadow: none;
                    }

                    .plp-mobile-map-modal-body .leaflet-marker-pane {
                        z-index: 740 !important;
                    }

                    .plp-mobile-map-modal-body .property-feed-map-marker {
                        z-index: 760 !important;
                    }

                    .plp-mobile-map-modal-body .property-feed-map-marker-wrap {
                        filter: drop-shadow(0 12px 18px rgba(15,57,96,.42)) !important;
                        transform: translateY(2px) scale(1.08);
                    }

                    .plp-mobile-map-modal-body .property-feed-map-style-control {
                        left: 50%;
                        top: 14px;
                        right: auto;
                        width: min(310px, calc(100vw - 32px));
                        transform: translateX(-50%);
                    }

                    .plp-mobile-map-modal-body .property-feed-map-style-control button {
                        height: 40px;
                        border-radius: 0;
                        background: rgba(255,255,255,0.9);
                        color: #4b5563;
                        font-size: 0.8rem;
                    }

                    .plp-mobile-map-modal-body .property-feed-map-style-control button.active {
                        background: #fff;
                        color: #0b74de;
                        box-shadow: inset 0 -3px 0 #0b74de;
                    }

                    .plp-mobile-map-modal--street .property-feed-map-street-toggle {
                        left: 50%;
                        right: auto;
                        top: auto;
                        bottom: calc(28px + env(safe-area-inset-bottom));
                        transform: translateX(-50%);
                    }

                    .plp-mobile-map-modal--street .property-feed-map-street-toggle.is-active {
                        background: rgba(255,255,255,0.92);
                        color: #111827;
                    }

                    .plp-mobile-map-modal--street .property-feed-map-street-guide {
                        left: 50%;
                        right: auto;
                        top: auto;
                        bottom: calc(80px + env(safe-area-inset-bottom));
                        transform: translateX(-50%);
                    }

                    .plp-mobile-map-modal-pin {
                        position: absolute;
                        left: 50%;
                        top: 50%;
                        z-index: 4;
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        min-height: 46px;
                        padding: 0 14px;
                        border-radius: 6px;
                        background: #fff;
                        color: #111827;
                        font-size: 0.95rem;
                        font-weight: 760;
                        box-shadow: 0 16px 36px rgba(15,23,42,0.18);
                        transform: translate(-50%, calc(-100% - 50px));
                        pointer-events: none;
                    }

                    .plp-mobile-map-modal-pin::after {
                        position: absolute;
                        left: 50%;
                        bottom: -9px;
                        width: 16px;
                        height: 16px;
                        border-right: 1px solid rgba(15,23,42,0.08);
                        border-bottom: 1px solid rgba(15,23,42,0.08);
                        background: #fff;
                        content: '';
                        transform: translateX(-50%) rotate(45deg);
                    }

                    .plp-mobile-map-modal-pin svg {
                        color: #18b77a;
                        position: relative;
                        z-index: 1;
                    }

                    .plp-mobile-map-modal-pin span {
                        position: relative;
                        z-index: 1;
                    }

                    .plp-mobile-street-minimap {
                        background:
                            radial-gradient(circle at 48% 52%, rgba(255,255,255,.95), rgba(255,255,255,.28) 36%, transparent 37%),
                            linear-gradient(28deg, transparent 43%, rgba(178,139,78,.52) 44%, rgba(178,139,78,.52) 49%, transparent 50%),
                            linear-gradient(-18deg, transparent 40%, rgba(55,76,93,.34) 41%, rgba(55,76,93,.34) 46%, transparent 47%),
                            linear-gradient(135deg, #dfe9e5, #fbf6ea);
                        border: 1px solid rgba(255,255,255,.72);
                        border-radius: 15px;
                        box-shadow: 0 16px 34px rgba(0,0,0,.32);
                        height: 76px;
                        left: auto;
                        overflow: hidden;
                        pointer-events: none;
                        position: absolute;
                        right: 12px;
                        top: 66px;
                        width: 104px;
                        z-index: 2147483647;
                    }

                    .plp-mobile-street-minimap::after {
                        border: 1px solid rgba(17,17,17,.12);
                        border-radius: inherit;
                        content: '';
                        inset: 0;
                        position: absolute;
                    }

                    .plp-mobile-street-minimap-road {
                        background: rgba(255,255,255,.74);
                        border: 1px solid rgba(184,148,95,.28);
                        border-radius: 999px;
                        display: block;
                        height: 10px;
                        left: -12px;
                        position: absolute;
                        top: 40px;
                        transform: rotate(-19deg);
                        width: 132px;
                    }

                    .plp-mobile-street-minimap-road--side {
                        background: rgba(255,255,255,.58);
                        left: 28px;
                        top: 18px;
                        transform: rotate(61deg);
                        width: 88px;
                    }

                    .plp-mobile-street-minimap-marker {
                        align-items: center;
                        background: linear-gradient(135deg, #dfc18e, #a87938);
                        border: 2px solid #fff;
                        border-radius: 999px;
                        box-shadow: 0 8px 18px rgba(0,0,0,.28);
                        display: grid;
                        height: 28px;
                        justify-items: center;
                        left: 50%;
                        position: absolute;
                        top: 48%;
                        transform: translate(-50%, -50%);
                        width: 28px;
                        z-index: 3;
                    }

                    .plp-mobile-street-minimap-marker::before {
                        border-bottom: 8px solid #fff;
                        border-left: 5px solid transparent;
                        border-right: 5px solid transparent;
                        content: '';
                        left: 50%;
                        position: absolute;
                        top: 4px;
                        transform: translateX(-50%);
                    }

                    .plp-mobile-street-minimap-marker i {
                        background: #111;
                        border-radius: 999px;
                        display: block;
                        height: 5px;
                        width: 5px;
                    }

                    .plp-mobile-street-minimap small {
                        background: rgba(17,17,17,.78);
                        border-radius: 999px;
                        bottom: 5px;
                        color: #fff;
                        font-size: .52rem;
                        font-weight: 780;
                        left: 6px;
                        letter-spacing: .02em;
                        line-height: 1;
                        padding: 4px 6px;
                        position: absolute;
                        text-transform: uppercase;
                        z-index: 4;
                    }

                    .plp-mobile-media-item--map .plp-location-explorer {
                        display: block;
                        height: 100%;
                        inset: 0;
                        min-height: 0;
                        overscroll-behavior: contain;
                        position: absolute;
                        touch-action: auto;
                        width: 100%;
                    }

                    .plp-mobile-media-item--location-map .plp-location-explorer {
                        inset: auto;
                        height: min(62vw, 272px);
                        min-height: 236px;
                        position: relative;
                    }

                    .plp-mobile-media-item--location-map .property-feed-map-marker {
                        background: none !important;
                        border: 0 !important;
                    }

                    .plp-mobile-media-item--location-map .property-feed-map-marker-wrap {
                        align-items: center;
                        cursor: pointer;
                        display: flex;
                        flex-direction: column;
                        filter: drop-shadow(0 10px 16px rgba(0,0,0,.4));
                        gap: 3px;
                        transform-origin: center bottom;
                    }

                    .plp-mobile-media-item--location-map .property-feed-map-pin {
                        align-items: center;
                        background: linear-gradient(145deg, #fff3c7 0%, #d7ad42 48%, #9c741b 100%);
                        border: 2px solid rgba(18,18,18,.88);
                        border-radius: 50% 50% 50% 8px;
                        box-shadow: 0 0 0 2px rgba(255,255,255,.18), 0 10px 24px rgba(217,172,63,.24);
                        display: inline-flex;
                        height: 30px;
                        justify-content: center;
                        position: relative;
                        transform: rotate(45deg);
                        width: 30px;
                    }

                    .plp-mobile-media-item--location-map .property-feed-map-pin::before {
                        background: radial-gradient(circle, rgba(223,193,142,.32), transparent 64%);
                        border-radius: 50%;
                        content: '';
                        inset: -7px;
                        position: absolute;
                        z-index: -1;
                    }

                    .plp-mobile-media-item--location-map .property-feed-map-pin span {
                        background: #15130f;
                        border-radius: 2px;
                        height: 8px;
                        position: relative;
                        transform: rotate(-45deg);
                        width: 10px;
                    }

                    .plp-mobile-media-item--location-map .property-feed-map-pin span::before {
                        background: #15130f;
                        border-radius: 2px 1px 0 1px;
                        content: '';
                        height: 8px;
                        left: 1px;
                        position: absolute;
                        top: -5px;
                        transform: rotate(45deg);
                        width: 8px;
                    }

                    .plp-mobile-media-item--location-map .property-feed-map-pin span::after {
                        background: #d7ad42;
                        border-radius: 1px 1px 0 0;
                        bottom: 0;
                        content: '';
                        height: 5px;
                        left: 4px;
                        position: absolute;
                        width: 3px;
                    }

                    .plp-mobile-media-item--location-map .property-feed-map-marker-wrap strong {
                        background: rgba(10,10,10,.88);
                        border: 1px solid rgba(223,193,142,.54);
                        border-radius: 999px;
                        box-shadow: 0 8px 16px rgba(0,0,0,.22);
                        color: #f0d08f;
                        display: block;
                        font-size: .62rem;
                        font-weight: 900;
                        line-height: 1.3;
                        min-width: 52px;
                        padding: 3px 8px;
                        text-align: center;
                        white-space: nowrap;
                    }

                    .plp-mobile-media-item--location-map .property-feed-map-marker-wrap.is-exclusive strong::after {
                        color: #fff3c7;
                        content: 'EX';
                        font-size: .52rem;
                        margin-left: 4px;
                    }

                    .plp-mobile-media-item--map .plp-location-context,
                    .plp-mobile-media-item--map .plp-location-actions {
                        display: none;
                    }

                    .plp-mobile-media-item--map .property-feed-map-shell,
                    .plp-mobile-media-item--map .property-feed-map-canvas,
                    .plp-mobile-media-item--map .property-feed-map-street-view,
                    .plp-mobile-media-item--map .property-feed-map-street-frame,
                    .plp-mobile-media-item--map .leaflet-container {
                        width: 100% !important;
                        height: 100% !important;
                        min-height: 0 !important;
                    }

                    .plp-mobile-media-item--map .property-feed-map-shell,
                    .plp-mobile-media-item--map .property-feed-map-street-view {
                        inset: 0;
                        overflow: hidden;
                        overscroll-behavior: contain;
                        pointer-events: auto;
                        position: absolute !important;
                        touch-action: auto;
                    }

                    .plp-mobile-media-item--map .property-feed-map-shell::after {
                        content: none;
                        display: none;
                    }

                    .plp-mobile-media-item--map .property-feed-map-street-view {
                        position: relative;
                        z-index: 2;
                    }

                    .plp-mobile-media-item--map .property-feed-map-street-native,
                    .plp-mobile-media-item--map .property-feed-map-street-native-canvas,
                    .plp-mobile-media-item--map .property-feed-map-street-frame {
                        display: block;
                        height: 100% !important;
                        inset: 0;
                        min-height: 100% !important;
                        pointer-events: auto !important;
                        touch-action: auto !important;
                        position: absolute !important;
                        width: 100% !important;
                        z-index: 3;
                    }

                    .plp-mobile-media-item--map .property-feed-map-street-view.is-interactive .property-feed-map-street-native {
                        touch-action: none !important;
                    }

                    .plp-mobile-media-item--map .property-feed-map-street-view:not(.is-interactive) .property-feed-map-street-native,
                    .plp-mobile-media-item--map .property-feed-map-street-view:not(.is-interactive) .property-feed-map-street-frame {
                        pointer-events: none !important;
                    }

                    .plp-mobile-media-item--map .property-feed-map-street-scroll-shield {
                        background: transparent;
                        display: block;
                        inset: 0;
                        pointer-events: auto;
                        position: absolute;
                        touch-action: pan-y;
                        user-select: none;
                        z-index: 2147482000;
                    }

                    .plp-mobile-media-item--map .property-feed-map-street-view.is-interactive .property-feed-map-street-scroll-shield {
                        display: none;
                    }

                    .plp-mobile-media-item--map .property-feed-map-street-toggle {
                        align-items: center;
                        background: linear-gradient(135deg, #dfc18e, #b8945f);
                        border: 1px solid rgba(255,255,255,.28);
                        border-radius: 999px;
                        box-shadow: 0 14px 32px rgba(0,0,0,.28);
                        color: #111;
                        cursor: pointer;
                        display: inline-flex;
                        font-size: .68rem;
                        font-weight: 780;
                        gap: 6px;
                        justify-content: center;
                        left: 50%;
                        min-height: 36px;
                        padding: 0 13px;
                        pointer-events: auto;
                        position: absolute;
                        right: auto;
                        top: 50%;
                        transform: translate(-50%, -50%);
                        white-space: nowrap;
                        z-index: 2147483000;
                    }

                    .plp-mobile-media-item--map .property-feed-map-street-toggle.is-active {
                        background: rgba(17, 17, 17, .84);
                        border-color: rgba(223, 193, 142, .42);
                        color: #f5ead7;
                        backdrop-filter: blur(12px);
                        -webkit-backdrop-filter: blur(12px);
                    }

                    .plp-mobile-media-item--map .property-feed-map-street-guide {
                        max-width: min(270px, calc(100% - 34px));
                        padding: 7px 10px;
                        top: calc(50% + 43px);
                    }

                    .plp-mobile-media-item--map .property-feed-map-street-guide span:last-child {
                        font-size: .61rem;
                        font-weight: 720;
                    }

                    .plp-mobile-media-item--map .property-feed-map-street-guide-motion {
                        height: 16px;
                        width: 24px;
                    }

                    .plp-mobile-media-item--map .property-feed-map-street-minimap {
                        background: rgba(255, 252, 246, .92);
                        border: 1px solid rgba(255,255,255,.72);
                        border-radius: 14px;
                        bottom: auto;
                        box-shadow: 0 16px 38px rgba(0,0,0,.28);
                        display: block;
                        height: 76px;
                        left: auto;
                        overflow: hidden;
                        pointer-events: none;
                        position: absolute;
                        right: 12px;
                        top: 66px;
                        width: 104px;
                        z-index: 2147483600;
                    }

                    .plp-mobile-media-item--map .property-feed-map-street-minimap::after {
                        border: 1px solid rgba(17,17,17,.1);
                        border-radius: inherit;
                        content: '';
                        inset: 0;
                        pointer-events: none;
                        position: absolute;
                        z-index: 4;
                    }

                    .plp-mobile-media-item--map .property-feed-map-street-minimap-fallback {
                        background:
                            radial-gradient(circle at 50% 50%, rgba(255,255,255,.95), rgba(255,255,255,.25) 35%, transparent 36%),
                            linear-gradient(135deg, transparent 45%, rgba(47, 108, 156, .12) 46%, rgba(47, 108, 156, .12) 53%, transparent 54%),
                            linear-gradient(135deg, #e7eee9, #f8f4ea);
                        inset: 0;
                        position: absolute;
                        z-index: 1;
                    }

                    .plp-mobile-media-item--map .property-feed-map-street-minimap-road {
                        background: rgba(255,255,255,.78);
                        border: 1px solid rgba(184,148,95,.3);
                        border-radius: 999px;
                        box-shadow: 0 1px 0 rgba(255,255,255,.82);
                        display: block;
                        height: 8px;
                        left: -16px;
                        position: absolute;
                        top: 40px;
                        transform: rotate(-22deg);
                        width: 136px;
                        z-index: 2;
                    }

                    .plp-mobile-media-item--map .property-feed-map-street-minimap-road--side {
                        background: rgba(255,255,255,.62);
                        left: 28px;
                        top: 18px;
                        transform: rotate(58deg);
                        width: 84px;
                    }

                    .plp-mobile-media-item--map .property-feed-map-street-minimap-marker {
                        align-items: center;
                        background: linear-gradient(135deg, #dfc18e, #a87938);
                        border: 2px solid #fff;
                        border-radius: 999px;
                        box-shadow: 0 8px 18px rgba(0,0,0,.28);
                        display: grid;
                        height: 24px;
                        justify-items: center;
                        left: 50%;
                        position: absolute;
                        top: 50%;
                        transform-origin: 50% 50%;
                        transition: transform .14s ease-out;
                        will-change: transform;
                        width: 24px;
                        z-index: 5;
                    }

                    .plp-mobile-media-item--map .property-feed-map-street-minimap-marker::before {
                        border-bottom-width: 7px;
                        border-left-width: 4px;
                        border-right-width: 4px;
                        border-left-style: solid;
                        border-right-style: solid;
                        border-bottom-style: solid;
                        border-left-color: transparent;
                        border-right-color: transparent;
                        border-bottom-color: #fff;
                        content: '';
                        left: 50%;
                        position: absolute;
                        top: 4px;
                        transform: translateX(-50%);
                    }

                    .plp-mobile-media-item--map .property-feed-map-street-minimap-marker i {
                        background: #111;
                        border-radius: 999px;
                        display: block;
                        height: 5px;
                        width: 5px;
                    }

                    .plp-mobile-media-item--map .property-feed-map-street-minimap small {
                        background: rgba(17,17,17,.76);
                        border-radius: 999px;
                        bottom: 5px;
                        color: #fff;
                        font-size: .5rem;
                        font-weight: 820;
                        left: 6px;
                        letter-spacing: .04em;
                        line-height: 1;
                        padding: 4px 6px;
                        position: absolute;
                        text-transform: uppercase;
                        z-index: 6;
                    }

                    .plp-mobile-media-item--map .property-feed-map-style-control {
                        left: 12px;
                        right: 12px;
                        top: 56px;
                    }

                    .plp-mobile-media-item--map .property-feed-map-style-control button {
                        height: 34px;
                        border-radius: 999px;
                        background: rgba(255,255,255,0.86);
                        color: #111;
                        font-size: 0.64rem;
                    }

                    .plp-mobile-media-item--map .property-feed-map-style-control button.active {
                        background: linear-gradient(135deg, #dfc18e, #b8945f);
                        color: #111;
                    }

                    .plp-mobile-media-item--map .property-feed-map-caption {
                        left: 12px;
                        right: 12px;
                        bottom: 12px;
                        background: transparent;
                        border: 0;
                        box-shadow: none;
                        justify-content: flex-end;
                        padding: 0;
                        pointer-events: none;
                    }

                    .plp-mobile-media-item--map .property-feed-map-caption span {
                        display: none;
                    }

                    .plp-mobile-sheet-summary {
                        display: grid;
                        grid-template-columns: minmax(0, 1fr);
                        align-items: center;
                        gap: 8px 10px;
                        padding: 2px 0 4px;
                    }

                    .plp-mobile-price-badge,
                    .plp-mobile-sheet-title,
                    .plp-mobile-sheet-price,
                    .plp-mobile-main-benefit-tag,
                    .plp-mobile-sheet-facts {
                        grid-column: 1 / -1;
                    }

                    .plp-mobile-price-badge {
                        width: fit-content;
                        padding: 8px 12px;
                        border-radius: 999px;
                        background: #fff0f0;
                        color: #c9233d;
                        font-size: 0.75rem;
                        font-weight: 720;
                    }

                    .plp-mobile-sheet-title {
                        justify-self: center;
                        width: 100%;
                        max-width: 320px;
                        margin: 0;
                        color: #262b2f;
                        font-family: 'Montserrat', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        font-size: clamp(0.82rem, 3.2vw, 0.98rem);
                        font-weight: 500;
                        line-height: 1.24;
                        text-align: center;
                        display: -webkit-box;
                        -webkit-box-orient: vertical;
                        -webkit-line-clamp: 2;
                        overflow: hidden;
                    }

                    .plp-mobile-sheet-price {
                        display: block;
                        justify-self: center;
                        max-width: 100%;
                        color: #171a1d;
                        font-family: 'Montserrat', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        font-size: clamp(1.16rem, 4.9vw, 1.44rem);
                        font-weight: 400;
                        line-height: 1.12;
                        letter-spacing: 0;
                        text-align: center;
                        overflow-wrap: anywhere;
                    }

                    .plp-mobile-main-benefit-tag {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        justify-self: center;
                        max-width: min(100%, 300px);
                        min-height: 22px;
                        padding: 4px 11px;
                        border: 1px solid rgba(184, 132, 54, 0.24);
                        border-radius: 999px;
                        background: rgba(189, 149, 81, 0.13);
                        color: var(--plp-gold-dark);
                        font-family: 'Montserrat', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        font-size: clamp(0.62rem, 2.7vw, 0.72rem);
                        font-weight: 600;
                        line-height: 1.1;
                        text-align: center;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    .plp-mobile-sheet-facts {
                        display: grid;
                        grid-template-columns: repeat(4, minmax(0, 1fr));
                        align-items: center;
                        justify-items: stretch;
                        width: 100%;
                        gap: 5px;
                        color: #2f3439;
                        text-align: center;
                    }

                    .plp-mobile-sheet-fact {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        min-width: 0;
                        gap: 5px;
                        padding: 2px 1px;
                        color: #2f3439;
                        text-align: center;
                    }

                    .plp-mobile-sheet-facts svg {
                        display: block;
                        flex: 0 0 auto;
                        width: 15px;
                        height: 15px;
                        color: #252a2f;
                        stroke-width: 2;
                    }

                    .plp-mobile-sheet-fact-text {
                        display: block;
                        max-width: 100%;
                        color: #252a2f;
                        font-family: 'Montserrat', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        font-size: clamp(0.59rem, 2.55vw, 0.7rem);
                        font-weight: 500;
                        line-height: 1.1;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    .plp-mobile-sheet-summary p {
                        grid-column: 1 / -1;
                        justify-self: center;
                        width: 100%;
                        min-width: 0;
                        margin: 0;
                        color: #343a40;
                        font-size: 0.8rem;
                        font-weight: 500;
                        line-height: 1.35;
                        text-align: center;
                        overflow: hidden;
                        display: -webkit-box;
                        -webkit-box-orient: vertical;
                        -webkit-line-clamp: 2;
                    }

                    .plp-mobile-listing-stats {
                        display: grid;
                        grid-column: 1 / -1;
                        grid-template-columns: repeat(3, minmax(0, 1fr));
                        justify-content: center;
                        width: 100%;
                        column-gap: clamp(8px, 4vw, 22px);
                        row-gap: 8px;
                        margin-top: 2px;
                        padding-top: 10px;
                        border-top: 1px solid rgba(35,31,26,0.08);
                    }

                    .plp-mobile-listing-stats span {
                        display: grid;
                        grid-template-columns: auto auto;
                        grid-template-areas:
                            "icon value"
                            "label label";
                        justify-content: center;
                        justify-items: center;
                        column-gap: 5px;
                        row-gap: 1px;
                        align-items: center;
                        min-width: 0;
                        text-align: center;
                    }

                    .plp-mobile-listing-stats svg {
                        grid-area: icon;
                        color: var(--plp-gold-dark);
                        stroke-width: 2.35;
                    }

                    .plp-mobile-listing-stats strong {
                        grid-area: value;
                        width: fit-content;
                        border-bottom: 2px dotted rgba(189,149,81,.58);
                        color: #171a1d;
                        font-size: 0.76rem;
                        font-weight: 820;
                        line-height: 1.04;
                    }

                    .plp-mobile-listing-stats small {
                        grid-area: label;
                        color: #58616a;
                        font-size: 0.64rem;
                        font-weight: 640;
                        line-height: 1.08;
                        text-align: center;
                        white-space: nowrap;
                    }

                    .plp-mobile-sheet-actions {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 10px;
                    }

                    .plp-mobile-sheet-primary {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 38px;
                        border-radius: 10px;
                        font-size: 0.72rem;
                        font-weight: 760;
                        text-decoration: none;
                    }

                    @media (max-width: 360px) {
                        .plp-mobile-sheet-summary {
                            grid-template-columns: minmax(0, 1fr);
                            gap: 7px 8px;
                        }

                        .plp-mobile-sheet-facts {
                            grid-template-columns: repeat(2, minmax(0, 1fr));
                            gap: 7px 12px;
                        }
                    }

                    .plp-mobile-card--summary {
                        display: block;
                        margin-top: 2px;
                        padding: 0;
                        overflow: hidden;
                        border-color: rgba(184,148,95,0.13);
                        border-radius: 22px;
                        background: linear-gradient(180deg, #ffffff 0%, #fffdfa 100%);
                        box-shadow:
                            0 16px 34px rgba(24,31,42,0.1),
                            0 1px 0 rgba(255,255,255,0.95) inset;
                    }

                    .plp-mobile-summary-head {
                        display: grid;
                        grid-template-columns: minmax(0, 1fr) minmax(106px, auto);
                        gap: 13px;
                        align-items: start;
                        padding: 17px 16px 13px;
                        border-bottom: 1px solid rgba(25,32,43,0.08);
                    }

                    .plp-mobile-summary-copy {
                        display: grid;
                        gap: 9px;
                        min-width: 0;
                    }

                    .plp-mobile-sheet-summary .plp-mobile-sheet-title {
                        justify-self: stretch;
                        max-width: none;
                        color: #122033;
                        font-size: clamp(1rem, 4.2vw, 1.24rem);
                        font-weight: 500;
                        line-height: 1.18;
                        text-align: left;
                    }

                    .plp-mobile-summary-location {
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        min-width: 0;
                        color: #536179;
                        font-size: 0.82rem;
                        font-weight: 450;
                        line-height: 1.25;
                    }

                    .plp-mobile-summary-location svg {
                        flex: 0 0 auto;
                        color: var(--plp-gold-dark);
                        stroke-width: 2.15;
                    }

                    .plp-mobile-summary-price-block {
                        display: grid;
                        gap: 3px;
                        justify-items: start;
                        min-width: 0;
                        padding-left: 13px;
                        border-left: 1px solid rgba(25,32,43,0.1);
                    }

                    .plp-mobile-summary-price-block small {
                        color: #647084;
                        font-size: 0.63rem;
                        font-weight: 650;
                        letter-spacing: 0.08em;
                        line-height: 1;
                        text-transform: uppercase;
                    }

                    .plp-mobile-sheet-summary .plp-mobile-sheet-price {
                        justify-self: start;
                        color: #b8945f;
                        font-size: clamp(1.16rem, 5.2vw, 1.5rem);
                        font-weight: 500;
                        line-height: 1;
                        text-align: left;
                    }

                    .plp-mobile-sheet-summary .plp-mobile-sheet-facts {
                        display: grid;
                        grid-template-columns: repeat(4, minmax(0, 1fr));
                        gap: 10px;
                        padding: 14px 16px;
                        border-bottom: 1px solid rgba(25,32,43,0.08);
                    }

                    .plp-mobile-sheet-summary .plp-mobile-sheet-fact {
                        display: grid;
                        grid-template-columns: minmax(0, 1fr);
                        align-items: start;
                        justify-items: center;
                        justify-content: center;
                        gap: 6px;
                        padding: 0;
                        text-align: center;
                    }

                    .plp-mobile-sheet-summary .plp-mobile-sheet-facts svg {
                        width: 22px;
                        height: 22px;
                        color: var(--plp-gold-dark);
                        stroke-width: 1.85;
                    }

                    .plp-mobile-sheet-summary .plp-mobile-sheet-fact-text {
                        display: grid;
                        gap: 2px;
                        color: #111c2d;
                        font-size: 0.82rem;
                        font-weight: 620;
                        line-height: 1.05;
                        text-align: center;
                        white-space: normal;
                    }

                    .plp-mobile-sheet-summary .plp-mobile-sheet-fact-text strong {
                        color: #111c2d;
                        font-size: 0.88rem;
                        font-weight: 580;
                        line-height: 1;
                    }

                    .plp-mobile-sheet-summary .plp-mobile-sheet-fact-text small,
                    .plp-mobile-sheet-summary .plp-mobile-sheet-fact--area .plp-mobile-sheet-fact-text::after {
                        color: #536179;
                        font-size: 0.62rem;
                        font-weight: 430;
                        line-height: 1.05;
                        white-space: normal;
                    }

                    .plp-mobile-sheet-summary .plp-mobile-sheet-fact--area .plp-mobile-sheet-fact-text::after {
                        content: 'área';
                    }

                    .plp-mobile-sheet-summary .plp-mobile-listing-stats {
                        display: grid;
                        grid-template-columns: repeat(3, minmax(0, 1fr));
                        column-gap: 0;
                        width: auto;
                        margin: 14px 16px 0;
                        padding: 11px 0;
                        border: 0;
                        border-radius: 13px;
                        background: linear-gradient(135deg, #102038, #091526);
                        box-shadow: 0 12px 24px rgba(9,21,38,0.15);
                    }

                    .plp-mobile-sheet-summary .plp-mobile-listing-stats span {
                        grid-template-columns: auto auto;
                        align-items: center;
                        padding: 0 7px;
                    }

                    .plp-mobile-sheet-summary .plp-mobile-listing-stats span + span {
                        border-left: 1px solid rgba(255,255,255,0.2);
                    }

                    .plp-mobile-sheet-summary .plp-mobile-listing-stats svg {
                        color: #d8b979;
                    }

                    .plp-mobile-sheet-summary .plp-mobile-listing-stats strong {
                        border-bottom: 0;
                        color: #fffdf7;
                        font-size: 0.86rem;
                        font-weight: 520;
                    }

                    .plp-mobile-sheet-summary .plp-mobile-listing-stats small {
                        color: rgba(255,255,255,0.78);
                        font-size: 0.6rem;
                        font-weight: 420;
                    }

                    .plp-mobile-summary-description {
                        box-sizing: border-box;
                        width: auto;
                        margin: 14px 0 0 !important;
                        padding: 0 16px;
                    }

                    .plp-mobile-summary-description summary {
                        display: grid;
                        gap: 8px;
                        color: #536179;
                        font-size: 0.84rem;
                        font-weight: 430;
                        line-height: 1.42;
                        text-align: left;
                        cursor: pointer;
                        list-style: none;
                    }

                    .plp-mobile-summary-description summary::-webkit-details-marker {
                        display: none;
                    }

                    .plp-mobile-summary-description-preview {
                        display: -webkit-box;
                        -webkit-box-orient: vertical;
                        -webkit-line-clamp: 2;
                        overflow: hidden;
                    }

                    .plp-mobile-summary-description-toggle {
                        display: inline-flex;
                        width: fit-content;
                        color: var(--plp-gold-dark);
                        font-size: 0.72rem;
                        font-weight: 720;
                        letter-spacing: 0.05em;
                        line-height: 1;
                        text-transform: uppercase;
                    }

                    .plp-mobile-summary-description-toggle-open {
                        display: none;
                    }

                    .plp-mobile-summary-description[open] .plp-mobile-summary-description-preview {
                        display: none;
                    }

                    .plp-mobile-summary-description[open] .plp-mobile-summary-description-toggle-closed {
                        display: none;
                    }

                    .plp-mobile-summary-description[open] .plp-mobile-summary-description-toggle-open {
                        display: inline;
                    }

                    .plp-mobile-summary-description-full {
                        display: grid;
                        gap: 10px;
                        margin-top: 10px;
                        padding-top: 10px;
                        border-top: 1px solid rgba(25,32,43,0.08);
                    }

                    .plp-mobile-summary-description-full p {
                        margin: 0;
                        color: #536179 !important;
                        font-size: 0.83rem !important;
                        font-weight: 430 !important;
                        line-height: 1.46 !important;
                        text-align: left !important;
                    }

                    .plp-mobile-summary-highlights {
                        display: grid;
                        grid-template-columns: repeat(4, minmax(0, 1fr));
                        margin: 15px 16px 16px;
                        overflow: hidden;
                        border: 1px solid rgba(184,148,95,0.13);
                        border-radius: 14px;
                        background: rgba(255,255,255,0.88);
                        box-shadow: 0 10px 22px rgba(24,31,42,0.06);
                    }

                    .plp-mobile-summary-highlights span {
                        display: grid;
                        gap: 6px;
                        justify-items: center;
                        align-content: start;
                        min-width: 0;
                        padding: 12px 7px 11px;
                        color: #122033;
                        text-align: center;
                    }

                    .plp-mobile-summary-highlights span + span {
                        border-left: 1px solid rgba(25,32,43,0.08);
                    }

                    .plp-mobile-summary-highlights svg {
                        color: var(--plp-gold-dark);
                        stroke-width: 1.75;
                    }

                    .plp-mobile-summary-highlights strong {
                        color: #122033;
                        font-size: 0.66rem;
                        font-weight: 500;
                        line-height: 1.15;
                    }

                    @media (max-width: 380px) {
                        .plp-mobile-summary-head {
                            grid-template-columns: 1fr;
                            gap: 10px;
                        }

                        .plp-mobile-summary-price-block {
                            display: flex;
                            align-items: baseline;
                            justify-content: space-between;
                            padding-left: 0;
                            border-left: 0;
                        }

                        .plp-mobile-sheet-summary .plp-mobile-sheet-facts,
                        .plp-mobile-summary-highlights {
                            grid-template-columns: repeat(2, minmax(0, 1fr));
                        }

                        .plp-mobile-summary-highlights span:nth-child(odd) {
                            border-left: 0;
                        }

                        .plp-mobile-summary-highlights span:nth-child(n + 3) {
                            border-top: 1px solid rgba(25,32,43,0.08);
                        }
                    }

                    .plp-mobile-card-head--split {
                        display: flex;
                        align-items: end;
                        justify-content: space-between;
                        gap: 12px;
                    }

                    .plp-mobile-card-head--split > div {
                        display: grid;
                        gap: 5px;
                        min-width: 0;
                    }

                    .plp-mobile-card-head--split > a {
                        display: inline-flex;
                        align-items: center;
                        gap: 5px;
                        flex: 0 0 auto;
                        color: var(--plp-gold-dark);
                        font-size: 0.73rem;
                        font-weight: 780;
                        letter-spacing: 0.04em;
                        line-height: 1;
                        text-decoration: none;
                        text-transform: uppercase;
                    }

                    .plp-mobile-card-head--split > a svg {
                        width: 14px;
                        height: 14px;
                        stroke-width: 2.2;
                    }

                    .plp-mobile-card-head--single-title {
                        margin-bottom: 13px;
                    }

                    .plp-mobile-card-head--single-title h2 {
                        color: #122033;
                        font-size: 1.08rem;
                        font-weight: 560;
                    }

                    .plp-mobile-card--technical {
                        margin-top: 12px;
                        padding: 17px 15px 16px;
                        border-color: rgba(24,31,42,0.08);
                        background: linear-gradient(180deg, #ffffff 0%, #fffdfa 100%);
                    }

                    .plp-mobile-card--technical .plp-mobile-card-head {
                        margin-bottom: 13px;
                        padding-bottom: 12px;
                        border-bottom: 1px solid rgba(25,32,43,0.08);
                    }

                    .plp-mobile-card--technical .plp-mobile-card-head h2 {
                        color: #122033;
                        font-size: 1.08rem;
                        font-weight: 560;
                    }

                    .plp-mobile-classic-lists {
                        gap: 15px;
                    }

                    .plp-mobile-card--technical .plp-info-list {
                        gap: 8px;
                    }

                    .plp-mobile-card--technical .plp-info-list + .plp-info-list {
                        padding-top: 12px;
                        border-top: 1px solid rgba(25,32,43,0.07);
                    }

                    .plp-mobile-card--technical .plp-info-list h3 {
                        padding-bottom: 0;
                        border-bottom: 0;
                        color: #122033;
                        font-size: 0.78rem;
                        font-weight: 650;
                    }

                    .plp-mobile-card--technical .plp-info-list > div {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 6px 14px;
                    }

                    .plp-mobile-card--technical .plp-info-list ul {
                        gap: 7px;
                    }

                    .plp-mobile-card--technical .plp-info-list li {
                        padding-left: 11px;
                        color: #4d5968;
                        font-size: 0.75rem;
                        font-weight: 440;
                        line-height: 1.32;
                    }

                    .plp-mobile-card--technical .plp-info-list li::before {
                        content: '';
                        top: 0.52em;
                        width: 4px;
                        height: 4px;
                        border-radius: 999px;
                        background: var(--plp-gold-dark);
                    }

                    .plp-mobile-card--nearby {
                        margin-top: 12px;
                    }

                    .plp-mobile-card--nearby .plp-nearby-benefits--mobile {
                        padding: 15px;
                        border: 1px solid rgba(24,31,42,0.08);
                        border-radius: 22px;
                        background: linear-gradient(180deg, #ffffff 0%, #fffdfa 100%);
                        box-shadow:
                            0 16px 34px rgba(24,31,42,0.1),
                            0 1px 0 rgba(255,255,255,0.95) inset;
                    }

                    .plp-mobile-card--nearby .plp-nearby-benefits-head {
                        gap: 4px;
                        margin-bottom: 12px;
                    }

                    .plp-mobile-card--nearby .plp-nearby-benefits-head h3 {
                        color: #122033;
                        font-size: 1.08rem;
                        font-weight: 560;
                    }

                    .plp-mobile-card--nearby .plp-nearby-summary-row {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(46px, 1fr));
                        gap: 0;
                        margin: 0 0 12px;
                        padding: 0;
                        border: 1px solid rgba(25,32,43,0.08);
                        border-radius: 15px;
                        background: rgba(255,255,255,0.82);
                        overflow: hidden;
                    }

                    .plp-mobile-card--nearby .plp-nearby-summary-item {
                        display: grid;
                        grid-template-columns: 1fr;
                        justify-items: center;
                        gap: 5px;
                        min-width: 0;
                        padding: 9px 5px 8px;
                        border: 0;
                        background: transparent;
                    }

                    .plp-mobile-card--nearby .plp-nearby-summary-item + .plp-nearby-summary-item {
                        border-left: 1px solid rgba(25,32,43,0.07);
                    }

                    .plp-mobile-card--nearby .plp-nearby-summary-item > span {
                        display: inline-flex;
                        width: auto;
                        height: auto;
                        color: var(--plp-gold-dark);
                    }

                    .plp-mobile-card--nearby .plp-nearby-summary-item div {
                        display: grid;
                        justify-items: center;
                        gap: 2px;
                        min-width: 0;
                    }

                    .plp-mobile-card--nearby .plp-nearby-summary-item strong,
                    .plp-mobile-card--nearby .plp-nearby-summary-item small {
                        max-width: 100%;
                        text-align: center;
                        overflow: hidden;
                        text-overflow: clip;
                    }

                    .plp-mobile-card--nearby .plp-nearby-summary-item strong {
                        color: #122033;
                        font-size: 0.59rem;
                        font-weight: 520;
                        line-height: 1.06;
                        white-space: normal;
                    }

                    .plp-mobile-card--nearby .plp-nearby-summary-item small {
                        color: #59677a;
                        font-size: 0.54rem;
                        font-weight: 420;
                        white-space: nowrap;
                    }

                    .plp-mobile-card--nearby .plp-nearby-map-shell,
                    .plp-mobile-card--nearby .plp-nearby-map-shell .leaflet-container {
                        min-height: 178px;
                    }

                    .plp-mobile-card--nearby .plp-nearby-map-shell {
                        border-radius: 16px;
                        box-shadow: 0 12px 24px rgba(24,31,42,0.1);
                    }

                    .plp-mobile-market-section {
                        margin-top: 12px;
                        padding: 15px;
                        border-color: rgba(24,31,42,0.08);
                        background: linear-gradient(180deg, #ffffff 0%, #fffdfa 100%);
                    }

                    .plp-mobile-market-section .plp-mobile-card-head {
                        margin-bottom: 12px;
                    }

                    .plp-mobile-market-section .plp-mobile-card-head h2 {
                        color: #122033;
                        font-size: 1.08rem;
                        font-weight: 560;
                    }

                    .plp-mobile-market-grid {
                        gap: 9px;
                    }

                    .plp-mobile-market-grid > div {
                        min-height: 68px;
                        padding: 10px 11px;
                        border: 1px solid rgba(184,148,95,0.14);
                        background: rgba(255,250,240,0.74);
                    }

                    .plp-mobile-market-grid strong {
                        color: #122033;
                        font-size: 0.87rem;
                        font-weight: 560;
                    }

                    .plp-mobile-market-chart {
                        margin-top: 10px;
                        padding: 10px 10px 8px;
                    }

                    .plp-mobile-market-chart svg {
                        height: 56px;
                    }

                    .plp-mobile-market-positioning {
                        margin-top: 9px;
                        padding: 10px 11px;
                        background: #fff8ec;
                    }

                    .plp-mobile-market-reading span {
                        display: -webkit-box;
                        -webkit-box-orient: vertical;
                        -webkit-line-clamp: 4;
                        overflow: hidden;
                    }

                    .plp-mobile-timeline {
                        display: flex;
                        gap: 8px;
                        margin: 12px -15px 0;
                        padding: 0 15px 3px;
                        overflow-x: auto;
                        overscroll-behavior-x: contain;
                        scrollbar-width: none;
                    }

                    .plp-mobile-timeline::-webkit-scrollbar {
                        display: none;
                    }

                    .plp-mobile-timeline-item {
                        flex: 0 0 76%;
                        grid-template-columns: minmax(0, 1fr);
                        min-height: 0;
                        padding: 10px 11px;
                        scroll-snap-align: start;
                    }

                    .plp-mobile-timeline-item b {
                        grid-column: auto;
                    }

                    .plp-mobile-related-section {
                        margin-top: 12px;
                        padding: 15px 14px 16px;
                        border-color: rgba(24,31,42,0.08);
                        background: linear-gradient(180deg, #ffffff 0%, #fffdfa 100%);
                    }

                    .plp-mobile-related-section .plp-mobile-card-head {
                        margin-bottom: 12px;
                    }

                    .plp-mobile-related-section .plp-mobile-card-head h2 {
                        color: #122033;
                        font-size: 1.08rem;
                        font-weight: 560;
                    }

                    .plp-mobile-related-rail {
                        grid-auto-columns: minmax(230px, 78%);
                        gap: 10px;
                        margin: 0 -14px;
                        padding: 0 14px 3px;
                    }

                    .plp-mobile-related-card {
                        display: block;
                        min-height: 136px;
                        border-radius: 15px;
                        border: 0;
                        background: #152033;
                        box-shadow: 0 14px 28px rgba(24,31,42,0.16);
                    }

                    .plp-mobile-related-card::after {
                        content: '';
                        position: absolute;
                        inset: 38% 0 0;
                        z-index: 1;
                        background: linear-gradient(180deg, rgba(7,14,24,0) 0%, rgba(7,14,24,0.88) 100%);
                        pointer-events: none;
                    }

                    .plp-mobile-related-card img {
                        height: 136px;
                    }

                    .plp-mobile-related-card > span {
                        z-index: 2;
                        padding: 5px 8px;
                        color: #fff;
                        font-size: 0.58rem;
                        font-weight: 720;
                        letter-spacing: 0.02em;
                    }

                    .plp-mobile-related-card div {
                        position: absolute;
                        inset: auto 0 0;
                        z-index: 2;
                        gap: 3px;
                        padding: 40px 11px 10px;
                        background: transparent;
                    }

                    .plp-mobile-related-card strong,
                    .plp-mobile-related-card small,
                    .plp-mobile-related-card p {
                        color: #fff;
                    }

                    .plp-mobile-related-card strong {
                        font-size: 0.9rem;
                        font-weight: 620;
                    }

                    .plp-mobile-related-card small,
                    .plp-mobile-related-card p {
                        font-size: 0.66rem;
                        font-weight: 430;
                        opacity: 0.88;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }

                    .plp-mobile-broker-card {
                        display: grid;
                        gap: 12px;
                        margin-top: 12px;
                        padding: 14px;
                        border-color: rgba(24,31,42,0.08);
                        background: linear-gradient(180deg, #ffffff 0%, #fffdfa 100%);
                    }

                    .plp-mobile-broker-head {
                        gap: 12px;
                    }

                    .plp-mobile-broker-head img {
                        width: 58px;
                        height: 58px;
                    }

                    .plp-mobile-broker-head h2 {
                        color: #122033;
                        font-size: 1rem;
                        font-weight: 560;
                    }

                    .plp-mobile-broker-cta,
                    .plp-mobile-broker-properties-link {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        min-height: 42px;
                        border-radius: 999px;
                        text-decoration: none;
                    }

                    .plp-mobile-broker-cta {
                        border: 1.5px solid var(--plp-gold-dark);
                        background: #fff;
                        color: var(--plp-gold-dark);
                        font-size: 0.82rem;
                        font-weight: 650;
                    }

                    .plp-mobile-broker-properties-link {
                        width: auto;
                        min-height: 0;
                        margin-top: -2px;
                        padding: 0;
                        border: 0;
                        background: transparent;
                        color: #536179;
                        box-shadow: none;
                        font-size: 0.72rem;
                        font-weight: 560;
                    }

                    .plp-mobile-transparency-card {
                        margin-top: 12px;
                        padding: 12px 13px;
                        border-color: rgba(184,148,95,0.16);
                        background: linear-gradient(180deg, rgba(255,252,246,0.96), rgba(251,245,235,0.88));
                    }

                    .plp-mobile-transparency-card .plp-mobile-card-head h2 {
                        color: #122033;
                        font-size: 0.82rem;
                        font-weight: 620;
                    }

                    .plp-mobile-sheet-primary {
                        border: 2px solid var(--plp-gold-dark);
                        background: linear-gradient(135deg, #dfc18e, #b8945f);
                        color: #111;
                    }

                    .plp-copy-section {
                        padding-top: 22px;
                    }

                    .pmds-scroll .plp-spec-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }

                    .pmds-scroll .plp-market-grid {
                        padding: 15px;
                    }

                    .pmds-scroll .plp-market-card {
                        padding: 0;
                    }

                    .pmds-scroll .plp-price-history-item {
                        grid-template-columns: 1fr;
                    }

                    .pmds-scroll .plp-price-history-item b {
                        text-align: left;
                    }

                    .plp-section,
                    .plp-market-card,
                    .plp-lead-card,
                    .plp-broker-card,
                    .plp-related-band {
                        border-radius: 18px;
                    }
                }

                .property-feed-map-marker {
                    background: none !important;
                    border: 0 !important;
                }

                .property-feed-map-marker-wrap {
                    align-items: center !important;
                    cursor: pointer !important;
                    display: flex !important;
                    filter: drop-shadow(0 8px 10px rgba(15, 57, 96, .34)) !important;
                    gap: 0 !important;
                    transform-origin: center bottom !important;
                }

                .property-feed-map-pin {
                    align-items: center !important;
                    background: linear-gradient(145deg, #4fb4ef 0%, #2287c8 54%, #166da7 100%) !important;
                    border: 2px solid #fff !important;
                    border-radius: 50% 50% 50% 0 !important;
                    box-shadow:
                        inset 0 1px 2px rgba(255,255,255,.42),
                        0 5px 12px rgba(19,102,170,.28) !important;
                    display: inline-flex !important;
                    height: 30px !important;
                    justify-content: center !important;
                    position: relative !important;
                    transform: rotate(-45deg) !important;
                    width: 30px !important;
                }

                .property-feed-map-pin::before {
                    background: rgba(34,135,200,.16) !important;
                    border-radius: 999px !important;
                    content: '' !important;
                    inset: -7px !important;
                    position: absolute !important;
                    z-index: -1 !important;
                }

                .property-feed-map-pin span {
                    background: #fff !important;
                    border-radius: 999px !important;
                    height: 10px !important;
                    position: relative !important;
                    transform: rotate(45deg) !important;
                    width: 10px !important;
                }

                .property-feed-map-pin span::before,
                .property-feed-map-pin span::after,
                .property-feed-map-marker-wrap strong,
                .property-feed-map-marker-wrap.is-exclusive strong::after {
                    content: none !important;
                    display: none !important;
                }
            ` }} />
        </>
    )
}
