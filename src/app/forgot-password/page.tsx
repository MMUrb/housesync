import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { HomeLogoLink } from "@/components/HomeLogoLink";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <HomeLogoLink className="mx-auto" logoClassName="text-xl" />
      <h1 className="mt-8 text-center text-2xl font-bold text-slate-900">Reset your password</h1>
      <p className="mt-1.5 text-center text-sm text-slate-600">
        Enter your email and we&rsquo;ll send you a link to set a new one.
      </p>
      <ForgotPasswordForm />
    </main>
  );
}
