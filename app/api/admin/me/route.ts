import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET - Retorna dados do usuario logado + instancia WhatsApp
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()

        // 1. Verificar quem esta logado no Auth
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, message: 'Nao autorizado' }, { status: 401 })
        }

        // 2. Buscar dados em admin_users
        const { data: adminUser, error: adminError } = await supabase
            .from('admin_users')
            .select(`
                id,
                name,
                email,
                phone,
                is_master,
                shadow_agent_prompt,
                shadow_agent_enabled,
                available_from,
                available_until,
                transfer_message,
                admin_sectors (
                    sectors (id, name, color, icon)
                )
            `)
            .eq('auth_user_id', user.id)
            .single()

        if (adminError || !adminUser) {
            return NextResponse.json({ success: false, message: 'Usuario nao encontrado' }, { status: 404 })
        }

        // Mapear setores
        const sectors = (adminUser.admin_sectors || []).map((as: any) => as.sectors)
        
        // 3. Buscar instancia WhatsApp vinculada a este Admin User
        const { data: instances } = await supabase
            .from('whatsapp_instances')
            .select('*')
            .eq('admin_user_id', adminUser.id)
            .order('created_at', { ascending: false })

        return NextResponse.json({
            success: true,
            user: {
                id: adminUser.id,
                name: adminUser.name,
                email: adminUser.email,
                phone: adminUser.phone,
                is_master: adminUser.is_master,
                shadow_agent_prompt: adminUser.shadow_agent_prompt || '',
                shadow_agent_enabled: adminUser.shadow_agent_enabled || false,
                available_from: adminUser.available_from || '08:00',
                available_until: adminUser.available_until || '20:00',
                transfer_message: adminUser.transfer_message || '',
                sectors
            },
            whatsapp_instances: instances || []
        })

    } catch (err: any) {
        console.error('[Admin Me API GET]', err)
        return NextResponse.json({ success: false, message: err.message }, { status: 500 })
    }
}

// PUT - Atualiza dados do proprio usuario
export async function PUT(request: NextRequest) {
    try {
        const supabase = await createClient()
        
        // 1. Verificar quem esta logado no Auth
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, message: 'Nao autorizado' }, { status: 401 })
        }

        // 2. Buscar ID do usuario na tabela admin_users
        const { data: adminUser, error: adminError } = await supabase
            .from('admin_users')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()

        if (adminError || !adminUser) {
            return NextResponse.json({ success: false, message: 'Usuario nao encontrado' }, { status: 404 })
        }

        const body = await request.json()
        const updateData: any = { updated_at: new Date().toISOString() }

        // Campos permitidos para atualizacao (apenas o proprio usuario pode se editar)
        // Nota: is_master e email so um admin master pode alterar na pagina de usuarios
        if (body.name !== undefined) updateData.name = body.name
        if (body.phone !== undefined) updateData.phone = body.phone
        if (body.shadow_agent_prompt !== undefined) updateData.shadow_agent_prompt = body.shadow_agent_prompt
        if (body.shadow_agent_enabled !== undefined) updateData.shadow_agent_enabled = body.shadow_agent_enabled
        if (body.available_from !== undefined) updateData.available_from = body.available_from
        if (body.available_until !== undefined) updateData.available_until = body.available_until
        if (body.transfer_message !== undefined) updateData.transfer_message = body.transfer_message

        // Atualizar senha no Auth
        if (body.password && body.password.length >= 6) {
            const { error: pwdErr } = await supabase.auth.updateUser({ password: body.password })
            if (pwdErr) throw new Error(`Erro ao atualizar senha auth: ${pwdErr.message}`)
        }

        // Fazer update da tabela
        const { error: updateErr } = await supabase
            .from('admin_users')
            .update(updateData)
            .eq('id', adminUser.id)

        if (updateErr) throw new Error(updateErr.message)

        return NextResponse.json({ success: true })

    } catch (err: any) {
        console.error('[Admin Me API PUT]', err)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}

