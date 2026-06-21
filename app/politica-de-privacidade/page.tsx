import type { Metadata } from 'next'
import Link from 'next/link'
import PrivacyControls from '@/components/tracking/PrivacyControls'

export const metadata: Metadata = {
  title: 'Política de Privacidade | Guilherme Pilger',
  description: 'Política de privacidade do site guilhermepilger.ai e do app Pilger CRM Ads.',
}

const sections = [
  {
    title: '1. Quem somos',
    body: [
      'Esta política explica como o site guilhermepilger.ai e o app Pilger CRM Ads tratam dados pessoais, dados de atendimento, informações de leads, métricas de tráfego orgânico e pago, dados de integrações com Meta, Instagram, Facebook, WhatsApp e demais ferramentas conectadas ao nosso painel.',
      'O sistema é operado para apoiar a curadoria imobiliária, o atendimento comercial, a gestão de campanhas, publicações, relatórios e agentes de inteligência artificial do ecossistema Guilherme Pilger.',
    ],
  },
  {
    title: '2. Dados que podemos coletar',
    body: [
      'Podemos coletar dados fornecidos diretamente pelo usuário, como nome, telefone, e-mail, interesse de compra, mensagens enviadas, comentários, preferências de imóveis e histórico de atendimento.',
      'Também podemos tratar dados técnicos e operacionais, como IP, dispositivo, páginas acessadas, origem do lead, interações com anúncios, métricas de campanhas, informações de páginas do Facebook, contas profissionais do Instagram, mensagens, comentários e permissões autorizadas pelo próprio usuário ou pela empresa administradora das contas.',
    ],
  },
  {
    title: '3. Como usamos os dados',
    body: [
      'Usamos os dados para responder contatos, qualificar leads, sugerir imóveis, organizar atendimentos, gerar relatórios de marketing, analisar desempenho de conteúdos, publicar materiais autorizados, melhorar campanhas e apoiar agentes de IA em tarefas comerciais e operacionais.',
      'Não vendemos dados pessoais. O uso das informações é limitado às finalidades do negócio, atendimento, marketing, segurança, auditoria e melhoria da plataforma.',
    ],
  },
  {
    title: '4. Integrações com Meta, Instagram e Facebook',
    body: [
      'Quando uma conta Meta, Facebook ou Instagram é conectada ao sistema, o app pode acessar apenas as permissões autorizadas no fluxo de login, como páginas vinculadas, métricas, comentários, mensagens, conteúdos publicados e dados necessários para publicação, moderação e atendimento.',
      'O acesso pode ser revogado a qualquer momento nas configurações da conta Meta ou solicitando a remoção pelo canal de contato informado nesta política.',
    ],
  },
  {
    title: '5. Agentes de IA e automações',
    body: [
      'O sistema pode usar agentes de IA para analisar campanhas, sugerir respostas, organizar mensagens, gerar relatórios e apoiar a criação de conteúdos. As respostas automáticas podem exigir revisão humana, conforme configuração interna.',
      'Credenciais, tokens e chaves de acesso são tratados como informações sensíveis e devem ser armazenados apenas em áreas administrativas protegidas.',
    ],
  },
  {
    title: '6. Compartilhamento com terceiros',
    body: [
      'Podemos compartilhar dados com provedores necessários para a operação da plataforma, como hospedagem, banco de dados, APIs de comunicação, Meta, Google, WhatsApp, ferramentas de inteligência artificial e serviços de armazenamento.',
      'Esses provedores são usados somente para viabilizar as funcionalidades do sistema, atendimento, segurança, análise e execução das operações contratadas.',
    ],
  },
  {
    title: '7. Retenção e exclusão de dados',
    body: [
      'Mantemos dados pelo tempo necessário para atendimento, histórico comercial, obrigações legais, auditoria, segurança e melhoria da operação.',
      'Solicitações de exclusão podem ser enviadas para o e-mail de contato. Para integrações Meta, a URL técnica de exclusão de dados é https://guilhermepilger.ai/api/auth/meta/facebook/data-deletion.',
    ],
  },
  {
    title: '8. Segurança',
    body: [
      'Adotamos medidas técnicas e administrativas para proteger dados contra acesso não autorizado, perda, uso indevido, alteração e divulgação indevida.',
      'Apesar dos esforços de segurança, nenhum sistema conectado à internet é absolutamente imune a riscos.',
    ],
  },
  {
    title: '9. Direitos do titular',
    body: [
      'O titular pode solicitar confirmação de tratamento, acesso, correção, exclusão, portabilidade, informações sobre compartilhamento e revogação de consentimento, quando aplicável.',
      'As solicitações serão avaliadas conforme a legislação aplicável e as obrigações legítimas do negócio.',
    ],
  },
  {
    title: '10. Contato',
    body: [
      'Para dúvidas, solicitações de privacidade ou pedidos de exclusão de dados, entre em contato pelo e-mail dias.eliane@outlook.com.',
      'Esta política pode ser atualizada periodicamente para refletir mudanças no sistema, nas integrações ou em exigências legais.',
    ],
  },
]

export default function PrivacyPolicyPage() {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <Link href="/" className="legal-back">Guilherme Pilger</Link>
        <p className="legal-kicker">Pilger CRM Ads</p>
        <h1>Política de Privacidade</h1>
        <p className="legal-lead">
          Esta página descreve como coletamos, usamos, protegemos e tratamos dados pessoais no site, no painel administrativo e nas integrações conectadas ao ecossistema Pilger.
        </p>
        <p className="legal-date">Última atualização: 14 de maio de 2026</p>
        <PrivacyControls />

        <div className="legal-content">
          {sections.map(section => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.body.map(paragraph => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
