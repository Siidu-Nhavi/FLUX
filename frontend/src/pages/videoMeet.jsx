import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import {
  Badge,
  Button,
  CircularProgress,
  IconButton,
  TextField,
} from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";
import SendIcon from "@mui/icons-material/Send";
import styles from "../styles/videoComponent.module.css";

/** CameraPreview component (top-level to comply with ESLint hooks rule) */
function CameraPreview({ previewVideoRef, previewStreamRef, stopStream }) {
  useEffect(() => {
    let mounted = true;
    const previewVideo = previewVideoRef.current;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (!mounted) {
          stopStream(stream);
          return;
        }
        previewStreamRef.current = stream;
        if (previewVideo) previewVideo.srcObject = stream;
      } catch (err) {
        console.error("CameraPreview: unable to access camera", err);
      }
    })();

    return () => {
      mounted = false;
      try {
        stopStream(previewStreamRef.current);
      } catch (e) {
        console.error("Error stopping preview stream:", e);
      }
      previewStreamRef.current = null;
      if (previewVideo) previewVideo.srcObject = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ width: "320px", maxWidth: "100%" }}>
      <video
        ref={previewVideoRef}
        autoPlay
        muted
        playsInline
        style={{ width: "100%", background: "#000" }}
      />
    </div>
  );
}

function RemoteVideo({ stream }) {
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    const videoElement = remoteVideoRef.current;
    if (videoElement) videoElement.srcObject = stream;
    return () => {
      if (videoElement) videoElement.srcObject = null;
    };
  }, [stream]);

  return (
    <video
      ref={remoteVideoRef}
      autoPlay
      playsInline
      style={{ width: "100%", height: "100%" }}
    />
  );
}

// Uses the local backend by default; set VITE_SIGNALING_SERVER_URL for LAN or deployed clients.
const serverUrl =
  import.meta.env.VITE_SIGNALING_SERVER_URL || "http://localhost:5000";
const turnServer = import.meta.env.VITE_TURN_URL;
const peerConfigConnections = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    ...(turnServer
      ? [
          {
            urls: turnServer,
            username: import.meta.env.VITE_TURN_USERNAME,
            credential: import.meta.env.VITE_TURN_CREDENTIAL,
          },
        ]
      : []),
  ],
};
const getRoomId = () => window.location.pathname.replace(/^\/+|\/+$/g, "");

