import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotJSON, parseSnapshot, createShareURL, readShareURL } from './shareBoard.js';
import PT_DATA from '../data.js';
const board = { id:'b-test', title:'Rent 🧭 café', nodes:[{id:'n1',type:'post',title:'A claim',x:123,y:456, checks:{validity:{verdict:'unverified',note:'No record yet'}}},{id:'n2',type:'doc',title:'Original',x:10,y:20}], strings:[{from:'n1',to:'n2',kind:'origin',label:'cites'}], summary:[],qa:[],log:[] };
test('snapshot round trip preserves content and positions without mutation', () => {
  const copy = parseSnapshot(snapshotJSON(board)); assert.deepEqual(copy,board); copy.nodes[0].x = 0; assert.equal(board.nodes[0].x,123);
});
test('compressed link preserves Unicode and subpath', async () => {
  const url = new URL(await createShareURL(board,'https://example.com/papertrail/?theme=dark#old'));
  assert.equal(url.pathname,'/papertrail/'); assert.equal(url.search,'?theme=dark'); assert.deepEqual(await readShareURL(url.hash),board);
});
test('unrelated fragments are ignored and invalid links rejected', async () => {
  assert.equal(await readShareURL('#other'), null); await assert.rejects(readShareURL('#board=invalid')); await assert.rejects(readShareURL('#board=gz.aaaa'));
});
test('dangling edges, duplicate IDs and unsafe assessment shapes rejected', () => {
  const broken=structuredClone(board); broken.strings[0].to='missing'; assert.throws(()=>snapshotJSON(broken));
  const duplicate=structuredClone(board); duplicate.nodes[1].id='n1'; assert.throws(()=>snapshotJSON(duplicate));
  const bad=structuredClone(board); bad.nodes[0].checks.validity.verdict='invented'; assert.throws(()=>snapshotJSON(bad));
});
test('oversized data and corrupt files rejected', () => {
  assert.throws(()=>parseSnapshot('broken')); assert.throws(()=>snapshotJSON({...board,title:'x'.repeat(2_000_001)}));
});
test('unsupported screenshot URLs rejected', () => {
  const shot=structuredClone(board); shot.nodes[0].type='shot'; shot.nodes[0].img='https://tracking.example/image'; assert.throws(()=>snapshotJSON(shot));
});
test('all current demo boards remain shareable after upstream updates', async () => {
  for (const demo of PT_DATA.boards) {
    const url = await createShareURL(demo, 'https://example.com/papertrail/');
    assert.deepEqual(await readShareURL(new URL(url).hash), demo);
  }
});
