import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { logout } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { mapUser } from "@/lib/user";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = mapUser(user);

  const initial = profile?.name?.charAt(0)?.toUpperCase() ?? "?";
  const details = [
    ["Nama", profile?.name],
    ["Email", profile?.email],
    ["Metode login", profile?.provider === "google" ? "Google" : "Email & password"],
  ];

  return (
    <main className="min-h-svh bg-muted px-6 pb-32 pt-16">
      <section className="mx-auto max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
          Profil
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight">Detail akun</h1>

        <div className="mt-8 rounded-[2rem] border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-4">
            {profile?.avatar ? (
              <img
                src={profile.avatar}
                alt=""
                className="size-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-full bg-primary/15 text-2xl font-bold text-primary">
                {initial}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-xl font-semibold tracking-tight">
                {profile?.name}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {profile?.email}
              </p>
            </div>
          </div>

          <dl className="mt-6 divide-y border-t">
            {details.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 py-3"
              >
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="truncate text-sm font-medium">{value || "-"}</dd>
              </div>
            ))}
          </dl>

          <form action={logout} className="mt-6">
            <Button type="submit" variant="outline" className="w-full">
              <LogOut className="size-4" />
              Keluar
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
