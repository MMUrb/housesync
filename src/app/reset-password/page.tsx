import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { HomeLogoLink } from "@/components/HomeLogoLink";

export const metadata = { title: "Set new password" };

export default function ResetPasswordPage() {
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <HomeLogoLink className="mx-auto" logoClassName="text-xl" />
      <h1 className="mt-8 text-center text-2xl font-bold text-slate-900">Set a new password</h1>
      <p className="mt-1.5 text-center text-sm text-slate-600">Choose a new password for your account.</p>
      <ResetPasswordForm />
    </main>
  );
}
