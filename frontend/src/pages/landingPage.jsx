import mobileImage from "../public/mobile.png";
import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <>
      <div className="landingPageContainer">
        <nav>
          <div className="navHeader">
            <h1>Video Conferencing</h1>
          </div>
          <div className="navLinks">
            <p>
              <Link
                to={"/auth/guest"}
                style={{ textDecoration: "none", color: "white" }}
              >
                Join As Guest
              </Link>
            </p>
            <p>
              <Link
                to={"/auth/register"}
                style={{ textDecoration: "none", color: "white" }}
              >
                Register
              </Link>
            </p>
            <div role="button">
              <p>
                <Link
                  to={"/auth/login"}
                  style={{ textDecoration: "none", color: "white" }}
                >
                  Login
                </Link>
              </p>
            </div>
          </div>
        </nav>
        <div className="landingMainContainer">
          <div>
            <h1>
              <span style={{ color: "#FF9839" }}>Connect</span> With Your Loved
              Ones
            </h1>
            <p>cover distance by Video Conferencing.</p>
            <div role="button">
              <Link
                to={"/auth"}
                style={{ textDecoration: "none", color: "white" }}
              >
                Get Started
              </Link>
            </div>
          </div>
          <div>
            <img src={mobileImage} alt="Mobile image" />
          </div>
        </div>
      </div>
    </>
  );
}
