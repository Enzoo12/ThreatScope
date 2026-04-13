import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { auth, db, firebaseEnabled } from "./firebase";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
 
const AuthContext = createContext(null);
 
function getAdminEmailSet() {
  const raw = process.env.REACT_APP_ADMIN_EMAILS || "";
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set(parts);
}
 
export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
 
  useEffect(() => {
    if (!firebaseEnabled || !auth) {
      setLoading(false);
      return;
    }
 
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user || !db) {
        setProfile(null);
        setLoading(false);
        return;
      }
 
      try {
        const adminEmailSet = getAdminEmailSet();
        const emailLower = (user.email || "").toLowerCase();
        const shouldBeAdmin = adminEmailSet.has(emailLower);
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const existing = snap.data();
          if (shouldBeAdmin && existing?.role !== "admin") {
            const upgraded = { ...existing, role: "admin", email: existing?.email || user.email || "" };
            await setDoc(ref, upgraded, { merge: true });
            setProfile(upgraded);
          } else {
            setProfile(existing);
          }
        } else {
          const nextProfile = {
            uid: user.uid,
            email: user.email || "",
            role: shouldBeAdmin ? "admin" : "client",
            createdAt: Date.now(),
          };
          await setDoc(ref, nextProfile, { merge: true });
          setProfile(nextProfile);
        }
      } catch (e) {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });
 
    return () => unsub();
  }, []);
 
  const api = useMemo(() => {
    const role = profile?.role || "client";
    const isAdmin = role === "admin";
    const adminEmailSet = getAdminEmailSet();
 
    return {
      firebaseEnabled,
      loading,
      firebaseUser,
      profile,
      role,
      isAdmin,
      async login(email, password) {
        if (!auth) throw new Error("Firebase Auth not configured");
        await signInWithEmailAndPassword(auth, email, password);
      },
      async register(email, password) {
        if (!auth || !db) throw new Error("Firebase not configured");
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const ref = doc(db, "users", cred.user.uid);
        const emailLower = String(email || "").toLowerCase();
        const shouldBeAdmin = adminEmailSet.has(emailLower);
        const generateUserId = () => {
  return Math.floor(10000000 + Math.random() * 90000000);
};

const nextProfile = {
  uid: cred.user.uid,
  userId: generateUserId(), // e.g. 847392011
  email: email,
  role: shouldBeAdmin ? "admin" : "client",
  createdAt: Date.now(),
};
        await setDoc(ref, nextProfile, { merge: true });
        setProfile(nextProfile);
      },
      async logout() {
        if (!auth) return;
        await signOut(auth);
      },
      async deleteMyProfile() {
        if (!db || !firebaseUser) return;
        await deleteDoc(doc(db, "users", firebaseUser.uid));
      },
    };
  }, [firebaseUser, loading, profile]);
 
  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}
 
export function useAuth() {
  return useContext(AuthContext);
}
 
export function RequireAuth({ children }) {
  const authState = useAuth();
  const location = useLocation();
 
  if (!authState?.firebaseEnabled) {
    return (
      <div style={{ padding: 24 }}>
        Firebase isn’t configured. Set REACT_APP_FIREBASE_* env vars and restart the frontend.
      </div>
    );
  }
 
  if (authState.loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!authState.firebaseUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}
 
export function RequireAdmin({ children }) {
  const authState = useAuth();
  if (!authState?.firebaseEnabled) {
    return (
      <div style={{ padding: 24 }}>
        Firebase isn’t configured. Set REACT_APP_FIREBASE_* env vars and restart the frontend.
      </div>
    );
  }
  if (authState.loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!authState.firebaseUser) return <Navigate to="/login" replace />;
  if (!authState.isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}
