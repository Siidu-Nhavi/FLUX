import mobileImage from "../public/mobile.png";
import {Link} from "react-router-dom";

export default function LandingPage() {
  return (
    <>
      <div className="landingPageContainer">
        <nav>
          <div className="navHeader">
            <h1>Video Conferencing</h1>
          </div>
          <div className="navLinks">
            <p>Join As Guest</p>
            <p>Register</p>
            <div role="button">
              <p>Login</p>
            </div>
          </div>
        </nav>
        <div className="landingMainContainer">
          <div>
            <h1>
              <span style={{ color: "#FF9839" }}>Connect</span> With Your Loved
              Ones
            </h1>
            <p>
                cover distance by Video Conferencing.
            </p>
            <div role="button">
                <Link to ={"/home"}>Get Started</Link>
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
