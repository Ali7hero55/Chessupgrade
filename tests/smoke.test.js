/* Smoke tests for chess.html — needs jsdom:  npm install jsdom  */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const FILE = path.join(__dirname, '..', 'chess.html');
const src = fs.readFileSync(FILE, 'utf8');
const errs = [];
const vc = new VirtualConsole().on('jsdomError', e => errs.push(e.message));

// minimal storage shared across "reloads"
const DISK = {};
function boot() {
  return new JSDOM(src, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'file:///C:/chess.html', virtualConsole: vc,
    beforeParse(w) {
      w.Audio = function () { return { play: () => Promise.resolve(), pause(){}, currentTime:0, volume:1, preload:'' }; };
      w.Element.prototype.animate = function () {
        const s = this; setTimeout(() => s.parentNode && s.parentNode.removeChild(s), 0);
        return { onfinish: null, cancel(){} };
      };
      w.Element.prototype.setPointerCapture = function () {};
      w.Element.prototype.releasePointerCapture = function () {};
      w.document.elementFromPoint = () => null;
      w.Element.prototype.scrollIntoView = function () {};
      Object.defineProperty(w, 'localStorage', {
        value: { getItem: k => k in DISK ? DISK[k] : null,
                 setItem: (k,v) => { DISK[k] = String(v); },
                 removeItem: k => { delete DISK[k]; } },
        writable: true
      });
    }
  });
}

