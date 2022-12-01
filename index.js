const express = require("express");
const { createServer } = require("http");
const WebSocket = require("ws");
const fs = require('fs');
const { v1: uuidv1, v4: uuidv4 } = require("uuid");
const axios = require("axios");
const { fstat } = require("fs");
const key = "SqgfZ1SE4v3OKlWezV1ft3PrP3O17zi0pEU2O1FcRQORp5YUjv";
const log = (...data) =>{
  console.log(...data)
  let str = ""
  for(const dt of data){
    if (typeof dt == "object"){
      str += JSON.stringify(dt, null, "\t") +"\n"
    }
    else{
      str += dt + "\t"
    }
  }
  fs.appendFileSync(__dirname +"/log.txt",`\n [${new Date().toLocaleString("en-US").toString()}]:${str}`)
}
const URL =
  process.platform == "win32"
    ? "https://api.soccerlegend.devmini.com/"
    : "https://api.soccerlegend.devmini.com/";

const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("<h1>Hello world v: 1-12-2022 08:42</h1>");
});

const server = createServer(app);
const wss = new WebSocket.Server({ server });

wss.sendRoom = (roomID, data) => {
  wss.clients.forEach((client) => {
    if (client.roomID == roomID) {
      client.send(data);
    }
  });
};

wss.on("connection", function (ws, req) {
  ws.id = uuidv4();
  log("client joined.",ws.id);  
  ws.send("v: 1-12-2022 08:42");
  ws.on("message", function (data) {
    try {
      log(data);
      log(ws._token);
      obj = JSON.parse(data);
      if (obj.type)
        if (ws[obj.type]) {
          ws[obj.type](obj.data);
        }
    } catch (err) {
      ws.send("error: " + err.message);
    }
  });

  ws.login = async (data) => {
    log("login", ws.id)
    try {
      await axios
        .post(URL + "account/get-account", {
          _token: data,
          key: key,
        })
        .then((res) => {
          ws.account = res.data.account;
          log(res.data.account)
        });   
    } catch (err) {
      ws.send("error: " + err.message);
    }
  };

  ws.createRoom = async (data) => {
    try {
      log("createRoom", ws.id);
      let account = await ws.getAccount(data._token)
      if (account._token == data._token) {
        log("createRoom token")
        ws.roomID = data.roomID;
        ws.clientID = data.clientID;
        ws.IsMaster = true;
        ws.send(
          JSON.stringify({
            type: "onServerCreateRoom",
            data: "Success",
          })
        );
      } else {
        ws.send({
          type: "onServerCreateRoom",
          data: "Fail",
        });
      }
    } catch (err) {
      ws.send("error: " + err.message);
    }
  };

  ws.joinRoom = async (data) => {
    try {
      log("joinRoom", ws.id);
      let account = await ws.getAccount(data._token)
      if (account._token == data._token) {
        log("joinRoom token")
        ws.roomID = data.roomID;
        ws.clientID = data.clientID;
        ws.send(
          JSON.stringify({
            type: "onServerCreateRoom",
            data: "Success",
          })
        );
      } else {
        ws.send({
          type: "onServerCreateRoom",
          data: "Fail",
        });
      }
    } catch (err) {
      ws.send("error: " + err.message);
    }
  };

  ws.onGameBeginStart = (data) => {
    try {
      log("onGameBeginStart", ws.id);
      if (ws.IsMaster) {
        let playerList = [];
        wss.clients.forEach((client) => {
          if (client.roomID == ws.roomID) {
            playerList.push(client);
          }
        });
        playerList = shuffle(playerList);
        let MaxPlayer = playerList.length;
        let playerTeam = [];
        playerList.forEach((client, i) => {
          if (i < MaxPlayer / 2) {
            client.team = {
              UserID: client.clientID,
              team: 0,
              position: i,
              account_id: client.account.id,
            };
          } else {
            client.team = {
              UserID: client.clientID,
              team: 1,
              position: i - MaxPlayer / 2,
              account_id: client.account.id,
            };
          }
          playerTeam.push(client.team);
        });

        wss.sendRoom(
          ws.roomID,
          JSON.stringify({
            type: "receiveTeamFromSever",
            data: JSON.stringify({ Items: playerTeam }),
          })
        );
      }
    } catch (err) {
      ws.send("error: " + err.message);
    }
  };

  ws.disconnectPhoton = (data) => {
    try {
      log("disconnectPhoton", ws.id);
      roomID = ws.roomID;
      ws.roomID = undefined;
      ws.clientID = undefined;
      if (ws.IsMaster) {
        ws.setNewMastser(roomID);
      }
    } catch (err) {
      ws.send("error: " + err.message);
    }
  };

  ws.setNewMastser = (roomID) => {
    try {
      let playerList = [];
      wss.clients.forEach((client) => {
        if (client.roomID == roomID) {
          playerList.push(client);
        }
      });
      if (playerList.length > 0) {
        let rd = Math.floor(Math.random() * playerList.length);
        let client = playerList[rd];
        client.IsMaster = true;
        ws.IsMaster = undefined;
        wss.sendRoom(
          roomID,
          JSON.stringify({
            type: "setNewMaster",
            data: client.clientID,
          })
        );
      }
    } catch (err) {
      ws.send("error: " + err.message);
    }
  };

  ws.sendResult = async (data) => {
    try {
      log("sendResult", ws.id);
      redScore = data.redScore;
      blueScore = data.blueScore;
      if (ws.IsMaster) {
        let playerTeam = [];
        wss.clients.forEach((client) => {
          if (client.roomID == ws.roomID) {
            playerTeam.push(client.team);
          }
        });
        let data = {
          key: key,
          redScore: redScore,
          blueScore: blueScore,
          playerTeam: playerTeam,
          master: ws.account.id,
        };
        log(URL + "game/send-game-results");
        axios
          .post(URL + "game/send-game-results", data)
          .then((response) => {
            wss.clients.forEach(async (client) => {
              axios
                .post(URL + "player/get-player", {
                  key: key,
                  account_id: client.account.id,
                })
                .then((res) => {
                  client.send(
                    JSON.stringify({
                      type: "endGame",
                      data: JSON.stringify({
                        player: JSON.stringify(res.data.player),
                        gameID: response.data.gameID,
                      }),
                    })
                  );
                });
            });
          })
          .catch(function (error) {
            log(error);
          });
      }
    } catch (err) {
      ws.send("error: " + err.message);
    }
  };

  ws.getAccount = async (_token) =>{
    if(ws.account == null){
      try {
        await axios
          .post(URL + "account/get-account", {
            _token: _token,
            key: key,
          })
          .then((res) => {
            ws.account = res.data.account;
            log(res.data.account)
          });   
        return ws.account
      } catch (err) {
        ws.send("error: " + err.message);
      }
    }
    return ws.account
  }

  ws.on("close", function () {
    log("client left.", ws.id);
    if (ws.IsMaster) {
      ws.setNewMastser(ws.roomID);
    }
  });
});

server.listen(port, function () {
  log(`Listening on http://localhost:${port}`);
});

function shuffle(array) {
  let currentIndex = array.length,
    randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex != 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}
