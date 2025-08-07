import { useEffect } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { useAppContext } from "@/context/AppContext";
import { jwtDecode } from "jwt-decode";

const ProtectedRoutes = () => {
  const navigate = useNavigate();
  const { registrationCompleted } = useAppContext();

  const checkTokenValidity = () => {
    const token = document.cookie.split('; ').find(row => row.startsWith('auth_token='));
    if (!token) {
      return false;
    }
    const tokenValue = token.split('=')[1];
    try {
      const decoded: any = jwtDecode(tokenValue);
      const currentTime = Math.floor(Date.now() / 1000);
      if (decoded.exp < currentTime) {
        document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; Secure; HttpOnly; SameSite=Strict';
        return false;
      }
      return true;
    } catch (e) {
      document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; Secure; HttpOnly; SameSite=Strict';
      return false;
    }
  };

  useEffect(() => {
    const restrictedRoutes = [
      "/registration/details",
      "/registration/device-verification",
      "/registration/fido-seedkey",
      "/registration/signature",
    ];
    const protectedRoutes = [
      "/registration/device-verification",
      "/registration/fido-seedkey",
      "/registration/signature",
      "/login",
      "/dashboard",
    ];
    const currentPath = window.location.pathname;

    if (protectedRoutes.includes(currentPath)) {
      for (let i = 0; i < 10; i++) {
        window.history.pushState({}, "", window.location.href);
      }
    }

    if (registrationCompleted && restrictedRoutes.includes(currentPath)) {
      navigate(checkTokenValidity() ? "/dashboard" : "/login", { replace: true });
    } else if (currentPath === "/dashboard" && !checkTokenValidity()) {
      navigate("/login", { replace: true });
    }

    const handlePopstate = (event: PopStateEvent) => {
      event.preventDefault();
      if (registrationCompleted && restrictedRoutes.includes(window.location.pathname)) {
        navigate("/login", { replace: true });
      } else if (window.location.pathname === "/dashboard" && !checkTokenValidity()) {
        navigate("/login", { replace: true });
      } else {
        navigate(window.location.pathname, { replace: true });
      }
    };

    window.addEventListener("popstate", handlePopstate);

    const interval = setInterval(() => {
      if (currentPath === "/dashboard" && !checkTokenValidity()) {
        navigate("/login", { replace: true });
      }
    }, 1000);

    return () => {
      window.removeEventListener("popstate", handlePopstate);
      clearInterval(interval);
    };
  }, [registrationCompleted, navigate]);

  return checkTokenValidity() || !["/dashboard"].includes(window.location.pathname) ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoutes;