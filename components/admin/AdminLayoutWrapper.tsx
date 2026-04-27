'use client'

import React from 'react'

export default function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
    return (
        <div className="admin-wrapper">
            {children}
        </div>
    )
}
