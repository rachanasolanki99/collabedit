import Link from "next/link";
import { FileText } from "lucide-react";
import { Footer } from "@/components/footer";
import { site } from "@/lib/site";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto w-full max-w-5xl px-4 py-5">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold">
          <FileText className="size-5 text-primary" />
          {site.name}
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        {children}
      </main>
      <Footer />
    </div>
  );
}
