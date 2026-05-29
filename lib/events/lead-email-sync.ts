import { phoneCandidates } from '@/lib/whatsapp/lead-sync'

type SupabaseClientLike = any

type EventRegistrationLike = {
    id?: string | null
    event_id?: string | null
    full_name?: string | null
    email?: string | null
    phone?: string | null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEmail(value: unknown): string | null {
    const email = String(value || '').trim().toLowerCase()
    return EMAIL_RE.test(email) ? email : null
}

function buildPhoneOrFilter(candidates: string[]): string {
    const safe = candidates
        .map(candidate => candidate.replace(/[^0-9]/g, ''))
        .filter(Boolean)
    return `phone.in.(${safe.join(',')}),phone_e164.in.(${safe.join(',')})`
}

function mergeLeadMetadata(current: unknown, registration: EventRegistrationLike, now: string) {
    const base = current && typeof current === 'object' && !Array.isArray(current)
        ? current as Record<string, unknown>
        : {}

    return {
        ...base,
        email_enrichment: {
            source: 'event_registration',
            event_registration_id: registration.id || null,
            event_id: registration.event_id || null,
            matched_phone: registration.phone || null,
            enriched_at: now,
        },
    }
}

export async function syncLeadEmailFromEventRegistration(
    supabase: SupabaseClientLike,
    registration: EventRegistrationLike
) {
    const email = normalizeEmail(registration.email)
    const candidates = phoneCandidates(registration.phone)
    if (!email || candidates.length === 0) {
        return { updated: 0, skipped: true, reason: 'missing_email_or_phone' }
    }

    const { data: leads, error } = await supabase
        .from('leads')
        .select('id, name, email, phone, phone_e164, metadata')
        .or(buildPhoneOrFilter(candidates))
        .limit(10)

    if (error) {
        console.warn('[Event Lead Email Sync] lead lookup failed:', error.message)
        return { updated: 0, skipped: true, reason: error.message }
    }

    const now = new Date().toISOString()
    let updated = 0
    let conflicts = 0

    for (const lead of leads || []) {
        const currentEmail = normalizeEmail(lead.email)
        if (currentEmail && currentEmail !== email) {
            conflicts += 1
            continue
        }
        if (currentEmail === email) continue

        const updateData: Record<string, unknown> = {
            email,
            metadata: mergeLeadMetadata(lead.metadata, registration, now),
            updated_at: now,
        }

        const registrationName = String(registration.full_name || '').trim()
        if (registrationName && (!lead.name || /^whatsapp\s/i.test(String(lead.name)))) {
            updateData.name = registrationName
        }

        const { error: updateError } = await supabase
            .from('leads')
            .update(updateData)
            .eq('id', lead.id)

        if (updateError) {
            console.warn('[Event Lead Email Sync] lead update failed:', updateError.message)
            continue
        }

        updated += 1
    }

    return { updated, conflicts, skipped: false }
}
