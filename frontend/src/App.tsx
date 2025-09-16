import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import ProductSelection from "./pages/ProductSelection";
import SelfieCapture from "./pages/SelfieCapture";
import LoadingScreen from "./pages/LoadingScreen";
import VirtualFitting from "./pages/VirtualFitting";
import NotFound from "./pages/NotFound";
import Header from "./components/Header";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { useAuthStore } from "./store/useAuthStore";
import { Toaster } from "sonner";

function App() {
  const loadUser = useAuthStore((s) => s.loadUser);
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <Router>
      <Header />
      <Toaster richColors position="top-right" />
      <Routes>
        <Route path="/" element={<ProductSelection />} />
        <Route path="/selfie-capture" element={<SelfieCapture />} />
        <Route path="/loading" element={<LoadingScreen />} />
        <Route path="/virtual-fitting" element={<VirtualFitting />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
