import { useEffect, useRef, useState } from "react";
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

// Uses the local backend by default; set VITE_SIGNALING_SERVER_URL for LAN or deployed clients.
const serverUrl = import.meta.env.VITE_SIGNALING_SERVER_URL || "http://localhost:5000";
const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VideoMeetComponent() {
  const socketRef = useRef(null);
  const socketIdRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const pendingIceCandidatesRef = useRef({});
  const videoRef = useRef([]);

  const [videoAvailable, setVideoAvailable] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(false);
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
  const [videos, setVideos] = useState([]);
  // NEW: tracks whether we're still establishing the socket/room connection.
  // Shown as a full-screen loader between "Connect" being clicked and the
  // server confirming this client has actually joined the room.
  const [connecting, setConnecting] = useState(false);

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
    Object.values(peerConnectionsRef.current).forEach((connection) => {
      const senders = connection.getSenders();
      stream.getTracks().forEach((track) => {
        const sender = senders.find((item) => item.track?.kind === track.kind);
        if (sender) sender.replaceTrack(track);
        else connection.addTrack(track, stream);
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

  /** Creates and configures one peer connection for a participant. */
  const createPeerConnection = (socketId) => {
    if (peerConnectionsRef.current[socketId])
      return peerConnectionsRef.current[socketId];
    const connection = new RTCPeerConnection(peerConfigConnections);
    peerConnectionsRef.current[socketId] = connection;
    connection.onicecandidate = ({ candidate }) => {
      if (candidate)
        socketRef.current?.emit(
          "signal",
          socketId,
          JSON.stringify({ ice: candidate }),
        );
    };
    connection.ontrack = ({ streams }) => {
      if (streams[0]) addRemoteStream(socketId, streams[0]);
    };
    const stream = localStreamRef.current ?? createBlackSilenceStream();
    if (!localStreamRef.current) localStreamRef.current = stream;
    stream.getTracks().forEach((track) => connection.addTrack(track, stream));
    return connection;
  };

  /** Sends an SDP offer to one participant. */
  const createOffer = async (socketId) => {
    const connection = createPeerConnection(socketId);
    try {
      const description = await connection.createOffer();
      await connection.setLocalDescription(description);
      socketRef.current?.emit(
        "signal",
        socketId,
        JSON.stringify({ sdp: connection.localDescription }),
      );
    } catch (error) {
      console.error("Unable to create offer:", error);
    }
  };

  /** Queues an ICE candidate until the peer connection has a remote description. */
  const addIceCandidate = async (socketId, connection, iceCandidate) => {
    const candidate = new RTCIceCandidate(iceCandidate);
    if (!connection.remoteDescription) {
      pendingIceCandidatesRef.current[socketId] ??= [];
      pendingIceCandidatesRef.current[socketId].push(candidate);
      return;
    }
    await connection.addIceCandidate(candidate);
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
    if (fromId === socketIdRef.current) return;
    const connection = createPeerConnection(fromId);
    try {
      const signal = JSON.parse(payload);
      if (signal.sdp) {
        await connection.setRemoteDescription(
          new RTCSessionDescription(signal.sdp),
        );
        await flushPendingIceCandidates(fromId, connection);
        if (signal.sdp.type === "offer") {
          const answer = await connection.createAnswer();
          await connection.setLocalDescription(answer);
          socketRef.current?.emit(
            "signal",
            fromId,
            JSON.stringify({ sdp: connection.localDescription }),
          );
        }
      }
      if (signal.ice) await addIceCandidate(fromId, connection, signal.ice);
    } catch (error) {
      console.error("Unable to process WebRTC signal:", error);
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
    if (socketIdSender !== socketIdRef.current)
      setNewMessages((count) => count + 1);
  };

  /** Connects the client to the signaling server and subscribes to call events. */
  const connectToSocketServer = () => {
    if (socketRef.current) return;
    const socket = io(serverUrl);
    socketRef.current = socket;
    socket.on("signal", gotMessageFromServer);
    // NEW: the server sends join/leave notices through the same "chat-message"
    // event (with sender "System"), so addMessage already knows how to render
    // them - no separate listener is needed for that part.
    socket.on("chat-message", addMessage);
    socket.on("connect", () => {
      socketIdRef.current = socket.id;
      // Use the meeting path so localhost and LAN-IP clients enter the same room.
      // NEW: also send the chosen username so the server can announce this
      // user's join (and later, leave) to everyone else already in the room.
      socket.emit("join-call", window.location.pathname, username);
    });
    // NEW: server-side acknowledgement that this client has fully joined the
    // room (chat history replayed, join notice broadcast). Once this arrives
    // it's safe to hide the "connecting" loader and show the call UI.
    socket.on("joined-room", () => {
      setConnecting(false);
    });
    // NEW: don't leave the user staring at a spinner forever if the
    // signaling server can't be reached at all.
    socket.on("connect_error", (error) => {
      console.error("Unable to connect to signaling server:", error);
      setConnecting(false);
    });
    socket.on("user-left", (id) => {
      peerConnectionsRef.current[id]?.close();
      delete peerConnectionsRef.current[id];
      delete pendingIceCandidatesRef.current[id];
      setVideos((currentVideos) =>
        currentVideos.filter((item) => item.socketId !== id),
      );
    });
    socket.on("user-joined", (id, clients) => {
      clients
        .filter((clientId) => clientId !== socketIdRef.current)
        .forEach(createPeerConnection);
      if (id === socketIdRef.current)
        clients
          .filter((clientId) => clientId !== socketIdRef.current)
          .forEach(createOffer);
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
    if (!trimmedMessage || !socketRef.current) return;
    const messageId = crypto.randomUUID();
    // Add locally first, then let the server broadcast the same ID to other participants.
    addMessage(
      trimmedMessage,
      username || "Anonymous",
      socketIdRef.current,
      messageId,
    );
    socketRef.current.emit("chat-message", trimmedMessage, username, messageId);
    setMessage("");
  };

  /** Releases all call resources and returns the user to the home page. */
  const handleEndCall = () => {
    stopStream(localStreamRef.current);
    Object.values(peerConnectionsRef.current).forEach((connection) =>
      connection.close(),
    );
    socketRef.current?.disconnect();
    window.location.assign("/");
  };

  /** Leaves the lobby, starts local media, and connects to the call. */
  const connect = async () => {
    setAskForUsername(false);
    // NEW: show the loader immediately - it stays up until the server
    // confirms (via "joined-room") that we're actually in the room.
    setConnecting(true);
    setVideo(videoAvailable);
    setAudio(audioAvailable);
    await getUserMedia(videoAvailable, audioAvailable);
    connectToSocketServer();
  };

  /** Checks permissions once, then cleans up media and socket resources on unmount. */
  useEffect(() => {
    const peerConnections = peerConnectionsRef.current;
    void (async () => {
      await getPermissions();
    })();
    return () => {
      stopStream(localStreamRef.current);
      Object.values(peerConnections).forEach((connection) =>
        connection.close(),
      );
      socketRef.current?.disconnect();
    };
    // This effect must run only once to avoid repeating the permission prompt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {askForUsername ? (
        <div>
          <h2>Enter into Lobby</h2>
          <TextField
            label="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            variant="outlined"
          />
          <Button variant="contained" onClick={connect}>
            Connect
          </Button>
          <div>
            <video ref={localVideoRef} autoPlay muted />
          </div>
        </div>
      ) : connecting ? (
        // NEW: full-screen loader shown while we wait for the socket to
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
                <video
                  ref={(element) => {
                    if (element) element.srcObject = remoteVideo.stream;
                  }}
                  autoPlay
                  playsInline
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
