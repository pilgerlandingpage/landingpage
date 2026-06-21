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
                .plp-desktop-media-map {
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

                .plp-desktop-media-map .plp-location-explorer,
                .plp-desktop-media-map .property-feed-map-shell,
                .plp-desktop-media-map .property-feed-map-canvas,
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
                    display: grid;
                    gap: 14px;
                    grid-template-columns: minmax(0, 1.16fr) minmax(280px, .84fr);
                }

                .plp-market-card {
                    border: 1px solid rgba(35, 31, 26, .1);
                    border-radius: var(--plp-radius);
                    background: linear-gradient(180deg, #ffffff 0%, #f8f6f1 100%);
                    box-shadow: 0 14px 34px rgba(32, 27, 18, .08);
                    min-width: 0;
                    padding: 18px;
                }

                .plp-market-main {
                    background:
                        linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,246,241,.96)),
                        radial-gradient(circle at 12% 18%, rgba(184,148,95,.18), transparent 30%);
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
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    margin-bottom: 16px;
                }

                .plp-market-metrics div {
                    border: 1px solid rgba(35, 31, 26, .07);
                    border-radius: var(--plp-radius);
                    background: rgba(255,255,255,.7);
                    min-width: 0;
                    padding: 12px;
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
                    padding: 14px 14px 10px;
                }

                .plp-market-chart svg {
                    display: block;
                    height: 92px;
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
                    grid-template-columns: 18px minmax(0, 1fr);
                    line-height: 1.35;
                    margin: 12px 0 0;
                }

                .plp-market-note svg {
                    color: #4f7a62;
                    margin-top: 1px;
                }

                .plp-market-cta {
                    width: max-content;
                    max-width: 100%;
                    margin-top: 13px;
                    padding: 0 14px;
                    border: 1px solid rgba(35, 31, 26, .12);
                    background: #151515;
                    color: #fff;
                    box-shadow: 0 12px 24px rgba(20, 18, 15, .16);
                }

                .plp-market-cta svg {
                    color: #dfc18e;
                    flex: 0 0 auto;
                }

                .plp-price-history-list {
                    display: grid;
                    gap: 0;
                }

                .plp-price-history-item {
                    align-items: start;
                    border-bottom: 1px solid rgba(35, 31, 26, .08);
                    display: grid;
                    gap: 10px;
                    grid-template-columns: 86px minmax(0, 1fr) auto;
                    padding: 12px 0;
                }

                .plp-price-history-item:first-child {
                    padding-top: 0;
                }

                .plp-price-history-item:last-child {
                    border-bottom: 0;
                    padding-bottom: 0;
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

                .plp-loc-price > span {
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
                .plp-market-cta,
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
                .plp-market-cta:hover,
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
                    filter: saturate(.86) contrast(1.06) sepia(.08) hue-rotate(352deg);
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

                    .plp-market-card {
                        padding: 15px;
                    }

                    .plp-market-cta {
                        width: 100%;
                    }

                    .plp-market-card-head {
                        align-items: flex-start;
                        flex-direction: column;
                        gap: 6px;
                    }

                    .plp-price-history-item {
                        gap: 7px;
                        grid-template-columns: 1fr;
                    }

                    .plp-price-history-item b {
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
                        background: #101113;
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
                        background: #101113;
                    }

                    .pmds-media {
                        position: absolute;
                        inset: 0;
                        z-index: 1;
                        width: 100vw;
                        max-width: none;
                        overflow-x: hidden;
                        overflow-y: auto;
                        padding-bottom: 40vh;
                        background: #101113;
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
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 34px;
                        padding: 9px 0 7px;
                        cursor: grab;
                        touch-action: none;
                        user-select: none;
                        -webkit-user-select: none;
                    }

                    .pmds-handle:active {
                        cursor: grabbing;
                    }

                    .pmds-handle span {
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
                        margin-bottom: 13px;
                    }

                    .plp-mobile-card-head h2 {
                        margin: 0;
                        color: #171a1d;
                        font-family: 'Playfair Display', Georgia, serif;
                        font-size: 1.23rem;
                        line-height: 1.16;
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

                    .plp-mobile-text-link {
                        display: inline-flex;
                        width: fit-content;
                        margin-top: 13px;
                        color: var(--plp-gold-dark);
                        font-size: 0.88rem;
                        font-weight: 720;
                        text-decoration: underline;
                        text-underline-offset: 4px;
                    }

                    .plp-mobile-description-details {
                        display: grid;
                        gap: 12px;
                        margin-top: 13px;
                    }

                    .plp-mobile-description-details summary {
                        display: inline-flex;
                        width: fit-content;
                        cursor: pointer;
                        list-style: none;
                        color: var(--plp-gold-dark);
                        font-size: 0.88rem;
                        font-weight: 720;
                        text-decoration: underline;
                        text-underline-offset: 4px;
                    }

                    .plp-mobile-description-details summary::-webkit-details-marker {
                        display: none;
                    }

                    .plp-mobile-description-details summary::after {
                        content: '+';
                        margin-left: 7px;
                        text-decoration: none;
                    }

                    .plp-mobile-description-details[open] summary::after {
                        content: '-';
                    }

                    .plp-mobile-description-full {
                        display: grid;
                        gap: 10px;
                    }

                    .plp-mobile-description-full p {
                        color: #343a40;
                        font-size: 0.92rem;
                        line-height: 1.54;
                        font-weight: 420;
                    }

                    .plp-mobile-facts-grid {
                        display: grid;
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 10px;
                    }

                    .plp-mobile-fact-tile {
                        display: flex;
                        gap: 10px;
                        min-width: 0;
                        min-height: 86px;
                        padding: 13px;
                        border: 1px solid rgba(184,148,95,0.16);
                        border-radius: 16px;
                        background: linear-gradient(180deg, #fff, #faf7ef);
                    }

                    .plp-mobile-fact-tile > span {
                        flex: 0 0 auto;
                        color: var(--plp-gold-dark);
                    }

                    .plp-mobile-fact-tile div {
                        min-width: 0;
                        display: grid;
                        gap: 4px;
                        align-content: start;
                    }

                    .plp-mobile-fact-tile small,
                    .plp-mobile-market-grid small,
                    .plp-mobile-timeline-item small {
                        color: #6f756f;
                        font-size: 0.68rem;
                        font-weight: 650;
                        line-height: 1.25;
                    }

                    .plp-mobile-fact-tile strong {
                        color: #171a1d;
                        font-size: 0.9rem;
                        font-weight: 720;
                        line-height: 1.2;
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

                    .plp-mobile-broker-head {
                        display: flex;
                        align-items: center;
                        gap: 13px;
                        margin-bottom: 13px;
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
                        font-size: 1.1rem;
                        line-height: 1.1;
                        font-weight: 700;
                    }

                    .plp-mobile-broker-head p {
                        color: #697069;
                        font-size: 0.78rem;
                        font-weight: 500;
                    }

                    .plp-mobile-broker-card .plp-mobile-sheet-actions {
                        grid-template-columns: 1fr;
                        margin-top: 14px;
                    }

                    .plp-mobile-broker-card .plp-mobile-sheet-primary {
                        gap: 8px;
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
                        margin-bottom: 18px;
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
                        height: min(62vh, 520px);
                        min-height: 360px;
                        object-fit: cover;
                        object-position: center;
                    }

                    .plp-mobile-media-item:first-of-type img {
                        height: min(58vh, 500px);
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
                        grid-template-columns: minmax(0, 1fr) minmax(118px, 136px);
                        align-items: center;
                        gap: 8px 10px;
                        padding: 2px 0 4px;
                    }

                    .plp-mobile-price-badge,
                    .plp-mobile-sheet-price,
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

                    .plp-mobile-sheet-price {
                        display: block;
                        max-width: 100%;
                        color: #171a1d;
                        font-size: clamp(1.44rem, 6.2vw, 1.86rem);
                        font-weight: 820;
                        line-height: 1.04;
                        letter-spacing: 0;
                        overflow-wrap: anywhere;
                    }

                    .plp-mobile-sheet-facts {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 7px 13px;
                        color: #2f3439;
                        font-size: 0.74rem;
                        font-weight: 660;
                    }

                    .plp-mobile-sheet-facts span {
                        display: inline-flex;
                        align-items: center;
                        gap: 5px;
                        white-space: nowrap;
                    }

                    .plp-mobile-sheet-facts svg {
                        width: 15px;
                        height: 15px;
                    }

                    .plp-mobile-sheet-summary p {
                        grid-column: 1;
                        min-width: 0;
                        margin: 0;
                        color: #343a40;
                        font-size: 0.8rem;
                        font-weight: 500;
                        line-height: 1.35;
                        overflow: hidden;
                        display: -webkit-box;
                        -webkit-box-orient: vertical;
                        -webkit-line-clamp: 2;
                    }

                    .plp-mobile-sheet-summary .plp-mobile-sheet-actions {
                        grid-column: 2;
                        width: 100%;
                        align-self: center;
                        justify-self: end;
                    }

                    .plp-mobile-sheet-actions {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 10px;
                    }

                    .plp-mobile-sheet-actions--single {
                        grid-template-columns: minmax(0, 136px);
                        justify-content: end;
                    }

                    .plp-mobile-sheet-outline,
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

                    .plp-mobile-sheet-outline {
                        border: 2px solid var(--plp-gold-dark);
                        background: #fff;
                        color: var(--plp-gold-dark);
                    }

                    @media (max-width: 360px) {
                        .plp-mobile-sheet-summary {
                            grid-template-columns: minmax(0, 1fr) minmax(104px, 118px);
                            gap: 7px 8px;
                        }

                        .plp-mobile-sheet-actions--single {
                            grid-template-columns: minmax(0, 118px);
                        }

                        .plp-mobile-sheet-outline {
                            min-height: 34px;
                            padding: 0 8px;
                            font-size: 0.68rem;
                        }
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

                    .pmds-scroll .plp-market-card {
                        padding: 15px;
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
            ` }} />
        </>
    )
}
