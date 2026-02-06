import { BottomNav } from "@/components/ui";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {children}
      <BottomNav />
    </div>
  );
}
