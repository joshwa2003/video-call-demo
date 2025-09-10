const socket = io("/");
const chatInputBox = document.getElementById("chat_message");
const all_messages = document.getElementById("all_messages");
const main__chat__window = document.getElementById("main__chat__window");
const videoGrid = document.getElementById("video-grid");
const myVideo = document.createElement("video");
myVideo.muted = true;

var peer = new Peer(undefined, {
  path: "/peerjs",
  host: "/",  // Change this to your Vercel domain if needed
  port: "443", // Use 443 for secure connections
  secure: true,
});


let myVideoStream;

var getUserMedia =
  navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia;

navigator.mediaDevices
  .getUserMedia({
    video: true,
    audio: true,
  })
  .then((stream) => {
    myVideoStream = stream;
    addVideoStream(myVideo, stream);

    peer.on("call", (call) => {
      call.answer(stream);
      const video = document.createElement("video");

      call.on("stream", (userVideoStream) => {
        addVideoStream(video, userVideoStream, call.peer); // Pass the peer ID
      });
    });

    socket.on("user-connected", (userId) => {
      connectToNewUser(userId, stream);
    });

    // Handle user disconnection
    socket.on("user-disconnected", (userId) => {
      console.log("User disconnected:", userId);
      removeVideoStream(userId);
    });


    socket.on("createMessage", (msg) => {
      console.log(msg);
      let li = document.createElement("li");
      li.innerHTML = msg;
      all_messages.append(li);
      main__chat__window.scrollTop = main__chat__window.scrollHeight;
    });
  });

peer.on("call", function (call) {
  getUserMedia(
    { video: true, audio: true },
    function (stream) {
      call.answer(stream); // Answer the call with an A/V stream.
      const video = document.createElement("video");
      call.on("stream", function (remoteStream) {
        addVideoStream(video, remoteStream, call.peer); // Pass the peer ID
      });
    },
    function (err) {
      console.log("Failed to get local stream", err);
    }
  );
});

peer.on("open", (id) => {
  console.log("My peer ID is:", id);
  socket.emit("join-room", ROOM_ID, id);
});

// CHAT

const connectToNewUser = (userId, streams) => {
  console.log("Connecting to new user:", userId);
  var call = peer.call(userId, streams);
  var video = document.createElement("video");
  call.on("stream", (userVideoStream) => {
    addVideoStream(video, userVideoStream, userId); // Pass the userId
  });
};

const videosPerPage = 9;
let currentPage = 1;

// Mobile layout variables
let isMobileLayout = false;
let mainSpeakerId = null;
let participants = new Map();

// Check if mobile layout should be used
const checkMobileLayout = () => {
  return window.innerWidth <= 768;
};

// Initialize layout based on screen size
const initializeLayout = () => {
  isMobileLayout = checkMobileLayout();
  const mobileLayout = document.querySelector('.mobile-video-layout');
  const desktopGrid = document.getElementById('video-grid');
  const paginationControls = document.querySelector('.pagination-controls');
  
  if (isMobileLayout) {
    mobileLayout.style.display = 'flex';
    desktopGrid.style.display = 'none';
    paginationControls.style.display = 'none';
  } else {
    mobileLayout.style.display = 'none';
    desktopGrid.style.display = 'grid';
    paginationControls.style.display = 'flex';
  }
};

