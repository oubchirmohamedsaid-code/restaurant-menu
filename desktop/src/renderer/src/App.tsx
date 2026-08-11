import { useEffect, useState } from "react";
import type { OgtUser } from "@shared/types";
import { BootScreen } from "./screens/BootScreen";
import { HeroScreen } from "./screens/HeroScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { DashboardScreen } from "./screens/DashboardScreen";

type View =
  | { name: "boot" }
  | { name: "hero" }
  | { name: "login" }
  | { name: "setup" }
  | { name: "app" };

export default function App() {
  const [view, setView] = useState<View>({ name: "boot" });
  const [dbError, setDbError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"setup" | "login">("login");
  const [user, setUser] = useState<OgtUser | null>(null);

  async function boot() {
    setDbError(null);
    setView({ name: "boot" });
    try {
      const status = await window.ogt.auth.status();
      setPhase(status.phase === "setup" ? "setup" : "login");
      setUser(status.user);
      setView(status.phase === "ready" && status.user ? { name: "app" } : { name: "hero" });
    } catch (err) {
      setDbError(err instanceof Error ? err.message : "تعذر الاتصال");
      setView({ name: "boot" });
    }
  }

  useEffect(() => {
    void boot();
  }, []);

  async function logout() {
    try {
      await window.ogt.auth.logout();
    } catch {
      // continue logging out locally
    }
    setUser(null);
    setView({ name: "login" });
  }

  if (view.name === "boot") return <BootScreen dbError={dbError} onRetry={() => void boot()} />;
  if (view.name === "hero") {
    return (
      <HeroScreen
        phase={phase}
        onPrimary={() => setView(phase === "setup" ? { name: "setup" } : { name: "login" })}
      />
    );
  }
  if (view.name === "setup") {
    return (
      <SetupScreen
        onDone={(u) => {
          setUser(u);
          setView({ name: "app" });
        }}
      />
    );
  }
  if (view.name === "login") {
    return (
      <LoginScreen
        onLogin={(u) => {
          setUser(u);
          setView({ name: "app" });
        }}
      />
    );
  }
  return <DashboardScreen user={user!} onLogout={() => void logout()} />;
}
