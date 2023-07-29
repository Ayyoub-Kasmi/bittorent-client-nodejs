const fs = require('fs');
const Bencode = require('bncode');
const crypto = require('crypto');
const { toBufferBE, toBigIntBE } = require('bigint-buffer');

module.exports.BLOCK_LENGTH = Math.pow(2, 14);

module.exports.open = (torrentFilePath) => { 
    return Bencode.decode(fs.readFileSync(torrentFilePath));
}

module.exports.infoHash = torrent => {
    //get torrent 'info' field and encode it in Bencode
    const info = Bencode.encode(torrent.info);

    // generate the SHA1 hash
    return crypto.createHash('sha1').update(info).digest();
}

module.exports.size = (torrent)=>{
    const totalSize = BigInt(
        torrent.info.files 
            ? torrent.info.files.map(file => file.length).reduce( (a, b) => a+b)
            : torrent.info.length
    )

    return toBufferBE(totalSize, 8);
}

module.exports.getPieceLength = (torrent, pieceIndex) => {
    //note: last piece might be shorter than other pieces

    const totalLength = Number( toBigIntBE(this.size(torrent)) );
    const pieceLength = torrent.info['piece length'];

    const lastPieceIndex = Math.floor(totalLength / pieceLength);
    const lastPieceLength = totalLength % pieceLength;

    return pieceIndex === lastPieceIndex ? lastPieceLength : pieceLength; 
}

module.exports.countBlocks = (torrent, pieceIndex) => {

    const pieceLength = this.getPieceLength(torrent, pieceIndex);

    return Math.ceil(pieceLength / this.BLOCK_LENGTH)
}

module.exports.getBlockLength = (torrent, pieceIndex, blockIndex) => {
    //note: last block might be shorter than other blocks
    
    const pieceLength = this.getPieceLength(torrent, pieceIndex);
    
    const lastBlockIndex = Math.floor(pieceLength / this.BLOCK_LENGTH);
    const lastBlockLength = pieceLength % this.BLOCK_LENGTH;

    return blockIndex === lastBlockIndex ? lastBlockLength : this.BLOCK_LENGTH;
}