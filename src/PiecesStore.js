'use strict'

const TorrentParser = require('./torrent-parser.js');

module.exports = class PiecesStore {
    #requested;
    #received;

    constructor(torrent){
        const totalPieces = torrent.info.pieces.length / 20; // pieces are represented by 20 bytes SHA hashes ==> total = length / 20
        
        this.#requested = buildPiecesArray();
        this.#received = buildPiecesArray();
        
        function buildPiecesArray(){
            
            const piecesArray = new Array(totalPieces).fill(false);

            // Torrent is pieces, piece is blocks ==> matrix of blocks
            return piecesArray.map((_, pieceIndex) => new Array(TorrentParser.countBlocks(torrent, pieceIndex)).fill(false));
        }
    }

    addRequested(pieceBlock){
        
        const blockIndex = pieceBlock.begin / TorrentParser.BLOCK_LENGTH;

        this.#requested[pieceBlock.index][blockIndex] = true;
    }

    addReceived(pieceBlock){

        const blockIndex = pieceBlock.begin / TorrentParser.BLOCK_LENGTH;
        
        this.#received[pieceBlock.index][blockIndex] = true;
    }

    needed(pieceBlock){
        if(this.#requested.every(blocks => blocks.every(isRequested => isRequested === true))){
            //use "slice" method to return a copy of an array
            this.#requested = this.#received.map(blocks => blocks.slice());//if all pieces were requested, override "requested" with "received" before checking the piece status
            //note: this override will tell whether the requested piece has been recieved, since a request is always made before a piece is received
        }

        const blockIndex = pieceBlock.begin / TorrentParser.BLOCK_LENGTH;

        return !this.#requested[pieceBlock.index][blockIndex]; //if the piece was already requested then it's not needed
    }

    isDone(){
        return this.#received.every(blocks => blocks.every(isReceived => isReceived === true)); //whether all pieces were receieved
    }
}