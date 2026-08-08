import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/landingPage";
import Home from "./pages/home";
import Authentication from "./pages/authentication";
import VideoMeet from "./pages/videoMeet";
import History from "./pages/history";
import { AuthProvider } from "./contexts/AuthContext";
import PublicRoute from "./utils/PublicRoute";


import "./App.css";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
          <Route path="/home" element={<Home />} />
          <Route path="/history" element={<History />} />
          <Route path="/auth" element={<Authentication />} />
          <Route path="/auth/:authAction" element={<Authentication />} />
         
            <Route path="/signup" element={<Navigate to="/auth/register" replace />} />
            <Route path="/:url" element={<VideoMeet />} />
            <Route path='/login' element={<Navigate to="/auth/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
