const express = require('express')
// const firebase=require('firebase/app')
// const { getStorage, ref, uploadBytesResumable, getDownloadURL }=require('firebase/storage')
const app = express()
const server = require('http').Server(app) 
const io = require('socket.io')(server)
// const { v4: uuidV4 } = require('uuid')
const fs=require('fs')
const {exec}=require('child_process')
const path=require('path')
const multer = require('multer')
const { log } = require('console')
const { Socket } = require('socket.io')
const inputFile=path.join(__dirname,'uploads/recording.webm')
const outputFile=path.join(__dirname,'output.mp4')
let userCount=0
let isFileUploaded=false;

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname,'home.html'))
})
const storage=multer.diskStorage({
  destination:(req,file,cb)=>{
    const uploadDir=path.join(__dirname,'uploads' );
      if(!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir);
      }
    cb(null,uploadDir);
  },
  filename:(req,file,cb)=>{
    cb(null,'recording.pdf')
  }
})
const upload=multer({storage})

app.use(express.static(__dirname))

// Middleware to parse incoming form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/uploads', express.static('uploads')); 
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
    socket.to(roomId).emit('user-connected', userId,userCount)
    

    socket.on('disconnect', () => {
      userCount-=1;
      io.to(roomId).emit('user-disconnected', userId,userCount)
    })

    socket.on("hand_raised",(data)=>{
      socket.to(roomId).emit("raiseEventFromServer",data)
    })

    socket.on("send_message",(username,message)=>{
      socket.to(roomId).emit("messageFromServer",username,message)
    })
    
    global.file_uploaded=function(file) {
      if (isFileUploaded) {
        const fileBuffer = fs.readFileSync(file)
        socket.emit("file_uploaded",fileBuffer)
      }
    }

    // socket.on("drawFromClient", (data) => {
    //   if (data.action === "draw") {
    //     io.to(roomId).emit("drawFromServer",data)    
    //   }
    // });

    // socket.on("startScreenShare",(data)=>{
    //   socket.to(roomId).emit("startScreenFromServer",data)
    // })

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
  res.json({message:'File uploaded successfully',fileName:req.file.filename})
});

app.post('/uploadFile', upload.single('file'),(req, res) => {
  if(!req.file){
    return res.status(400).json({message:'No file uploaded'});
  }
  console.log(`File uploaded successfully:${req.file.path}`);
  res.json({message:'File uploaded successfully',fileName:req.file.filename})
  isFileUploaded=true;
  console.log(req.file.path);
  
  file_uploaded(req.file.path)
});

// Serve the file download
app.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'uploads', req.params.filename);
  // Check if the file exists using fs.access
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).send('File not found');
    }
    // If file exists, send it as a download
    res.download(filePath); // Triggers the download of the file
    console.log(filePath);
    
  });
});

server.listen(3000)
