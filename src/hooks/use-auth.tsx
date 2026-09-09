import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient, useConvexAuth, useQuery } from "convex/react";
import { createContext, useContext, useState, useMemo, type ReactNode } from "react";

export interface AuthUser {
  _id?: string;
  name?: string;
  email?: string;
  image?: string;
}

export interface AuthContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null | undefined;
  signIn: (provider: string, formData?: FormData) => Promise<unknown>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const LOCAL_STORAGE_KEY = "menuflow_mock_user";

function ConvexAuthConsumer({ children }: { children: ReactNode }) {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser);
  const { signIn, signOut } = useAuthActions();
  const isLoading = isAuthLoading || (isAuthenticated && user === undefined);

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isAuthenticated,
        user: user as AuthUser | null | undefined,
        signIn: signIn as (provider: string, formData?: FormData) => Promise<unknown>,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function LocalAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
      return {
        _id: "demo-operator",
        name: "Restaurant Operator",
        email: "demo@menuflow.pos",
      };
    } catch {
      return {
        _id: "demo-operator",
        name: "Restaurant Operator",
        email: "demo@menuflow.pos",
      };
    }
  });

  const signIn = async (provider: string, formData?: FormData): Promise<unknown> => {
    if (provider === "anonymous") {
      const guestUser: AuthUser = {
        _id: `guest-${Date.now()}`,
        name: "Guest Operator",
        email: "guest@menuflow.pos",
      };
      setUser(guestUser);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(guestUser));
      return { ok: true };
    }

    if (provider === "email-otp") {
      const email = (formData?.get("email") as string) || "operator@menuflow.pos";
      const code = formData?.get("code") as string;
      if (code) {
        const emailUser: AuthUser = {
          _id: `user-${Date.now()}`,
          name: email.split("@")[0] || "Operator",
          email,
        };
        setUser(emailUser);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(emailUser));
        return { ok: true };
      }
      return { ok: true };
    }
    return { ok: true };
  };

  const signOut = async () => {
    setUser(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        isLoading: false,
        isAuthenticated: Boolean(user),
        user,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AppAuthProvider({ children }: { children: ReactNode }) {
  const convexUrl = import.meta.env.VITE_CONVEX_URL;
  const convexClient = useMemo(() => {
    if (convexUrl && typeof convexUrl === "string" && convexUrl.trim().length > 0) {
      try {
        return new ConvexReactClient(convexUrl);
      } catch {
        return null;
      }
    }
    return null;
  }, [convexUrl]);

  if (convexClient) {
    return (
      <ConvexAuthProvider client={convexClient}>
        <ConvexAuthConsumer>{children}</ConvexAuthConsumer>
      </ConvexAuthProvider>
    );
  }

  return <LocalAuthProvider>{children}</LocalAuthProvider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AppAuthProvider");
  }
  return context;
}