// Handle window resize
window.addEventListener('resize', () => {
  const wasMobile = isMobileLayout;
  isMobileLayout = checkMobileLayout();
  
  if (wasMobile !== isMobileLayout) {
    initializeLayout();
    // Re-organize videos for new layout
    reorganizeVideos();
  }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', initializeLayout);

const addVideoStream = (videoEl, stream, userId) => {
  videoEl.srcObject = stream;
  videoEl.setAttribute("id", userId);
  videoEl.classList.add("video-participant");
  videoEl.addEventListener("loadedmetadata", () => {
    videoEl.play();
  });

  // Check if participant already exists to prevent duplicates
  if (participants.has(userId)) {
    console.log("Participant already exists:", userId);
    return;
  }

  // Store participant info
  participants.set(userId, { video: videoEl, stream: stream });

  // For desktop view: Always use consistent sizing regardless of source device
  if (isMobileLayout) {
    addToMobileLayout(videoEl, userId, stream);
  } else {
    // Ensure consistent video properties for desktop view
    videoEl.style.width = "100%";
    videoEl.style.height = "90%";
    videoEl.style.objectFit = "contain";
    videoEl.style.borderRadius = "8px";
    videoEl.style.backgroundColor = "#000000";
    videoEl.style.transform = "scaleX(-1)";
    videoEl.style.border = "2px solid #ffffff";
    videoEl.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.15)";
    
    videoGrid.append(videoEl);
    updateVideoPagination();
  }
};

const addToMobileLayout = (videoEl, userId, stream) => {
  // If this is our own video, add to own camera container
  if (userId === peer.id || videoEl.muted) {
    const ownCameraMobile = document.getElementById('ownCameraMobile');
    if (ownCameraMobile) {
      ownCameraMobile.srcObject = stream;
      ownCameraMobile.muted = true;
      ownCameraMobile.addEventListener('loadedmetadata', () => {
        ownCameraMobile.play();
      });
    }
    return;
  }

  // If no main speaker, make this the main speaker
  if (!mainSpeakerId) {
    setMainSpeaker(userId, videoEl, stream);
  } else {
    // Add to participants scroll
    addToParticipantsScroll(userId, videoEl, stream);
  }
};

const setMainSpeaker = (userId, videoEl, stream) => {
  mainSpeakerId = userId;
  const mainSpeaker = document.getElementById('mainSpeaker');
  const noSpeakerMessage = document.querySelector('.no-speaker-message');
  
  mainSpeaker.srcObject = stream;
  mainSpeaker.style.display = 'block';
  noSpeakerMessage.style.display = 'none';
  
  // Copy video properties
  mainSpeaker.muted = videoEl.muted;
  mainSpeaker.addEventListener('loadedmetadata', () => {
    mainSpeaker.play();
  });
};

const addToParticipantsScroll = (userId, videoEl, stream) => {
  const participantsScroll = document.getElementById('participantsScroll');
  
  // Check if user already exists in participants scroll to prevent duplicates
  const existingParticipant = document.querySelector(`[data-user-id="${userId}"]`);
  if (existingParticipant) {
    console.log("User already exists in participants scroll:", userId);
    return;
  }
  
  // Create participant item
  const participantItem = document.createElement('div');
  participantItem.className = 'participant-item';
  participantItem.setAttribute('data-user-id', userId);
  
  // Clone video for participant scroll
  const participantVideo = document.createElement('video');
  participantVideo.srcObject = stream;
  participantVideo.muted = true; // Mute in scroll view
  participantVideo.addEventListener('loadedmetadata', () => {
    participantVideo.play();
  });
  
  // Add click handler to switch main speaker
  participantItem.addEventListener('click', () => {
    switchMainSpeaker(userId);
  });
  
  participantItem.appendChild(participantVideo);
  participantsScroll.appendChild(participantItem);
};

const switchMainSpeaker = (newSpeakerId) => {
  if (newSpeakerId === mainSpeakerId) return;
  
  const currentMainParticipant = participants.get(mainSpeakerId);
  const newMainParticipant = participants.get(newSpeakerId);
  
  if (currentMainParticipant && newMainParticipant) {
    // Move current main speaker to scroll
    addToParticipantsScroll(mainSpeakerId, currentMainParticipant.video, currentMainParticipant.stream);
    
    // Remove new main speaker from scroll
    const participantItem = document.querySelector(`[data-user-id="${newSpeakerId}"]`);
    if (participantItem) {
      participantItem.remove();
    }
    
    // Set new main speaker
    setMainSpeaker(newSpeakerId, newMainParticipant.video, newMainParticipant.stream);
  }
};

const reorganizeVideos = () => {
  if (isMobileLayout) {
    // Clear mobile layout
    const participantsScroll = document.getElementById('participantsScroll');
    participantsScroll.innerHTML = '';
    const mainSpeaker = document.getElementById('mainSpeaker');
    mainSpeaker.style.display = 'none';
    document.querySelector('.no-speaker-message').style.display = 'flex';
    mainSpeakerId = null;
    
    // Re-add all participants to mobile layout
    participants.forEach((participant, userId) => {
      addToMobileLayout(participant.video, userId, participant.stream);
    });
  } else {
    // Move all videos back to desktop grid
    videoGrid.innerHTML = '';
    participants.forEach((participant, userId) => {
      videoGrid.append(participant.video);
    });
    updateVideoPagination();
  }
};

const updateVideoPagination = () => {
  const videos = Array.from(document.querySelectorAll(".video-participant"));
  const totalPages = Math.ceil(videos.length / videosPerPage);

  // Update page indicator
  const pageIndicator = document.getElementById("pageIndicator");
  if (pageIndicator) {
    pageIndicator.textContent = `${currentPage} / ${totalPages || 1}`;
  }

  // Enable/disable buttons
  const prevButton = document.getElementById("prevPage");
  const nextButton = document.getElementById("nextPage");
  if (prevButton) prevButton.disabled = currentPage === 1;
  if (nextButton) nextButton.disabled = currentPage === totalPages || totalPages === 0;

  // Show only videos for current page
  videos.forEach((video, index) => {
    const start = (currentPage - 1) * videosPerPage;
    const end = start + videosPerPage;
    if (index >= start && index < end) {
      video.style.display = "block";
    } else {
      video.style.display = "none";
    }
  });
};

// Pagination button handlers
const goToPrevPage = () => {
  if (currentPage > 1) {
    currentPage--;
    updateVideoPagination();
  }
};

const goToNextPage = () => {
  const videos = document.querySelectorAll(".video-participant");
  const totalPages = Math.ceil(videos.length / videosPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    updateVideoPagination();
  }
};

// Attach event listeners for pagination buttons
document.addEventListener("DOMContentLoaded", () => {
  const prevButton = document.getElementById("prevPage");
  const nextButton = document.getElementById("nextPage");
  if (prevButton) prevButton.addEventListener("click", goToPrevPage);
  if (nextButton) nextButton.addEventListener("click", goToNextPage);
});

// Remove video stream when a user leaves
const removeVideoStream = (userId) => {
  console.log("Removing video stream for user:", userId);
  
  // Remove from participants map
  participants.delete(userId);
  
  if (isMobileLayout) {
    // Handle mobile layout removal
    if (userId === mainSpeakerId) {
      // Find new main speaker
      const remainingParticipants = Array.from(participants.keys()).filter(id => id !== peer.id);
      if (remainingParticipants.length > 0) {
        const newMainId = remainingParticipants[0];
        const newMainParticipant = participants.get(newMainId);
        
        // Remove from scroll first
        const participantItem = document.querySelector(`[data-user-id="${newMainId}"]`);
        if (participantItem) {
          participantItem.remove();
        }
        
        setMainSpeaker(newMainId, newMainParticipant.video, newMainParticipant.stream);
      } else {
        // No participants left
        const mainSpeaker = document.getElementById('mainSpeaker');
        const noSpeakerMessage = document.querySelector('.no-speaker-message');
        mainSpeaker.style.display = 'none';
        noSpeakerMessage.style.display = 'flex';
        mainSpeakerId = null;
      }
    } else {
      // Remove from participants scroll
      const participantItem = document.querySelector(`[data-user-id="${userId}"]`);
      if (participantItem) {
        participantItem.remove();
      }
    }
  } else {
    // Handle desktop layout removal
    const videoEl = document.getElementById(userId);
    if (videoEl) {
      videoEl.remove();
      updateVideoPagination();
    }
  }
};

const playStop = () => {
  let enabled = myVideoStream.getVideoTracks()[0].enabled;
  if (enabled) {
    myVideoStream.getVideoTracks()[0].enabled = false;
    setPlayVideo();
  } else {
    setStopVideo();
    myVideoStream.getVideoTracks()[0].enabled = true;
  }
};

const muteUnmute = () => {
  const enabled = myVideoStream.getAudioTracks()[0].enabled;
  if (enabled) {
    myVideoStream.getAudioTracks()[0].enabled = false;
    setUnmuteButton();
  } else {
    setMuteButton();
    myVideoStream.getAudioTracks()[0].enabled = true;
  }
};

const setPlayVideo = () => {
  const button = document.getElementById("playPauseVideo");
  button.innerHTML = `<i class="fa fa-video-camera" style="opacity: 0.5;"></i>`;
  button.classList.add("unmute");
  button.title = "Turn camera on";
};

const setStopVideo = () => {
  const button = document.getElementById("playPauseVideo");
  button.innerHTML = `<i class="fa fa-video-camera"></i>`;
  button.classList.remove("unmute");
  button.title = "Turn camera off";
};

const setUnmuteButton = () => {
  const button = document.getElementById("muteButton");
  button.innerHTML = `<i class="fa fa-microphone-slash"></i>`;
  button.classList.add("unmute");
  button.title = "Unmute";
};

const setMuteButton = () => {
  const button = document.getElementById("muteButton");
  button.innerHTML = `<i class="fa fa-microphone"></i>`;
  button.classList.remove("unmute");
  button.title = "Mute";
};

// Toggle Chat Box
const toggleChat = () => {
  const chatPanel = document.getElementById("chatPanel");
  const videoSection = document.querySelector(".video-section");
  
  if (chatPanel.classList.contains("open")) {
    chatPanel.classList.remove("open");
  } else {
    chatPanel.classList.add("open");
  }
};

// Close Chat
const closeChat = () => {
  const chatPanel = document.getElementById("chatPanel");
  chatPanel.classList.remove("open");
};

// Send Message
const sendMessage = () => {
  const chatInput = document.getElementById("chat_message");
  const message = chatInput.value.trim();
  
  if (message !== "") {
    socket.emit("message", message);
    chatInput.value = "";
  }
};

// Copy URL to Clipboard
const copyURL = () => {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    // Create a simple notification
    const notification = document.createElement("div");
    notification.textContent = "Meeting link copied to clipboard!";
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #202124;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 1001;
      font-size: 14px;
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 3000);
  });
};

// Leave Meeting
const leaveMeeting = () => {
  console.log("Leaving meeting...");
  socket.emit("user-disconnected", peer.id);
  window.location.href = "/";
};

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("chatButton").addEventListener("click", toggleChat);
  document.getElementById("inviteButton").addEventListener("click", copyURL);
  document.getElementById("leave-meeting").addEventListener("click", leaveMeeting);
  
  // Close chat button
  const closeChatButton = document.getElementById("closeChatButton");
  if (closeChatButton) {
    closeChatButton.addEventListener("click", closeChat);
  }
  
  // Send button
  const sendButton = document.getElementById("sendButton");
  if (sendButton) {
    sendButton.addEventListener("click", sendMessage);
  }
  
  // Enter key for chat input
  const chatInput = document.getElementById("chat_message");
  if (chatInput) {
    chatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        sendMessage();
      }
    });
  }
});
