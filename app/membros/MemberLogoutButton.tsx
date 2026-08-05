'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function MemberLogoutButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogout() {
    if (loading) return

    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/membros/entrar?next=/membros')
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        className="members-logout-link"
        onClick={handleLogout}
        disabled={loading}
        aria-label="Sair da area de membros"
      >
        {loading ? <Loader2 className="animate-spin" size={14} /> : <LogOut size={14} />}
        <span>Sair</span>
      </button>
      <style jsx>{`
        .members-logout-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-height: 32px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 7px;
          padding: 0 11px;
          color: rgba(255, 255, 255, 0.78);
          background: rgba(255, 255, 255, 0.04);
          font: inherit;
          font-size: 0.68rem;
          font-weight: 950;
          text-transform: uppercase;
          cursor: pointer;
        }

        .members-logout-link:hover {
          color: #e8b049;
          border-color: rgba(232, 176, 73, 0.42);
        }

        .members-logout-link:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        @media (max-width: 820px) {
          .members-logout-link {
            width: 34px;
            padding: 0;
          }

          .members-logout-link span {
            position: absolute;
            width: 1px;
            height: 1px;
            overflow: hidden;
            clip: rect(0 0 0 0);
            white-space: nowrap;
          }
        }
      `}</style>
    </>
  )
}
