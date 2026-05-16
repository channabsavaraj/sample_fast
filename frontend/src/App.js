import { useState, useEffect } from "react";
import Login from "./pages/Login";
import Register from "./pages/Register";
import User from "./pages/UserDashboard";
import Provider from "./pages/ProviderDashboard";
import Admin from "./pages/AdminDashboard";

export default function App() {
  const [role, setRole] = useState("");
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    // Check for existing token
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split(".")[1]));
        setRole(decoded.role);
      } catch (err) {
        localStorage.removeItem("token");
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setRole("");
    setShowRegister(false);
  };

  if (showRegister) {
    return <Register setShowRegister={setShowRegister} />;
  }

  if (!role) {
    return <Login setRole={setRole} setShowRegister={setShowRegister} />;
  }

  if (role === "user") return <User />;
  if (role === "provider") return <Provider />;
  return <Admin />;
}
