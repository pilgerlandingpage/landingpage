import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Termos de Servico | Guilherme Pilger',
  description: 'Termos de servico do site guilhermepilger.ai e do app Pilger CRM Ads.',
}

const sections = [
  {
    title: '1. Aceite dos termos',
    body: [
      'Ao acessar o site guilhermepilger.ai, usar o painel administrativo, conectar contas de terceiros ou utilizar o app Pilger CRM Ads, o usuario concorda com estes Termos de Servico.',
      'Caso nao concorde com estes termos, o usuario deve interromper o uso da plataforma e nao conectar contas externas.',
    ],
  },
  {
    title: '2. Finalidade da plataforma',
    body: [
      'A plataforma apoia atividades de curadoria imobiliaria, captacao de leads, atendimento, organizacao comercial, analise de marketing, publicacao de conteudos, relatorios e automacoes com agentes de inteligencia artificial.',
      'O sistema pode integrar Meta, Facebook, Instagram, WhatsApp, Google, ferramentas de IA, banco de dados e servicos de armazenamento para executar suas funcionalidades.',
    ],
  },
  {
    title: '3. Responsabilidades do usuario',
    body: [
      'O usuario deve fornecer informacoes corretas, manter credenciais seguras, conectar apenas contas que possui ou esta autorizado a administrar e respeitar as politicas das plataformas integradas.',
      'O usuario e responsavel por revisar conteudos, mensagens, campanhas, respostas automatizadas e publicacoes antes de ativa-las em modo automatico, quando aplicavel.',
    ],
  },
  {
    title: '4. Uso de integracoes externas',
    body: [
      'Ao conectar contas Meta, Facebook, Instagram ou outras plataformas, o usuario autoriza o sistema a acessar e processar dados conforme as permissoes concedidas no fluxo de autenticacao.',
      'A disponibilidade de recursos depende das APIs de terceiros, permissoes aprovadas, politicas de uso, limites tecnicos e estabilidade dos provedores.',
    ],
  },
  {
    title: '5. Agentes de inteligencia artificial',
    body: [
      'Os agentes de IA podem gerar analises, sugestoes, respostas, relatorios, ideias de conteudo e apoio operacional. Esses resultados devem ser tratados como apoio a decisao, nao como garantia de resultado comercial.',
      'Sempre que o uso envolver comunicacao com clientes, campanhas pagas ou publicacoes externas, recomenda-se revisao humana antes da execucao automatica.',
    ],
  },
  {
    title: '6. Conteudos, campanhas e publicacoes',
    body: [
      'O usuario declara possuir autorizacao para usar imagens, videos, textos, marcas, dados de imoveis, informacoes comerciais e materiais enviados para a plataforma.',
      'A plataforma pode armazenar criativos, programar postagens, organizar campanhas e registrar historico de execucao para auditoria e melhoria da operacao.',
    ],
  },
  {
    title: '7. Limites de responsabilidade',
    body: [
      'A plataforma e fornecida para apoio operacional e pode sofrer indisponibilidades, limitacoes de API, falhas de terceiros, manutencoes ou alteracoes de regras impostas por plataformas externas.',
      'Nao garantimos resultados especificos em vendas, alcance, leads, campanhas, engajamento ou desempenho comercial.',
    ],
  },
  {
    title: '8. Privacidade e protecao de dados',
    body: [
      'O tratamento de dados pessoais segue a Politica de Privacidade disponivel em https://guilhermepilger.ai/politica-de-privacidade.',
      'Solicitacoes relacionadas a dados pessoais podem ser enviadas para dias.eliane@outlook.com.',
    ],
  },
  {
    title: '9. Suspensao e encerramento',
    body: [
      'Podemos suspender acessos, automacoes ou integracoes em caso de uso indevido, risco de seguranca, descumprimento de politicas de terceiros ou necessidade de protecao da operacao.',
      'O usuario pode solicitar a desconexao de contas integradas e a exclusao de dados conforme a Politica de Privacidade.',
    ],
  },
  {
    title: '10. Alteracoes dos termos',
    body: [
      'Estes termos podem ser atualizados periodicamente para refletir mudancas na plataforma, nas integracoes, nas funcionalidades ou em exigencias legais.',
      'A continuidade de uso apos atualizacoes representa concordancia com a versao vigente dos termos.',
    ],
  },
]

export default function TermsOfServicePage() {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <Link href="/" className="legal-back">Guilherme Pilger</Link>
        <p className="legal-kicker">Pilger CRM Ads</p>
        <h1>Termos de Servico</h1>
        <p className="legal-lead">
          Estes termos regulam o uso do site, do painel administrativo, das integracoes conectadas e dos recursos de automacao e inteligencia artificial do ecossistema Pilger.
        </p>
        <p className="legal-date">Ultima atualizacao: 14 de maio de 2026</p>

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
