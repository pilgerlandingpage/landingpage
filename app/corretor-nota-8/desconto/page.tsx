import type { Metadata } from 'next'
import DescontoClient from './DescontoClient'

export const metadata: Metadata = {
  title: 'Presente de agradecimento | Corretor Nota 8',
  description: 'Uma condição especial para conhecer o livro digital Corretor Nota 8 com 30% de desconto.',
  robots: {
    index: false,
    follow: true,
  },
}

export default function CorretorNota8DescontoPage() {
  return <DescontoClient />
}
