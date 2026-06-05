export default function PropertyFeedStyles() {
    return (
        <style>{`
            .property-feed-page {
                --pf-ink: #111111;
                --pf-muted: #73737d;
                --pf-line: #e8e5df;
                --pf-soft: #f7f4ef;
                --pf-gold: #bf9552;
                background: #ece8df;
                color: var(--pf-ink);
                font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                height: 100dvh;
                overflow-x: hidden;
                overflow-y: auto;
                scroll-behavior: smooth;
                scroll-snap-type: y mandatory;
                scrollbar-width: none;
                max-width: 100vw;
            }

            .property-feed-page::-webkit-scrollbar {
                display: none;
            }

            .property-feed-slide {
                align-items: stretch;
                display: flex;
                justify-content: center;
                min-height: 100dvh;
                overflow: hidden;
                scroll-snap-align: start;
                scroll-snap-stop: always;
                width: 100vw;
            }

            .property-feed-card {
                background: #fff;
                box-shadow: 0 24px 80px rgba(18, 16, 12, .16);
                display: grid;
                grid-template-rows: auto auto auto auto auto auto minmax(0, 1fr);
                height: 100dvh;
                max-width: 760px;
                min-height: 100dvh;
                overflow: hidden;
                position: relative;
                width: 100%;
            }

            .property-feed-card,
            .property-feed-card * {
                min-width: 0;
            }

            .property-feed-header {
                align-items: center;
                background: rgba(255, 255, 255, .96);
                border-bottom: 1px solid var(--pf-line);
                display: grid;
                gap: 8px;
                grid-template-columns: 34px minmax(0, 1fr) auto;
                min-height: 56px;
                padding: 7px 12px;
                z-index: 5;
            }

            .property-feed-header strong {
                display: block;
                font-size: clamp(1rem, 3.8vw, 1.22rem);
                font-weight: 850;
                line-height: 1.1;
                overflow: hidden;
                text-align: center;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .property-top-actions {
                align-items: center;
                display: flex;
                gap: 4px;
                justify-content: flex-end;
                min-width: 0;
            }

            .property-icon-button {
                align-items: center;
                background: transparent;
                border: 0;
                border-radius: 999px;
                color: #141414;
                cursor: pointer;
                display: inline-flex;
                height: 32px;
                justify-content: center;
                text-decoration: none;
                width: 32px;
            }

            .property-icon-button:hover {
                background: #f3f1ed;
            }

            .property-icon-button.is-active {
                background: #f3f1ed;
            }

            .property-more-menu-wrap {
                display: inline-flex;
                position: relative;
            }

            .property-more-menu {
                background: rgba(255, 255, 255, .98);
                border: 1px solid rgba(17, 17, 17, .08);
                border-radius: 14px;
                box-shadow: 0 18px 46px rgba(18, 16, 12, .2);
                display: grid;
                gap: 2px;
                min-width: 214px;
                padding: 7px;
                position: absolute;
                right: 0;
                top: 38px;
                z-index: 60;
            }

            .property-more-menu::before {
                background: #fff;
                border-left: 1px solid rgba(17, 17, 17, .08);
                border-top: 1px solid rgba(17, 17, 17, .08);
                content: '';
                height: 10px;
                position: absolute;
                right: 12px;
                top: -6px;
                transform: rotate(45deg);
                width: 10px;
            }

            .property-more-menu button,
            .property-more-menu a {
                align-items: center;
                background: transparent;
                border: 0;
                border-radius: 10px;
                color: #151515;
                cursor: pointer;
                display: grid;
                font: inherit;
                gap: 9px;
                grid-template-columns: 24px minmax(0, 1fr);
                min-height: 44px;
                padding: 7px 9px;
                text-align: left;
                text-decoration: none;
                width: 100%;
            }

            .property-more-menu button:hover,
            .property-more-menu a:hover {
                background: #f5f2ec;
            }

            .property-more-menu button:disabled {
                cursor: default;
                opacity: .45;
            }

            .property-more-menu button:disabled:hover {
                background: transparent;
            }

            .property-more-menu svg {
                color: #bf9552;
                justify-self: center;
                stroke-width: 2.15;
            }

            .property-more-menu span {
                display: grid;
                gap: 2px;
                min-width: 0;
            }

            .property-more-menu b {
                color: #171410;
                font-size: .74rem;
                font-weight: 900;
                line-height: 1.1;
                white-space: nowrap;
            }

            .property-more-menu small {
                color: #81786e;
                font-size: .62rem;
                font-weight: 700;
                line-height: 1.05;
                white-space: nowrap;
            }

            .property-heart-count {
                gap: 3px;
                min-width: 38px;
                padding: 0 4px;
                width: auto;
            }

            .property-heart-count span {
                font-size: .72rem;
                font-weight: 850;
                line-height: 1;
            }

            .property-icon-button.is-saved {
                color: #d92e4c;
            }

            .property-dislike-button.is-disliked {
                background: #f5eee8;
                color: #9a6a3a;
            }

            .property-save-button {
                background: #e60023;
                border: 0;
                border-radius: 13px;
                color: #fff;
                cursor: pointer;
                font-size: .78rem;
                font-weight: 900;
                height: 38px;
                letter-spacing: 0;
                padding: 0 14px;
                white-space: nowrap;
            }

            .property-save-button.is-saved {
                background: #151515;
            }

            .property-feed-profile {
                align-items: center;
                display: grid;
                gap: 15px;
                grid-template-columns: clamp(84px, 24vw, 104px) minmax(0, 1fr);
                padding: 13px 17px 7px;
            }

            .property-profile-photo {
                aspect-ratio: 1;
                background: #fff;
                border: 0;
                border-radius: 999px;
                box-shadow: 0 0 0 3px #fff, 0 10px 24px rgba(230, 0, 35, .15);
                box-sizing: border-box;
                cursor: default;
                display: block;
                isolation: isolate;
                overflow: visible;
                padding: 4px;
                position: relative;
                width: 100%;
            }

            .property-profile-photo::before {
                animation: propertyStoryRingSpin 1.35s cubic-bezier(.2,.85,.25,1) both;
                background: conic-gradient(from 0deg, #e60023 0deg, #ff2d55 72deg, #f4b64a 128deg, #e60023 220deg, #e60023 360deg);
                border-radius: inherit;
                content: '';
                inset: 0;
                position: absolute;
                z-index: 0;
            }

            .property-profile-photo img {
                border: 2px solid #fff;
                border-radius: inherit;
                display: block;
                height: 100%;
                object-fit: cover;
                position: relative;
                width: 100%;
                z-index: 1;
            }

            .property-profile-copy {
                min-width: 0;
            }

            .property-profile-copy h1 {
                display: -webkit-box;
                font-size: clamp(1.02rem, 4.9vw, 1.36rem);
                font-weight: 850;
                letter-spacing: 0;
                line-height: 1.04;
                margin: 0;
                overflow: hidden;
                overflow-wrap: anywhere;
                -webkit-box-orient: vertical;
                -webkit-line-clamp: 2;
            }

            .property-profile-copy p {
                color: var(--pf-muted);
                display: block;
                font-size: clamp(.76rem, 2.8vw, .9rem);
                line-height: 1.22;
                margin: 5px 0 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .property-broker-chip {
                align-items: center;
                background: #f6f1e8;
                border: 1px solid #e5dccf;
                border-radius: 999px;
                color: #2a241d;
                display: inline-flex;
                font-size: .74rem;
                font-weight: 800;
                gap: 7px;
                line-height: 1;
                margin-top: 8px;
                max-width: 100%;
                min-height: 28px;
                padding: 4px 10px 4px 5px;
                vertical-align: top;
            }

            .property-broker-chip img {
                border-radius: 999px;
                height: 20px;
                object-fit: cover;
                width: 20px;
            }

            .property-broker-chip span {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .property-profile-stats {
                display: grid;
                grid-template-columns: .7fr 1.65fr .8fr;
                margin-top: 11px;
            }

            .property-profile-stats span {
                border-left: 1px solid #dedbd5;
                color: var(--pf-muted);
                display: block;
                font-size: clamp(.62rem, 2.4vw, .78rem);
                line-height: 1.15;
                min-width: 0;
                padding: 0 7px;
                text-align: center;
            }

            .property-profile-stats span:first-child {
                border-left: 0;
                padding-left: 0;
            }

            .property-profile-stats span:last-child {
                padding-right: 0;
            }

            .property-profile-stats b {
                color: #111;
                display: block;
                font-size: clamp(.74rem, 2.7vw, .88rem);
                font-weight: 850;
                line-height: 1;
                margin-bottom: 4px;
                overflow: visible;
                text-overflow: clip;
                white-space: nowrap;
            }

            .property-feed-bio {
                display: grid;
                gap: 5px;
                padding: 6px 17px 8px;
            }

            .property-bio-kicker,
            .property-bio-summary,
            .property-bio-lines p {
                margin: 0;
            }

            .property-bio-kicker {
                color: #1f1f23;
                display: block;
                font-size: .78rem;
                font-weight: 850;
                line-height: 1.18;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .property-bio-summary {
                color: #24242a;
                display: -webkit-box;
                font-size: .79rem;
                line-height: 1.26;
                overflow: hidden;
                -webkit-box-orient: vertical;
                -webkit-line-clamp: 2;
            }

            .property-bio-lines {
                display: grid;
                gap: 5px;
            }

            .property-bio-lines p {
                align-items: flex-start;
                color: #29292e;
                display: grid;
                font-size: .74rem;
                gap: 7px;
                grid-template-columns: 20px minmax(0, 1fr);
                line-height: 1.18;
            }

            .property-bio-lines svg {
                margin-top: 1px;
                stroke-width: 2.05;
            }

            .property-feature-icon.feature-icon-0 {
                color: #258293;
            }

            .property-feature-icon.feature-icon-1 {
                color: #9a6a3a;
            }

            .property-feature-icon.feature-icon-2 {
                color: #b18442;
            }

            .property-feature-icon.feature-icon-3 {
                color: #4f7a62;
            }

            .property-feature-icon.feature-icon-4 {
                color: #bf9552;
            }

            .property-bio-lines span {
                display: -webkit-box;
                overflow: hidden;
                -webkit-box-orient: vertical;
                -webkit-line-clamp: 1;
            }

            .property-feed-actions {
                display: grid;
                gap: 5px;
                grid-template-columns: minmax(0, 1fr) minmax(0, 1.28fr) 33px;
                padding: 1px 17px 6px;
            }

            .property-action {
                align-items: center;
                background: #fff;
                border: 1px solid #dedbd5;
                border-radius: 9px;
                color: #151515;
                cursor: pointer;
                display: inline-flex;
                font-size: .71rem;
                font-weight: 850;
                gap: 4px;
                justify-content: center;
                min-height: 32px;
                min-width: 0;
                padding: 0 6px;
                text-decoration: none;
                white-space: nowrap;
            }

            .property-action svg {
                height: 16px;
                width: 16px;
            }

            .property-action.primary {
                background: #20c964;
                border-color: #20c964;
                box-shadow: 0 7px 14px rgba(32, 201, 100, .2);
                color: #fff;
            }

            .property-action.details {
                background: linear-gradient(135deg, #dfc18e, #b8945f);
                border-color: rgba(255,255,255,.28);
                box-shadow: 0 8px 16px rgba(184, 148, 95, .24);
                color: #101010;
            }

            .property-action.details svg {
                stroke-width: 2.25;
            }

            .property-action.square {
                display: inline-flex;
                padding: 0;
            }

            .property-action.square svg {
                height: 18px;
                width: 18px;
            }

            .property-feed-stories {
                display: grid;
                gap: 6px;
                padding: 6px 16px 9px;
            }

            .property-feed-stories-label {
                color: #151515;
                display: block;
                font-size: .72rem;
                font-weight: 900;
                letter-spacing: 0;
                line-height: 1;
                padding-left: 1px;
            }

            .property-feed-stories-pages {
                display: flex;
                gap: 12px;
                overflow-x: auto;
                scroll-snap-type: x mandatory;
                scrollbar-width: none;
                touch-action: pan-x;
                -webkit-overflow-scrolling: touch;
            }

            .property-feed-stories-pages::-webkit-scrollbar {
                display: none;
            }

            .property-feed-story-page {
                display: grid;
                flex: 0 0 100%;
                gap: 8px;
                grid-template-columns: repeat(5, minmax(0, 1fr));
                scroll-snap-align: start;
            }

            .property-feed-stories button {
                align-items: center;
                background: transparent;
                border: 0;
                color: #202025;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                font-size: .65rem;
                font-weight: 650;
                gap: 6px;
                min-width: 0;
                padding: 0;
                text-align: center;
            }

            .property-feed-stories span {
                align-items: center;
                aspect-ratio: 1;
                background: #f5f2ec;
                border: 2px solid #f7f7f7;
                border-radius: 999px;
                box-shadow: 0 0 0 2px #dfddd8;
                display: inline-flex;
                justify-content: center;
                overflow: hidden;
                width: min(100%, 56px);
            }

            .property-feed-stories img {
                display: block;
                height: 100%;
                object-fit: cover;
                width: 100%;
            }

            .property-feed-tabs {
                border-top: 1px solid var(--pf-line);
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                min-height: 47px;
            }

            .property-feed-tabs.has-map {
                grid-template-columns: repeat(4, minmax(0, 1fr));
            }

            .property-feed-tabs button {
                align-items: center;
                background: #fff;
                border: 0;
                border-bottom: 3px solid transparent;
                color: #77777f;
                cursor: pointer;
                display: inline-flex;
                font-size: .78rem;
                font-weight: 780;
                gap: 5px;
                justify-content: center;
                min-width: 0;
                padding: 0 8px;
            }

            .property-feed-tabs.has-map button {
                font-size: .72rem;
                gap: 4px;
                padding: 0 4px;
            }

            .property-feed-tabs button.active {
                border-bottom-color: #111;
                color: #111;
            }

            .property-feed-media {
                min-height: 0;
                overflow: hidden;
                position: relative;
            }

            .property-photo-carousel {
                display: flex;
                height: 100%;
                min-height: 0;
                overflow-x: auto;
                overflow-y: hidden;
                overscroll-behavior-x: contain;
                scroll-snap-type: x mandatory;
                scrollbar-width: none;
                touch-action: pan-x pan-y;
                -webkit-overflow-scrolling: touch;
                width: 100%;
            }

            .property-photo-carousel::-webkit-scrollbar {
                display: none;
            }

            .property-photo-mosaic {
                display: grid;
                flex: 0 0 100%;
                gap: 2px;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                grid-template-rows: repeat(3, minmax(0, 1fr));
                height: 100%;
                min-height: 0;
                scroll-snap-align: start;
                width: 100%;
            }

            .property-photo-mosaic button {
                background: #e9e4da;
                border: 0;
                cursor: zoom-in;
                min-height: 0;
                overflow: hidden;
                padding: 0;
                touch-action: pan-x pan-y;
            }

            .property-photo-mosaic img {
                display: block;
                height: 100%;
                object-fit: cover;
                width: 100%;
            }

            .property-feed-panel {
                align-items: center;
                background: linear-gradient(180deg, #fbfaf7 0%, #fff 100%);
                display: flex;
                flex-direction: column;
                height: 100%;
                justify-content: center;
                padding: 24px;
                text-align: center;
            }

            .property-feed-panel h2 {
                font-size: 1.35rem;
                line-height: 1.1;
                margin: 14px 0 7px;
            }

            .property-feed-panel p {
                color: var(--pf-muted);
                line-height: 1.45;
                margin: 0;
                max-width: 340px;
            }

            .property-feed-panel a {
                background: #151515;
                border-radius: 999px;
                color: #fff;
                font-weight: 850;
                margin-top: 17px;
                padding: 11px 16px;
                text-decoration: none;
            }

            .property-feed-map-shell {
                background: #111;
                height: 100%;
                min-height: 0;
                overflow: hidden;
                position: relative;
                width: 100%;
            }

            .property-feed-map-shell::after {
                box-shadow: inset 0 0 96px rgba(5, 8, 10, .2);
                content: '';
                inset: 0;
                mix-blend-mode: multiply;
                pointer-events: none;
                position: absolute;
                z-index: 401;
            }

            .property-feed-map-canvas {
                background: #111;
                height: 100% !important;
                width: 100% !important;
            }

            .property-feed-map-shell.map-style-luxury .leaflet-tile-pane {
                filter: saturate(.86) contrast(1.06) sepia(.08) hue-rotate(352deg);
            }

            .property-feed-map-shell.map-style-classic .leaflet-tile-pane {
                filter: saturate(.9) contrast(1.02);
            }

            .property-feed-map-shell.map-style-satellite .leaflet-tile-pane {
                filter: saturate(1.08) contrast(1.04) brightness(.94);
            }

            .property-feed-map-shell .leaflet-control-zoom {
                border: 0 !important;
                border-radius: 12px !important;
                box-shadow: 0 10px 28px rgba(0,0,0,.26) !important;
                overflow: hidden;
            }

            .property-feed-map-shell .leaflet-control-zoom a {
                background: rgba(20,20,20,.92) !important;
                border: 0 !important;
                border-bottom: 1px solid rgba(255,255,255,.08) !important;
                color: #e8dcc7 !important;
                font-size: 18px !important;
                height: 38px !important;
                line-height: 38px !important;
                width: 38px !important;
            }

            .property-feed-map-shell .leaflet-control-zoom a:hover {
                background: #c9a96e !important;
                color: #111 !important;
            }

            .property-feed-map-shell .leaflet-control-attribution {
                background: rgba(12,12,12,.58) !important;
                color: rgba(255,255,255,.48) !important;
                font-size: 9px !important;
            }

            .property-feed-map-shell .leaflet-control-attribution a {
                color: rgba(255,255,255,.66) !important;
            }

            .property-feed-map-style-control {
                display: flex;
                flex-direction: column;
                gap: 7px;
                position: absolute;
                right: 10px;
                top: 10px;
                z-index: 610;
            }

            .property-feed-map-style-control button {
                align-items: center;
                background: rgba(18, 18, 18, .76);
                border: 1px solid rgba(232, 220, 199, .14);
                border-radius: 10px;
                box-shadow: 0 10px 24px rgba(0,0,0,.18);
                color: #e8dcc7;
                cursor: pointer;
                display: inline-flex;
                font: 850 .64rem/1 Inter, sans-serif;
                gap: 5px;
                height: 32px;
                justify-content: flex-start;
                min-width: 0;
                padding: 0 9px;
                transition: background .18s ease, color .18s ease, transform .18s ease;
                white-space: nowrap;
            }

            .property-feed-map-style-control button:hover {
                transform: translateY(-1px);
            }

            .property-feed-map-style-control button.active {
                background: linear-gradient(135deg, #dfc18e, #b8945f);
                border-color: rgba(255,255,255,.28);
                color: #101010;
            }

            .property-feed-map-marker {
                background: none !important;
                border: 0 !important;
            }

            .property-feed-map-marker-wrap {
                align-items: center;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                filter: drop-shadow(0 12px 18px rgba(0,0,0,.48));
                gap: 3px;
                transform-origin: center bottom;
            }

            .property-feed-map-pin {
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

            .property-feed-map-pin::before {
                background: radial-gradient(circle, rgba(223,193,142,.32), transparent 64%);
                border-radius: 50%;
                content: '';
                inset: -8px;
                position: absolute;
                z-index: -1;
            }

            .property-feed-map-pin span {
                background: #15130f;
                border-radius: 2px;
                height: 9px;
                position: relative;
                transform: rotate(-45deg);
                width: 11px;
            }

            .property-feed-map-pin span::before {
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

            .property-feed-map-pin span::after {
                background: #d7ad42;
                border-radius: 1px 1px 0 0;
                bottom: 0;
                content: '';
                height: 5px;
                left: 4px;
                position: absolute;
                width: 3px;
            }

            .property-feed-map-marker-wrap strong {
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

            .property-feed-map-marker-wrap.is-exclusive strong::after {
                color: #fff3c7;
                content: 'EX';
                font-size: .56rem;
                margin-left: 5px;
            }

            .property-feed-map-popup .leaflet-popup-content-wrapper {
                background: #131313;
                border: 1px solid rgba(223,193,142,.22);
                border-radius: 16px;
                box-shadow: 0 18px 52px rgba(0,0,0,.5);
                overflow: hidden;
                padding: 0;
                width: 250px;
            }

            .property-feed-map-popup .leaflet-popup-content {
                margin: 0;
                width: 250px !important;
            }

            .property-feed-map-popup .leaflet-popup-tip {
                background: #131313;
                border: 1px solid rgba(223,193,142,.2);
            }

            .property-feed-map-popup-content {
                display: grid;
                gap: 7px;
                padding: 13px 14px;
            }

            .property-feed-map-popup-content strong {
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

            .property-feed-map-popup-content span {
                color: #aaa39a;
                font-size: .72rem;
                font-weight: 750;
            }

            .property-feed-map-popup-content b {
                color: #f0d08f;
                font-size: .95rem;
                font-weight: 950;
            }

            .property-feed-hint {
                align-items: center;
                background: rgba(255, 255, 255, .86);
                border: 1px solid rgba(0, 0, 0, .08);
                border-radius: 999px;
                bottom: 9px;
                color: #7b756d;
                display: inline-flex;
                font-size: .68rem;
                font-weight: 800;
                gap: 5px;
                left: 50%;
                opacity: .82;
                padding: 4px 9px;
                pointer-events: none;
                position: absolute;
                transform: translateX(-50%);
                white-space: nowrap;
                z-index: 4;
            }

            .property-feed-hint.can-swipe {
                animation: propertyFeedSwipeCue 2.6s ease-in-out infinite;
            }

            .property-feed-hint.can-swipe svg {
                animation: propertyFeedSwipeArrow 1.3s ease-in-out infinite;
            }

            .property-feed-hint.is-end {
                animation: none;
            }

            @keyframes propertyFeedSwipeCue {
                0%, 72%, 100% {
                    opacity: .78;
                    transform: translate(-50%, 0);
                }
                22% {
                    opacity: 1;
                    transform: translate(-50%, -15px);
                }
                42% {
                    opacity: .9;
                    transform: translate(-50%, 0);
                }
            }

            @keyframes propertyFeedSwipeArrow {
                0%, 100% {
                    transform: translateY(0);
                }
                45% {
                    transform: translateY(-4px);
                }
            }

            @keyframes propertyStoryRingSpin {
                0% {
                    filter: brightness(.95) saturate(.95);
                    transform: rotate(-135deg) scale(.96);
                }
                62% {
                    filter: brightness(1.06) saturate(1.12);
                    transform: rotate(250deg) scale(1.045);
                }
                100% {
                    filter: brightness(1) saturate(1);
                    transform: rotate(360deg) scale(1);
                }
            }

            .property-gallery-modal {
                align-items: center;
                background: rgba(4, 4, 4, .95);
                display: flex;
                inset: 0;
                justify-content: center;
                padding: 18px;
                position: fixed;
                touch-action: pan-y;
                user-select: none;
                z-index: 200;
            }

            .property-gallery-modal img {
                border-radius: 16px;
                max-height: min(86dvh, 900px);
                max-width: min(92vw, 1120px);
                object-fit: contain;
                -webkit-user-drag: none;
                user-select: none;
            }

            .property-gallery-close,
            .property-gallery-nav {
                align-items: center;
                background: rgba(255, 255, 255, .12);
                border: 1px solid rgba(255,255,255,.22);
                border-radius: 999px;
                color: #fff;
                cursor: pointer;
                display: inline-flex;
                height: 48px;
                justify-content: center;
                position: fixed;
                width: 48px;
            }

            .property-gallery-close {
                right: 18px;
                top: 18px;
            }

            .property-gallery-nav.prev {
                left: 18px;
                top: 50%;
                transform: translateY(-50%);
            }

            .property-gallery-nav.next {
                right: 18px;
                top: 50%;
                transform: translateY(-50%);
            }

            .property-gallery-counter {
                background: rgba(255,255,255,.12);
                border: 1px solid rgba(255,255,255,.18);
                border-radius: 999px;
                bottom: 24px;
                color: #fff;
                font-weight: 850;
                left: 50%;
                padding: 10px 16px;
                position: fixed;
                transform: translateX(-50%);
            }

            @media (min-width: 820px) {
                .property-feed-page {
                    background:
                        linear-gradient(90deg, rgba(247, 244, 239, .94) 0%, rgba(247, 244, 239, .78) 45%, rgba(247, 244, 239, .94) 100%),
                        url("https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/fundo%20imobiliaria.jpeg") center / cover fixed;
                }

                .property-feed-slide {
                    padding: 18px 0;
                }

                .property-feed-card {
                    border: 1px solid rgba(0,0,0,.08);
                    border-radius: 36px;
                    height: calc(100dvh - 36px);
                    min-height: calc(100dvh - 36px);
                    overflow: hidden;
                }
            }

            @media (max-width: 520px) {
                .property-feed-page,
                .property-feed-slide,
                .property-feed-card {
                    max-width: 100vw !important;
                    width: 100vw !important;
                }

                .property-feed-card {
                    box-shadow: none;
                }

                .property-feed-map-style-control {
                    right: 8px;
                    top: 8px;
                }

                .property-feed-map-style-control button {
                    height: 31px;
                    padding: 0 8px;
                }

                .property-feed-header {
                    grid-template-columns: 32px minmax(0, 1fr) auto;
                    min-height: 54px;
                    padding: 7px 10px;
                }

                .property-icon-button {
                    height: 31px;
                    width: 31px;
                }

                .property-heart-count {
                    min-width: 36px;
                    width: auto;
                }

                .property-top-actions {
                    gap: 4px;
                }

                .property-save-button {
                    border-radius: 12px;
                    font-size: .72rem;
                    height: 34px;
                    padding: 0 10px;
                }

                .property-feed-profile {
                    grid-template-columns: clamp(82px, 25vw, 96px) minmax(0, 1fr);
                    padding: 12px 17px 7px;
                }

                .property-profile-copy h1 {
                    font-size: clamp(1.02rem, 4.9vw, 1.36rem);
                    -webkit-line-clamp: 2;
                }

                .property-profile-copy p {
                    margin-top: 5px;
                }

                .property-profile-stats {
                    grid-template-columns: .7fr 1.65fr .8fr;
                    margin-top: 11px;
                }

                .property-profile-stats span {
                    padding: 0 7px;
                }

                .property-profile-stats b {
                    font-size: clamp(.72rem, 2.7vw, .86rem);
                    margin-bottom: 4px;
                }

                .property-feed-bio {
                    gap: 5px;
                    padding: 6px 17px 8px;
                }

                .property-bio-summary {
                    font-size: .79rem;
                    line-height: 1.26;
                }

                .property-bio-lines p {
                    font-size: .74rem;
                    gap: 7px;
                    grid-template-columns: 20px minmax(0, 1fr);
                    line-height: 1.18;
                }

                .property-feed-actions {
                    gap: 5px;
                    grid-template-columns: minmax(0, 1fr) minmax(0, 1.28fr) 33px;
                    padding: 1px 17px 6px;
                }

                .property-action {
                    border-radius: 9px;
                    font-size: .71rem;
                    gap: 4px;
                    min-height: 32px;
                    padding: 0 6px;
                }

                .property-action.square {
                    display: inline-flex;
                }

                .property-feed-stories {
                    gap: 6px;
                    padding: 6px 16px 9px;
                }

                .property-feed-story-page {
                    gap: 8px;
                }

                .property-feed-stories span {
                    width: min(100%, 56px);
                }

                .property-feed-stories button {
                    gap: 0;
                }

                .property-feed-tabs {
                    min-height: 47px;
                }

                .property-feed-tabs button {
                    font-size: .78rem;
                    gap: 5px;
                }

                .property-feed-hint {
                    bottom: 12px;
                    display: inline-flex;
                    font-size: .66rem;
                    padding: 5px 10px;
                }
            }

            @media (max-height: 760px) {
                .property-feed-header {
                    min-height: 49px;
                }

                .property-feed-profile {
                    grid-template-columns: 76px minmax(0, 1fr);
                    padding-bottom: 5px;
                    padding-top: 9px;
                }

                .property-profile-copy h1 {
                    font-size: clamp(1.05rem, 5.5vw, 1.48rem);
                }

                .property-profile-stats {
                    grid-template-columns: .7fr 1.65fr .8fr;
                    margin-top: 8px;
                }

                .property-profile-stats span {
                    font-size: .62rem;
                }

                .property-profile-stats b {
                    font-size: clamp(.7rem, 2.5vw, .84rem);
                }

                .property-feed-bio {
                    gap: 5px;
                    padding-bottom: 7px;
                    padding-top: 5px;
                }

                .property-bio-summary {
                    font-size: .74rem;
                    -webkit-line-clamp: 1;
                }

                .property-bio-lines p {
                    font-size: .74rem;
                    line-height: 1.2;
                }

                .property-feed-actions {
                    padding-bottom: 5px;
                }

                .property-action {
                    min-height: 31px;
                }

                .property-feed-stories {
                    padding-bottom: 7px;
                    padding-top: 6px;
                }

                .property-feed-stories span {
                    width: min(100%, 44px);
                }

                .property-feed-tabs {
                    min-height: 42px;
                }
            }

            @media (max-width: 374px) {
                .property-feed-actions {
                    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
                }

                .property-action.square {
                    display: none;
                }

                .property-top-actions {
                    gap: 2px;
                }

                .property-save-button {
                    display: none;
                }

                .property-feed-stories {
                    gap: 6px;
                }

                .property-feed-story-page {
                    gap: 6px;
                }

                .property-feed-stories span {
                    width: min(100%, 42px);
                }
            }
        `}</style>
    )
}
