const socket = io('/')
document.getElementById('callButton').addEventListener('click',()=>{
    console.log("hi"); 
    const randomNum = Math.floor(Math.random() * 1000);  
    console.log(randomNum);
    document.getElementById('call_id').value=randomNum;
  })
document.getElementById('answerButton').addEventListener('click',()=>{
  let value1=document.getElementById('callInput').value
  let username=document.getElementById('username').value
  // socket.emit("joinEvent",username)
  sessionStorage.setItem('username',username)
  document.getElementById('anchor').href=value1
})
