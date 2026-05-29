import type { Metadata } from 'next'
import Link from 'next/link'
import PrivacyControls from '@/components/tracking/PrivacyControls'

export const metadata: Metadata = {
  title: 'Politica de Privacidade | Guilherme Pilger',
  description: 'Politica de privacidade do site guilhermepilger.ai e do app Pilger CRM Ads.',
}

const sections = [
  {
    title: '1. Quem somos',
    body: [
      'Esta politica explica como o site guilhermepilger.ai e o app Pilger CRM Ads tratam dados pessoais, dados de atendimento, informacoes de leads, metricas de trafego organico e pago, dados de integracoes com Meta, Instagram, Facebook, WhatsApp e demais ferramentas conectadas ao nosso painel.',
      'O sistema e operado para apoiar a curadoria imobiliaria, o atendimento comercial, a gestao de campanhas, publicacoes, relatorios e agentes de inteligencia artificial do ecossistema Guilherme Pilger.',
    ],
  },
  {
    title: '2. Dados que podemos coletar',
    body: [
      'Podemos coletar dados fornecidos diretamente pelo usuario, como nome, telefone, e-mail, interesse de compra, mensagens enviadas, comentarios, preferencias de imoveis e historico de atendimento.',
      'Tambem podemos tratar dados tecnicos e operacionais, como IP, dispositivo, paginas acessadas, origem do lead, interacoes com anuncios, metricas de campanhas, informacoes de paginas do Facebook, contas profissionais do Instagram, mensagens, comentarios e permissoes autorizadas pelo proprio usuario ou pela empresa administradora das contas.',
    ],
  },
  {
    title: '3. Como usamos os dados',
    body: [
      'Usamos os dados para responder contatos, qualificar leads, sugerir imoveis, organizar atendimentos, gerar relatorios de marketing, analisar desempenho de conteudos, publicar materiais autorizados, melhorar campanhas e apoiar agentes de IA em tarefas comerciais e operacionais.',
      'Nao vendemos dados pessoais. O uso das informacoes e limitado as finalidades do negocio, atendimento, marketing, seguranca, auditoria e melhoria da plataforma.',
    ],
  },
  {
    title: '4. Integracoes com Meta, Instagram e Facebook',
    body: [
      'Quando uma conta Meta, Facebook ou Instagram e conectada ao sistema, o app pode acessar apenas as permissoes autorizadas no fluxo de login, como paginas vinculadas, metricas, comentarios, mensagens, conteudos publicados e dados necessarios para publicacao, moderacao e atendimento.',
      'O acesso pode ser revogado a qualquer momento nas configuracoes da conta Meta ou solicitando a remocao pelo canal de contato informado nesta politica.',
    ],
  },
  {
    title: '5. Agentes de IA e automacoes',
    body: [
      'O sistema pode usar agentes de IA para analisar campanhas, sugerir respostas, organizar mensagens, gerar relatorios e apoiar a criacao de conteudos. As respostas automaticas podem exigir revisao humana, conforme configuracao interna.',
      'Credenciais, tokens e chaves de acesso sao tratados como informacoes sensiveis e devem ser armazenados apenas em areas administrativas protegidas.',
    ],
  },
  {
    title: '6. Compartilhamento com terceiros',
    body: [
      'Podemos compartilhar dados com provedores necessarios para a operacao da plataforma, como hospedagem, banco de dados, APIs de comunicacao, Meta, Google, WhatsApp, ferramentas de inteligencia artificial e servicos de armazenamento.',
      'Esses provedores sao usados somente para viabilizar as funcionalidades do sistema, atendimento, seguranca, analise e execucao das operacoes contratadas.',
    ],
  },
  {
    title: '7. Retencao e exclusao de dados',
    body: [
      'Mantemos dados pelo tempo necessario para atendimento, historico comercial, obrigacoes legais, auditoria, seguranca e melhoria da operacao.',
      'Solicitacoes de exclusao podem ser enviadas para o e-mail de contato. Para integracoes Meta, a URL tecnica de exclusao de dados e https://guilhermepilger.ai/api/auth/meta/facebook/data-deletion.',
    ],
  },
  {
    title: '8. Seguranca',
    body: [
      'Adotamos medidas tecnicas e administrativas para proteger dados contra acesso nao autorizado, perda, uso indevido, alteracao e divulgacao indevida.',
      'Apesar dos esforcos de seguranca, nenhum sistema conectado a internet e absolutamente imune a riscos.',
    ],
  },
  {
    title: '9. Direitos do titular',
    body: [
      'O titular pode solicitar confirmacao de tratamento, acesso, correcao, exclusao, portabilidade, informacoes sobre compartilhamento e revogacao de consentimento, quando aplicavel.',
      'As solicitacoes serao avaliadas conforme a legislacao aplicavel e as obrigacoes legitimas do negocio.',
    ],
  },
  {
    title: '10. Contato',
    body: [
      'Para duvidas, solicitacoes de privacidade ou pedidos de exclusao de dados, entre em contato pelo e-mail dias.eliane@outlook.com.',
      'Esta politica pode ser atualizada periodicamente para refletir mudancas no sistema, nas integracoes ou em exigencias legais.',
    ],
  },
]

export default function PrivacyPolicyPage() {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <Link href="/" className="legal-back">Guilherme Pilger</Link>
        <p className="legal-kicker">Pilger CRM Ads</p>
        <h1>Politica de Privacidade</h1>
        <p className="legal-lead">
          Esta pagina descreve como coletamos, usamos, protegemos e tratamos dados pessoais no site, no painel administrativo e nas integracoes conectadas ao ecossistema Pilger.
        </p>
        <p className="legal-date">Ultima atualizacao: 14 de maio de 2026</p>
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
