import { Geist, Geist_Mono } from "next/font/google";
import { AppNavigation } from "@/components/app-navigation";
import { createClient } from "@/lib/supabase/server";
import { mapUser } from "@/lib/user";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Sora German Vocab",
  description: "A German vocabulary learning app",
};

export default async function RootLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = mapUser(user);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background">
        <AppNavigation profile={profile} />
        {children}
      </body>
    </html>
  );
}
