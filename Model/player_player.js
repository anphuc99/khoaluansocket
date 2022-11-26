const Model = require("@longanphuc/orm-mysql").Model
class player_player extends Model {
    constructor(){
        super("player_player")
        this.$primaryKey = "account_id"
        this.account_id = undefined
        this.name = undefined
        this.level = undefined
        this.exp = undefined
        this.fans = undefined
        this.speed = undefined
        this.jump = undefined
        this.shotForce = undefined
        this.point = undefined      
    }
}

module.exports = player_player