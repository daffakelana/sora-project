"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export async function login(_prevState, formData) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (!email || !password) {
    return { error: "Email dan password wajib diisi." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(_prevState, formData) {
  const name = formData.get("name");
  const email = formData.get("email");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirm-password");

  if (!email || !password) {
    return { error: "Email dan password wajib diisi." };
  }
  if (password.length < 8) {
    return { error: "Password minimal 8 karakter." };
  }
  if (confirmPassword && password !== confirmPassword) {
    return { error: "Konfirmasi password tidak cocok." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: name || "" },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Jika konfirmasi email diaktifkan di Supabase, session belum dibuat.
  if (!data.session) {
    return {
      message:
        "Akun dibuat. Cek email kamu untuk konfirmasi sebelum login.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
