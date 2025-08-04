import { useEffect } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { useAppContext } from "@/context/appContext";

const ProtectedRoutes = () => {
  const navigate = useNavigate();
  const { registrationCompleted } = useAppContext();

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
    ];
    const currentPath = window.location.pathname;

    // Overwrite history for protected routes and flood history stack
    if (protectedRoutes.includes(currentPath)) {
      // Replace current history entry
      navigate(currentPath, { replace: true });
      // Push multiple identical history entries to block back navigation
      for (let i = 0; i < 10; i++) {
        window.history.pushState({}, "", window.location.href);
      }
    }

    // Redirect to /login or /dashboard if accessing restricted routes after registration
    if (registrationCompleted && restrictedRoutes.includes(currentPath)) {
      navigate(currentPath === "/dashboard" ? "/dashboard" : "/login", { replace: true });
    }

    // Handle browser back/forward button (popstate event)
    const handlePopstate = () => {
      if (registrationCompleted && restrictedRoutes.includes(window.location.pathname)) {
        navigate("/login", { replace: true });
      }
    };

    window.addEventListener("popstate", handlePopstate);

    // Cleanup event listener
    return () => {
      window.removeEventListener("popstate", handlePopstate);
    };
  }, [registrationCompleted, navigate]);

  return <Outlet />;
};

export default ProtectedRoutes;