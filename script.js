const socket = io('/')
const videoGrid = document.getElementById('video-grid')
let mediaRecorder;
let recordedChunks=[];
const myPeer = new Peer(undefined, {
  host: '/',
  port: '3001'
})
//
function startClientRecording(stream){
  mediaRecorder=new MediaRecorder(stream);
  mediaRecorder.ondataavailable=(event)=>{
    recordedChunks.push(event.data)
  };
  mediaRecorder.onstop=()=>{
    const recordedBlob=new Blob(recordedChunks,{type:'video/webm'});
    const recordedUrl=URL.createObjectURL(recordedBlob);
    uploadToServer(recordedBlob);
  }
  document.getElementById('record_start').addEventListener('click',()=>{
    mediaRecorder.start();
    console.log("start recording");
  })
  document.getElementById('record_stop').addEventListener('click',()=>{
    mediaRecorder.stop();
  })
}

function uploadToServer(blob){
  const formData=new FormData();
  formData.append('file',blob,'recording.webm');
  console.log([...formData.entries()]);
  if(formData){
    console.log("formData");
    
  }
  console.log(formData);
  
  fetch('/upload',{
    method:'POST',
    body:formData,
  })
  .then(response=>response.json())
  .then(data=>{
    console.log('upload successful:',data);
  })
  .catch(error=>{
    console.error('Error uploading the file:',error)
  })
}
//
let connectionSpeed;
if ('connection' in navigator) {
  connectionSpeed = navigator.connection.downlink; // in Mbps
  console.log(`Current network speed: ${connectionSpeed} Mbps`);
}
const getVideoConstraints = (connectionSpeed) => {
  if (connectionSpeed >= 2) {
      return { frameRate: 30 } ; // High resolution
  } else if (connectionSpeed >= 1) {
      return { frameRate: 20 } ; // Medium resolution
  } else if( connectionSpeed >=0.5){
      return { frameRate: 10 } ; // Low resolution
  } else{
    return false
  }
};

let stream;
let screenStream;
let isScreenSharing=false;
let localVideoTrack;
let callListenerSet=false;

const myVideo = document.createElement('video')
myVideo.id='local-video'
myVideo.style.position='relative'
myVideo.style.width='300px'
myVideo.style.height='300px'
myVideo.muted = true
const peers = {}
const constraints=getVideoConstraints(connectionSpeed)
console.log(constraints);
navigator.mediaDevices.getUserMedia({
  video:constraints,
  audio: {
    noiseSuppression:true,
    echoCancellation:true
  }
}).then(userStream => {
  stream=userStream
  addVideoStream(myVideo, stream)

  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const gainNode = audioContext.createGain();

  // Connect the source to the gain node and the gain node to the destination
  source.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Function to adjust the gain value based on user input
  function setMicrophoneSensitivity(value) {
      gainNode.gain.value = Math.min(Math.max(value, 0), 2); // Clamping between 0 and 2
  }

  // Example: Adjust gain based on slider input
  const sensitivitySlider = document.getElementById('sensitivitySlider');
  sensitivitySlider.addEventListener('input', (event) => {
      setMicrophoneSensitivity(event.target.value);
  });

  startClientRecording(stream)

  socket.on('user-connected',( userId, userCount) => {
    console.log("User connected:"+userId);
    if(!isScreenSharing){
      connectToNewUser(userId, stream)
    }
    else{
      connectToNewUser(userId,screenStream)
    }
    document.getElementById('userCount').innerText=`${userCount} users`
  })
})

myPeer.on('call', call => {
  call.answer(stream)
  const video = document.createElement('video')
  video.id='remote-video'
  video.style.position='relative';
  video.style.width='300px';
  video.style.height='300px';
  // if(!isScreenSharing){
  //   video.className='stream-video'
  // }
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream)
  })
})

socket.on('user-disconnected',( userId,userCount ) => {
  if (peers[userId]) peers[userId].close()
    document.getElementById('userCount').innerText=`${userCount} users`
})

myPeer.on('open', id => {
  socket.emit('join-room', ROOM_ID, id)
})

