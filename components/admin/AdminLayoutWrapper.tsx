'use client'

import React from 'react'
import UserAccessTracker from './UserAccessTracker'

export default function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
    return (
        <div className="admin-wrapper">
            <UserAccessTracker />
            {children}
        </div>
    )
}
