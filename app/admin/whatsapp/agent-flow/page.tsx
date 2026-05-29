import { redirect } from 'next/navigation'

export default function AgentFlowRedirectPage() {
    redirect('/admin/pilger-ai/agentes?tipo=corretores')
}
