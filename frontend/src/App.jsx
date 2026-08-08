import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/landingPage";
import Home from "./pages/home";
import Authentication from "./pages/authentication";
import Profile from "./pages/profile";
import VideoMeet from "./pages/videoMeet";

import "./App.css";

export default function App() {
  return (
    <>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/home" element={<Home />} />

          <Route path="/auth" element={<Authentication />} />
          <Route path="/auth/:authAction" element={<Authentication />} />
          <Route path="/profile" element={<Profile />} />

          <Route path="/:url" element={<VideoMeet />} />
        </Routes>
      </Router>
    </>
  );
}
