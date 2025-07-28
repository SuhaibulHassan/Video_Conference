const express = require('express')
const firebase=require('firebase/app')
const { getStorage, ref, uploadBytesResumable, getDownloadURL }=require('firebase/storage')
const app = express()
const server = require('http').Server(app) 
const io = require('socket.io')(server)
const { v4: uuidV4 } = require('uuid')
const fs=require('fs')
const {exec}=require('child_process')
const path=require('path')
const multer = require('multer')
const inputFile=path.join(__dirname,'uploads/recording.webm')
const outputFile=path.join(__dirname,'output.mp4')
let userCount=0

// app.get('/', (req, res) => {
//   res.redirect(`/${uuidV4()}`)
// })
const firebaseConfig = {
  apiKey: "AIzaSyCD-OxNfBkE9s9BthbKNfVZEkxRzGo9_jI",
  authDomain: "video-chat-app-d596a.firebaseapp.com",
  projectId: "video-chat-app-d596a",
  storageBucket: "video-chat-app-d596a.firebasestorage.app",
  messagingSenderId: "1098844354467",
  appId: "1:1098844354467:web:d5fa3ae505dff212a68c16"
};
const firebase_app=firebase.initializeApp(firebaseConfig)
function uploadToFirebase(blob){
  const storageRef=getStorage(firebase_app)
  const fileRef=ref(storageRef,'videos/recording.webm');
  // const storageRef=ref(storage,'videos/recording.webm')
  // const uploadTask=fileRef.put(blob);
  const uploadTask=uploadBytesResumable(fileRef,blob)
  console.log(fileRef);
  console.log(blob);
  uploadTask.on('state-changed',
    (snapshot)=>{
     const progress=(snapshot.bytesTransferred/snapshot.totalBytes)*100;
     console.log('Upload is'+progress+'%done');
    },
    (error)=>{
      console.error("Error uploading the file:",error);
    },
    ()=>{
      uploadTask.snapshot.ref.getDownloadUrl().then((downloadedUrl)=>{
        console.log('File available at',downloadedUrl);
      })
    }
  )
}
//
const storage=multer.diskStorage({
  destination:(req,file,cb)=>{
    const uploadDir=path.join(__dirname,'uploads' );
      if(!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir);
      }
    cb(null,uploadDir);
  },
  filename:(req,file,cb)=>{
    cb(null,'recording.webm')
  }
})
const upload=multer({storage})

app.use(express.static(__dirname))

// Middleware to parse incoming form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

//
app.get('/:room', (req, res) => {
//   res.sendFile(__dirname+'/index.html', { roomId: req.params.room })
    res.redirect(`/index.html?roomId=${req.params.room}`);
})
io.on('connection', socket => {
  socket.on('join-room', (roomId, userId) => {
    userCount+=1;
    console.log(roomId);
    console.log(userId);
    socket.join(roomId)
    io.to(roomId).emit('user-connected', userId,userCount)
    

    socket.on('disconnect', () => {
      userCount-=1;
      io.to(roomId).emit('user-disconnected', userId,userCount)
    })
  })
})

function convertVideoToMp4(inputFile,outputFile){
  const ffmpegPath=require('ffmpeg-static')
  const command=`"${ffmpegPath}" -i "${inputFile}" -t 00:00:15 "${outputFile}"`;
  console.log(command);
  exec(command,(err,stdout,stderr)=>{
    if(err){
      console.error(`Error:${stderr}`);
      return;
    }
    console.log(`video converted and saved to:${outputFile}`);
  })
}

// The /upload POST endpoint where the file will be uploaded
app.post('/upload', upload.single('file'),(req, res) => {
  if(!req.file){
    return res.status(400).json({message:'No file uploaded'});
  }
  console.log(`File uploaded successfully:${req.file.path}`);
  convertVideoToMp4(req.file.path,outputFile)
  uploadToFirebase(req.file)
  res.json({message:'File uploaded successfully',fileName:req.file.filename})
});

server.listen(3000)
