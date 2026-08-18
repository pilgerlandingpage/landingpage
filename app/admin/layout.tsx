import AdminSidebar from '@/components/admin/AdminSidebar'
import AdminAssistant from '@/components/admin/AdminAssistant'
import AdminLayoutWrapper from '@/components/admin/AdminLayoutWrapper'
import UserAccessTracker from '@/components/admin/UserAccessTracker'

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
            <UserAccessTracker />
        </AdminLayoutWrapper>
    )
}
