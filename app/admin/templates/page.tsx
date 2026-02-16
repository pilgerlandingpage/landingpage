'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import TemplatesGrid from '@/components/admin/TemplatesGrid'

export default function TemplatesGallery() {
    return (
        <div className="max-w-6xl mx-auto p-8">
            <div className="admin-header mb-8">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Link href="/admin">
                        <button className="btn btn-outline" style={{ padding: '8px' }}>
                            <ArrowLeft size={20} />
                        </button>
                    </Link>
                    <div>
                        <h1>Galeria de Modelos</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                            Escolha um modelo visual para começar sua nova Landing Page.
                        </p>
                    </div>
                </div>
            </div>

            <TemplatesGrid />
        </div>
    )
}
