import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminTopbar } from "@/components/layout/admin-topbar";
import { requireAdminPage } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminPage();
  if (!session) {
    redirect("/login?redirect=/admin");
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[18rem_1fr]">
      <AdminSidebar />
      <div className="min-w-0">
        <AdminTopbar />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