function connectToNewUser(userId, stream) {
  const call = myPeer.call(userId, stream)
  const video = document.createElement('video')
  video.id='remote-video'
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream)
  })
  call.on('close', () => {
    video.remove()
  })

  peers[userId] = call
}

function addVideoStream(video, stream) {
  video.srcObject = stream
  video.addEventListener('loadedmetadata', () => {
    video.play()
  })
  
  videoGrid.append(video)
}

function modifyVideoStream(video,stream){
  video.srcObject=stream
  video.addEventListener('loadedmetadata',()=>{
    video.play()
  })
}

document.getElementById('applyResolution').addEventListener('click',()=>{
  const resolution=document.getElementById('videoResolutions').value;
  adjustDisplaySize('local-video',resolution)
  const videoElements=document.querySelectorAll('#remote-video');
  videoElements.forEach((videoElement)=>{
    adjustDisplaySize(videoElement.id,resolution)
    console.log(videoElement);
    
  })
  function adjustDisplaySize(videoId,resolution) {
    const videoElement=document.getElementById(videoId);
    const videoGrid=document.getElementById('video-grid')
    switch(resolution){
      case '720p':
        videoElement.style.width='1280px';
        videoElement.style.height='720px';
        videoGrid.style.gridTemplateColumns='repeat(auto-fill, 1280px)';
        videoGrid.style.gridAutoRows='720px'
        break;
      case '480p':
        videoElement.style.width='640px';
        videoElement.style.height='480px';
        videoGrid.style.gridTemplateColumns='repeat(auto-fill, 640px)';
        videoGrid.style.gridAutoRows='480px'
        break;
      case '360p':
        videoElement.style.width='480px';
        videoElement.style.height='360px';
        videoGrid.style.gridTemplateColumns='repeat(auto-fill, 480px)';
        videoGrid.style.gridAutoRows='360px'
        break;
    }
  }
})

 // Mute Audio
const muteAudioBtn = document.getElementById('muteAudioBtn');
muteAudioBtn.addEventListener('click', () => {
  console.log("clicked");
  const localAudioTrack = stream.getAudioTracks()[0];
  localAudioTrack.enabled = !localAudioTrack.enabled;
  muteAudioBtn.textContent = localAudioTrack.enabled ? "Mute Audio" : "Unmute Audio";
});

const muteVideoBtn = document.getElementById('muteVideoBtn');
muteVideoBtn.addEventListener('click', () => {
  console.log("clicked");
  localVideoTrack = stream.getVideoTracks()[0];
  localVideoTrack.enabled = !localVideoTrack.enabled;
  muteVideoBtn.textContent = localVideoTrack.enabled ? "Disable Video" : "Enable Video";
});

const screenButton=document.getElementById('screenShare');
screenButton.addEventListener('click',()=>{
  if(!isScreenSharing){
    navigator.mediaDevices.getDisplayMedia({
      video:true
    }).then(newScreenStream=>{
      if(screenStream){
        screenStream.getTracks().forEach(track=>track.stop())
      }
      screenStream=newScreenStream;
      console.log(myPeer);
      myVideo.id='stream-video'
      modifyVideoStream(myVideo, screenStream);

      const screenTrack=screenStream.getVideoTracks()[0];

      for(let userId in peers){
        const peer=peers[userId];
        console.log(peer);
        replaceTrack(peer,screenTrack); 
    }
    isScreenSharing=true;
    });
  }else{
    modifyVideoStream(myVideo,stream);
    localVideoTrack=stream.getVideoTracks()[0]
    replaceTrack(myPeer,localVideoTrack)
    for(let userId in peers){
      const peer=peers[userId];
      replaceTrack(peer,localVideoTrack)
    }
    isScreenSharing=false;
  }
})

function replaceTrack(peer,newTrack){
  if(peer.peerConnection){
    const sender = peer.peerConnection.getSenders().find(sender=>sender.track.kind=="video")
    console.log(sender);
    if(sender){
      sender.replaceTrack(newTrack);
    }else{
      console.error("No video sender found for the peer.");
    }
  }
}

