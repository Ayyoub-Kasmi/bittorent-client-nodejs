# bittorent-client-nodejs

Extras:
- Implement a custom Bencode parser. (50 lines parser: https://effbot.org/zone/bencode.htm)
- Automatically go through all announce urls (if one doesn't response, try the next one. If all udp don't respond, try http)
- Improve the mechanism to detect pieces that have already been requested / downloaded (so to not request them again)
- For the downloaded file's name, auto-generate it from the torrent's name field
- Change the File opening code (fs.openSync()) to support download resume, instead of overwriting the downloaded file