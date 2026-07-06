import Link from 'next/link'
import { ArrowRight, CheckCircle2, HelpCircle, MessageCircle, Search } from 'lucide-react'
import WhatsAppCaptureLink from '@/components/common/WhatsAppCaptureLink'
import type { AiGuidePage } from '@/lib/seo/ai-guide-pages'

export default function AiGuidePageTemplate({ guide }: { guide: AiGuidePage }) {
  return (
    <main className="ai-guide-page">
      <section className="ai-guide-page-hero">
        <img src={guide.image} alt={guide.imageAlt} className="ai-guide-page-hero-image" />
        <div className="ai-guide-page-hero-shade" />
        <div className="ai-guide-page-hero-content">
          <span>{guide.kicker}</span>
          <h1>{guide.heroTitle}</h1>
          <p>{guide.heroLead}</p>
          <div className="ai-guide-page-actions">
            <Link href={guide.primaryHref} className="ai-guide-page-primary">
              <Search size={17} />
              {guide.primaryLabel}
            </Link>
            <WhatsAppCaptureLink
              phone="5547992528080"
              message={guide.whatsappMessage}
              slug={guide.slug}
              template="ai-guide-whatsapp"
              metadata={{ guide_slug: guide.slug, tracking_event_type: 'guide_whatsapp_click' }}
              className="ai-guide-page-whatsapp"
            >
              <MessageCircle size={17} />
              Pedir curadoria
            </WhatsAppCaptureLink>
          </div>
        </div>
      </section>

      <section className="ai-guide-page-answer">
        <div>
          <span>Resposta direta</span>
          <h2>{guide.directAnswerTitle}</h2>
        </div>
        <p>{guide.directAnswer}</p>
      </section>

      <section className="ai-guide-page-cards" aria-label="Pontos principais do guia">
        {guide.cards.map(card => (
          <article key={card.title}>
            <HelpCircle size={23} />
            <h2>{card.title}</h2>
            <p>{card.text}</p>
            <Link href={card.href}>
              {card.label}
              <ArrowRight size={15} />
            </Link>
          </article>
        ))}
      </section>

      <section className="ai-guide-page-comparison">
        <div className="ai-guide-page-head">
          <span>{guide.comparisonKicker}</span>
          <h2>{guide.comparisonTitle}</h2>
        </div>
        <div className="ai-guide-page-comparison-grid">
          {guide.comparisons.map(item => (
            <article key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <strong>{item.highlight}</strong>
              <Link href={item.href}>
                Aprofundar
                <ArrowRight size={15} />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="ai-guide-page-checklist">
        <div>
          <span>Checklist de decisão</span>
          <h2>{guide.checklistTitle}</h2>
          <p>{guide.checklistIntro}</p>
        </div>
        <ol>
          {guide.checklist.map(item => (
            <li key={item}>
              <CheckCircle2 size={18} />
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="ai-guide-page-related">
        <div className="ai-guide-page-head">
          <span>Próximas leituras</span>
          <h2>Continue por intenção de busca.</h2>
        </div>
        <div className="ai-guide-page-related-links">
          {guide.related.map(item => (
            <Link href={item.href} key={item.href}>
              {item.label}
              <ArrowRight size={15} />
            </Link>
          ))}
        </div>
      </section>

      <section className="ai-guide-page-faq">
        <div className="ai-guide-page-head">
          <span>Perguntas frequentes</span>
          <h2>Respostas rápidas para compradores.</h2>
        </div>
        <div className="ai-guide-page-faq-list">
          {guide.faq.map(item => (
            <article key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <style>{`
        .ai-guide-page {
          background: #f8f4ed;
          color: #17130f;
        }
        .ai-guide-page-hero {
          align-items: end;
          background: #17130f;
          color: #fff8ea;
          display: grid;
          min-height: min(760px, 86vh);
          overflow: hidden;
          padding: 150px 7vw 72px;
          position: relative;
        }
        .ai-guide-page-hero-image {
          height: 100%;
          inset: 0;
          object-fit: cover;
          position: absolute;
          width: 100%;
          z-index: 0;
        }
        .ai-guide-page-hero-shade {
          background: linear-gradient(90deg, rgba(12,10,8,.94) 0%, rgba(12,10,8,.74) 42%, rgba(12,10,8,.28) 100%),
            linear-gradient(0deg, rgba(12,10,8,.72), rgba(12,10,8,.18));
          inset: 0;
          position: absolute;
          z-index: 1;
        }
        .ai-guide-page-hero-content {
          max-width: 1020px;
          position: relative;
          z-index: 2;
        }
        .ai-guide-page-hero-content > span,
        .ai-guide-page-answer span,
        .ai-guide-page-head span,
        .ai-guide-page-checklist span:first-child {
          color: #d8b979;
          display: inline-flex;
          font-size: .72rem;
          font-weight: 950;
          letter-spacing: .16em;
          text-transform: uppercase;
        }
        .ai-guide-page-hero h1,
        .ai-guide-page-answer h2,
        .ai-guide-page-head h2,
        .ai-guide-page-checklist h2 {
          font-family: var(--font-serif);
          letter-spacing: 0;
          margin: 0;
        }
        .ai-guide-page-hero h1 {
          font-size: clamp(3.2rem, 8vw, 7.8rem);
          line-height: .88;
          margin-top: 14px;
          max-width: 940px;
        }
        .ai-guide-page-hero p {
          color: rgba(255,255,255,.78);
          font-size: clamp(1rem, 1.55vw, 1.24rem);
          line-height: 1.72;
          max-width: 760px;
        }
        .ai-guide-page-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 28px;
        }
        .ai-guide-page-primary,
        .ai-guide-page-whatsapp {
          align-items: center;
          border-radius: 999px;
          display: inline-flex;
          font-size: .76rem;
          font-weight: 950;
          gap: 8px;
          justify-content: center;
          min-height: 48px;
          padding: 0 18px;
          text-decoration: none;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .ai-guide-page-primary {
          background: #d8b979;
          color: #17130f;
        }
        .ai-guide-page-whatsapp {
          background: #087a3d;
          color: #fff !important;
        }
        .ai-guide-page-answer {
          align-items: end;
          background: #fffdf8;
          display: grid;
          gap: 38px;
          grid-template-columns: minmax(280px, 650px) minmax(0, 1fr);
          padding: 72px 7vw;
        }
        .ai-guide-page-answer h2,
        .ai-guide-page-head h2,
        .ai-guide-page-checklist h2 {
          color: #211b15;
          font-size: clamp(2.1rem, 4vw, 4.4rem);
          line-height: .98;
          margin-top: 10px;
        }
        .ai-guide-page-answer p,
        .ai-guide-page-checklist p {
          color: #5d5147;
          font-size: 1.03rem;
          line-height: 1.76;
          margin: 0;
        }
        .ai-guide-page-cards {
          display: grid;
          gap: 18px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          padding: 44px 7vw 72px;
        }
        .ai-guide-page-cards article,
        .ai-guide-page-comparison-grid article,
        .ai-guide-page-faq-list article {
          background: #fff;
          border: 1px solid rgba(184,132,62,.18);
          border-radius: 12px;
          box-shadow: 0 18px 42px rgba(63,45,23,.06);
          padding: 26px;
        }
        .ai-guide-page-cards svg,
        .ai-guide-page-checklist li svg {
          color: #a87939;
          flex: 0 0 auto;
        }
        .ai-guide-page-cards h2,
        .ai-guide-page-comparison-grid h3,
        .ai-guide-page-faq-list h3 {
          color: #211b15;
          font-family: var(--font-serif);
          font-size: 1.55rem;
          line-height: 1.08;
          margin: 18px 0 12px;
        }
        .ai-guide-page-cards p,
        .ai-guide-page-comparison-grid p,
        .ai-guide-page-faq-list p {
          color: #5d5147;
          line-height: 1.7;
          margin: 0 0 18px;
        }
        .ai-guide-page-cards a,
        .ai-guide-page-comparison-grid a,
        .ai-guide-page-related-links a {
          align-items: center;
          color: #8f642e;
          display: inline-flex;
          font-size: .75rem;
          font-weight: 950;
          gap: 6px;
          letter-spacing: .08em;
          text-decoration: none;
          text-transform: uppercase;
        }
        .ai-guide-page-comparison {
          background: #17130f;
          color: #fff8ea;
          padding: 72px 7vw;
        }
        .ai-guide-page-comparison .ai-guide-page-head h2 {
          color: #fff8ea;
          max-width: 820px;
        }
        .ai-guide-page-comparison-grid {
          display: grid;
          gap: 18px;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: 34px;
        }
        .ai-guide-page-comparison-grid article {
          background: rgba(255,255,255,.055);
          border-color: rgba(255,255,255,.12);
          box-shadow: none;
        }
        .ai-guide-page-comparison-grid h3 {
          color: #fff8ea;
        }
        .ai-guide-page-comparison-grid p {
          color: rgba(255,255,255,.66);
        }
        .ai-guide-page-comparison-grid strong {
          color: #e4c58a;
          display: block;
          font-size: .9rem;
          line-height: 1.55;
          margin: 0 0 18px;
        }
        .ai-guide-page-comparison-grid a {
          color: #e4c58a;
        }
        .ai-guide-page-checklist {
          align-items: start;
          display: grid;
          gap: 40px;
          grid-template-columns: minmax(280px, 540px) minmax(0, 1fr);
          padding: 72px 7vw;
        }
        .ai-guide-page-checklist ol {
          display: grid;
          gap: 12px;
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .ai-guide-page-checklist li {
          align-items: start;
          background: #fff;
          border: 1px solid rgba(184,132,62,.18);
          border-radius: 12px;
          display: flex;
          gap: 12px;
          padding: 16px;
        }
        .ai-guide-page-checklist li span {
          color: #352d25;
          font-size: .95rem;
          line-height: 1.55;
        }
        .ai-guide-page-related,
        .ai-guide-page-faq {
          background: #fffdf8;
          padding: 64px 7vw 74px;
        }
        .ai-guide-page-related-links {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: 28px;
        }
        .ai-guide-page-related-links a {
          background: #f6efe3;
          border: 1px solid rgba(184,132,62,.18);
          border-radius: 12px;
          color: #211b15;
          justify-content: space-between;
          min-height: 64px;
          padding: 14px;
        }
        .ai-guide-page-faq {
          background: #f8f4ed;
          padding-top: 18px;
        }
        .ai-guide-page-faq-list {
          display: grid;
          gap: 14px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin-top: 28px;
        }
        .ai-guide-page-faq-list h3 {
          font-size: 1.25rem;
          margin-top: 0;
        }
        .ai-guide-page-faq-list p {
          margin-bottom: 0;
        }
        @media (max-width: 1100px) {
          .ai-guide-page-answer,
          .ai-guide-page-checklist,
          .ai-guide-page-cards,
          .ai-guide-page-comparison-grid,
          .ai-guide-page-related-links,
          .ai-guide-page-faq-list {
            grid-template-columns: 1fr;
          }
          .ai-guide-page-hero {
            min-height: 720px;
            padding-top: 118px;
          }
        }
        @media (max-width: 680px) {
          .ai-guide-page-hero {
            min-height: 660px;
            padding: 104px 20px 46px;
          }
          .ai-guide-page-hero h1 {
            font-size: clamp(2.7rem, 13vw, 4.6rem);
          }
          .ai-guide-page-actions {
            display: grid;
          }
          .ai-guide-page-primary,
          .ai-guide-page-whatsapp {
            width: 100%;
          }
          .ai-guide-page-answer,
          .ai-guide-page-cards,
          .ai-guide-page-comparison,
          .ai-guide-page-checklist,
          .ai-guide-page-related,
          .ai-guide-page-faq {
            padding-left: 20px;
            padding-right: 20px;
          }
        }
      `}</style>
    </main>
  )
}
