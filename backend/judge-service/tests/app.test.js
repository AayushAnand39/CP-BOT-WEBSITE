const test=require("node:test");
const assert=require("node:assert/strict");
const request=require("supertest");
const app=require("../src/app");
const {env}=require("../src/config/env");

const acceptedCode=`#include <bits/stdc++.h>
using namespace std;
int main(){ long long a,b; cin>>a>>b; cout<<a+b<<"\\n"; }`;

const wrongCode=`#include <bits/stdc++.h>
using namespace std;
int main(){ long long a,b; cin>>a>>b; cout<<a-b<<"\\n"; }`;

const slowCode=`#include <bits/stdc++.h>
using namespace std;
int main(){while(true){} }`;

test("GET /health returns service health",async()=>{
 const r=await request(app).get("/health");
 assert.equal(r.status,200);
 assert.deepEqual(r.body,{success:true,service:"judge-service",status:"ok"});
});

test("judging requires internal token",async()=>{
 const r=await request(app).post("/api/v1/judge/internal/judge").send({
  language:"cpp",sourceCode:acceptedCode,tests:[{input:"2 3\n",expectedOutput:"5\n"}]
 });
 assert.equal(r.status,401); assert.equal(r.body.code,"INVALID_SERVICE_TOKEN");
});

test("accepts correct submission",async()=>{
 const r=await request(app).post("/api/v1/judge/internal/judge")
 .set("X-Internal-Service-Token",env.INTERNAL_SERVICE_TOKEN).send({
  language:"cpp",sourceCode:acceptedCode,
  tests:[{input:"2 3\n",expectedOutput:"5\n"},{input:"100 200\n",expectedOutput:"300\n"}]
 });
 assert.equal(r.status,201); assert.equal(r.body.data.verdict,"AC"); assert.equal(r.body.data.tests.length,2);
});

test("returns WA",async()=>{
 const r=await request(app).post("/api/v1/judge/internal/judge")
 .set("X-Internal-Service-Token",env.INTERNAL_SERVICE_TOKEN).send({
  language:"cpp",sourceCode:wrongCode,tests:[{input:"2 3\n",expectedOutput:"5\n"}]
 });
 assert.equal(r.status,201); assert.equal(r.body.data.verdict,"WA");
});

test("returns CE",async()=>{
 const r=await request(app).post("/api/v1/judge/internal/judge")
 .set("X-Internal-Service-Token",env.INTERNAL_SERVICE_TOKEN).send({
  language:"cpp",sourceCode:"not valid c++",tests:[{input:"2 3\n",expectedOutput:"5\n"}]
 });
 assert.equal(r.status,201); assert.equal(r.body.data.verdict,"CE");
});

test("returns TLE",async()=>{
 const r=await request(app).post("/api/v1/judge/internal/judge")
 .set("X-Internal-Service-Token",env.INTERNAL_SERVICE_TOKEN).send({
  language:"cpp",sourceCode:slowCode,tests:[{input:"1\n",expectedOutput:"1\n"}]
 });
 assert.equal(r.status,201); assert.equal(r.body.data.verdict,"TLE");
});

test("validates submission",async()=>{
 const r=await request(app).post("/api/v1/judge/internal/judge")
 .set("X-Internal-Service-Token",env.INTERNAL_SERVICE_TOKEN).send({
  language:"python",sourceCode:acceptedCode,tests:[]
 });
 assert.equal(r.status,400); assert.equal(r.body.code,"VALIDATION_ERROR");
});

test("unknown route returns 404",async()=>{
 const r=await request(app).get("/api/v1/not-real");
 assert.equal(r.status,404); assert.equal(r.body.code,"ROUTE_NOT_FOUND");
});
