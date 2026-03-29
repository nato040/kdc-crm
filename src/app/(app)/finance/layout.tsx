import { Sidebar } from "@/components/sidebar";

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-56 flex-1 px-8 py-6 lg:px-12 lg:py-8">
        {children}
      </main>
    </div>
  );
}