let annotationEnabled = false;
document.getElementById("toggleAnnotate").addEventListener("click", function() {
  const local_video = document.getElementById("stream-video");
  const canvas=document.createElement('canvas')
  canvas.className='myCanvas'
  videoGrid.appendChild(canvas)
  const ctx = canvas.getContext("2d");
  if (local_video) {
    console.log(local_video.style);
  }
  ctx.drawImage(local_video, 0, 0, local_video.width, local_video.height);
  let drawing = false;
  annotationEnabled = !annotationEnabled;
  if (annotationEnabled) {
      canvas.style.pointerEvents = 'auto'; // Allow drawing
  } else {
      canvas.style.pointerEvents = 'none'; // Disable drawing
  }

  // const canvas = document.getElementById("annotationCanvas");
canvas.addEventListener("mousedown", (e) => {
    drawing = true;
    ctx.moveTo(e.clientX, e.clientY);
});

canvas.addEventListener("mousemove", (e) => {
    if (drawing) {
        ctx.lineTo(e.clientX, e.clientY);
        ctx.stroke();
    }
});

canvas.addEventListener("mouseup", () => {
  drawing = false;
});

// Emit drawing events to other participants
canvas.addEventListener("mousemove", (e) => {
  if (drawing) {
    socket.emit("drawFromClient", {
      x: e.clientX,
      y: e.clientY,
      action: "draw", // can be "draw", "erase", etc.
    });
  }
});
});

const username=sessionStorage.getItem('username')
console.log(username);
document.getElementById('raise_hand').addEventListener('click',()=>{
  socket.emit("hand_raised",username)
})

socket.on("raiseEventFromServer",(data)=>{
  console.log(data);
  document.getElementById("handraise_status").innerText=`${data} raised hand.`
})

setInterval(async () => {
  const currentSpeed = navigator.connection.downlink;
  console.log(`Current network speed: ${currentSpeed} Mbps`);
  if(connectionSpeed!=currentSpeed){
    navigator.mediaDevices.getUserMedia({
      video:true
    }).then(newScreenStream=>{
      if(screenStream){
        screenStream.getTracks().forEach(track=>track.stop())
      }
      screenStream=newScreenStream;
      // console.log(myPeer);
      myVideo.id='stream-video'
      modifyVideoStream(myVideo, screenStream);
  
      const screenTrack=screenStream.getVideoTracks()[0];
  
      for(let userId in peers){
        const peer=peers[userId];
        console.log(peer);
        replaceTrack(peer,screenTrack); 
    }
  })
  connectionSpeed=currentSpeed;
  } 
}, 5000);

document.getElementById('send_message').addEventListener('click',()=>{
  const files=document.getElementById('fileInput').files;
  if (files[0]) {
    uploadFileToServer(files[0])
  }
  const message=document.getElementById('message_box').value
  const message_holder=document.createElement('p')
  message_holder.innerText=username+":"+message
  socket.emit("send_message",username,message)
  document.getElementById('chatbox').appendChild(message_holder)
})

socket.on("messageFromServer",(username,message)=>{
  const message_holder=document.createElement('p')
  message_holder.innerText=username+":"+message
  document.getElementById('chatbox').appendChild(message_holder)
})

const chatboxButton=document.getElementById('chatboxButton').addEventListener('click',()=>{
  document.getElementById('video-grid').style.width='70%';
  document.getElementById('chatbox').style.display='unset';
})

function uploadFileToServer(file){
  const formData=new FormData();
  formData.append('file',file);
  console.log([...formData.entries()]);
  if(formData){
    console.log("formData");
  }
  console.log(formData);
  
  fetch('/uploadFile',{
    method:'POST',
    body:formData,
  })
  .then(response=>response.json())
  .then(data=>{
    console.log('upload successful:',data);
  })
  .catch(error=>{
    console.error('Error uploading the file:',error)
  })
}

socket.on("file_uploaded",(fileBuffer)=>{
  // console.log(data);
  const file_message=document.createElement('a')
  const file = new Blob([fileBuffer],{type:'text/plain'});
  const url = URL.createObjectURL(file);
  file_message.href=url;
  console.log(url);
  file_message.download=true;
  file_message.textContent='Download';
  document.getElementById('chatbox').appendChild(file_message);
})
