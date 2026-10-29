(function(){
  // Firestore giả có "máy chủ" thật (do Playwright giữ) → dữ liệu sống qua các phiên trình duyệt
  const user={uid:'demo',email:'qs@demo.vn',displayName:'QS Demo'};
  const SV={__sv:1};
  function bad(v,p){ if(v===undefined) return p+'=undefined'; if(typeof v==='number'&&!Number.isFinite(v)) return p+'=NaN';
    if(Array.isArray(v)){for(let i=0;i<v.length;i++){ if(v[i]&&v[i].__sv) return p+'['+i+'] serverTimestamp in array'; const r=bad(v[i],p+'['+i+']'); if(r) return r;} return null;}
    if(v&&typeof v==='object'&&!v.__sv){for(const k of Object.keys(v)){const r=bad(v[k],p+'.'+k); if(r) return r;}} return null;}
  const xhr=(method,path,body)=>{const x=new XMLHttpRequest(); x.open(method,'/__fs/'+encodeURIComponent(path),false); x.setRequestHeader('Content-Type','application/json'); x.send(body?JSON.stringify(body):null); return x.responseText?JSON.parse(x.responseText):null;};
  const listeners={};
  const snap=(id,data,pending)=>({exists:!!data,data:()=>data,id,metadata:{hasPendingWrites:!!pending}});
  const write=(path,d,merge)=>{const r=bad(d,path); if(r){window.__fsErrors=(window.__fsErrors||[]).concat(r); return Promise.reject(new Error('FirebaseError: invalid data '+r));}
    const clean=JSON.parse(JSON.stringify(d,(k,v)=>v&&v.__sv?new Date().toISOString():v)); const res=xhr('POST',path,{data:clean,merge:!!merge});
    (listeners[path]||[]).forEach(cb=>setTimeout(()=>cb(snap(path.split('/').pop(),res,true)),0)); window.__fsWrites=(window.__fsWrites||0)+1; return Promise.resolve();};
  const docRef=(path)=>({collection:(n)=>col(path+'/'+n), get:async()=>{const d=xhr('GET',path); return snap(path.split('/').pop(), path.startsWith('users/')?(d||null):d);},
    set:(d,o)=>write(path,d,o&&o.merge), update:(d)=>write(path,d,true),
    onSnapshot:(cb)=>{(listeners[path]=listeners[path]||[]).push(cb); setTimeout(()=>cb(snap(path.split('/').pop(),xhr('GET',path),false)),0); return()=>{listeners[path]=(listeners[path]||[]).filter(f=>f!==cb)}}});
  const col=(name)=>({doc:(id)=>docRef(name+'/'+(id===undefined?'auto'+Math.random().toString(36).slice(2,10):id)), get:async()=>{const all=xhr('GET','__list__'+name)||{}; const docs=Object.entries(all).map(([id,d])=>snap(id,d,false)); return {docs,empty:!docs.length,forEach:(f)=>docs.forEach(f)};}, where(){return this}, orderBy(){return this}});
  const fs=()=>({settings(){},collection:col,batch:()=>{const ops=[];return {set(r,d,o){ops.push([r,d,o])},update(r,d){ops.push([r,d,{merge:true}])},commit:()=>Promise.all(ops.map(([r,d,o])=>r.set(d,o)))}}});
  fs.FieldValue={serverTimestamp:()=>SV};
  // Auth: mặc định đã đăng nhập sẵn; localStorage '__auth_form'='1' → bắt đầu chưa đăng nhập để test form
  const A={user:(function(){try{return localStorage.getItem('__auth_form')==='1'?null:user}catch(e){return user}})(),cbs:[]};
  const fire=()=>A.cbs.forEach(cb=>setTimeout(()=>cb(A.user),0));
  const auth=()=>({get currentUser(){return A.user},onAuthStateChanged:(cb)=>{A.cbs.push(cb);setTimeout(()=>cb(A.user),0);return()=>{}},
    signInWithEmailAndPassword:async(e,p)=>{await new Promise(r=>setTimeout(r,700)); if(p==='wrong'){const er=new Error('bad');er.code='auth/invalid-credential';throw er;} A.user=user; fire(); return {user};},
    signOut:async()=>{A.user=null; fire();}});
  window.firebase={apps:[],initializeApp(){this.apps.push({})},firestore:fs,auth:auth};
})();
