import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({
  children
}) {
  const {
    authUser,
    loading
  } = useAuth();

  if (loading) {
    return (
      <div className="page-center">
        Loading...
      </div>
    );
  }

  if (!authUser) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return children;
}
