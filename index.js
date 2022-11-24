const express = require('express');
const { createServer } = require('http');
const WebSocket = require('ws');

const app = express();
const port = 3000;

const server = createServer(app);
const wss = new WebSocket.Server({ server });
wss.on('connection', function(ws) {
  console.log("client joined.");
  ws.on('message', function(data) {
    console.log(data)
    // obj = JSON.parse(data)
    // ws[obj.type](obj.data)
    ws.send("cccccccccc")
  });

  ws.login = (data)=>{
    console.log("hahahahaha")
    console.log(data)
    
  }

  ws.on('close', function() {
    console.log("client left.");
  });
});

server.listen(port, function() {
  console.log(`Listening on http://localhost:${port}`);
});
