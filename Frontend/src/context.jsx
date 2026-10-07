import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, supabase } from "./lib";
const Context = createContext(null);
export function AppProvider({ children }) {
  const [session, setSession] = useState(null),
    [loading, setLoading] = useState(true),
    [memberships, setMemberships] = useState([]),
    [profile, setProfile] = useState(null),
    [businessId, setBusinessId] = useState(
      localStorage.getItem("steadly_business") || "",
    ),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const refresh = useCallback(async () => {
    try {
      setError("");
      const data = await api("/me");
      setProfile(data.user);
      setMemberships(data.memberships);
      setBusinessId((current) =>
        data.memberships.some((m) => m.business_id === current)
          ? current
          : data.memberships[0]?.business_id || "",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setMemberships([]);
        setProfile(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (session?.user.id) {
      setLoading(true);
      refresh();
    }
  }, [session?.user.id, refresh]);
  useEffect(() => {
    localStorage.setItem("steadly_business", businessId);
  }, [businessId]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const membership = memberships.find((m) => m.business_id === businessId);
  const request = useCallback(
    (path, options = {}) => api(path, { ...options, businessId }),
    [businessId],
  );
  return (
    <Context.Provider
      value={{
        session,
        loading,
        memberships,
        profile,
        businessId,
        setBusinessId,
        business: membership?.businesses,
        role: membership?.role,
        refresh,
        error,
        request,
        notify: setToast,
      }}
    >
      {children}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </Context.Provider>
  );
}
export const useApp = () => useContext(Context);
