const Model = require("@longanphuc/orm-mysql").Model
class account_account extends Model {
    constructor(){
        super("Account_account")
        this.$primaryKey = "id"
        this.id = undefined
        this.name = undefined
        this.email = undefined
        this.username = undefined
        this.password = undefined
        this._token = undefined
        this.isUse = undefined
    }
}

module.exports = account_account