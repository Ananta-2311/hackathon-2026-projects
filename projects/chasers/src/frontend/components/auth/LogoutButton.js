"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

export default function LogoutButton({ className = "" }) {
  const router = useRouter();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <button type="button" onClick={handleLogout} className={className}>
      Logout
    </button>
  );
}
