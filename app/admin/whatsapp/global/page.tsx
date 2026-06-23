import { redirect } from 'next/navigation'

export default function WhatsAppGlobalRedirectPage() {
    redirect('/admin/pilger-ai/agentes?agent=whatsapp-global-agent&setor=Diretoria')
}
