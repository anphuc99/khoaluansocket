const express = require('express');
const { createServer } = require('http');
const WebSocket = require('ws');

const app = express();
const port = 3000;

const server = createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', function(ws) {
  console.log("client joined.");

  // send "hello world" interval
  const textInterval = setInterval(() => ws.send("hello world!"), 100);

  ws.on('message', function(data) {
    if (typeof(data) === "string") {
      // client sent a string
      console.log("string received from client -> '" + data + "'");

    } else {
      console.log("binary received from client -> " + Array.from(data).join(", ") + "");
    }
  });

  ws.on('close', function() {
    console.log("client left.");
    clearInterval(textInterval);
  });
});

server.listen(port, function() {
  console.log(`Listening on http://localhost:${port}`);
});
