const {prisma}=require('./db.service'); const AppError=require('../utils/app-error'); const {sha256}=require('../utils/hash');
const PUBLIC={id:true,source:true,sourceContestId:true,sourceIndex:true,title:true,rating:true,tags:true,concepts:true,statement:true,inputFormat:true,outputFormat:true,constraints:true,examplesJson:true,notes:true,editorial:true,timeLimitMs:true,memoryLimitMb:true,deterministic:true,status:true,createdAt:true,updatedAt:true};
const INTERNAL={...PUBLIC,solutionCode:true,solutionSource:true,solutionSourceRef:true,generatorCode:true,generatorVersion:true,generatorHash:true,testcaseArtifactJson:true};
const norm=v=>v.trim().toLowerCase(); const list=v=>[...new Set((v||[]).map(x=>String(x).trim().toLowerCase()).filter(Boolean))];
function where(f){const w={}; if(f.ratingMin!==undefined||f.ratingMax!==undefined){w.rating={};if(f.ratingMin!==undefined)w.rating.gte=f.ratingMin;if(f.ratingMax!==undefined)w.rating.lte=f.ratingMax;} if(f.tag)w.tags={has:norm(f.tag)};if(f.concept)w.concepts={has:norm(f.concept)};if(f.source)w.source=norm(f.source);if(f.status)w.status=f.status;if(f.deterministic!==undefined)w.deterministic=f.deterministic;if(f.search)w.OR=[{title:{contains:f.search,mode:'insensitive'}},{statement:{contains:f.search,mode:'insensitive'}}];return w;}
async function listProblems(f){const w=where(f),skip=(f.page-1)*f.pageSize;const [items,total]=await prisma.$transaction([prisma.problem.findMany({where:w,select:PUBLIC,orderBy:[{rating:'asc'},{title:'asc'}],skip,take:f.pageSize}),prisma.problem.count({where:w})]);return {items,pagination:{page:f.page,pageSize:f.pageSize,total,totalPages:Math.ceil(total/f.pageSize)}};}
async function getById(id,internal=false){const p=await prisma.problem.findUnique({where:{id},select:internal?INTERNAL:PUBLIC});if(!p||(!internal&&p.status!=='READY'))throw new AppError(404,'Problem not found','PROBLEM_NOT_FOUND');return p;}
async function createProblem(data){const d={...data,source:norm(data.source),tags:list(data.tags),concepts:list(data.concepts),solutionCode:data.solutionCode||null,generatorCode:data.generatorCode||null};if(d.generatorCode)d.generatorHash=sha256(d.generatorCode);return prisma.problem.create({data:d,select:INTERNAL});}
async function updateProblem(id,data){
  const old=await prisma.problem.findUnique({where:{id},select:INTERNAL});
  if(!old)throw new AppError(404,'Problem not found','PROBLEM_NOT_FOUND');
  const d={...data};
  if(d.source!==undefined)d.source=norm(d.source);
  if(d.tags!==undefined)d.tags=list(d.tags);
  if(d.concepts!==undefined)d.concepts=list(d.concepts);
  if(d.generatorCode!==undefined){
    if(!d.generatorCode){d.generatorVersion=null;d.generatorHash=null;}
    else{d.generatorHash=sha256(d.generatorCode);d.generatorVersion=d.generatorVersion??((old.generatorVersion||0)+1);}
  }
  const merged={...old,...d};
  if(merged.status==='READY'&&(!merged.solutionCode||!merged.generatorCode||merged.deterministic!==true)){
    throw new AppError(400,'READY requires solutionCode, generatorCode and deterministic=true','INVALID_READY_PROBLEM');
  }
  return prisma.problem.update({where:{id},data:d,select:INTERNAL});
}
async function remove(id){const p=await prisma.problem.findUnique({where:{id},select:{id:true}});if(!p)throw new AppError(404,'Problem not found','PROBLEM_NOT_FOUND');await prisma.problem.delete({where:{id}});}
module.exports={listProblems,getById,createProblem,updateProblem,remove};
