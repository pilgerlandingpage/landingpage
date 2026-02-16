
import { createServerSupabase, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        // 1. Verify Authentication (Must be an existing admin)
        const supabase = await createServerSupabase()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized: You must be logged in to create users.' },
                { status: 401 }
            )
        }

        // 2. Parse Request Body
        const { email, password, name, role, creci, phone } = await request.json()

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required.' },
                { status: 400 }
            )
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: 'Password must be at least 6 characters long.' },
                { status: 400 }
            )
        }

        // 3. Create User using Service Role Key
        const supabaseAdmin = createAdminClient()

        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm email since admin is creating it
            user_metadata: {
                full_name: name || '',
                role: role || 'user',
                creci: creci || null,
                phone: phone || null,
            }
        })

        if (error) {
            console.error('Error creating user:', error)
            return NextResponse.json(
                { error: error.message },
                { status: 400 }
            )
        }

        return NextResponse.json({
            message: 'User created successfully',
            user: data.user
        })

    } catch (error) {
        console.error('Unexpected error:', error)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
