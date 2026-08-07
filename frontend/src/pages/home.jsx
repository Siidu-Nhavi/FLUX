import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import withAuth from "../utils/withAuth";
import "../styles/home.css";

function HomeComponent() {
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");
  const [copied, setCopied] = useState(false);

  const openMeeting = (code) => {
    const roomCode = code.trim().replace(/[^a-zA-Z0-9-]/g, "");
    if (roomCode) navigate(`/${roomCode}`);
  };

  const createMeeting = () => {
    const code = crypto.randomUUID().slice(0, 8);
    setMeetingCode(code);
    openMeeting(code);
  };

  const copyInvite = async () => {
    if (!meetingCode.trim()) return;
    await navigator.clipboard?.writeText(`${window.location.origin}/${meetingCode.trim()}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="home-page">
      <nav className="home-nav">
        <a className="brand" href="/home" aria-label="Flux home">
          <span className="brand-mark"><VideoCallIcon /></span>Flux
        </a>
        <span className="nav-status"><i /> Secure video meetings</span>
      </nav>
      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow">YOUR PERSONAL MEETING SPACE</p>
          <h1>Meet clearly.<br /><em>Move</em> together.</h1>
          <p className="hero-description">Start a private room in seconds or use a shared meeting code to connect with your team.</p>
        </div>
        <div className="meeting-card">
          <div className="card-icon"><VideoCallIcon /></div>
          <h2>Ready when you are</h2>
          <p>Create a new room or join a meeting already in progress.</p>
          <button className="create-button" type="button" onClick={createMeeting}><AddIcon /> Start a new meeting</button>
          <div className="join-divider"><span>OR JOIN WITH A CODE</span></div>
          <label htmlFor="meeting-code">Meeting code</label>
          <div className="code-input">
            <input id="meeting-code" value={meetingCode} onChange={(event) => setMeetingCode(event.target.value)} onKeyDown={(event) => event.key === "Enter" && openMeeting(meetingCode)} placeholder="e.g. team-sync-42" autoComplete="off" />
            <button type="button" aria-label="Join meeting" onClick={() => openMeeting(meetingCode)}><ArrowForwardIcon /></button>
          </div>
          {meetingCode && <button className="copy-button" type="button" onClick={copyInvite}><ContentCopyIcon /> {copied ? "Invite link copied" : "Copy invite link"}</button>}
        </div>
      </section>
    </main>
  );
}

export default withAuth(HomeComponent);
