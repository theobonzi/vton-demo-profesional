import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import ProductSelection from "./pages/ProductSelection";
import SelfieCapture from "./pages/SelfieCapture";
import LoadingScreen from "./pages/LoadingScreen";
import VirtualFitting from "./pages/VirtualFitting";
import NotFound from "./pages/NotFound";
import { login, saveAuthData } from "./services/authService";

function App() {
  useEffect(() => {
    // Connexion automatique pour la démo
    const autoLogin = async () => {
      try {
        const tokenData = await login({
          email: "demo@example.com",
          password: "secret"
        });
        
        // Sauvegarder les données d'authentification
        saveAuthData(tokenData.access_token, {
          id: 1,
          email: "demo@example.com",
          username: "demo_user",
          is_active: true,
          created_at: "2024-01-01T00:00:00Z"
        });
        
        console.log("Connexion automatique réussie pour la démo");
      } catch (error) {
        console.error("Erreur lors de la connexion automatique:", error);
      }
    };
    
    autoLogin();
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<ProductSelection />} />
        <Route path="/selfie-capture" element={<SelfieCapture />} />
        <Route path="/loading" element={<LoadingScreen />} />
        <Route path="/virtual-fitting" element={<VirtualFitting />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
