import { Logo } from "@/components/Logo";

/**
 * Shown when the Supabase environment variables are missing, so the app gives
 * clear setup instructions instead of a runtime error.
 */
export function NotConfigured() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-12">
      <Logo className="text-xl" />
      <div className="card mt-6 p-6">
        <h1 className="text-lg font-bold text-slate-900">Almost there: connect Supabase</h1>
        <p className="mt-2 text-sm text-slate-600">
          HouseSync needs a Supabase project to store your house, expenses and chores. It only
          takes a few minutes:
        </p>
        <ol className="mt-4 space-y-3 text-sm text-slate-700">
          <li className="flex gap-3">
            <span className="chip bg-brand-100 text-brand-700">1</span>
            <span>
              Create a free project at{" "}
              <a className="font-medium text-brand-700 underline" href="https://supabase.com" target="_blank" rel="noreferrer">
                supabase.com
              </a>
              .
            </span>
          </li>
          <li className="flex gap-3">
            <span className="chip bg-brand-100 text-brand-700">2</span>
            <span>
              Open <span className="font-mono text-xs">supabase/schema.sql</span> from this project,
              paste it into the Supabase <span className="font-medium">SQL Editor</span> and run it.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="chip bg-brand-100 text-brand-700">3</span>
            <span>
              Copy <span className="font-mono text-xs">.env.local.example</span> to{" "}
              <span className="font-mono text-xs">.env.local</span> and paste your{" "}
              <span className="font-medium">Project URL</span> and{" "}
              <span className="font-medium">anon key</span> (Project Settings → API).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="chip bg-brand-100 text-brand-700">4</span>
            <span>
              Restart the dev server: <span className="font-mono text-xs">npm run dev</span>.
            </span>
          </li>
        </ol>
        <p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
          Full step-by-step instructions are in <span className="font-mono">README.md</span>.
        </p>
      </div>
    </main>
  );
}
