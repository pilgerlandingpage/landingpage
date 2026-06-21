import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Termos de Serviço | Guilherme Pilger',
  description: 'Termos de serviço do site guilhermepilger.ai e do app Pilger CRM Ads.',
}

const sections = [
  {
    title: '1. Aceite dos termos',
    body: [
      'Ao acessar o site guilhermepilger.ai, usar o painel administrativo, conectar contas de terceiros ou utilizar o app Pilger CRM Ads, o usuário concorda com estes Termos de Serviço.',
      'Caso não concorde com estes termos, o usuário deve interromper o uso da plataforma e não conectar contas externas.',
    ],
  },
  {
    title: '2. Finalidade da plataforma',
    body: [
      'A plataforma apoia atividades de curadoria imobiliária, captação de leads, atendimento, organização comercial, análise de marketing, publicação de conteúdos, relatórios e automações com agentes de inteligência artificial.',
      'O sistema pode integrar Meta, Facebook, Instagram, WhatsApp, Google, ferramentas de IA, banco de dados e serviços de armazenamento para executar suas funcionalidades.',
    ],
  },
  {
    title: '3. Responsabilidades do usuário',
    body: [
      'O usuário deve fornecer informações corretas, manter credenciais seguras, conectar apenas contas que possui ou está autorizado a administrar e respeitar as políticas das plataformas integradas.',
      'O usuário é responsável por revisar conteúdos, mensagens, campanhas, respostas automatizadas e publicações antes de ativá-las em modo automático, quando aplicável.',
    ],
  },
  {
    title: '4. Uso de integrações externas',
    body: [
      'Ao conectar contas Meta, Facebook, Instagram ou outras plataformas, o usuário autoriza o sistema a acessar e processar dados conforme as permissões concedidas no fluxo de autenticação.',
      'A disponibilidade de recursos depende das APIs de terceiros, permissões aprovadas, políticas de uso, limites técnicos e estabilidade dos provedores.',
    ],
  },
  {
    title: '5. Agentes de inteligência artificial',
    body: [
      'Os agentes de IA podem gerar análises, sugestões, respostas, relatórios, ideias de conteúdo e apoio operacional. Esses resultados devem ser tratados como apoio à decisão, não como garantia de resultado comercial.',
      'Sempre que o uso envolver comunicação com clientes, campanhas pagas ou publicações externas, recomenda-se revisão humana antes da execução automática.',
    ],
  },
  {
    title: '6. Conteúdos, campanhas e publicações',
    body: [
      'O usuário declara possuir autorização para usar imagens, vídeos, textos, marcas, dados de imóveis, informações comerciais e materiais enviados para a plataforma.',
      'A plataforma pode armazenar criativos, programar postagens, organizar campanhas e registrar histórico de execução para auditoria e melhoria da operação.',
    ],
  },
  {
    title: '7. Limites de responsabilidade',
    body: [
      'A plataforma é fornecida para apoio operacional e pode sofrer indisponibilidades, limitações de API, falhas de terceiros, manutenções ou alterações de regras impostas por plataformas externas.',
      'Não garantimos resultados específicos em vendas, alcance, leads, campanhas, engajamento ou desempenho comercial.',
    ],
  },
  {
    title: '8. Privacidade e proteção de dados',
    body: [
      'O tratamento de dados pessoais segue a Política de Privacidade disponível em https://guilhermepilger.ai/politica-de-privacidade.',
      'Solicitações relacionadas a dados pessoais podem ser enviadas para dias.eliane@outlook.com.',
    ],
  },
  {
    title: '9. Suspensão e encerramento',
    body: [
      'Podemos suspender acessos, automações ou integrações em caso de uso indevido, risco de segurança, descumprimento de políticas de terceiros ou necessidade de proteção da operação.',
      'O usuário pode solicitar a desconexão de contas integradas e a exclusão de dados conforme a Política de Privacidade.',
    ],
  },
  {
    title: '10. Alterações dos termos',
    body: [
      'Estes termos podem ser atualizados periodicamente para refletir mudanças na plataforma, nas integrações, nas funcionalidades ou em exigências legais.',
      'A continuidade de uso após atualizações representa concordância com a versão vigente dos termos.',
    ],
  },
]

export default function TermsOfServicePage() {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <Link href="/" className="legal-back">Guilherme Pilger</Link>
        <p className="legal-kicker">Pilger CRM Ads</p>
        <h1>Termos de Serviço</h1>
        <p className="legal-lead">
          Estes termos regulam o uso do site, do painel administrativo, das integrações conectadas e dos recursos de automação e inteligência artificial do ecossistema Pilger.
        </p>
        <p className="legal-date">Última atualização: 14 de maio de 2026</p>

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
