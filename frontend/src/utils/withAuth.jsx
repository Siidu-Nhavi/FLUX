import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const withAuth = (WrappedComponent) => {
  return function AuthComponent(props) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const checkAuth = async () => {
        try {
          const { data } = await supabase.auth.getSession();
          const session = data?.session ?? null;
          const token = localStorage.getItem("flux_access_token");
          if (!session && !token) {
            navigate("/", { replace: true });
            return;
          }
          setLoading(false);
        } catch (e) {
          const token = localStorage.getItem("flux_access_token");
          if (!token) {
            navigate("/", { replace: true });
            return;
          }
          setLoading(false);
          console.error("Error checking auth status:", e);
        }
      };

      checkAuth();
    }, [navigate]);

    if (loading) {
      return <p>Loading...</p>;
    }

    return <WrappedComponent {...props} />;
  };
};

export default withAuth;
