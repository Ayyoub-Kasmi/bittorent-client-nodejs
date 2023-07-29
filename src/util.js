'use strict'

const crypto = require('crypto');

let clientId = null;

module.exports.generateClientId = ()=>{
    if(!clientId){
        clientId = crypto.randomBytes(20);
        Buffer.from('AT0001--').copy(clientId, 0); //add the 'AT0001' optional prefix (for Allen Torrent), an optional way to identify known torrent clients
    }

    return clientId;
}