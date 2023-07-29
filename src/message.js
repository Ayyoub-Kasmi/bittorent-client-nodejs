'use strict'

const Buffer = require('buffer').Buffer;
const torrentParser = require('./torrent-parser.js');
const util = require('./util.js');

/***
 * message types by id @description
 * 0 : choke
 * 1 : unchoke
 * 2 : intersted
 * 3 : uninterested
 * 4 : have (payload: piece index)
 * 5 : bitfield (payload: bitfield)
 * 6 : request (piece) (payload: piece index, begin, length)
 * 7 : piece (payload: piece index, begin, block)
 * 8 : cancel (payload: piece index, begin, length)
 * 9 : port (payload: listen-port)
 */

module.exports.buildHandshake = torrent => {
    //handshake format: <pstrlen><pstr><reserved><info_hash><peer_id>
    //For BitTorrent protocol, pstrlen = 19, pstr = "BitTorrent protocol", reservered = 0

    const message = Buffer.alloc(68);

    //pstrlen (1 byte)
    message.writeUInt8(19, 0);
    
    //pstr
    message.write('BitTorrent protocol', 1);

    //reserved (8 bytes)
    message.writeUInt32BE(0, 20);
    message.writeUInt32BE(0, 24);

    //info hash (5 bytes)
    torrentParser.infoHash(torrent).copy(message, 28);

    console.log('handshake being sent (client id missing): ', message);
    //peer (client) id (20 bytes)
    return Buffer.concat([message, util.generateClientId()]);
}

module.exports.buildKeepAlive = () => Buffer.alloc(4);

module.exports.buildChoke = () => {
    const message = Buffer.alloc(5);

    //message content length
    message.writeUInt32BE(1, 0);

    //type id
    message.writeUInt8(0, 4);

    return message;
}

module.exports.buildUnchoke = () => {
    const message = Buffer.alloc(5);

    //message content length
    message.writeUInt32BE(1, 0);

    //type id
    message.writeUInt8(1, 4);

    return message;
}

module.exports.buildInterested = () => {
    console.log('Sending interested after handshake was recieved...');
    const message = Buffer.alloc(5);

    //message content length
    message.writeUInt32BE(1, 0);

    //type id
    message.writeUInt8(2, 4);

    return message;
}

module.exports.buildUninterested = () => {
    const message = Buffer.alloc(5);

    //message content length
    message.writeUInt32BE(1, 0);

    //type id
    message.writeUInt8(3, 4);

    return message;
}

module.exports.buildHave = payload => {
    const message = Buffer.alloc(9);

    //message content length
    message.writeUInt32BE(5, 0);

    //type id
    message.writeUInt8(4, 4);

    //piece index
    message.writeUInt32BE(payload, 5);

    return message;
}

module.exports.buildBitfield = bitfield => {
    const message = Buffer.alloc(bitfield.length + 1 + 4);

    //message content length
    message.writeUInt32BE(bitfield.length + 1, 0);

    //type id
    message.writeUInt8(5, 4);

    //bitfield
    bitfield.copy(message, 5);

    return message;
}

module.exports.buildRequestPiece = payload => {
    const message = Buffer.alloc(17);

    //message content length
    message.writeUInt32BE(13, 0);

    //type id
    message.writeUInt8(6, 4);

    //piece index
    message.writeUInt32BE(payload.index, 5);

    //begin
    message.writeUInt32BE(payload.begin, 9);

    //payload length
    message.writeUInt32BE(payload.length, 13);

    console.log("Piece request message: ", message);

    return message;
}

module.exports.buildPiece = payload => {
    const message = Buffer.alloc(payload.block.length + 13);

    //message content length
    message.writeUInt32BE(payload.block.length + 9, 0);

    //type id
    message.writeUInt8(7, 4);

    // piece index
    message.writeUInt32BE(payload.index, 5);

    // begin
    message.writeUInt32BE(payload.begin, 9);

    // block
    payload.block.copy(message, 13);

    return message;
}

module.exports.buildCancel = payload => {
    const message = Buffer.alloc(17);

    // message content length
    message.writeUInt32BE(13, 0);

    // type id
    message.writeUInt8(8, 4);

    // piece index
    message.writeUInt32BE(payload.index, 5);

    // begin
    message.writeUInt32BE(payload.begin, 9);

    // payload length
    message.writeUInt32BE(payload.length, 13);

    return message;
};

module.exports.buildPort = payload => {
    const message = Buffer.alloc(7);
    
    // message content length
    message.writeUInt32BE(3, 0);

    // type id
    message.writeUInt8(9, 4);

    // listen-port
    message.writeUInt16BE(payload, 5);
    
    return message;
};

module.exports.parse = message => {

    const result = {};

    //content size
    result.size = message.readUInt32BE(0);

    //message id
    result.typeId = message.length > 4 ? message.readUInt8(4) : null; //the id is the 5th byte of the message

    //payload data
    const payload = message.length > 5 ? message.slice(5) : null; //the payload starts from the 6th byte of the message

    if(result.typeId === 6 || result.typeId === 7 || result.typeId === 8){
        //type: "request", "piece response" or cancel ==> payload = (piece index, begin, length / block)

        result.payload = {
            index: payload.readInt32BE(0),
            begin: payload.readInt32BE(4),
        }

        result.payload[typeId === 7 ? 'block' : 'length'] === payload.slice(8); //the rest of the payload
    }else{
        result.payload = payload;
    }

    return result;
}