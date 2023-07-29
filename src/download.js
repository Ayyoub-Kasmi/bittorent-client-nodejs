'use strict'

const net = require('net'); //uses tcp, ensures that files are fully downloaded 
const Buffer = require('buffer').Buffer;
const tracker = require('./tracker.js');
const Message = require('./message.js');
const PiecesStore = require('./PiecesStore.js');
const Queue = require('./Queue.js');
const fs = require('fs');
const { BLOCK_LENGTH } = require('./torrent-parser.js');

module.exports = (torrent, downloadedFilePath) => {

    tracker.getPeers(torrent, peers => {
        console.log(peers);

        const piecesStore = new PiecesStore(torrent);

        const downloadedFile = fs.openSync(downloadedFilePath, 'w');

        // download(peers[8], torrent, piecesStore, downloadedFile);
        // download(peers[1], torrent, piecesStore, downloadedFile);
        const p = {
            ip: '75.119.150.88',
            port: '51413',
        }
        download(p, torrent, piecesStore, downloadedFile);
        
        const filteredPeers = [
            '37.103.255.58', 
            '14.40.34.5',
            '14.56.242.233',
            '207.34.208.185',
            '78.139.43.83',
            '79.100.55.165',
            '83.240.47.78',
            '192.42.253.212',
            '154.244.183.226',
        ]

        // peers.filter(peer => filteredPeers.indexOf(peer.ip) === -1).forEach(peer => download(peer, torrent, piecesStore, downloadedFile))
        // peers.forEach(peer => download(peer, torrent, piecesStore, downloadedFile));
    })
}

function download(peer, torrent, piecesStore, downloadedFile){
    console.log('Attempting to download from peer ', peer.ip);

    const socket = new net.Socket();
    
    const queue = new Queue(torrent); //job queue that tells which peer to download from next
    
    //error handler to avoid crashes
    socket.on('error', error => {
        console.log(error);

        // if(error.code === 'ETIMEDOUT'){
        //     console.log('Time out connection error');
        // }

        socket.end();
    });

    //setup a tcp connection with the peer
    socket.connect(peer.port, peer.ip, () => {
        //once connected to the peer, do a handshake on the transfer operation
        console.log('Connection established with the peer %s , sending the handshake', peer.ip);
        socket.write(Message.buildHandshake(torrent));
    });

    //note that tcp socket connection listening doesn't neceessarily return a full message! it may return a part of a message or multiple messages
    //to handle this, an "onWholeMessage" function is used that only returns the message once it's fully received
    onWholeMessage(socket, message => {
        messageHandler(message, socket, piecesStore, queue, downloadedFile, peer.ip);
    }); //message handler will make an action based on the message
}

function onWholeMessage(socket, callback){
    let savedBuffer = Buffer.alloc(0);
    let handshake = true;

    socket.on('data', receivedBuffer => {
        // console.log('receieved data: ', receivedBuffer, 'handshake: ', handshake);
        const getMessageLength = () => handshake ? savedBuffer.readUInt8(0) + 49 : savedBuffer.readUint32BE(0) + 4;

        //concat the received buffer to the saved one
        savedBuffer = Buffer.concat([savedBuffer, receivedBuffer]);

        while(savedBuffer.length >= 4 && savedBuffer.length >= getMessageLength()){

            callback(savedBuffer.slice(0, getMessageLength() ));

            savedBuffer = savedBuffer.slice(getMessageLength() );

            handshake = false;
        }
    })
}

function messageHandler(message, socket, piecesStore, queue, downloadedFile, ip){
    if( isHandshake(message) ){
        //send an "interested" message
        console.log('Handshake has been recieved: ', message, ', ip: ', ip);

        socket.write(Message.buildInterested());

    }else{
        console.log('A message has been recieved:  ', message, ', ip: ', ip);

        const messageContent = Message.parse(message);

        if (messageContent.size === 0) {
            // a keep-alive message
            keepAliveHandler(socket, piecesStore, queue, ip);
        
        } else {
            
            switch(messageContent.typeId){
                case 0: chokeHandler(socket); break;
                case 1: unchokeHandler(socket, piecesStore, queue, ip); break;
                case 4: haveHandler(messageContent.payload, socket, piecesStore, queue); break;
                case 5: bitfieldHandler(messageContent.payload, socket, piecesStore, queue, ip); break;
                case 7: pieceHandler(messageContent.payload, socket, piecesStore, queue, downloadedFile); break;
            }
        }

    }

}