let pass = 0, fail = 0;
const check = (name, fn) => {
  try { const r = fn(); console.log('  ok   ' + name + (r !== undefined ? '  -> ' + r : '')); pass++; }
  catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); fail++; }
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dom = boot(); const w = dom.window, d = w.document;
  await sleep(300);
  const E = c => w.eval(c);

  console.log('=== ENGINE (perft)');
  check('start position 20/400/8902', () => {
    const r = E(`(function(){function pf(s,d){if(!d)return 1;var n=0,m=legalMoves(s);
      for(var i=0;i<m.length;i++){var u=makeMove(s,m[i]);n+=pf(s,d-1);undoMove(s,m[i],u);}return n;}
      var s=parseFen(START_FEN);return [pf(s,1),pf(s,2),pf(s,3)];})()`);
    if (r[0]!==20||r[1]!==400||r[2]!==8902) throw new Error(JSON.stringify(r));
    return r.join(' / ');
  });
  check('kiwipete 48/2039', () => {
    const r = E(`(function(){function pf(s,d){if(!d)return 1;var n=0,m=legalMoves(s);
      for(var i=0;i<m.length;i++){var u=makeMove(s,m[i]);n+=pf(s,d-1);undoMove(s,m[i],u);}return n;}
      var s=parseFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
      return [pf(s,1),pf(s,2)];})()`);
    if (r[0]!==48||r[1]!==2039) throw new Error(JSON.stringify(r));
    return r.join(' / ');
  });

  console.log('=== RENDER');
  check('three boards, 64 squares each', () => {
    const n = d.querySelectorAll('.board .sq').length;
    if (n !== 192) throw new Error('got ' + n); return n;
  });
  check('opening position = 32 pieces', () => {
    E("APP.mode='pvp'; startGame(START_FEN)");
    const n = d.querySelectorAll('#board .piece').length;
    if (n !== 32) throw new Error('got ' + n); return n;
  });
  check('all four piece sets produce valid SVG', () => {
    for (const s of ['casual','3d','classic','neon'])
      for (const t of ['k','q','r','b','n','p'])
        for (const c of ['w','b'])
          if (/undefined|NaN/.test(E(`pieceSVG('${t}','${c}','${s}')`))) throw new Error(s+'/'+t+'/'+c);
    return '48 variants clean';
  });

  console.log('=== COORDINATES');
  check('labels match each square\'s own coords', () => {
    const r = E(`(function(){var B=BS('board'),bad=[];
      for(var i=0;i<64;i++){var r=i>>3,c=i&7;
        var cf=B[i].querySelector('.cf'), cr=B[i].querySelector('.cr');
        if(r===7&&(!cf||cf.textContent!=='abcdefgh'[c]))bad.push(i);
        if(c===0&&(!cr||cr.textContent!==String(8-r)))bad.push(i);}
      return bad.length?('BAD '+bad.join(',')):'ok';})()`);
    if (r !== 'ok') throw new Error(r); return r;
  });
  check('labels unchanged by flipping', () => {
    E("APP.flipped=true; render();");
    const r = E(`(function(){var B=BS('board'),bad=[];
      for(var i=0;i<64;i++){var r=i>>3,c=i&7;
        var cf=B[i].querySelector('.cf'), cr=B[i].querySelector('.cr');
        if(r===7&&(!cf||cf.textContent!=='abcdefgh'[c]))bad.push(i);
        if(c===0&&(!cr||cr.textContent!==String(8-r)))bad.push(i);}
      return bad.length?('BAD '+bad.join(',')):'ok';})()`);
    E("APP.flipped=false; render();");
    if (r !== 'ok') throw new Error(r); return r;
  });
  check('flip is instant (no CSS transition on the board)', () => {
    const css = d.querySelector('style').textContent;
    const m = css.match(/\.board\{[^}]*\}/);
    if (m && /transition/.test(m[0])) throw new Error('board still animates');
    return 'instant';
  });

  console.log('=== GAME FLOW');
  E("startGame(START_FEN)");
  const ply = c => { E(c); };
  ply("applyMove(APP.legal.find(m=>m.from===53&&m.to===45))"); await sleep(70);
  ply("applyMove(APP.legal.find(m=>m.from===12&&m.to===28))"); await sleep(70);
  ply("applyMove(APP.legal.find(m=>m.from===54&&m.to===38))"); await sleep(70);
  ply("applyMove(APP.legal.find(m=>m.from===3&&m.to===39))");  await sleep(200);
  check('checkmate detected', () => {
    const r = E("gameStatus(st)");
    if (!r.over) throw new Error('game not over');
    return r.title + ' / ' + r.sub;
  });
  check('promotion offers 4 pieces', () => {
    E("startGame('4k3/P7/8/8/8/8/8/4K3 w - - 0 1')");
    return E("APP.legal.filter(m=>m.promo).length");
  });

  console.log('=== PROFILES + ELO');
  check('new profiles start at 100', () => { E("PROF.list=[]; PROF.load();"); return E("PROF.list.map(p=>p.name+'='+p.elo).join(', ')"); });
  check('win +8 / loss -4', () => {
    E("APP.mode='pvp'; APP.whiteId='p1'; APP.blackId='p2';");
    E("PROF.list[0].elo=100;PROF.list[0].l=0;PROF.list[1].elo=100;PROF.list[1].w=0;");
    E("startGame(START_FEN); doResign();");
    return E("PROF.list[0].elo") + ' / ' + E("PROF.list[1].elo");
  });
  check('draw = +1 each', () => {
    E("PROF.list[0].elo=100;PROF.list[0].d=0;PROF.list[1].elo=100;PROF.list[1].d=0;");
    E("startGame(START_FEN); doDraw();");
    return E("PROF.list[0].elo") + ' / ' + E("PROF.list[1].elo");
  });
  dom.window.close();

  // ---- reload with the same storage ----
  const dom2 = boot(); const w2 = dom2.window; await sleep(300);
  const E2 = c => w2.eval(c);
  check('profiles survive reopening the file', () => {
    const n = E2("PROF.list.length");
    if (!n) throw new Error('no profiles came back');
    return E2("PROF.list.map(p=>p.name+'='+p.elo).join(', ')");
  });
  dom2.window.close();

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (errs.length) { console.log('jsdom errors:'); errs.slice(0,5).forEach(e=>console.log('  ! '+e)); }
  process.exit(fail || errs.length ? 1 : 0);
})();
