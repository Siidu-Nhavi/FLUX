import { Link } from "react-router-dom";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import "../styles/home.css";

export default function NotFound() {
  return (
    <main className="home-page">
      <nav className="home-nav">
        <a className="brand" href="/home" aria-label="Flux home">
          <span className="brand-mark"><VideoCallIcon /></span>Flux
        </a>
      </nav>
      <section className="home-hero">
        <div className="hero-copy">
          <h1>Page not found</h1>
          <p className="hero-description">The page you tried to reach doesn't exist or the link is invalid.</p>
          <p>
            <Link to="/home">Return to the home page</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