export default function VideoMeetComponent() {
  const socketRef = useRef(null);
  const socketIdRef = useRef(null);
  const localVideoRef = useRef(null);
  const previewVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const previewStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const pendingIceCandidatesRef = useRef({});
  const videoRef = useRef([]);
  const [videoAvailable, setVideoAvailable] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(false);
  const [mediaCheckComplete, setMediaCheckComplete] = useState(false);
  const [video, setVideo] = useState(false);
  const [audio, setAudio] = useState(false);
  const [screen, setScreen] = useState(false);
  const [screenAvailable, setScreenAvailable] = useState(false);
  const [showModal, setModal] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [newMessages, setNewMessages] = useState(0);
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState("");
  const [nameError, setNameError] = useState("");
  const [videos, setVideos] = useState([]);
  // NEW: tracks whether we're still establishing the socket/room connection.
  // Shown as a full-screen loader between "Connect" being clicked and the
  // server confirming this client has actually joined the room.
  const [connecting, setConnecting] = useState(false);
  const navigate = useNavigate();

  /** Stops a media stream and releases its camera, microphone, or screen tracks. */
  const stopStream = (stream) => {
    stream?.getTracks().forEach((track) => track.stop());
  };

  /** Creates muted placeholder tracks when no camera or microphone stream is available. */
  const createBlackSilenceStream = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    canvas.getContext("2d").fillRect(0, 0, canvas.width, canvas.height);
    const videoTrack = canvas.captureStream().getVideoTracks()[0];
    videoTrack.enabled = false;

    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const destination = oscillator.connect(
      audioContext.createMediaStreamDestination(),
    );
    oscillator.start();
    const audioTrack = destination.stream.getAudioTracks()[0];
    audioTrack.enabled = false;

    return new MediaStream([videoTrack, audioTrack]);
  };

  /** Adds black or silent placeholder tracks for media controls that are turned off. */
  const addPlaceholderTracks = (stream, useVideo, useAudio) => {
    const placeholders = createBlackSilenceStream();
    const placeholderVideo = placeholders.getVideoTracks()[0];
    const placeholderAudio = placeholders.getAudioTracks()[0];

    if (!useVideo) stream.addTrack(placeholderVideo);
    else placeholderVideo.stop();

    if (!useAudio) stream.addTrack(placeholderAudio);
    else placeholderAudio.stop();

    return stream;
  };

  /** Replaces the outgoing tracks for every connected peer with the current local stream. */
  const replacePeerTracks = (stream) => {
    console.info("[webrtc] replacing peer tracks", { peerCount: Object.keys(peerConnectionsRef.current).length });
    Object.entries(peerConnectionsRef.current).forEach(([socketId, connection]) => {
      const senders = connection.getSenders();
      stream.getTracks().forEach((newTrack) => {
        const sender = senders.find((item) => item.track?.kind === newTrack.kind);
        if (sender) {
          console.info("[webrtc] replacing track", { socketId, kind: newTrack.kind });
          sender.replaceTrack(newTrack).catch((err) => {
            console.error("[webrtc] failed to replace track", { socketId, kind: newTrack.kind, error: err });
          });
        } else {
          console.info("[webrtc] adding new track", { socketId, kind: newTrack.kind });
          connection.addTrack(newTrack, stream);
        }
      });
    });
  };

  

  /** Shows the selected local stream and sends its tracks to all peers. */
  const setLocalStream = (stream) => {
    stopStream(localStreamRef.current);
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    replacePeerTracks(stream);
  };

  /** Detects device access and records which media controls can be enabled. */
  const getPermissions = async () => {
    setScreenAvailable(Boolean(navigator.mediaDevices?.getDisplayMedia));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setVideoAvailable(true);
      setAudioAvailable(true);
      stopStream(stream);
    } catch (error) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        setVideoAvailable(true);
        stopStream(stream);
      } catch {
        setVideoAvailable(false);
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        setAudioAvailable(true);
        stopStream(stream);
      } catch {
        setAudioAvailable(false);
      }
      console.error("Unable to access all requested media devices:", error);
    }
  };

  /** Obtains the currently enabled camera and microphone tracks. */
  const getUserMedia = async (useVideo = video, useAudio = audio) => {
    if (!useVideo && !useAudio) {
      setLocalStream(createBlackSilenceStream());
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: useVideo,
        audio: useAudio,
      });
      // Keep both track types present so muting one does not remove the other from peers.
      setLocalStream(addPlaceholderTracks(stream, useVideo, useAudio));
    } catch (err) {
      if (err.name === "NotReadableError") {
        alert(
          "Camera is already in use by another application. Please close other apps and try again.",
        );
      } else {
        console.error("Media access error:", err);
      }
    }
  };

  /** Starts screen sharing and restores the previous camera/microphone state when it ends. */
  const getDisplayMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      stream.getVideoTracks()[0].onended = () => {
        setScreen(false);
        getUserMedia();
      };
    } catch (error) {
      setScreen(false);
      console.error("Unable to share screen:", error);
    }
  };

  /** Adds or updates a remote participant's video stream. */
  const addRemoteStream = (socketId, stream) => {
    console.info("[webrtc] remote track received", { socketId });
    
    setVideos((currentVideos) => {
      const existing = currentVideos.find((item) => item.socketId === socketId);
      const updatedVideos = existing
        ? currentVideos.map((item) =>
            item.socketId === socketId ? { ...item, stream } : item,
          )
        : [...currentVideos, { socketId, stream }];
      videoRef.current = updatedVideos;
      
      return updatedVideos;
    });
  };

  const clearPeerConnections = (clearRenderedVideos = true) => {
    Object.values(peerConnectionsRef.current).forEach((connection) =>
      connection.close(),
    );
    peerConnectionsRef.current = {};
    pendingIceCandidatesRef.current = {};
    videoRef.current = [];
    if (clearRenderedVideos) setVideos([]);
  };

  /** Creates and configures one peer connection for a participant. */
  const createPeerConnection = (socketId) => {
    if (peerConnectionsRef.current[socketId])
      return peerConnectionsRef.current[socketId];
    console.info("[webrtc] creating peer connection", { socketId });
    const connection = new RTCPeerConnection(peerConfigConnections);
    peerConnectionsRef.current[socketId] = connection;
    connection.onicecandidate = ({ candidate }) => {
      if (candidate) {
        console.info("[webrtc] ICE candidate sent", { socketId });
        socketRef.current?.emit(
          "signal",
          socketId,
          JSON.stringify({ ice: candidate }),
        );
      }
    };
    connection.ontrack = ({ streams }) => {
      if (streams[0]) {
        console.info("[webrtc] remote track handler fired", { socketId, trackCount: streams[0].getTracks().length });
        addRemoteStream(socketId, streams[0]);
      }
    };
    connection.onconnectionstatechange = () => {
      console.info("[webrtc] connection state", {
        socketId,
        state: connection.connectionState,
      });
    };
    
    // Add local tracks if available, otherwise add placeholder tracks
    const stream = localStreamRef.current ?? createBlackSilenceStream();
    if (!localStreamRef.current) {
      console.warn("[webrtc] local stream not available yet, using placeholder", { socketId });
      localStreamRef.current = stream;
    }
    
    const tracks = stream.getTracks();
    console.info("[webrtc] adding tracks to peer connection", { socketId, trackCount: tracks.length });
    tracks.forEach((track) => {
      connection.addTrack(track, stream);
    });
    
    return connection;
  };

  /** Sends an SDP offer to one participant. */
  const createOffer = async (socketId) => {
    console.info("[webrtc] creating offer for peer", { socketId });
    const connection = createPeerConnection(socketId);
    try {
      const description = await connection.createOffer();
      await connection.setLocalDescription(description);
      console.info("[webrtc] offer created and local description set", { socketId });
      socketRef.current?.emit(
        "signal",
        socketId,
        JSON.stringify({ sdp: connection.localDescription }),
      );
      console.info("[webrtc] offer sent to peer", { socketId });
    } catch (error) {
      console.error("[webrtc] error creating offer", { socketId, error: error?.message });
    }
  };

  /** Queues an ICE candidate until the peer connection has a remote description. */
  const addIceCandidate = async (socketId, connection, iceCandidate) => {
    try {
      const candidate = new RTCIceCandidate(iceCandidate);
      if (!connection.remoteDescription) {
        console.info("[webrtc] queueing ICE candidate (no remote description yet)", { socketId });
        pendingIceCandidatesRef.current[socketId] ??= [];
        pendingIceCandidatesRef.current[socketId].push(candidate);
        return;
      }
      console.info("[webrtc] adding ICE candidate", { socketId });
      await connection.addIceCandidate(candidate);
    } catch (error) {
      console.warn("[webrtc] error adding ICE candidate", { socketId, error: error?.message });
    }
  };

  /** Adds ICE candidates that arrived before the remote offer or answer. */
  const flushPendingIceCandidates = async (socketId, connection) => {
    const candidates = pendingIceCandidatesRef.current[socketId] ?? [];
    for (const candidate of candidates) {
      await connection.addIceCandidate(candidate);
    }
    delete pendingIceCandidatesRef.current[socketId];
  };

  /** Applies incoming WebRTC signaling data and replies to offers. */
  const gotMessageFromServer = async (fromId, payload) => {
    if (fromId === socketIdRef.current) {
      console.warn("[webrtc] ignoring signal from self", { fromId });
      return;
    }
    
    console.info("[webrtc] processing signal from peer", { fromId });
    const connection = createPeerConnection(fromId);
    
    try {
      const signal = JSON.parse(payload);
      
      if (signal.sdp) {
        console.info(`[webrtc] ${signal.sdp.type} received from ${fromId}`, { 
          fromId, 
          sdpType: signal.sdp.type 
        });
        
        await connection.setRemoteDescription(
          new RTCSessionDescription(signal.sdp),
        );
        console.info("[webrtc] remote description set", { fromId });
        
        // Flush any pending ICE candidates
        await flushPendingIceCandidates(fromId, connection);
        
        if (signal.sdp.type === "offer") {
          console.info("[webrtc] offer received, creating answer", { fromId });
          const answer = await connection.createAnswer();
          await connection.setLocalDescription(answer);
          console.info("[webrtc] answer created and local description set", { fromId });
          socketRef.current?.emit(
            "signal",
            fromId,
            JSON.stringify({ sdp: connection.localDescription }),
          );
          console.info("[webrtc] answer sent", { fromId });
        }
      }
      
      if (signal.ice) {
        console.info("[webrtc] ICE candidate received", { fromId });
        await addIceCandidate(fromId, connection, signal.ice);
      }
    } catch (error) {
      console.error("[webrtc] error processing signal", { fromId, error: error?.message });
    }
  };

  /** Stores one chat message unless it was already added by this client. */
  const addMessage = (data, sender, socketIdSender, messageId) => {
    setMessages((currentMessages) => {
      if (
        messageId &&
        currentMessages.some((item) => item.messageId === messageId)
      ) {
        return currentMessages;
      }
      return [...currentMessages, { sender, data, messageId }];
    });
    console.info("[chat] message received", { socketId: socketIdSender });
    if (socketIdSender !== socketIdRef.current)
      setNewMessages((count) => count + 1);
  };

  /** Connects the client to the signaling server and subscribes to call events. */
  const connectToSocketServer = () => {
    if (socketRef.current) {
      console.warn("[socket] socket already exists, returning early");
      return;
    }
    console.info("[socket] creating new socket connection");
    const socket = io(serverUrl);
    socketRef.current = socket;
    
    // Register event listeners BEFORE attempting to join
    socket.on("signal", (fromId, payload) => {
      console.info("[socket] signal event received", { fromId });
      gotMessageFromServer(fromId, payload);
    });
    
    socket.on("chat-message", (data, sender, socketIdSender, messageId) => {
      console.info("[socket] chat-message event received", { sender, socketIdSender, messageId });
      addMessage(data, sender, socketIdSender, messageId);
    });
    
    socket.on("connect", () => {
      socketIdRef.current = socket.id;
      console.info("[socket] connected", { socketId: socket.id });
      const roomId = getRoomId();
      console.info("[socket] joining room", { roomId, socketId: socket.id, username });
      socket.emit("join-call", roomId, username);
    });
    
    socket.on("joined-room", (roomId) => {
      console.info("[socket] room joined successfully", { roomId, socketId: socket.id });
      setConnecting(false);
    });
    
    socket.on("existing-users", (socketIds) => {
      console.info("[socket] existing users received", { count: socketIds.length, socketIds });
      socketIds.forEach((existingSocketId) => {
        console.info("[socket] creating offer for existing user", { existingSocketId });
        createOffer(existingSocketId);
      });
    });
    
    socket.on("user-joined", (socketId) => {
      console.info("[socket] user joined notification received", { socketId });
      // New user will send offers to us, so we don't need to create offers here
    });
    
    socket.on("connect_error", (error) => {
      console.error("[socket] connection error", { error: error?.message || error });
      setConnecting(false);
    });
    
    socket.on("disconnect", (reason) => {
      console.info("[socket] disconnected", { reason, socketId: socketIdRef.current });
      socketIdRef.current = null;
      clearPeerConnections();
    });
    
    socket.on("user-left", (id) => {
      console.info("[socket] user left", { socketId: id });
      if (peerConnectionsRef.current[id]) {
        peerConnectionsRef.current[id].close();
        delete peerConnectionsRef.current[id];
      }
      delete pendingIceCandidatesRef.current[id];
      setVideos((currentVideos) =>
        currentVideos.filter((item) => item.socketId !== id),
      );
    });
  };

  /** Toggles the local camera setting and refreshes the outgoing media stream. */
  const handleVideo = () => {
    const nextVideo = !video;
    setVideo(nextVideo);
    getUserMedia(nextVideo, audio);
  };

  /** Toggles the local microphone setting and refreshes the outgoing media stream. */
  const handleAudio = () => {
    const nextAudio = !audio;
    setAudio(nextAudio);
    getUserMedia(video, nextAudio);
  };

  /** Starts screen sharing or restores the selected camera and microphone stream. */
  const handleScreen = () => {
    if (screen) {
      stopStream(localStreamRef.current);
      setScreen(false);
      getUserMedia();
      return;
    }
    setScreen(true);
    getDisplayMedia();
  };

  /** Opens or closes the chat panel and clears its unread counter when opened. */
  const toggleChat = () => {
    setModal((isOpen) => {
      const willOpen = !isOpen;
      if (willOpen) setNewMessages(0);
      return willOpen;
    });
  };

  /** Sends the current chat text to all participants. */
  const sendMessage = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || !socketRef.current) {
      console.warn("[chat] message not sent", { reason: trimmedMessage ? "no socket" : "empty message" });
      return;
    }
    const messageId = crypto.randomUUID();
    // Add locally first, then let the server broadcast the same ID to other participants.
    addMessage(
      trimmedMessage,
      username || "Anonymous",
      socketIdRef.current,
      messageId,
    );
    console.info("[chat] message sent", { socketId: socketIdRef.current, messageId });
    socketRef.current.emit("chat-message", trimmedMessage, username, messageId);
    setMessage("");
  };

  /** Releases all call resources and returns the user to the home page. */
  const handleEndCall = async () => {
    // Attempt to save meeting record to backend (best-effort)
    try {
      const meetingCode = window.location.pathname.replace(/^\//, "") || null;
      const token = localStorage.getItem("flux_access_token");
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
      if (meetingCode) {
        await fetch(`${apiBase}/api/meetings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ meetingCode, date: new Date().toISOString() }),
        });
      }
    } catch (err) {
      console.error("Failed to save meeting record:", err);
    } finally {
      stopStream(localStreamRef.current);
      // Ensure preview stream (if any) is stopped when leaving
      stopStream(previewStreamRef.current);
      previewStreamRef.current = null;
      clearPeerConnections();
      socketRef.current?.disconnect();
      navigate("/home", { replace: true });
    }
  };

  /** Leaves the lobby, starts local media, and connects to the call. */
  const connect = async () => {
    // Require a non-empty display name before connecting
    if (!username || !username.trim()) {
      setNameError("Please enter a display name");
      return;
    }
    setNameError("");
    setAskForUsername(false);
    // NEW: show the loader immediately - it stays up until the server
    // confirms (via "joined-room") that we're actually in the room.
    setConnecting(true);
    setVideo(videoAvailable);
    setAudio(audioAvailable);
    // Stop preview camera (if running) before acquiring the main local stream
    try {
      stopStream(previewStreamRef.current);
      previewStreamRef.current = null;
      if (previewVideoRef.current) previewVideoRef.current.srcObject = null;
    } catch (e) {
      console.error("Error stopping preview stream:", e);
    }
    await getUserMedia(videoAvailable, audioAvailable);
    connectToSocketServer();
  };

  /** Checks permissions once, then cleans up media and socket resources on unmount. */
  useEffect(() => {
    void (async () => {
      try {
        await getPermissions();
      } finally {
        setMediaCheckComplete(true);
      }
    })();
    return () => {
      stopStream(localStreamRef.current);
      clearPeerConnections(false);
      const socket = socketRef.current;
      socket?.removeAllListeners();
      socket?.disconnect();
      socketRef.current = null;
    };
    // This effect must run only once to avoid repeating the permission prompt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {askForUsername ? (
          <div className={styles.lobbyContainer}>
            <h2 className={styles.lobbyHeading}>Enter into Lobby</h2>
            <div className={styles.lobbyControls}>
              <TextField
                label="Username"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  if (nameError) setNameError("");
                }}
                variant="outlined"
                required
                error={Boolean(nameError)}
                helperText={nameError}
              />
              <Button
                variant="contained"
                onClick={connect}
                disabled={!username.trim() || !mediaCheckComplete}
              >
                {mediaCheckComplete ? "Connect" : "Checking camera and microphone..."}
              </Button>
            </div>
            <div className={styles.previewWrapper}>
              <CameraPreview
                previewVideoRef={previewVideoRef}
                previewStreamRef={previewStreamRef}
                stopStream={stopStream}
              />
            </div>
            <div className={styles.localPreview}>
              <video ref={localVideoRef} autoPlay muted />
            </div>
          </div>
      ) : connecting ? (
        //  full-screen loader shown while we wait for the socket to
        // connect and the server to confirm this client has joined the room.
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            gap: "16px",
            color: "white",
            background: "#1c1c1c",
          }}
        >
          <CircularProgress color="inherit" />
          <p>Connecting to the room...</p>
        </div>
      ) : (
        <div className={styles.meetVideoContainer}>
          {showModal && (
            <div className={styles.chatRoom}>
              <div className={styles.chatContainer}>
                <h1>Chat</h1>
                <div className={styles.chattingDisplay}>
                  {messages.length ? (
                    messages.map((item, index) => (
                      <div
                        style={{
                          marginBottom: "20px",
                          // NEW: cente system join/leave notices so
                          // they read differently from regular chat messages.
                          ...(item.sender === "System"
                            ? {
                                textAlign: "center",
                                fontStyle: "italic",
                                color: "#9e9e9e",
                              }
                            : {}),
                        }}
                        key={item.messageId ?? `${item.sender}-${index}`}
                      >
                        {item.sender === "System" ? (
                          <p>{item.data}</p>
                        ) : (
                          <>
                            <p style={{ fontWeight: "bold" }}>{item.sender}</p>
                            <p>{item.data}</p>
                          </>
                        )}
                      </div>
                    ))
                  ) : (
                    <p>No Messages Yet</p>
                  )}
                </div>
                <div className={styles.chattingArea}>
                  <TextField
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    label="Enter your chat"
                    variant="outlined"
                  />
                  <Button variant="contained" onClick={sendMessage}>
                    Send <SendIcon />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <div className={styles.buttonContainers}>
            <IconButton onClick={handleVideo} style={{ color: "white" }}>
              {video ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>
            <IconButton onClick={handleEndCall} style={{ color: "red" }}>
              <CallEndIcon />
            </IconButton>
            <IconButton onClick={handleAudio} style={{ color: "white" }}>
              {audio ? <MicIcon /> : <MicOffIcon />}
            </IconButton>
            {screenAvailable && (
              <IconButton onClick={handleScreen} style={{ color: "white" }}>
                {screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
              </IconButton>
            )}
            <Badge badgeContent={newMessages} max={999} color="primary">
              <IconButton onClick={toggleChat} style={{ color: "white" }}>
                <ChatIcon />
              </IconButton>
            </Badge>
          </div>
          <video
            className={styles.meetUserVideo}
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
          />
          <div className={styles.conferenceView}>
            {videos.map((remoteVideo) => (
              <div key={remoteVideo.socketId}>
                <RemoteVideo stream={remoteVideo.stream} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
