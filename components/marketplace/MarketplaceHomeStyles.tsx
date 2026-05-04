'use client'

import { useEffect } from 'react'

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
          .mi-table { min-width: 600px; }
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
          height: 220px;
          overflow: hidden;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding-bottom: 16px;
          background: linear-gradient(180deg, #f0ede8 0%, #f7f7f5 100%);
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
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          height: 100%;
          width: auto;
          max-width: none;
          object-fit: contain;
          filter: none;
          z-index: 1;
        }
        .hero-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to top,
            rgba(247, 247, 245, 0.95) 0%,
            rgba(247, 247, 245, 0.3) 35%,
            rgba(247, 247, 245, 0) 60%
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
          color: #FFD700;
          -webkit-text-fill-color: #FFD700;
          letter-spacing: 0.12em;
          margin-bottom: 4px;
          text-shadow: 0 1px 4px rgba(0,0,0,0.5), 0 0 8px rgba(0,0,0,0.2);
        }
        .hero-title-new {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(0.85rem, 3.4vw, 2rem);
          font-weight: 700;
          margin: 0;
          line-height: 1.2;
          color: #1a1a1a;
          -webkit-text-fill-color: #1a1a1a;
          text-align: center;
          white-space: nowrap;
          text-shadow: 0 1px 6px rgba(255,255,255,0.5);
        }
        .hero-gold {
          color: #FFD700;
          -webkit-text-fill-color: #FFD700;
          text-shadow: 0 1px 4px rgba(0,0,0,0.5), 0 0 8px rgba(0,0,0,0.2);
        }
        @media (min-width: 768px) {
          .hero-content {
            padding: 0 24px;
          }
          .hero-eyebrow {
            font-size: 1rem;
            margin-bottom: 8px;
          }
          .hero-title-new {
            font-size: clamp(1.5rem, 2.5vw, 2.2rem);
          }
        }

        /* Video Background */
        .hero-video-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .hero-video-frame {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          min-width: 100%;
          min-height: 100%;
          width: 177.78vh; /* 16:9 ratio based on height */
          height: 56.25vw; /* 16:9 ratio based on width */
          pointer-events: none;
          opacity: 0.8;
          filter: grayscale(20%);
        }
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
          max-width: 2000px;
          margin: 0 auto;
          padding: 20px 24px;
        }
        .properties-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          row-gap: 20px;
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
          color: var(--text-muted, #999);
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

        /* Small phones - 1 column */
        @media (min-width: 550px) {
          .properties-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 18px;
            row-gap: 28px;
          }
          .listings-section { padding: 20px 28px; }
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
          .listings-section { padding: 24px 40px; }
          .properties-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 24px;
            row-gap: 36px;
          }
        }

        /* Large desktop - 5 columns */
        @media (min-width: 1440px) {
          .hero-strip { height: 450px; }
          .listings-section { padding: 28px 48px; }
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
`

export default function MarketplaceHomeStyles() {
  useEffect(() => {
    const id = 'marketplace-home-styles'
    if (document.getElementById(id)) return

    const style = document.createElement('style')
    style.id = id
    style.textContent = MARKETPLACE_HOME_CSS
    document.head.appendChild(style)

    return () => {
      style.remove()
    }
  }, [])

  return null
}
