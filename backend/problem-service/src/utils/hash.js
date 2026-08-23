const crypto=require('crypto'); module.exports={sha256:v=>crypto.createHash('sha256').update(v,'utf8').digest('hex')};
