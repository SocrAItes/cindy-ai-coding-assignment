import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceLinks, httpsLink, aggregateChecks, startAnalysis } from '../plugin/core.js';
import { GitHub } from '../plugin/github.js';
const pr={repo:'makecindy/cindy',headRepo:'contributor/cindy',number:248,title:'Example',sha:'a'.repeat(40)};
const check={kind:'check',id:'42',name:'unit-tests',state:'failed',url:'https://github.com/makecindy/cindy/actions/runs/7/job/8'};
const output={kind:'检查输出',text:'Expected 401; received 500.',notice:'不是完整日志。'};
function fixture(){let db={};const calls={create:0,send:0};const storage={read:async()=>structuredClone(db),write:async v=>{db=structuredClone(v);}};const tasks={capabilities:async()=>({operations:['create','send','readMessages']}),create:async()=>{calls.create++;return{taskId:'task-1',revision:1}},send:async()=>{calls.send++;return{runId:'run-1'}}};return{calls,storage,tasks,pr,check,output,currentSha:pr.sha};}
test('links keep the PR repository, fork commit and exact job distinct',()=>{
 const links=sourceLinks(pr,check);
 assert.equal(links.pr,'https://github.com/makecindy/cindy/pull/248');
 assert.equal(links.commit,'https://github.com/contributor/cindy/commit/'+'a'.repeat(40));
 assert.equal(links.check,check.url);
 assert.equal(httpsLink('javascript:alert(1)'),null);
 assert.equal(httpsLink('https://token:secret@github.com/'),null);
});
test('a new head commit stops dispatch instead of analyzing stale evidence',async()=>{
 const f=fixture();await assert.rejects(startAnalysis({...f,currentSha:'b'.repeat(40)}),{code:'STALE_COMMIT'});
 assert.deepEqual(f.calls,{create:0,send:0});
});
test('double-click and later replay create one task and send one input',async()=>{
 const f=fixture();const [a,b]=await Promise.all([startAnalysis(f),startAnalysis(f)]);
 assert.equal(a.taskId,b.taskId);assert.deepEqual(f.calls,{create:1,send:1});
 await startAnalysis(f);assert.deepEqual(f.calls,{create:1,send:1});
});
test('an unknown send acknowledgement is durable and never silently replayed',async()=>{
 const f=fixture();f.tasks.send=async()=>{f.calls.send++;throw new Error('connection lost')};
 await assert.rejects(startAnalysis(f),{code:'SEND_UNCERTAIN'});
 const result=await startAnalysis(f);assert.equal(result.phase,'uncertain');assert.deepEqual(f.calls,{create:1,send:1});
});
test('unreadable checks and missing checks cannot appear as CI success',()=>{
 assert.equal(aggregateChecks([],false),'none');
 assert.equal(aggregateChecks([{state:'passed'}],true),'unknown');
 assert.equal(aggregateChecks([{state:'passed'},{state:'failed'}],true),'failed');
});
test('partial check API permissions remain visible alongside readable statuses',async()=>{
 const gh=new GitHub(async({url})=>{
  if(url.includes('/check-runs'))return{ok:true,status:403,body:'{}'};
  return{ok:true,status:200,body:JSON.stringify([{id:8,context:'build',state:'success',target_url:'https://github.com/makecindy/cindy/actions/runs/7'}])};
 });
 const result=await gh.checks(pr);assert.equal(result.checks.length,1);assert.equal(result.state,'unknown');assert.equal(result.incomplete,true);assert.equal(result.notices.length,1);
});
test('GitHub authentication failure produces a connection error, not an empty PR list',async()=>{
 const gh=new GitHub(async()=>({ok:true,status:401,body:'{}'}));
 await assert.rejects(gh.list(),error=>error.status===401&&error.message.includes('登录已失效'));
});
test('a rerun that passes or replaces the selected failure cannot be handed off as an old failure',async()=>{
 for (const current of [{...check,state:'passed'},{...check,id:'new-run',state:'running'}]) {
  const gh=new GitHub(()=>{throw new Error('unexpected network request')});
  gh.pr=async()=>pr; gh.checks=async()=>({checks:[current]});
  gh.output=async()=>{throw new Error('obsolete output must not be read')};
  await assert.rejects(gh.analysisEvidence(pr,check),{code:'CHECK_CHANGED'});
 }
});
test('a push while output is being read stops task creation',async()=>{
 const f=fixture(),gh=new GitHub(()=>{throw new Error('unexpected network request')});let reads=0;
 gh.pr=async()=>++reads===1?pr:{...pr,sha:'b'.repeat(40)};
 gh.checks=async()=>({checks:[check]});gh.output=async()=>output;
 const evidence=await gh.analysisEvidence(pr,check);
 await assert.rejects(startAnalysis({...f,...evidence}),{code:'STALE_COMMIT'});
 assert.deepEqual(f.calls,{create:0,send:0});
});
test('handoff uses freshly read failure output and the latest source link',async()=>{
 const f=fixture(),gh=new GitHub(()=>{throw new Error('unexpected network request')});
 const latest={...check,url:'https://github.com/makecindy/cindy/actions/runs/9/job/10'};
 gh.pr=async()=>pr;gh.checks=async()=>({checks:[latest]});
 gh.output=async()=>({...output,text:'Fresh failure evidence from the selected check.'});
 let sent='';f.tasks.send=async input=>{sent=input.text;return{runId:'run-1'}};
 await startAnalysis({...f,...await gh.analysisEvidence(pr,check)});
 assert.match(sent,/Fresh failure evidence/);assert.ok(sent.includes(latest.url));
 assert.ok(!sent.includes(output.text));
});
