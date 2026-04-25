"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { signOut as authSignOut } from "@/lib/auth";
import { getCurrentUserProfile } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      if (!supabase) {
        if (active) setLoading(false);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      setSession(data.session ?? null);
      if (data.session) {
        try {
          const me = await getCurrentUserProfile();
          if (!active) return;
          setProfile(me.profile || null);
          setPatient(me.patient || null);
        } catch {
          setProfile(null);
          setPatient(null);
        }
      }
      setLoading(false);
    }

    hydrate();

    const { data: sub } = supabase
      ? supabase.auth.onAuthStateChange(async (_event, nextSession) => {
          setSession(nextSession ?? null);
          if (!nextSession) {
            setProfile(null);
            setPatient(null);
            return;
          }
          try {
            const me = await getCurrentUserProfile();
            setProfile(me.profile || null);
            setPatient(me.patient || null);
          } catch {
            setProfile(null);
            setPatient(null);
          }
        })
      : { data: { subscription: null } };

    return () => {
      active = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      profile,
      patient,
      loading,
      signOut: authSignOut,
    }),
    [session, profile, patient, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
