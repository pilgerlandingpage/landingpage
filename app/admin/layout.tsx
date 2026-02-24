import AdminSidebar from '@/components/admin/AdminSidebar'
import AdminAssistant from '@/components/admin/AdminAssistant'
import AdminLayoutWrapper from '@/components/admin/AdminLayoutWrapper'

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <AdminLayoutWrapper>
            <AdminSidebar />
            <main className="admin-content">
                {children}
            </main>
            <AdminAssistant />
        </AdminLayoutWrapper>
    )
}
