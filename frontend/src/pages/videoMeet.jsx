import { useRef, useState, useEffect } from "react";
import { TextField, Button } from "@mui/material";
import { io } from "socket.io-client";

const server_url = import.meta.env.SERVER_URL;
const connections = {};

const peerConfigConnection = {
  //ice servers are used to establish a connection between peers in WebRTC. They help in traversing NATs and firewalls.
  //ice servers are used to find the best path for media to travel between peers.
  iceServers: [
    {
      //stun servers are used to get the public IP address of the client. They help in establishing a connection between peers.
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

export default function VideoMeet() {
  let socketRef = useRef();
  let socketIdRef = useRef();
  let localVideoRef = useRef();

  let [videoAvailable, setVideoAvailable] = useState(true);
  let [audioAvailable, setAudioAvailable] = useState(true);
  let [video, setVideo] = useState([]);
  let [audio, setAudio] = useState();
  let [screen, setScreen] = useState();
  let [showModal, setShowModal] = useState();
  let [screenAvailable, setScreenAvailable] = useState();
  let [messages, setMessages] = useState([]);
  let [message, setMessage] = useState("");

  let [newMessage, setNewMessage] = useState(0);
  let [askForUserName, setAskForUserName] = useState(true);
  let [userName, setUserName] = useState("");

  const videoRef = useRef([]);

  let [videos, setVideos] = useState([]);

  // if(isChrome() === false){
  //Todo
  // }

  //function to get the permission for the video and audio from the user. If the user denies the permission, we will not be able to access the video and audio.
  const getPermissions = async () => {
    try {
      //used for getting the permission for th evideo and audio from the user.
      const videoPermission = await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      if (videoPermission) {
        setVideoAvailable(true);
      } else {
        setVideoAvailable(false);
      }

      //used for getting the permission for the audio from the user.
      const audioPermission = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (audioPermission) {
        setAudioAvailable(true);
      } else {
        setAudioAvailable(false);
      }

      //used for getting the permission for the screen from the user.
      //here user can share the screen with other users in the video call. If the user denies the permission, we will not be able to access the screen.
      if (navigator.mediaDevices.getDisplayMedia) {
        setScreenAvailable(true);
      } else {
        setScreenAvailable(false);
      }

      //if the user has given the permission for the video and audio, we will get the media stream from the user.
      if (videoPermission || audioPermission) {
        const userMediaStream = await navigator.mediaDevices.getUserMedia({
          video: videoAvailable,
          audio: audioAvailable,
        });

        //we will set the media stream to the local video element. This will allow us to see our own video and audio in the video call.
        //we will also set the media stream to the window object. This will allow us to access the media stream from other components in the application.
        //we will also set the media stream to the local video ref. This will allow us to access the media stream from other components in the application.
        if (userMediaStream) {
          window.localStream = userMediaStream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = userMediaStream;
          }
        }
      }
    } catch (err) {
      console.log(err);
    }
  };

  //this function is used to get the media stream from the user. This will allow us to access the media stream from other components in the application.
  let getUserMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }

    window.localStream = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    for (let id in connections) {
      if (id === socketIdRef.current) continue;

      connections[id].addStream(window.localStream);

      connections[id].createOffer().then((description) => {
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            socketRef.current.emit(
              "signal",
              id,
              JSON.stringify({ sdp: connections[id].localDescription }),
            );
          })
          .catch((e) => console.log(e));
      });
    }

    stream.getTracks().forEach((track) => {
      track.onended = () => {
        setVideo(false);
        setAudio(false);

        try {
          let tracks = localVideoRef.current.srcObject.getTracks();
          tracks.forEach((track) => {
            track.stop();
          });
        } catch (e) {
          console.log(e);
        }

        //TODO: we need to remove the stream from the connections. This will allow us to stop sending the stream to the other users in the video call.
        let blackSilence = (...args) =>
          new MediaStream([black(...args), silence()]);

        window.localStream = blackSilence();
        localVideoRef.current.srcObject = window.localStream;

        for (let id in connections) {
          connections[id].addStream(window.localStream);
          connections[id].createOffer().then((description) => {
            connections[id]
              .setLocalDescription(description)
              .then(() => {
                socketRef.current.emit(
                  "signal",
                  id,
                  JSON.stringify({ sdp: connections[id].localDescription }),
                );
              })
              .catch((e) => console.log(e));
          });
        }
      };
    });
  };

  //this function is used to create a silent audio track. This will allow us to send a silent audio track to the other users in the video call. This is useful when the user has turned off the audio and we want to send a silent audio track to the other users in the video call.
  let silence = () => {
    let ctx = new AudioContext();
    let oscillator = ctx.createOscillator();
    let dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  };

  //this function is used to create a black video track. This will allow us to send a black video track to the other users in the video call. This is useful when the user has turned off the video and we want to send a black video track to the other users in the video call.
  let black = () => {
    let canvas = Object.assign(document.createElement("canvas"), {
      width: 640,
      height: 480,
    });
    canvas.getContext("2d").fillRect(0, 0, canvas.width, canvas.height);
    let stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  };

  //this function activates when user clicks on the microphone,video and turn the mike on/of turn the video on/off.
  let getUserMedia = async () => {
    //this function is used to get the media stream from the user. This will allow us to access the media stream from other components in the application.
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      navigator.mediaDevices
        .getUserMedia({ video: video, audio: audio })
        .then(getUserMediaSuccess)
        .then((stream) => {
          // handle stream
        })
        .catch((err) => {
          console.log(err);
        });
    } else {
      try {
        //if the user has turned off the video and audio, we will stop the media stream from the local video element. This will allow us to stop the video and audio in the video call.
        let tracks = localVideoRef.current.srcObject.getTracks();
        tracks.forEach((track) => {
          track.stop();
        });
      } catch (err) {
        console.log(err);
      }
    }
  };

  //this function is used to handle the message received from the server. This will allow us to handle the message received from the server and send it to the other users in the video call.
  let gotMessageFromServer = (fromId, message) => {
    let signal = JSON.parse(message);

    if (fromId !== socketIdRef.current) {
      if (signal.sdp) {
        connections[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(() => {
            if (signal.sdp.type === "offer") {
              connections[fromId]
                .createAnswer()
                .then((description) => {
                  connections[fromId]
                    .setLocalDescription(description)
                    .then(() => {
                      socketRef.current.emit(
                        "signal",
                        fromId,
                        JSON.stringify({
                          sdp: connections[fromId].localDescription,
                        }),
                      );
                    })
                    .catch((e) => console.log(e));
                })
                .catch((e) => console.log(e));
            }
          })
          .catch((e) => console.log(e));
      }

      if (signal.ice) {
        connections[fromId]
          .addIceCandidate(new RTCIceCandidate(signal.ice))
          .catch((e) => {
            console.log(e);
          });
      }
    }
  };

  let addMessage = () => {};

  //this method is for setting up a WebRTC + Socket.IO signaling flow
  let connectToSocketServer = () => {
    socketRef.current = io.connect(server_url, { secure: true });
    socketRef.current.on("signal", gotMessageFromServer);

    socketRef.current.on("connect", () => {
      socketRef.current.emit("join-call", window.location.href);

      socketIdRef.current = socketRef.current.id;

      socketRef.current.on("chat-message", addMessage);

      //this event is triggered when a user leaves the call. We will remove the video element of the user who left the call.
      socketRef.current.on("user-left", (id) => {
        //filter the video element of the user who left the call from the videos state.
        setVideo((videos) => videos.filter((video) => video.socketId !== id));
      });

      //this event is triggered when a user joins the call. We will add the video element of the user who joined the call.
      socketRef.current.on("user-joined", (id, clients) => {
        clients.forEach((socketListId) => {
          //here we are creating a new RTCPeerConnection for each user who joined the call. This will allow us to establish a peer-to-peer connection with each user in the call.
          connections[socketListId] = new RTCPeerConnection(
            peerConfigConnection,
          );

          //icecandidate -> icecandidate is a protocol used in webrtc to find the best path for media to travel between peers. it is used to signal the candidate information to the other peer. basciclly it is used to estblish a connection between peers.
          //also acts as media relay between peers.
          connections[socketListId].onicecandidate = (event) => {
            if (event.candidate != null) {
              socketRef.current.emit(
                "signal",
                socketListId,
                JSON.stringify({ ice: event.candidate }),
              );
            }
          };

          connections[socketListId].onaddstream = (event) => {
            let videoExists = videoRef.current.find(
              (video) => video.socketId === socketListId,
            );

            if (videoExists) {
              setVideo((video) => {
                const updatedVideos = videos.map((video) =>
                  //let A is connected to the sockeListId and A is sending the stream to B. So we will update the stream of A in the Videos
                  video.socketId === socketListId
                    ? { ...video, stream: event.stream }
                    : video,
                );

                videoRef.current = updatedVideos;
                return updatedVideos;
              });
            } else {
              let newVideo = {
                socketId: socketListId,
                stream: event.stream,
                autoPlay: true,
                playsInline: true,
              };

              setVideos((videos) => {
                const updatedVideos = [...videos, newVideo];
                videoRef.current = updatedVideos;
                return updatedVideos;
              });
            }
          };

          if (window.localStream !== undefined && window.localStream !== null) {
            connections[socketListId].addStream(window.localStream);
          } else {
            //TODO Black silence
            let blackSilence = (...args) =>
              new MediaStream([black(...args), silence()]);

            window.localStream = blackSilence();
            connections[socketListId].addStream(window.localStream);
          }
        });

        if (id === socketIdRef.current) {
          for (let id2 in connections) {
            if (id2 === socketIdRef.current) continue;

            try {
              connections[id2].addStream(window.localStream);
            } catch (err) {
              console.log(err);
            }

            connections[id2].createOffer().then((description) => {
              connections[id2]
                .setLocalDescription(description)
                .then(() => {
                  socketRef.current.emit(
                    "signal",
                    id2,
                    JSON.stringify({ sdp: connections[id2].localDescription }),
                  );
                })
                .catch((e) => {
                  console.log(e);
                });
            });
          }
        }
      });
    });
  };

  //useEffect to get the media stream from the user. This will allow us to access the media stream from other components in the application.
  useEffect(() => {
    if (video !== undefined && audio !== undefined) {
      getUserMedia();
    }
  }, [video, audio]);

  //useEffect to get the permission for the video and audio from the user. If the user denies the permission, we will not be able to access the video and audio.
  useEffect(() => {
    getPermissions();
  }, []);

  let getMedia = () => {
    setVideo(videoAvailable);
    setAudio(audioAvailable);
    connectToSocketServer();
  };

  return (
    <div>
      {askForUserName === true ? (
        <div>
          <h2>Enter into Lobby</h2>
          <TextField
            id="outlined-basic"
            label="Username"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            variant="outlined"
          />

          <Button variant="contained" onClick={getMedia}>
            {" "}
            Connect
          </Button>

          <div>
            <video ref={localVideoRef} autoPlay muted></video>
          </div>
        </div>
      ) : (
        <>
          <video ref={localVideoRef} autoPlay muted></video>

          {videos.map((video) => (
            <div key={video.socketId}>
              <h2>{video.socketId}</h2>
              <video
                data-socket-id={video.socketId}
                ref={(ref) => {
                  if (ref && video.stream) {
                    ref.srcObject = video.stream;
                  }
                }}
                autoPlay
                playsInline
              ></video>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
