'use strict'

const tracker = require('./src/tracker.js');
const TorrentParser = require('./src/torrent-parser.js');
const download = require('./src/download.js');

//load and decode the torrent file
const torrent = TorrentParser.open('./DLRAW.NET-Tokyo D v01-02e.rar.torrent')
// console.log(torrent.info.files[2].path.toString('utf8'));

// //get the peers list
// tracker.getPeers(torrent, peers => {
//     console.log('list of peers: ', peers);
// })

download(torrent, './downloads/'+torrent.info.name);