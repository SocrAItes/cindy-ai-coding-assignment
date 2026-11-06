import test from 'node:test';
import assert from 'node:assert/strict';
import { ListStatusLoader } from '../plugin/list-status.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
const prs = count => Array.from({length:count},(_,i)=>({repo:'owner/repo',number:i+1}));

test('CI summaries respect a shared concurrency limit and deduplicate page items',async()=>{
  let active=0,maximum=0,calls=0;const waiting=[];
  const loader=new ListStatusLoader(pr=>new Promise(resolve=>{
    calls++;active++;maximum=Math.max(maximum,active);
    waiting.push(()=>{active--;resolve({state:pr.number%2?'failed':'passed'})});
  }),()=>{},3);
  const items=prs(8);loader.show([...items,items[0]]);await tick();assert.equal(calls,3);
  while(waiting.length){waiting.shift()();await tick();}
  assert.equal(calls,8);assert.equal(maximum,3);assert.equal(loader.get(items[0]).state,'failed');
  loader.show(items);await tick();assert.equal(calls,8);
});

test('page changes ignore old responses while individual failures remain unknown',async()=>{
  const [old,next]=prs(2),updates=[];let release;
  const loader=new ListStatusLoader(pr=>pr.number===1?new Promise(resolve=>{release=resolve}):Promise.reject(new Error('permission denied')),()=>updates.push('changed'),1);
  loader.show([old]);await tick();loader.show([next]);release({state:'passed'});await tick();await tick();
  assert.equal(loader.get(old),undefined);assert.equal(loader.get(next).state,'unknown');
  assert.match(loader.get(next).error,/permission denied/);assert.equal(updates.length,1);
});

test('a refresh never accepts the previous refresh result for the same PR',async()=>{
  const item=prs(1)[0],waiting=[];
  const loader=new ListStatusLoader(()=>new Promise(resolve=>waiting.push(resolve)),()=>{},1);
  loader.show([item]);await tick();loader.show([item],{reset:true});waiting.shift()({state:'passed'});await tick();
  assert.equal(loader.get(item),undefined);waiting.shift()({state:'failed'});await tick();
  assert.equal(loader.get(item).state,'failed');
});

test('fresh selected PR details cannot be replaced by an older list summary',async()=>{
  const item=prs(1)[0];let release;
  const loader=new ListStatusLoader(()=>new Promise(resolve=>{release=resolve}),()=>{});
  loader.show([item]);await tick();loader.record(item,{state:'failed',sha:'new-head'});
  release({state:'passed',sha:'old-head'});await tick();
  assert.deepEqual(loader.get(item),{state:'failed',sha:'new-head'});
});
