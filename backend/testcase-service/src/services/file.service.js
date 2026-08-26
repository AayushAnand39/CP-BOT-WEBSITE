const fs = require("fs/promises");
async function ensureDir(dir){ await fs.mkdir(dir,{recursive:true}); }
async function removeDir(dir){ await fs.rm(dir,{recursive:true,force:true}); }
module.exports={ensureDir,removeDir};
