module.exports = class OcppJsonCall {

    constructor(messageId, messageType, action, payload) {
        this.messageType = messageType;
        this.messageId = messageId;
        
        this.action = action;
        this.payload = payload;
    }
}