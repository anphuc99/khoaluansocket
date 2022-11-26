const express = require("express");
const { createServer } = require("http");
const WebSocket = require("ws");
const mysql = require("mysql2");
const axios = require("axios");
const Context = require("@longanphuc/orm-mysql").Context;
const Player = require("./Model/player_player");
const Game = require("./Model/game_game");
const GameInfo = require("./Model/game_gameinfo");
const Account = require("./Model/account_account");
const Connection = require("@longanphuc/orm-mysql/connection");
const { 
  v1: uuidv1,
  v4: uuidv4,
} = require('uuid');


const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('<h1>Hello world v: 26-11-2022</h1>');
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
  console.log("client joined.");
  ws.id = uuidv4()
  console.log(ws.id)
  ws.send("v: 26-11-2022")
  ws.on("message", function (data) {
    console.log(data);
    console.log(ws._token);
    obj = JSON.parse(data);
    if (obj.type)
      if (ws[obj.type]) {
        ws[obj.type](obj.data);
      }
  });

  ws.login = async (data) => {
    let account_context = new Context(Account);
    let account = await account_context.where("_token", data).first();
    if (account !== undefined) {      
      ws.account = account.toObject();
      wss.clients.forEach(client => {
        if (client.account.id == ws.account.id && client.id != ws.id){
          client.send(JSON.stringify({
            type: "login",
            data: ""
          }))
        }
      })
    }
  };

  ws.createRoom = async (data) => {
    console.log("createRoom");
    if (ws.account._token == data._token) {
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
  };

  ws.joinRoom = (data) => {
    console.log("joinRoom");
    if (ws.account._token == data._token) {
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
  };

  ws.onGameBeginStart = (data) => {
    console.log("onGameBeginStart");
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
  };

  ws.disconnectPhoton = (data) => {
    console.log("disconnectPhoton");
    roomID = ws.roomID;
    ws.roomID = undefined;
    ws.clientID = undefined;
    if (ws.IsMaster) {
      ws.setNewMastser(roomID);
    }
  };

  ws.setNewMastser = (roomID) => {
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
  };

  ws.sendResult = async (data) => {
    redScore = data.redScore;
    blueScore = data.blueScore;
    if (ws.IsMaster) {
      Connection.beginTransaction();
      try {
        let game = new Game();
        game.redScore = redScore;
        game.blueScore = blueScore;
        game.master = ws.account.id;
        var today = new Date();
        var date =
          today.getFullYear() +
          "-" +
          (today.getMonth() + 1) +
          "-" +
          today.getDate();
        var time =
          today.getHours() +
          ":" +
          today.getMinutes() +
          ":" +
          today.getSeconds();
        var dateTime = date + " " + time;
        game.date = dateTime;
        await game.save();
        for (const client of wss.clients) {
          if (client.roomID == ws.roomID) {
            let gameInfo = new GameInfo();
            let player_context = new Context(Player);
            let player = await player_context.find(client.account.id);
            gameInfo.gameID = game.id;
            gameInfo.playerID = client.account.id;
            gameInfo.team = client.team.team;
            gameInfo.name = player.name;
            gameInfo.level = player.level;
            gameInfo.save();
            ws.setNewAttribule(redScore, blueScore, player, client);
            player.update();
          }
        }
        Connection.commit();
        for (const client of wss.clients) {
          if (client.roomID == ws.roomID) {
            let player_context = new Context(Player);
            let player = await player_context.find(ws.account.id);
            client.send(
              JSON.stringify({
                type: "endGame",
                data: JSON.stringify({
                  player: JSON.stringify(player.toObject()),
                  gameID: game.id,
                }),
              })
            );
          }
        }
      } catch {
        Connection.rollback();
      }
    }
  };

  ws.setNewAttribule = (redScore, blueScore, player, client) => {
    if (redScore > blueScore) {
      if (client.team.team == 0) {
        player.fans += 100;
        ws.addExp(player, 80);
      } else {
        player.fans -= 50;
        ws.addExp(player, 20);
      }
    } else if (blueScore > redScore) {
      if (client.team.team == 1) {
        player.fans += 100;
        ws.addExp(player, 80);
      } else {
        player.fans -= 50;
        ws.addExp(player, 20);
      }
    } else {
      ws.addExp(player, 50);
    }
  };

  ws.addExp = (player, exp) => {
    if (player.level < 30) {
      player.exp += exp;
      if (player.exp >= Math.floor(Math.pow(1.4, player.level - 1) + 800)) {
        player.level += 1;
        if (player.level < 30) {
          player.exp -= Math.floor(Math.pow(1.4, player.level - 1) + 800);
        } else {
          player.exp = 0;
        }
        player.point += 1;
      }
    }
  };

  ws.on("close", function () {
    console.log("client left.");
    if (ws.IsMaster) {
      ws.setNewMastser(ws.roomID);
    }
  });
});

server.listen(port, function () {
  console.log(`Listening on http://localhost:${port}`);
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
