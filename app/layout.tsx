import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pilger Imóveis de Luxo',
  description: 'Encontre o imóvel dos seus sonhos com atendimento exclusivo via IA',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
