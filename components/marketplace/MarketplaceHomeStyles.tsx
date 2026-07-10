const MARKETPLACE_HOME_CSS = `/* ====== BASE ====== */
        .marketplace-container {
          min-height: 100vh;
          background-color: var(--bg-secondary, #f7f7f5);
          padding-bottom: 80px;
          color: var(--text-primary, #1a1a1a);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          overflow-x: hidden;
          max-width: 100vw;
        }

        /* ====== MARKET TICKER ====== */
        .market-ticker-shell {
          position: relative;
          display: flex;
          align-items: center;
          height: 36px;
          max-width: 2000px;
          margin: 0 auto;
          background: #0a0a0a;
          color: #f8f5ee;
          border-top: 1px solid rgba(201, 169, 110, 0.18);
          border-bottom: 1px solid rgba(201, 169, 110, 0.24);
          overflow: hidden;
          z-index: 130;
        }
        .market-ticker-label {
          position: relative;
          z-index: 3;
          height: 100%;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 14px 0 18px;
          background: #0a0a0a;
          border-right: 1px solid rgba(201, 169, 110, 0.22);
          white-space: nowrap;
          flex: 0 0 auto;
        }
        .market-ticker-pulse {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #19c37d;
          animation: tickerPulse 2s ease-in-out infinite;
        }
        @keyframes tickerPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 4px rgba(25, 195, 125, 0.6); }
          50% { opacity: 0.4; box-shadow: 0 0 8px rgba(25, 195, 125, 0.3); }
        }
        .market-ticker-label span {
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0;
          color: #d7bd82;
        }
        .market-ticker-label strong {
          font-size: 0.62rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.58);
          text-transform: uppercase;
        }
        .market-ticker-track {
          position: relative;
          flex: 1;
          overflow: hidden;
          height: 100%;
        }
        .market-ticker-loop {
          display: flex;
          align-items: center;
          gap: 0;
          height: 100%;
          width: max-content;
          animation: marketTickerScroll 160s linear infinite;
          will-change: transform;
        }
        .market-ticker-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-width: max-content;
          white-space: nowrap;
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.82);
          padding: 0 18px;
          border-right: 1px solid rgba(255, 255, 255, 0.06);
        }
        .market-ticker-sparkline {
          width: 28px;
          height: 12px;
          flex: 0 0 auto;
        }
        .market-ticker-mark {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #a1a1aa;
          box-shadow: 0 0 8px rgba(161, 161, 170, 0.3);
          flex: 0 0 auto;
        }
        .market-ticker-mark-up {
          background: #19c37d;
          box-shadow: 0 0 10px rgba(25, 195, 125, 0.4);
        }
        .market-ticker-mark-down {
          background: #ef4444;
          box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);
        }
        .market-ticker-item-label {
          font-weight: 500;
        }
        .market-ticker-item-value {
          font-weight: 800;
          font-size: 0.74rem;
          color: #d7bd82;
        }
        .market-ticker-up { color: #19c37d; }
        .market-ticker-down { color: #ef4444; }
        .market-ticker-neutral { color: #d7bd82; }
        .market-ticker-fade {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 52px;
          z-index: 2;
          pointer-events: none;
        }
        .market-ticker-fade-left {
          left: 0;
          background: linear-gradient(90deg, #0a0a0a, rgba(10, 10, 10, 0));
        }
        .market-ticker-fade-right {
          right: 0;
          background: linear-gradient(270deg, #0a0a0a, rgba(10, 10, 10, 0));
        }
        @keyframes marketTickerScroll {
          from { transform: translateX(0); }
          to { transform: translateX(-25%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .market-ticker-loop { animation: none; }
        }

        /* ====== MARKET INTELLIGENCE TERMINAL ====== */
        .mi-section {
          max-width: 2000px;
          margin: 20px auto 24px;
          padding: 0;
          border-radius: 10px;
          background: #0d1117;
          overflow: hidden;
          box-shadow: 0 12px 36px rgba(0,0,0,0.22);
          border: 1px solid rgba(255,255,255,0.06);
        }
        /* Top Bar */
        .mi-topbar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          padding: 14px 18px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .mi-kicker {
          display: block;
          margin-bottom: 3px;
          color: #f6ca67;
          font-size: 0.62rem;
          font-weight: 850;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .mi-topbar h2 {
          margin: 0;
          color: #fff;
          font-size: clamp(0.95rem, 1.6vw, 1.25rem);
          font-weight: 850;
          line-height: 1.15;
        }
        .mi-topbar-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
        }
        .mi-sources {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          justify-content: flex-end;
        }
        /* Source chips like network badges (ETH, BSC, etc.) */
        .mi-source-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 7px 2px 5px;
          border-radius: 4px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.06);
          white-space: nowrap;
          transition: all 0.2s;
          cursor: default;
        }
        .mi-source-chip:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.12);
        }
        .mi-chip-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex: 0 0 auto;
        }
        .mi-chip-key {
          color: rgba(255,255,255,0.78);
          font-size: 0.6rem;
          font-weight: 850;
        }
        .mi-chip-label {
          color: rgba(255,255,255,0.38);
          font-size: 0.55rem;
          font-weight: 650;
        }
        .mi-live-tag {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: rgba(255,255,255,0.6);
          font-size: 0.68rem;
          white-space: nowrap;
        }
        .mi-live-tag svg { color: #19c37d; }
        .mi-live-tag strong { color: #f6ca67; font-weight: 850; }

        /* Chart Area */
        .mi-chart-wrap {
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .mi-chart-tabs {
          display: flex;
          align-items: center;
          gap: 0;
          padding: 0 16px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .mi-chart-tabs span {
          padding: 7px 12px;
          color: rgba(255,255,255,0.42);
          font-size: 0.68rem;
          font-weight: 750;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }
        .mi-chart-tabs span:hover { color: rgba(255,255,255,0.7); }
        .mi-tab-active {
          color: #f6ca67 !important;
          border-bottom-color: #f6ca67 !important;
        }
        .mi-chart-ohlc {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 5px 16px;
          font-size: 0.62rem;
          color: rgba(255,255,255,0.45);
          font-weight: 650;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .mi-chart-ohlc b { font-weight: 850; color: rgba(255,255,255,0.72); }
        .mi-ma-label {
          display: flex;
          gap: 10px;
          margin-left: auto;
        }
        .mi-ma-label span { font-weight: 750; font-size: 0.6rem; }
        .mi-chart-container {
          position: relative;
          background: rgba(0,0,0,0.15);
        }
        .mi-trend-chart {
          display: block;
          width: 100%;
          height: 280px;
        }

        /* Chart Legend */
        .mi-chart-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 4px 14px;
          padding: 8px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .mi-legend-item {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.66rem;
          white-space: nowrap;
        }
        .mi-legend-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex: 0 0 auto;
        }
        .mi-legend-label {
          color: rgba(255,255,255,0.58);
          font-weight: 650;
          max-width: 160px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mi-legend-score { font-weight: 900; font-size: 0.7rem; }

        /* Data Table (Token Explorer style) */
        .mi-table-wrap {
          overflow-x: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
        }
        .mi-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 720px;
        }
        .mi-table thead tr {
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .mi-table th {
          padding: 8px 10px;
          color: rgba(255,255,255,0.38);
          font-size: 0.6rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          text-align: left;
          white-space: nowrap;
        }
        .mi-table th:first-child { padding-left: 16px; }
        .mi-table th:last-child { padding-right: 16px; }
        .mi-table tbody tr {
          border-bottom: 1px solid rgba(255,255,255,0.04);
          transition: background 0.15s;
        }
        .mi-table tbody tr:hover {
          background: rgba(255,255,255,0.03);
        }
        .mi-table td {
          padding: 9px 10px;
          font-size: 0.74rem;
          color: rgba(255,255,255,0.78);
          white-space: nowrap;
        }
        .mi-table td:first-child { padding-left: 16px; }
        .mi-table td:last-child { padding-right: 16px; }
        .mi-td-rank {
          color: rgba(255,255,255,0.3);
          font-weight: 750;
          font-size: 0.7rem;
          width: 30px;
        }
        .mi-td-name a {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #fff !important;
          font-weight: 750;
        }
        .mi-asset-icon {
          display: grid;
          place-items: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          color: #fff;
          font-size: 0.62rem;
          font-weight: 900;
          flex: 0 0 auto;
        }
        .mi-asset-name {
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mi-source-tag {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid;
          font-size: 0.58rem;
          font-weight: 800;
          background: rgba(255,255,255,0.03);
        }
        .mi-source-tag svg { width: 10px; height: 10px; }
        .mi-td-score strong {
          color: #fff;
          font-size: 0.82rem;
          font-weight: 900;
        }
        .mi-td-delta {
          font-weight: 750;
          font-size: 0.72rem;
        }
        .mi-delta-up { color: #19c37d; }
        .mi-delta-down { color: #ef4444; }
        .mi-td-spark { padding: 6px 8px; }
        .mi-td-temp { width: 100px; }
        .mi-temp-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.6rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .mi-temp-hot { background: rgba(25,195,125,0.15); color: #19c37d; }
        .mi-temp-warm { background: rgba(245,158,11,0.15); color: #f59e0b; }
        .mi-temp-cool { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); }

        /* Bottom Bar */
        .mi-bottom-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 16px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .mi-actions { display: flex; gap: 8px; }
        .mi-action-primary, .mi-action-secondary {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 0.72rem;
          font-weight: 800;
          white-space: nowrap;
          transition: all 0.2s;
        }
        .mi-action-primary {
          background: #f6ca67;
          color: #0d1117 !important;
          border: 1px solid #f6ca67;
        }
        .mi-action-primary:hover { background: #ffd97a; }
        .mi-action-secondary {
          background: transparent;
          color: #fff !important;
          border: 1px solid rgba(246,202,103,0.28);
        }
        .mi-action-secondary:hover { background: rgba(255,255,255,0.06); }
        .mi-data-note {
          display: flex;
          align-items: center;
          gap: 5px;
          color: rgba(255,255,255,0.38);
          font-size: 0.66rem;
          font-weight: 650;
        }
        .mi-data-note svg { color: #f6ca67; }

        /* MI Mobile Responsive */
        @media (max-width: 640px) {
          .mi-section { margin: 14px 8px 18px; border-radius: 8px; }
          .mi-topbar { flex-direction: column; gap: 8px; padding: 12px 14px 8px; }
          .mi-topbar-right { align-items: flex-start; width: 100%; }
          .mi-sources { justify-content: flex-start; }
          .mi-chip-label { display: none; }
          .mi-chart-tabs span { padding: 6px 8px; font-size: 0.62rem; }
          .mi-chart-ohlc { flex-wrap: wrap; gap: 6px; }
          .mi-trend-chart { height: 220px; }
          .mi-chart-legend { gap: 3px 8px; padding: 6px 12px; }
          .mi-legend-label { max-width: 90px; font-size: 0.6rem; }
          .mi-table { min-width: 100%; }
          .mi-table th:nth-child(5), .mi-table td:nth-child(5), /* 24h */
          .mi-table th:nth-child(6), .mi-table td:nth-child(6), /* 7d */
          .mi-table th:nth-child(7), .mi-table td:nth-child(7), /* 30d */
          .mi-table th:nth-child(8), .mi-table td:nth-child(8), /* Sparkline */
          .mi-table th:nth-child(9), .mi-table td:nth-child(9)  /* Status */
          { display: none; }
          .mi-bottom-bar { flex-direction: column; align-items: stretch; gap: 8px; }
          .mi-actions { width: 100%; }
          .mi-action-primary, .mi-action-secondary { flex: 1; justify-content: center; }
          .mi-data-note { justify-content: center; }
          .market-ticker-label { padding: 0 10px; }
          .market-ticker-label strong { display: none; }
          .market-ticker-item { font-size: 0.68rem; padding: 0 12px; }
          .market-ticker-sparkline { width: 22px; height: 10px; }
          .market-ticker-loop { animation-duration: 100s; }
          .market-ticker-fade-left { left: 0; }
        }

        @media (max-width: 900px) {
          .home-premium-hero {
            height: min(540px, calc(100svh - 86px)) !important;
            min-height: 500px;
            padding-bottom: 22px !important;
          }
          .home-hero-social-proof {
            display: none;
          }
          .home-premium-hero .hero-title-script {
            max-width: 100%;
            font-size: clamp(1.95rem, 8.8vw, 2.36rem) !important;
            white-space: nowrap;
          }
          .home-premium-hero .hero-top-fade {
            height: 78px;
            z-index: 0;
            background: linear-gradient(
              to bottom,
              rgba(255, 255, 255, 0.98) 0%,
              rgba(255, 255, 255, 0.9) 24%,
              rgba(255, 255, 255, 0.52) 62%,
              rgba(255, 255, 255, 0) 100%
            );
          }
          .home-premium-hero .hero-subtitle-top {
            max-width: calc(100vw - 32px);
            font-size: clamp(1.08rem, 5vw, 1.42rem) !important;
          }
          .home-hero-social-proof {
            left: 14px;
            top: 14px;
            gap: 6px;
          }
          .home-hero-social-proof span:nth-child(2) {
            display: none;
          }
          .home-hero-social-proof span {
            padding: 8px 10px;
            font-size: 0.58rem;
          }
          .home-premium-hero .hero-bg-image {
            width: auto !important;
            height: 108% !important;
            max-height: none !important;
            top: auto !important;
            bottom: -28px !important;
          }
          .home-premium-hero .hero-background-frame {
            object-fit: cover !important;
            object-position: center 28% !important;
            opacity: 0.9 !important;
            filter: contrast(1.04) saturate(0.96);
          }
          .home-premium-hero .hero-overlay {
            background: none;
          }
          .home-hero-content {
            padding-bottom: 8px;
          }
          .home-hero-actions {
            gap: 8px;
            margin-top: 12px;
            padding: 0 16px;
          }
          .home-hero-action {
            min-height: 38px;
            padding: 0 13px;
            font-size: 0.64rem;
          }
          .gp-authority-strip {
            flex-direction: column;
            align-items: flex-start;
            margin: 16px 12px 10px;
            padding: 18px;
            border-radius: 16px;
          }
          .gp-authority-stats {
            width: 100%;
            min-width: 0;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 5px;
          }
          .gp-authority-stats a {
            min-width: 0;
            padding: 8px 2px;
            border-radius: 9px;
          }
          .gp-authority-stats strong {
            font-size: clamp(1.02rem, 6vw, 1.26rem);
          }
          .gp-authority-stats span {
            margin-top: 4px;
            font-size: 0.42rem;
            letter-spacing: 0.02em;
          }
          .premium-categories-showcase {
            margin: 4px 0 12px;
            padding: 10px 12px 14px;
            overflow: hidden;
          }
          .premium-section-head {
            display: block;
            margin-bottom: 10px;
          }
          .premium-section-head h2 {
            font-size: clamp(0.67rem, 3.36vw, 0.86rem);
            white-space: nowrap;
          }
          .premium-category-grid {
            display: flex;
            gap: 10px;
            overflow-x: auto;
            padding-bottom: 6px;
            scroll-snap-type: x proximity;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
            touch-action: pan-x;
          }
          .premium-category-grid::-webkit-scrollbar {
            display: none;
          }
          .premium-category-card {
            position: relative;
            overflow: hidden;
            flex: 0 0 calc(50% - 5px);
            min-width: calc(50% - 5px);
            min-height: 0;
            aspect-ratio: 1 / 0.68;
            border-radius: 12px;
            scroll-snap-align: start;
          }
          .gp-concierge-band {
            grid-template-columns: 1fr;
            margin: 10px 12px 24px;
            border-radius: 18px;
          }
          .gp-concierge-media {
            min-height: 250px;
          }
          .gp-concierge-media img {
            object-position: center 28%;
          }
          .gp-concierge-content {
            padding: 24px 20px 26px;
          }
          .gp-concierge-actions {
            gap: 8px;
          }
          .gp-button {
            flex: 1;
            min-width: min(100%, 180px);
            padding: 0 12px;
            font-size: 0.62rem;
          }
        }

        /* Reset all links inside marketplace — no underlines anywhere */
        .marketplace-container a,
        .marketplace-container a:hover,
        .marketplace-container a:visited,
        .marketplace-container a:focus,
        .marketplace-container a:active,
        .property-card a,
        .property-card a:hover,
        .property-card a:visited {
          text-decoration: none !important;
          color: inherit;
        }

        /* ====== HERO ====== */
        .hero-strip {
          position: relative;
          width: 100%;
          height: 480px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          padding-bottom: 24px;
          background: linear-gradient(180deg, #f0ede8 0%, #f7f7f5 100%);
        }
        @media (max-width: 768px) {
          .hero-strip {
            height: 420px;
            padding-bottom: 16px;
          }
        }
        .hero-top-fade {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 40px;
          background: linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0.95) 0%,
            rgba(255, 255, 255, 0.7) 30%,
            rgba(255, 255, 255, 0.3) 60%,
            rgba(255, 255, 255, 0) 100%
          );
          z-index: 4;
          pointer-events: none;
        }
        .hero-photo-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -48%);
          width: 220px;
          height: 220px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(184, 148, 95, 0.35) 0%, rgba(184, 148, 95, 0.15) 40%, rgba(184, 148, 95, 0) 70%);
          filter: blur(8px);
          z-index: 0;
          pointer-events: none;
        }
        .hero-bg-image {
          position: absolute;
          top: auto;
          bottom: -38px;
          left: 50%;
          transform: translateX(-50%);
          height: min(126%, 680px);
          width: auto;
          max-width: none;
          object-fit: contain;
          object-position: center bottom;
          filter: none;
          z-index: 1;
        }
        .hero-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to top,
            rgba(184,148,95,0.90) 0%,
            rgba(184,148,95,0.55) 22%,
            rgba(184,148,95,0.10) 40%,
            transparent 55%
          );
          z-index: 2;
        }
        .hero-content {
          position: relative;
          z-index: 3;
          text-align: center;
          width: 100%;
          padding: 0 6px;
        }
        .hero-eyebrow {
          display: block;
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(0.65rem, 2.2vw, 1rem);
          font-weight: 600;
          font-style: italic;
          color: #111;
          -webkit-text-fill-color: #111;
          letter-spacing: 0.12em;
          margin-bottom: 4px;
        }
        .hero-subtitle-top {
          font-family: 'Inter', sans-serif;
          font-size: clamp(0.9rem, 2.5vw, 1.8rem);
          font-weight: 500;
          line-height: 1.3;
          margin: 0 auto;
          color: #111;
          text-shadow: 0 1px 15px rgba(255,255,255,0.8);
          max-width: 800px;
        }
        .hero-title-script {
          font-family: 'Playfair Display', Georgia, serif;
          font-style: italic;
          font-size: clamp(3.15rem, 7.2vw, 5.85rem);
          font-weight: 400;
          line-height: 1;
          margin: 0;
          color: #111;
          text-shadow: 0 2px 20px rgba(255,255,255,0.8);
        }
        @media (min-width: 768px) {
          .hero-content {
            padding: 0 24px;
          }
          .hero-subtitle-top {
            font-size: clamp(1.2rem, 1.8vw, 1.8rem);
            margin-bottom: 0px;
          }
        }

        /* Hero background image */
        .hero-image-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .hero-image-bg::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 78px;
          z-index: 2;
          pointer-events: none;
          background: linear-gradient(
            to bottom,
            rgba(247,247,245,0.98) 0%,
            rgba(247,247,245,0.82) 38%,
            rgba(247,247,245,0) 100%
          );
        }
        .hero-background-frame {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 28%;
          pointer-events: none;
          opacity: 0.9;
          filter: contrast(1.04) saturate(0.96);
        }

        .home-premium-hero {
          isolation: isolate;
          min-height: 520px;
          border-bottom: 1px solid rgba(184,148,95,0.16);
        }
        .home-premium-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          background:
            linear-gradient(90deg, rgba(8,8,8,0.28) 0%, rgba(8,8,8,0.04) 34%, rgba(8,8,8,0.18) 100%),
            radial-gradient(circle at 50% 32%, rgba(255,255,255,0.05), transparent 38%);
          mix-blend-mode: multiply;
        }
        .home-premium-hero .hero-background-frame {
          opacity: 0.9 !important;
          filter: contrast(1.04) saturate(0.96);
        }
        .home-premium-hero .hero-overlay {
          background: linear-gradient(to top, rgba(247,247,245,0.96) 0%, rgba(247,247,245,0.65) 22%, rgba(247,247,245,0.15) 38%, transparent 52%);
        }
        .home-hero-content {
          z-index: 4;
          padding-bottom: 8px;
        }
        .home-hero-eyebrow {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 7px;
          color: #111;
          font-family: 'Inter', sans-serif;
          font-size: clamp(0.7rem, 1.6vw, 0.84rem);
          font-weight: 900;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          text-shadow: 0 1px 12px rgba(255,255,255,0.7);
        }
        .home-premium-hero .hero-subtitle-top {
          color: #16130f;
          font-size: clamp(1.2rem, 2.4vw, 2.05rem);
          font-weight: 750;
        }
        .home-premium-hero .hero-title-script {
          color: #12100d;
          font-size: clamp(3.4rem, 8vw, 6.6rem);
          letter-spacing: 0;
        }
        .home-hero-actions {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 16px;
        }
        .home-hero-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          padding: 0 18px;
          border-radius: 999px;
          font-family: 'Inter', sans-serif;
          font-size: 0.78rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          box-shadow: 0 14px 34px rgba(28,22,14,0.16);
          transition: transform 0.22s ease, box-shadow 0.22s ease;
        }
        .home-hero-action:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 42px rgba(28,22,14,0.2);
        }
        .home-hero-action-primary {
          background: linear-gradient(135deg, #dfc18e, #b8945f);
          color: #100e0b !important;
          border: 1px solid rgba(255,255,255,0.42);
        }
        .home-hero-action-secondary {
          background: rgba(255,255,255,0.72);
          color: #171410 !important;
          border: 1px solid rgba(33,29,23,0.12);
          backdrop-filter: blur(14px);
        }
        .home-hero-social-proof,
        .home-hero-watch {
          position: absolute;
          z-index: 5;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #f3e4c7;
          font-family: 'Inter', sans-serif;
          font-size: 0.68rem;
          font-weight: 900;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          pointer-events: none;
        }
        .home-hero-social-proof {
          left: 28px;
          top: 34px;
          flex-direction: column;
          align-items: flex-start;
        }
        .home-hero-social-proof span,
        .home-hero-watch {
          padding: 9px 12px;
          border: 1px solid rgba(223,193,142,0.26);
          border-radius: 999px;
          background: rgba(12,12,12,0.58);
          backdrop-filter: blur(14px);
          box-shadow: 0 14px 34px rgba(0,0,0,0.18);
        }
        .home-hero-social-proof span {
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }
        .home-hero-watch {
          right: 28px;
          top: 34px;
        }

        .gp-kicker {
          display: inline-flex;
          align-items: center;
          color: #a78042;
          font-family: 'Inter', sans-serif;
          font-size: 0.68rem;
          font-weight: 950;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }
        .gp-authority-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          max-width: 1360px;
          margin: 24px auto 12px;
          padding: 22px 32px;
          border: 1px solid rgba(184,148,95,0.16);
          border-radius: 18px;
          background:
            linear-gradient(135deg, rgba(255,255,255,0.9), rgba(246,242,234,0.92));
          box-shadow: 0 16px 38px rgba(31,25,18,0.08);
        }
        .gp-authority-copy h2 {
          max-width: 720px;
          margin: 0;
          color: #a78042;
          font-family: 'Inter', sans-serif;
          font-size: clamp(0.72rem, 1.05vw, 0.94rem);
          font-weight: 950;
          line-height: 1;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }
        .gp-nowrap {
          white-space: nowrap;
        }
        .gp-authority-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(82px, 1fr));
          gap: 8px;
          min-width: min(460px, 42vw);
        }
        .gp-authority-stats a {
          display: block;
          padding: 10px 8px;
          border: 1px solid rgba(32,27,20,0.07);
          border-radius: 12px;
          background: rgba(255,255,255,0.72);
          color: inherit;
          text-decoration: none;
          text-align: center;
          transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease, background 0.22s ease;
        }
        .gp-authority-stats a:hover {
          transform: translateY(-2px);
          border-color: rgba(184,148,95,0.28);
          background: rgba(255,255,255,0.92);
          box-shadow: 0 10px 24px rgba(31,25,18,0.08);
        }
        .gp-authority-stats strong {
          display: block;
          color: #181512;
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(1.12rem, 1.55vw, 1.7rem);
          line-height: 1;
        }
        .gp-authority-stats span {
          display: block;
          margin-top: 6px;
          color: #766a5a;
          font-size: 0.56rem;
          font-weight: 850;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .home-developments-showcase {
          margin-top: 8px;
          margin-bottom: 4px;
        }
        .home-developments-showcase .premium-category-grid {
          display: flex;
          gap: 14px;
          overflow-x: auto;
          overflow-y: hidden;
          padding-bottom: 6px;
          scroll-snap-type: x proximity;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
          touch-action: pan-x;
        }
        .home-developments-showcase .premium-category-grid::-webkit-scrollbar {
          display: none;
        }
        .home-developments-showcase .premium-category-card {
          flex: 0 0 calc((100% - 42px) / 4);
          min-width: 0;
          min-height: 160px;
          scroll-snap-align: start;
        }

        .premium-categories-showcase {
          max-width: 1440px;
          margin: 18px auto 20px;
          padding: 12px clamp(12px, 3vw, 48px) 20px;
        }
        .premium-section-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 16px;
        }
        .premium-section-head h2 {
          margin: 4px 0 0;
          color: #1f1b16;
          font-size: clamp(1.42rem, 2.1vw, 2.08rem);
          letter-spacing: 0;
          white-space: nowrap;
        }
        .premium-section-head p {
          max-width: 430px;
          margin: 0;
          color: #6d6255;
          font-size: 0.92rem;
          font-weight: 600;
          line-height: 1.5;
        }
        .premium-category-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }
        .premium-category-card {
          position: relative;
          min-height: 160px;
          overflow: hidden;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.42);
          background: #14110d;
          color: #fff !important;
          box-shadow: 0 18px 40px rgba(25,20,14,0.16);
          isolation: isolate;
        }
        .premium-category-card .premium-category-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: saturate(1.04) contrast(1.04) brightness(1.08);
          transform: scale(1.02);
          transition: transform 0.55s ease, filter 0.55s ease;
          z-index: 0;
        }
        .premium-category-card:hover .premium-category-image {
          transform: scale(1.08);
          filter: saturate(1.04) contrast(1.08);
        }
        .premium-category-shade {
          position: absolute;
          inset: 0;
          z-index: 1;
          background:
            linear-gradient(to top, rgba(8,8,8,0.66), rgba(8,8,8,0.42) 28%, rgba(8,8,8,0.14) 48%, rgba(8,8,8,0) 64%),
            linear-gradient(90deg, rgba(8,8,8,0.12), rgba(8,8,8,0));
        }
        .premium-category-icon {
          position: absolute;
          top: 14px;
          right: 14px;
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(223,193,142,0.92);
          color: #111;
        }
        .premium-category-copy {
          position: absolute;
          left: 16px;
          right: 16px;
          bottom: 15px;
          display: grid;
          gap: 4px;
          z-index: 2;
        }
        .premium-category-copy strong {
          color: #fffdf8;
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(1.18rem, 1.7vw, 1.55rem);
          font-weight: 850;
          line-height: 1;
        }
        .premium-category-copy small {
          color: #fff4d7;
          font-size: 0.74rem;
          font-weight: 950;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .gp-concierge-band {
          position: relative;
          display: grid;
          grid-template-columns: minmax(260px, 0.8fr) minmax(0, 1.2fr);
          align-items: stretch;
          max-width: 1360px;
          margin: 8px auto 34px;
          overflow: hidden;
          border-radius: 20px;
          background:
            radial-gradient(circle at 14% 18%, rgba(223,193,142,0.18), transparent 34%),
            linear-gradient(135deg, #191714, #2a241d);
          color: #f9f2e5;
          box-shadow: 0 22px 54px rgba(22,18,14,0.22);
        }
        .gp-concierge-media {
          position: relative;
          min-height: 360px;
          overflow: hidden;
          background:
            linear-gradient(to top, rgba(18,16,14,0.72), transparent),
            rgba(255,255,255,0.04);
        }
        .gp-concierge-media::after {
          content: '';
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(24,21,18,0.06), rgba(24,21,18,0.54) 100%),
            linear-gradient(to top, rgba(24,21,18,0.2), transparent 55%);
          pointer-events: none;
        }
        .gp-concierge-media img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 34%;
          filter: saturate(0.94) contrast(1.04);
        }
        .gp-concierge-content {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: clamp(28px, 5vw, 64px);
        }
        .gp-concierge-content h2 {
          max-width: 760px;
          margin: 8px 0 14px;
          color: #fff8ea;
          font-size: clamp(1.8rem, 4vw, 3.8rem);
          line-height: 1.02;
          letter-spacing: 0;
        }
        .gp-concierge-content p {
          max-width: 650px;
          margin: 0;
          color: rgba(255,255,255,0.72);
          font-size: clamp(0.94rem, 1.4vw, 1.08rem);
          font-weight: 500;
          line-height: 1.7;
        }
        .gp-concierge-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 24px;
        }
        .gp-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          padding: 0 16px;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 950;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .gp-button-dark {
          background: linear-gradient(135deg, #dfc18e, #b8945f);
          color: #100e0b !important;
        }
        .gp-button-light {
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.08);
          color: #fff8ea !important;
        }

        /* ====== STICKY SEARCH + CATEGORIES ====== */
        .sticky-bar {
          position: sticky;
          top: 0;
          z-index: 100;
          background: var(--bg-primary, #ffffff);
          border-bottom: 1px solid var(--border, #e8e5e0);
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          overflow: visible;
        }

        /* Categories */
        .categories-bar {
          display: flex;
          gap: 20px;
          overflow-x: auto;
          padding: 10px 24px 0px 24px;
          scrollbar-width: none;
          max-width: 2000px;
          margin: 0 auto;
        }
        .categories-bar::-webkit-scrollbar {
          display: none;
        }
        .category-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          min-width: 52px;
          cursor: pointer;
          color: var(--text-muted, #999);
          padding-bottom: 10px;
          border-bottom: 2px solid transparent;
          transition: all 0.2s ease;
          opacity: 0.6;
        }
        .category-item:hover, .category-item.active {
          color: var(--text-primary, #1a1a1a);
          border-bottom-color: var(--gold, #b8945f);
          opacity: 1;
        }
        .category-item.active .category-icon {
          color: var(--gold, #b8945f);
        }
        .category-label {
          font-size: 0.68rem;
          font-weight: 600;
          white-space: nowrap;
        }

        /* ====== LISTING GRID ====== */
        .listings-section {
          max-width: 1440px;
          margin: 0 auto;
          padding: clamp(18px, 2.4vw, 34px) clamp(12px, 3vw, 44px) clamp(28px, 4vw, 58px);
        }
        .properties-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          row-gap: 20px;
        }

        /* ====== MAP SEARCH - CRITICAL SSR LAYOUT ====== */
        .home-map-search {
          margin: clamp(24px, 4vw, 48px) auto;
          padding: 0 clamp(18px, 3vw, 36px);
          width: 100%;
        }
        .map-search-copy {
          margin: 0 auto 18px;
          max-width: 820px;
          text-align: center;
        }
        .map-search-copy h2 {
          color: #211c16;
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(1.45rem, 2.7vw, 2.8rem);
          font-weight: 760;
          letter-spacing: 0;
          line-height: 1.04;
          margin: 8px 0 0;
        }
        .map-search-copy p {
          color: #746858;
          font-size: clamp(0.78rem, 1.05vw, 0.92rem);
          font-weight: 600;
          line-height: 1.5;
          margin: 10px auto 0;
          max-width: 620px;
        }
        .map-search-shell {
          background: #fff;
          border: 1px solid rgba(184,148,95,0.18);
          border-radius: 18px;
          box-shadow: 0 24px 70px rgba(31,27,21,0.11);
          isolation: isolate;
          margin: 0 auto;
          max-width: 1680px;
          overflow: hidden;
          position: relative;
          z-index: 0;
        }
        .map-search-shell:focus-within {
          overflow: visible;
          z-index: 20;
        }
        .map-preview-panel {
          background: #1f1b16;
          border-radius: 18px;
          height: clamp(320px, 42vw, 520px);
          overflow: hidden;
          position: relative;
        }
        .map-preview-stat {
          align-items: center;
          background: rgba(23,20,16,0.82);
          border: 1px solid rgba(223,193,142,0.24);
          border-radius: 999px;
          bottom: 16px;
          color: #fff8ea;
          display: inline-flex;
          font: 850 0.72rem/1 'Inter', sans-serif;
          gap: 8px;
          left: 16px;
          letter-spacing: 0.08em;
          padding: 10px 13px;
          position: absolute;
          text-transform: uppercase;
          z-index: 650;
        }
        .map-search-panel {
          background: #fbfaf7;
          display: grid;
          gap: 10px;
          padding: 16px;
        }
        .map-search-panel-new {
          align-content: center;
          background: transparent;
          bottom: 22px;
          left: 50%;
          max-width: 980px;
          padding: 0;
          pointer-events: none;
          position: absolute;
          transform: translateX(-50%);
          width: min(980px, calc(100% - 440px));
          z-index: 760;
        }
        .map-search-panel-new .home-search-box-map {
          pointer-events: auto;
          width: 100%;
        }
        .map-search-panel .search-heading {
          color: #5b3d12;
          font: 950 0.72rem/1 'Inter', sans-serif;
          letter-spacing: 0.16em;
          text-align: center;
          text-transform: uppercase;
        }
        .compact-search-grid {
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(0, 1.18fr) minmax(0, 0.82fr);
        }
        .map-search-panel .field {
          min-width: 0;
          position: relative;
        }
        .map-search-panel .field label {
          color: #746858;
          display: block;
          font: 900 0.64rem/1 'Inter', sans-serif;
          letter-spacing: 0.12em;
          margin: 0 0 6px;
          text-transform: uppercase;
        }
        .map-search-panel .input-wrap,
        .map-search-panel .select-wrap {
          align-items: center;
          background: #fff;
          border: 1px solid rgba(116,104,88,0.22);
          border-radius: 8px;
          display: grid;
          gap: 8px;
          grid-template-columns: 17px minmax(0, 1fr) auto;
          min-height: 40px;
          padding: 0 12px;
        }
        .map-search-panel .input-wrap input,
        .map-search-panel .select-wrap select {
          background: transparent;
          border: 0;
          color: #211c16;
          font: 750 0.82rem/1 'Inter', sans-serif;
          min-width: 0;
          outline: 0;
          width: 100%;
        }
        .map-search-panel .select-wrap select {
          appearance: none;
        }
        .map-search-panel .purpose-switch {
          background: #f2eee6;
          border: 1px solid rgba(116,104,88,0.14);
          border-radius: 8px;
          display: grid;
          gap: 4px;
          grid-template-columns: 1fr 1fr;
          padding: 4px;
        }
        .map-search-panel .purpose-switch button {
          background: transparent;
          border: 0;
          border-radius: 6px;
          color: #746858;
          cursor: pointer;
          font: 900 0.76rem/1 'Inter', sans-serif;
          min-height: 32px;
        }
        .map-search-panel .purpose-switch button.active {
          background: #171410;
          color: #dfc18e;
          box-shadow: 0 7px 16px rgba(31,27,21,0.14);
        }
        .map-search-panel .search-submit {
          align-items: center;
          background: #c8a862;
          border: 0;
          border-radius: 8px;
          color: #10100e;
          cursor: pointer;
          display: inline-flex;
          font: 950 0.8rem/1 'Inter', sans-serif;
          gap: 9px;
          justify-content: center;
          letter-spacing: 0.1em;
          min-height: 40px;
          text-transform: uppercase;
        }
        .map-search-panel .search-actions {
          display: grid;
          gap: 8px;
          grid-template-columns: 1fr 1fr;
        }
        .map-search-panel .utility-button {
          align-items: center;
          background: #fff;
          border: 1px solid rgba(116,104,88,0.16);
          border-radius: 8px;
          color: #211c16;
          cursor: pointer;
          display: inline-flex;
          font: 850 0.78rem/1 'Inter', sans-serif;
          gap: 8px;
          justify-content: center;
          min-height: 36px;
        }
        .advanced-filter-panel {
          background: rgba(184,148,95,0.07);
          border: 1px solid rgba(184,148,95,0.16);
          border-radius: 10px;
          color: #746858;
          display: grid;
          gap: 10px;
          padding: 10px;
        }
        .advanced-filter-head {
          align-items: center;
          display: flex;
          gap: 8px;
          justify-content: space-between;
        }
        .advanced-filter-head strong {
          color: #211c16;
          font-size: 0.82rem;
        }
        .advanced-filter-head span {
          font-size: 0.78rem;
          font-weight: 700;
        }
        .filter-chip-grid {
          display: grid;
          gap: 6px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .filter-chip {
          align-items: center;
          background: #fff;
          border: 1px solid rgba(116,104,88,0.12);
          border-radius: 999px;
          color: #211c16;
          cursor: pointer;
          display: inline-grid;
          gap: 6px;
          grid-template-columns: 15px minmax(0, 1fr) auto;
          min-height: 34px;
          padding: 0 9px;
        }
        .filter-chip span {
          color: #211c16;
          font: 850 0.72rem/1 'Inter', sans-serif;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .filter-chip small {
          color: #746858;
          font: 850 0.66rem/1 'Inter', sans-serif;
        }

        /* ====== BOTTOM NAV ====== */
        .mobile-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 58px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-top: 1px solid var(--border, #e8e5e0);
          display: flex;
          justify-content: center;
          gap: 48px;
          align-items: center;
          z-index: 1000;
          padding-bottom: env(safe-area-inset-bottom);
        }
        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--text-muted, #999);
          font: inherit;
          font-size: 0.65rem;
          cursor: pointer;
          width: 54px;
          font-weight: 500;
          transition: color 0.2s;
        }
        .nav-item:hover { color: var(--text-secondary, #5a5a5a); }
        .nav-item.active { color: var(--gold, #b8945f); }
        .nav-icon { margin-bottom: 1px; }
        
        .empty-state { 
          text-align: center; 
          padding: 60px 24px; 
          color: var(--text-muted, #999);
          font-size: 0.95rem;
        }

        /* ====== RESPONSIVE BREAKPOINTS ====== */

        @media (min-width: 900px) {
          .map-preview-panel {
            height: clamp(520px, 38vw, 660px);
            min-height: 520px;
          }
          .map-search-panel {
            align-content: center;
            padding: 20px clamp(22px, 4vw, 54px) 24px;
          }
          .map-search-panel-new {
            justify-items: stretch;
          }
          .map-search-panel .search-actions {
            grid-template-columns: 1fr;
          }
          .map-search-panel .advanced-toggle {
            display: none;
          }
        }

        @media (max-width: 640px) {
          .home-map-search {
            margin: 8px auto 24px;
            padding: 0 14px;
          }
          .map-search-copy {
            margin-bottom: 10px;
            padding: 0 6px;
          }
          .map-search-copy h2 {
            font-size: 0.99rem;
            line-height: 1.03;
            white-space: nowrap;
          }
          .map-search-copy p {
            font-size: 0.76rem;
            line-height: 1.35;
            margin-top: 6px;
          }
          .map-search-shell {
            border-radius: 14px;
            overflow: visible;
          }
          .map-preview-panel {
            border-radius: 14px;
            height: clamp(330px, 86vw, 380px);
          }
          .map-preview-stat {
            bottom: 136px;
            left: 12px;
            padding: 9px 11px;
            z-index: 650;
          }
          .map-search-panel-new {
            inset: auto 8px 10px;
            min-width: 0;
            overflow: visible;
            transform: none;
            width: auto;
            z-index: 760;
          }
          .map-search-panel {
            gap: 9px;
            padding: 10px;
          }
          .compact-search-grid {
            gap: 8px;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          }
          .map-search-panel .field-location {
            grid-column: 1 / 2;
          }
          .map-search-panel .input-wrap,
          .map-search-panel .select-wrap {
            gap: 7px;
            grid-template-columns: 16px minmax(0, 1fr) auto;
            min-height: 38px;
            padding: 0 10px;
          }
          .map-search-panel .input-wrap input,
          .map-search-panel .select-wrap select {
            font-size: 0.76rem;
          }
          .map-search-panel .purpose-switch button {
            min-height: 30px;
          }
          .map-search-panel .search-submit {
            min-height: 39px;
          }
          .advanced-filter-head {
            align-items: flex-start;
            display: grid;
          }
          .filter-chip {
            min-height: 32px;
            padding: 0 8px;
          }
          .filter-chip span {
            font-size: 0.68rem;
          }
        }

        /* Small phones - 1 column */
        @media (min-width: 550px) {
          .properties-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 18px;
            row-gap: 28px;
          }
          .listings-section { padding: 24px 28px 32px; }
        }

        /* Tablet - 3 columns, hide mobile nav */
        @media (min-width: 768px) {
          .marketplace-container { padding-bottom: 0; }
          .hero-strip { height: 320px; }
          .hero-title { font-size: 2.4rem; }
          .hero-welcome { font-size: 0.75rem; }
          .hero-subtitle { font-size: 0.85rem; }
          .properties-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 22px;
            row-gap: 32px;
          }
          .mobile-nav { display: none !important; }
        }

        /* Desktop - 4 columns */
        @media (min-width: 1024px) {
          .hero-strip { height: 400px; }
          .hero-title { font-size: 2.8rem; }
          .hero-subtitle { font-size: 0.9rem; }
          .hero-welcome { font-size: 0.8rem; }
          .listings-section { padding: 28px 40px 40px; }
          .properties-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 24px;
            row-gap: 36px;
          }
        }

        /* Large desktop - 5 columns */
        @media (min-width: 1440px) {
          .hero-strip { height: 450px; }
          .listings-section { padding: 32px 48px 52px; }
          .properties-grid {
            grid-template-columns: repeat(5, 1fr);
            gap: 28px;
            row-gap: 40px;
          }
        }

        /* Ultra-wide - 6 columns */
        @media (min-width: 1800px) {
          .properties-grid {
            grid-template-columns: repeat(6, 1fr);
            gap: 32px;
            row-gap: 44px;
          }
        }

        @media (max-width: 900px) {
          .home-premium-hero {
            height: min(540px, calc(100svh - 86px)) !important;
            min-height: 500px;
            padding-bottom: 22px !important;
          }
          .home-premium-hero .hero-background-frame {
            object-fit: cover !important;
            object-position: center 28% !important;
            opacity: 0.9 !important;
            filter: contrast(1.04) saturate(0.96);
          }
          .home-premium-hero .hero-overlay {
            background: linear-gradient(to top, rgba(247,247,245,0.96) 0%, rgba(247,247,245,0.65) 22%, rgba(247,247,245,0.15) 38%, transparent 52%) !important;
          }
          .home-hero-content {
            padding-bottom: 8px;
          }
          .home-hero-social-proof {
            display: none !important;
          }
          .home-premium-hero .hero-subtitle-top {
            max-width: calc(100vw - 32px);
            font-size: clamp(1.08rem, 5vw, 1.42rem) !important;
          }
          .home-premium-hero .hero-title-script {
            max-width: calc(100vw - 20px);
            font-size: clamp(1.95rem, 8.8vw, 2.36rem) !important;
            white-space: nowrap;
          }
          .home-premium-hero .hero-bg-image {
            width: auto !important;
            height: 108% !important;
            max-height: none !important;
            top: auto !important;
            bottom: -28px !important;
          }
          .premium-section-head {
            display: block !important;
            margin-bottom: 10px;
          }
          .premium-categories-showcase {
            margin: 0 auto 24px !important;
            padding: 18px 12px 0 !important;
            overflow: hidden;
          }
          .premium-section-head h2 {
            color: #1f1b16;
            font-family: 'Playfair Display', Georgia, serif;
            font-size: clamp(0.96rem, 4.8vw, 1.23rem) !important;
            font-weight: 760;
            line-height: 1.02;
            letter-spacing: 0;
          }
          .premium-category-grid {
            display: flex !important;
            grid-template-columns: none !important;
            overflow-x: auto;
            gap: 10px;
            padding-bottom: 6px;
            scroll-snap-type: x proximity;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
            touch-action: pan-x;
          }
          .premium-category-grid::-webkit-scrollbar {
            display: none;
          }
          .premium-category-card {
            flex: 0 0 calc(50% - 5px) !important;
            min-width: calc(50% - 5px);
            min-height: 0;
            aspect-ratio: 1 / 0.68;
            border-radius: 12px;
            scroll-snap-align: start;
          }
          .home-developments-showcase .premium-category-card {
            flex: 0 0 calc(50% - 5px) !important;
            min-width: calc(50% - 5px);
            min-height: 0;
            aspect-ratio: 1 / 0.68;
          }
          .premium-category-icon {
            top: 9px !important;
            right: 9px !important;
            width: 28px !important;
            height: 28px !important;
          }
          .premium-category-icon svg {
            width: 14px;
            height: 14px;
          }
          .premium-category-copy {
            left: 10px !important;
            right: 10px !important;
            bottom: 10px !important;
            gap: 3px !important;
          }
          .premium-category-copy strong {
            font-size: 0.88rem !important;
            line-height: 1.02 !important;
          }
          .premium-category-copy small {
            font-size: 0.5rem !important;
            line-height: 1.1 !important;
            letter-spacing: 0.04em !important;
          }
          .gp-concierge-band {
            display: grid !important;
            grid-template-columns: 1fr !important;
            margin-left: 12px;
            margin-right: 12px;
          }
          .gp-concierge-media {
            min-height: 250px !important;
          }
          .gp-concierge-media img {
            object-position: center 28%;
          }
          .gp-concierge-content {
            padding: 24px 20px 26px !important;
          }
          .gp-concierge-content h2 {
            font-size: clamp(1.7rem, 9vw, 2.45rem) !important;
            line-height: 1.04;
          }
        }

        @media (max-width: 640px) {
          .gp-authority-strip {
            align-items: center !important;
            width: calc(100% - 24px);
            max-width: 344px;
            margin: 16px auto 10px !important;
            padding: 18px 14px !important;
          }
          .gp-authority-copy {
            width: 100%;
            text-align: center;
          }
          .gp-authority-copy h2 {
            margin-left: auto;
            margin-right: auto;
            font-family: 'Inter', sans-serif !important;
            color: #a78042 !important;
            font-size: clamp(0.62rem, 3.1vw, 0.72rem) !important;
            font-weight: 950 !important;
            letter-spacing: 0.16em !important;
            line-height: 1 !important;
            text-transform: uppercase !important;
            white-space: nowrap;
          }
          .gp-authority-stats {
            width: 100% !important;
            max-width: 316px;
            min-width: 0 !important;
            margin: 0 auto;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 4px !important;
          }
          .gp-authority-stats a {
            min-width: 0;
            min-height: 50px;
            padding: 8px 2px !important;
            border-radius: 8px !important;
          }
          .gp-authority-stats strong {
            font-size: clamp(0.9rem, 4.5vw, 1.08rem) !important;
          }
          .gp-authority-stats span {
            margin-top: 3px !important;
            font-size: 0.38rem !important;
            letter-spacing: 0 !important;
            white-space: nowrap;
          }
        }

        /* ====== LOCATION IMAGE CARDS ====== */
        .gp-authority-strip {
          display: grid !important;
          align-items: stretch !important;
          gap: 14px !important;
          grid-template-columns: minmax(0, 1fr) !important;
          box-sizing: border-box;
          width: 100%;
          max-width: 1440px !important;
          margin: 20px auto 18px !important;
          padding: 12px clamp(12px, 3vw, 48px) 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }
        .gp-authority-copy {
          width: 100%;
          text-align: left !important;
        }
        .gp-authority-copy h2 {
          margin: 0 !important;
          max-width: none !important;
          color: #1f1b16 !important;
          font-family: 'Playfair Display', Georgia, serif !important;
          font-size: clamp(1.42rem, 2.1vw, 2.08rem) !important;
          font-weight: 760 !important;
          line-height: 1.02 !important;
          letter-spacing: 0 !important;
          text-transform: none !important;
          white-space: nowrap;
        }
        .gp-authority-stats {
          display: grid !important;
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 14px !important;
          width: 100% !important;
          max-width: none !important;
          min-width: 0 !important;
          margin: 0 !important;
          justify-self: stretch !important;
        }
        .gp-authority-stats a.gp-location-card {
          position: relative;
          display: block !important;
          min-height: 160px;
          overflow: hidden;
          padding: 0 !important;
          border: 1px solid rgba(255,255,255,0.42) !important;
          border-radius: 14px !important;
          background: #14110d !important;
          color: #fff !important;
          text-align: left !important;
          isolation: isolate;
          box-shadow: 0 18px 40px rgba(25,20,14,0.16);
        }
        .gp-location-image {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          object-fit: cover;
          filter: saturate(1.02) contrast(1.04) brightness(1.08);
          transform: scale(1.02);
          transition: transform 0.55s ease, filter 0.55s ease;
          z-index: 0;
        }
        .gp-authority-stats a.gp-location-card:hover .gp-location-image {
          transform: scale(1.08);
          filter: saturate(1.06) contrast(1.1);
        }
        .gp-location-shade {
          position: absolute;
          inset: 0;
          z-index: 1;
          background:
            linear-gradient(to top, rgba(8,8,8,0.66), rgba(8,8,8,0.42) 28%, rgba(8,8,8,0.14) 48%, rgba(8,8,8,0) 64%),
            linear-gradient(90deg, rgba(8,8,8,0.12), rgba(8,8,8,0));
        }
        .gp-location-copy {
          position: absolute;
          left: 16px;
          right: 16px;
          bottom: 15px;
          display: grid;
          gap: 5px;
          z-index: 2;
          text-transform: none;
        }
        .gp-authority-stats a.gp-location-card .gp-location-copy strong {
          display: block;
          margin: 0;
          color: #fffdf8 !important;
          font-family: 'Playfair Display', Georgia, serif !important;
          font-size: clamp(1.16rem, 1.7vw, 1.52rem) !important;
          font-weight: 850 !important;
          line-height: 1 !important;
          letter-spacing: 0 !important;
          text-transform: none !important;
          text-shadow: 0 2px 14px rgba(0,0,0,0.34);
        }
        .gp-authority-stats a.gp-location-card .gp-location-copy small {
          display: inline-flex;
          align-items: baseline;
          gap: 5px;
          margin: 0;
          color: #fff4d7 !important;
          font: 950 0.7rem/1 'Inter', sans-serif !important;
          letter-spacing: 0.06em !important;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .gp-location-copy b {
          color: #dfc18e;
          font-size: 0.96rem;
          line-height: 1;
        }

        @media (min-width: 1024px) {
          .premium-categories-showcase {
            padding-left: 40px;
            padding-right: 40px;
          }
          .gp-authority-strip {
            padding-left: 40px !important;
            padding-right: 40px !important;
          }
        }

        @media (min-width: 1440px) {
          .premium-categories-showcase {
            padding-left: 48px;
            padding-right: 48px;
          }
          .gp-authority-strip {
            padding-left: 48px !important;
            padding-right: 48px !important;
          }
        }

        @media (max-width: 640px) {
          .premium-categories-showcase,
          .gp-authority-strip {
            position: relative;
          }
          .premium-categories-showcase::after,
          .gp-authority-strip::after {
            align-items: center;
            background: linear-gradient(90deg, rgba(247,247,245,0), rgba(247,247,245,0.62) 78%, rgba(247,247,245,0.96));
            color: rgba(31,27,22,0.58);
            content: '›';
            display: flex;
            font: 950 1.18rem/1 'Inter', sans-serif;
            justify-content: flex-end;
            padding-right: 5px;
            pointer-events: none;
            position: absolute;
            right: 0;
            width: 24px;
            z-index: 8;
          }
          .gp-authority-strip::after {
            bottom: 10px;
            top: 52px;
          }
          .premium-categories-showcase::after {
            bottom: 14px;
            top: 54px;
          }
          .premium-category-card .premium-category-image {
            filter: saturate(1.02) contrast(1.02) brightness(1.08) !important;
          }
          .premium-category-shade {
            background:
              linear-gradient(to top, rgba(8,8,8,0.64), rgba(8,8,8,0.4) 30%, rgba(8,8,8,0.12) 50%, rgba(8,8,8,0) 66%),
              linear-gradient(90deg, rgba(8,8,8,0.1), rgba(8,8,8,0)) !important;
          }
          .gp-authority-strip {
            align-items: stretch !important;
            width: 100% !important;
            max-width: none !important;
            margin: 12px auto 12px !important;
            padding: 16px 12px 0 !important;
            gap: 10px !important;
          }
          .gp-authority-copy {
            text-align: left !important;
          }
          .gp-authority-copy h2 {
            color: #1f1b16 !important;
            font-family: 'Playfair Display', Georgia, serif !important;
            font-size: clamp(0.96rem, 4.8vw, 1.23rem) !important;
            font-weight: 760 !important;
            line-height: 1.02 !important;
            letter-spacing: 0 !important;
            text-transform: none !important;
            white-space: nowrap;
          }
          .gp-authority-stats {
            display: flex !important;
            grid-template-columns: none !important;
            gap: 10px !important;
            overflow-x: auto;
            overflow-y: hidden;
            scroll-snap-type: x proximity;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
            touch-action: pan-x;
            width: 100% !important;
            max-width: none !important;
          }
          .gp-authority-stats::-webkit-scrollbar {
            display: none;
          }
          .gp-authority-stats a.gp-location-card {
            flex: 0 0 calc(50% - 5px) !important;
            min-width: calc(50% - 5px) !important;
            min-height: 0 !important;
            aspect-ratio: 1 / 0.68;
            border-radius: 12px !important;
            scroll-snap-align: start;
          }
          .gp-location-copy {
            left: 10px;
            right: 10px;
            bottom: 10px;
            gap: 3px;
          }
          .gp-authority-stats a.gp-location-card .gp-location-copy strong {
            font-size: clamp(0.6rem, 3.2vw, 0.82rem) !important;
            line-height: 1.1 !important;
            word-break: break-word;
            overflow-wrap: break-word;
          }
          .gp-authority-stats a.gp-location-card .gp-location-copy small {
            gap: 4px;
            font-size: 0.48rem !important;
            line-height: 1.1 !important;
            letter-spacing: 0.04em !important;
          }
          .gp-location-copy b {
            font-size: 0.68rem;
          }
        }

        /* Homepage title typography */
        .marketplace-container :is(h1, h2, h3, h4),
        .marketplace-container .section-title,
        .marketplace-container .property-title,
        .marketplace-container .property-title strong,
        .marketplace-container .premium-category-copy strong,
        .marketplace-container .premium-category-card .premium-category-copy strong,
        .marketplace-container .gp-location-copy strong,
        .marketplace-container .gp-authority-stats a.gp-location-card .gp-location-copy strong,
        .marketplace-container .section-end-card strong,
        .marketplace-container .social-card strong,
        .marketplace-container .media-social-card strong {
          font-family: 'Montserrat', 'Inter', sans-serif !important;
          font-weight: 400 !important;
        }
`

export default function MarketplaceHomeStyles() {
  return (
    <style
      id="marketplace-home-styles"
      dangerouslySetInnerHTML={{ __html: MARKETPLACE_HOME_CSS }}
    />
  )
}
