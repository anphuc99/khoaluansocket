const Model = require("@longanphuc/orm-mysql").Model
class game_game extends Model {
    constructor(){
        super("Game_game")
        this.$primaryKey = "id"
        this.id = undefined
        this.redScore = undefined
        this.blueScore = undefined
        this.master = undefined
        this.date = undefined
    }
}

module.exports = game_game