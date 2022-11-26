const Model = require("@longanphuc/orm-mysql").Model
class game_gameinfo extends Model {
    constructor(){
        super("Game_gameinfo")
        this.$primaryKey = "id"
        this.id = undefined
        this.gameID = undefined
        this.playerID = undefined
        this.team = undefined
        this.name = undefined
        this.level = undefined
    }
}

module.exports = game_gameinfo