function isHandshake(message){
    // note: the handshake message's length is 68 bytes, and pstrlen = 19 (pstr = 'BitTorrent protocol')
    
    return message.length === (message.readUInt8(0) + 49) && message.toString('utf8', 1, 1 + message.readUInt8(0)) === 'BitTorrent protocol';
}

function keepAliveHandler(socket, piecesStore, queue, ip){
    console.log('keep-alive ');
    const isQueueEmpty = queue.length === 0;

    if(isQueueEmpty) requestPiece(socket, piecesStore, queue, ip);
}

function chokeHandler(){

}

function unchokeHandler(socket, piecesStore, queue, ip) { 
    console.log('Unchoke message recieved!');
    queue.chocked = false;

    requestPiece(socket, piecesStore, queue, ip);
}

function haveHandler(payload, socket, piecesStore, queue) { 

    const pieceIndex = payload.readUint32BE(0);

    const queueWasEmpty = queue.length === 0;
    
    queue.queue(pieceIndex);

    // Only start requesting pieces if the queue was empty, because we want to wait for piece responses to come back, before 
        // requesting the next piece.
    if(queueWasEmpty) requestPiece(socket, piecesStore, queue); 
}

function bitfieldHandler(payload, socket, piecesStore, queue, ip) {
    // The payload here is buffer of bytes. Note that the highest bit of the highest byte represents the index 0
    // console.log('Bitfield has been recieved: ', payload, ', parsed: ', payload.toString('utf8'));
    console.log('Bitfield has been recieved: ', payload);
    
    const queueWasEmpty = queue.length === 0; 

    payload.forEach((byte, i) => {
        for(let j = 0; j < 8; j++){
            if( byte % 2) queue.queue(i * 8 + 7 - j);
            byte = Math.floor(byte / 2);
        }
    })

    // Only start requesting pieces if the queue was empty, because we want to wait for piece responses to come back, before 
        // requesting the next piece.
    if(queueWasEmpty) requestPiece(socket, piecesStore, queue, ip);
}

function pieceHandler(torrent, pieceResponse, socket, piecesStore, queue, downloadedFile) {
    //pieceResponse is similar to pieceBlock objects (it has "index" and "begin") but it includes the actual data, instead of the length
    console.log('Block %d from piece  %d has been recieved', pieceResponse.begin / BLOCK_LENGTH, pieceResponse.index);

    piecesStore.addReceived(pieceResponse);

    // Write the piece to file
    const offset = pieceResponse.index * torrent.info['piece length'] + pieceResponse.begin;
    fs.write(downloadedFile, pieceResponse.block, 0, pieceResponse.block.length, offset, () => {});

    if(piecesStore.isDone()){

        socket.end();
        console.log('Download finished!');

        try {
            fs.closeSync(downloadedFile)
        } catch (error) {
            
        }
    }else{
        //request the next piece
        requestPiece(socket, piecesStore, queue);
    }
}

function requestPiece(socket, piecesStore, queue, ip){
    console.log('requesting a piece from ', ip, ', ', ' checking the queue choke status: ', queue.chocked);
    if (queue.chocked) return null;

    while(queue.length){ //loop until finding a piece that was not requested
        
        console.log('Queue: ', queue);
        const pieceBlock = queue.deque();

        if(piecesStore.needed(pieceBlock)){
            console.log('A piece is going to be requested from ', ip, ': ', pieceBlock);
            
            socket.write(Message.buildRequestPiece(pieceBlock));

            piecesStore.addRequested(pieceBlock);

            break;
        }
    }

}