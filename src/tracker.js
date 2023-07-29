'use strict'

const dgram = require('dgram'); //for the udp (socket) connection
const Buffer = require('buffer').Buffer;
const urlParse = require('url').parse;
const crypto = require('crypto');
const { toBufferBE } = require('bigint-buffer');
const torrentParser = require('./torrent-parser.js');
const util = require('./util.js');

module.exports.getPeers = (torrent, callback) => {
    const socket = dgram.createSocket('udp4');
    // const trackerUrl = torrent['announce-list'][1].toString('utf8'); //tracker url
    // const trackerUrl = 'udp://uploads.gamecoast.net:6969/announce';
    const trackerUrl = 'udp://tracker.opentrackr.org:1337/announce';

    console.log(torrent.announce.toString('utf8'));

    socket.on('error', error => {
        console.log(error);
    })

    socket.on('message', response => {

        
        if(responseType(response) === 'connect'){
            console.log('Connection response received from the tracker');
            //this is a reponse to a connection request

            // 2. parse the connection response and get the connection id
            const connectionResponse = parseConnectionResponse(response);

            // 3. send announce request
            const announceRequest = buildAnnounceRequest(connectionResponse.connection_id, torrent);
            udpSend(socket, announceRequest, trackerUrl);
            
        }else if(responseType(response) === 'announce'){
            console.log('Announce response received from the tracker');

            // 4. parse the announce response
            const announceResponse = parseAnnounceResponse(response);

            // 5. pass the peers to the callback
            callback(announceResponse.peers);
        }else if(responseType(response) === 'error'){
            console.log(response.toString('utf8'));
            socket.close(()=>{
                console.log('closing socket server');
            })
        }
    })

    // 1. send connection request
    socket.bind(6890, '192.168.8.104');
    udpSend(socket, buildConnectionRequest(), trackerUrl);
    
}

function udpSend(socket, message, rawUrl, callback=()=>{}){
    //parse the host url
    const url = urlParse(rawUrl);

    //send the whole message to the host thought the socket
    socket.send(message, 0, message.length, url.port, url.hostname, callback);

    console.log('request sent: ', message);
}

function buildConnectionRequest(){
    const requestPacket = Buffer.alloc(16);

    //write the connection id (8 bytes / 64 bits)
    // requestPacket.writeBigUInt64BE(BigInt(0x41727101980), 0);
    toBufferBE(BigInt(0x41727101980), 8).copy(requestPacket, 0);


    //write the action number 0 for 'connect' (4 bytes / 32 bits)
    requestPacket.writeUInt32BE(0, 8);

    //generate a random transaction id (4 bytes/ 32 bits)
    crypto.randomBytes(4).copy(requestPacket, 12);

    return requestPacket;
}

function responseType(response){
    const action = response.readUInt32BE(0);
    
    if(action === 0) return 'connect';
    if(action === 1) return 'announce';
    if(action === 3) return 'error'

    throw new Error('invalid response type');
}

function parseConnectionResponse(connectionResponse){
    //note that the response is a binary stream (Buffer)
    return {
        action: connectionResponse.readUint32BE(0), //4 bytes for the action type
        transaction_id: connectionResponse.readUInt32BE(4), //4 bytes for the transaction id
        // connection_id: connectionResponse.readBigUInt64BE(8), //8 bytes for the connection id
        connection_id: connectionResponse.slice(8), //8 bytes for the connection id
    }
}

function buildAnnounceRequest(connection_id, torrent, port=6881){
    //note: the port should be between 6881 and 6889
    const announcePacket = Buffer.allocUnsafe(98);

    // 8 bytes for connection id
    // announcePacket.writeBigUInt64BE(connection_id, 0);
    connection_id.copy(announcePacket, 0);

    // 4 bytes for action (=1, announce)
    announcePacket.writeUInt32BE(1, 8);

    // 4 bytes for transaction id
    crypto.randomBytes(4).copy(announcePacket, 12);

    // 5 bytes for info hash
    torrentParser.infoHash(torrent).copy(announcePacket, 16);

    // 5 bytes for peer id
    util.generateClientId().copy(announcePacket, 36);

    // 8 bytes for 'downloaded'
    // announcePacket.writeBigUInt64BE(0, 56);
    toBufferBE(BigInt(0), 8).copy(announcePacket, 56);

    // 8 bytes for 'left'
    torrentParser.size(torrent).copy(announcePacket, 64)

    // 8 bytes for 'uploaded'
    Buffer.alloc(8).copy(announcePacket, 72);

    // 4 bytes for event type (0: 'none')
    announcePacket.writeUInt32BE(0, 80);

    // 4 bytes for ip address (default = 0)
    announcePacket.writeUInt32BE(0, 84);

    // 4 bytes for random key
    crypto.randomBytes(4).copy(announcePacket, 88);

    // 4 bytes for 'number wanted' (default = -1)
    announcePacket.writeInt32BE(-1, 92);

    // 2 bytes for port
    announcePacket.writeUInt16BE(port, 96);

    return announcePacket;
}

function parseAnnounceResponse(announceResponse){

    function splitAddresses(addressesBuffer, addressSize){
        const addresses = [];

        for(let offset = 0; offset < addressesBuffer.length; offset+=addressSize){
            addresses.push(addressesBuffer.slice(offset, offset + addressSize));
        }

        return addresses;
    }

    return {
        action: announceResponse.readUInt32BE(0),
        transaction_id: announceResponse.readUInt32BE(4),
        interval: announceResponse.readUInt32BE(8),
        leechers: announceResponse.readUInt32BE(12),
        seeders: announceResponse.readUInt32BE(16),
        peers: splitAddresses(announceResponse.slice(20), 6).map(binaryAddress => {
            return {
                ip: binaryAddress.slice(0, 4).join('.'),
                port: binaryAddress.readUInt16BE(4),
            }
        })
    }
}