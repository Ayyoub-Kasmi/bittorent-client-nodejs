'use strict'

const PieceBlock = require('./PieceBlock.js');
const TorrentParser = require('./torrent-parser.js');

module.exports = class Queue {
    #torrent;
    #queue;
    
    constructor(torrent){
        this.#torrent = torrent;
        this.#queue = [];
        this.chocked = true;
    }

    get length(){
        return this.#queue.length;
    }

    queue(pieceIndex){
        // queue jobs to request piece of index "pieceIndex"
        
        const totalBlocks = TorrentParser.countBlocks(this.#torrent, pieceIndex);

        for(let blockIndex = 0; blockIndex < totalBlocks; blockIndex++){

            const pieceBlock = new PieceBlock(
                pieceIndex, // index
                blockIndex * TorrentParser.BLOCK_LENGTH, //begin
                TorrentParser.getBlockLength(this.#torrent, pieceIndex, blockIndex) //block length
            );            

            this.#queue.push(pieceBlock);
        }
    }

    deque(){
        return this.#queue.shift();
    }

    peek(){
        return this.#queue[0];
    }
}