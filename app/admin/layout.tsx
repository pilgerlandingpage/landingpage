import AdminSidebar from '@/components/admin/AdminSidebar'
import AdminAssistant from '@/components/admin/AdminAssistant'

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-content">
                {children}
            </main>
            <AdminAssistant />
        </div>
    )
}
