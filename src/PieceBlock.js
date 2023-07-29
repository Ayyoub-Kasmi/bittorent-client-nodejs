'use strict'

module.exports = class PieceBlock{
    constructor(pieceIndex, begin, length){
        // object modelization for piece message's payload
        
        this.index = pieceIndex; //note that the index here is the index to send in the tcp message, which is the "piece" index, not the "block" index!
        this.begin = begin;
        this.length = length;
        
    }
}