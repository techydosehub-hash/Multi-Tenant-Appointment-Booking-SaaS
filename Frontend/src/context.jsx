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
    [demo, setDemo] = useState(null),
    [guest, setGuest] = useState(false),
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
      setDemo(data.demo);
      setGuest(data.guest);
      setMemberships(data.memberships);
      setBusinessId((current) =>
        data.demo?.active ? data.demo.business_id : data.memberships.some((m) => m.business_id === current)
          ? current
          : data.memberships[0]?.business_id || "",
      );
      return true;
    } catch (e) {
      setError(e.message);
      return false;
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
        setDemo(null);
        setGuest(false);
        setBusinessId("");
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
        demo,
        guest,
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
