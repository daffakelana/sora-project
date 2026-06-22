// Ambil info profil yang rapi dari objek user Supabase.
// Untuk login Google, nama & avatar ada di user_metadata (full_name / name / picture).
export function mapUser(user) {
  if (!user) {
    return null;
  }

  const meta = user.user_metadata ?? {};
  const name =
    meta.full_name ||
    meta.name ||
    meta.display_name ||
    user.email?.split("@")[0] ||
    "Pengguna";

  return {
    id: user.id,
    name,
    email: user.email ?? "",
    avatar: meta.avatar_url || meta.picture || "",
    provider: user.app_metadata?.provider || "email",
  };
}
