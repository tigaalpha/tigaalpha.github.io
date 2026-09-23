import { LoginCard } from "@/features/auth/components/login-card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageToggle } from "@/components/ui/language-toggle";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-primary-light/20 to-white px-4 dark:from-primary/10 dark:to-page">
      <div className="absolute right-4 top-4 flex items-center gap-1.5">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <LoginCard />
    </main>
  );
}
