var $=function(s){return document.querySelector(s)};
var P='cbsimple-',BASE=location.origin+location.pathname,q=new URLSearchParams(location.search);
function clean(n){return (n||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,20)}
var me=clean(q.get('me'))||clean(localStorage.getItem('cbs_me')),target=clean(q.get('call'));
var contacts=JSON.parse(localStorage.getItem('cbs_contacts')||'[]');
var peer,conn,mcall,stream,muted=false,paused=false,wake,ICE={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
try{var ic=JSON.parse(localStorage.getItem('cbs_ice')||'null');if(ic&&ic.iceServers)ICE=ic}catch(e){}
fetch('https://songwriterkaz.github.io/coffeebreak-ice/ice.json',{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(j){if(j&&j.iceServers){ICE={iceServers:j.iceServers};localStorage.setItem('cbs_ice',JSON.stringify(ICE))}}).catch(function(){});
function st(t,ok){$('#st').textContent=t;$('#st').className=ok?'ok':''}
function save(n){if(!n||n==me)return;contacts=contacts.filter(function(c){return c!=n});contacts.unshift(n);localStorage.setItem('cbs_contacts',JSON.stringify(contacts));fill()}
function fill(){var w=$('#who');w.innerHTML='';if(!contacts.length){w.innerHTML='<option value="">Share your link to add people</option>';return}contacts.forEach(function(c){var o=document.createElement('option');o.value=c;o.textContent=c;w.appendChild(o)});if(target)w.value=target}
$('#who').onchange=function(){target=this.value;link()};
if(!me){$('#setup').classList.remove('hide');$('#nm').focus()}else go();
$('#start').onclick=function(){var n=clean($('#nm').value);if(!n){$('#nm').focus();return}me=n;go()};
$('#nm').onkeydown=function(e){if(e.key=='Enter')$('#start').click()};
function go(){localStorage.setItem('cbs_me',me);var u=BASE+'?me='+me+(target?'&call='+target:'');history.replaceState(null,'',u);
$('#setup').classList.add('hide');$('#app').classList.remove('hide');$('#me').textContent='You are '+me;if(target)save(target);fill();awake();
waitFor('QRCode',function(){new QRCode($('#qr'),{text:BASE+'?call='+me,width:120,height:120,colorDark:'#3b2417'})});
waitFor('Peer',start);listen()}
function waitFor(n,f){if(window[n])f();else setTimeout(function(){waitFor(n,f)},150)}
var tries=0;
function start(){st('Going online');if(peer)try{peer.destroy()}catch(e){}
peer=new Peer(P+me,{config:ICE,debug:0});
peer.on('open',function(){tries=0;st(target?'Connecting to '+target:'Online. Ready',!target);link()});
peer.on('connection',function(c){bind(c)});
peer.on('call',function(c){mcall=c;save(c.peer.slice(P.length));target=c.peer.slice(P.length);fill();$('#ans').hidden=false;$('#call').classList.add('hide');st(target+' is calling');ring(true)});
peer.on('disconnected',function(){st('Reconnecting');setTimeout(function(){try{peer.reconnect()}catch(e){start()}},1500)});
peer.on('error',function(e){if(e.type=='unavailable-id'){st('Reconnecting');setTimeout(start,4000+Math.min(tries++,5)*2000)}else if(e.type=='peer-unavailable'){st(target+' is offline. Waiting');ntfy(target)}else if(e.type=='network'||e.type=='server-error'||e.type=='socket-error'){st('Reconnecting');setTimeout(start,3000)}})}
function link(){if(!target||!peer||!peer.open)return;if(conn&&conn.open&&conn.peer==P+target)return;bind(peer.connect(P+target,{reliable:true}))}
function bind(c){c.on('open',function(){conn=c;var n=c.peer.slice(P.length);save(n);if(!target){target=n;fill()}st('Connected to '+n,true)});
c.on('data',function(d){if(d=='bye'&&mcall){try{mcall.close()}catch(e){}endUI()}});c.on('close',function(){if(conn==c){conn=null;st('Reconnecting')}});c.on('error',function(){})}
setInterval(function(){if(peer&&peer.disconnected&&!peer.destroyed)try{peer.reconnect()}catch(e){};if(target&&!(conn&&conn.open))link()},6000);
// backup pairing over ntfy.sh
function ntfy(n){fetch('https://ntfy.sh/cbsimple-'+n,{method:'POST',body:me}).catch(function(){})}
function listen(){try{var es=new EventSource('https://ntfy.sh/cbsimple-'+me+'/sse');es.onmessage=function(e){try{var n=clean(JSON.parse(e.data).message);if(n&&n!=me){save(n);if(!(conn&&conn.open)){target=n;fill();link()}}}catch(x){}}}catch(e){}}
function mic(){if(stream)return Promise.resolve(stream);return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}}).then(function(s){stream=s;return s})}
function media(c){mcall=c;c.on('stream',function(s){var a=$('#au');a.srcObject=s;a.play().catch(function(){});st('On call with '+c.peer.slice(P.length),true)});
c.on('close',endUI);c.on('error',endUI);$('#call').textContent='END';$('#call').classList.add('end');$('#call').classList.remove('hide');$('#ans').hidden=true}
function endUI(){mcall=null;ring(false);$('#call').textContent='CALL';$('#call').classList.remove('end','hide');$('#ans').hidden=true;st(conn&&conn.open?'Connected to '+target:'Online. Ready',true)}
$('#call').onclick=function(){if(mcall){try{conn&&conn.open&&conn.send('bye')}catch(e){}mcall.close();endUI();return}target=target||$('#who').value;if(!target){st('Share your link first');return}
if(!peer||!peer.open){st('Still going online');return}st('Calling '+target);mic().then(function(s){media(peer.call(P+target,s))}).catch(function(){st('Allow the microphone')})};
$('#ans').onclick=function(){ring(false);var c=mcall;mic().then(function(s){c.answer(s);media(c)}).catch(function(){st('Allow the microphone')})};
$('#mute').onclick=function(){muted=!muted;if(stream)stream.getAudioTracks().forEach(function(t){t.enabled=!muted&&!paused});this.classList.toggle('on',muted);this.textContent=muted?'Unmute':'Mute'};
$('#pause').onclick=function(){paused=!paused;if(stream)stream.getAudioTracks().forEach(function(t){t.enabled=!muted&&!paused});$('#au').muted=paused;this.classList.toggle('on',paused);this.textContent=paused?'Resume':'Pause'};
$('#share').onclick=function(){var u=BASE+'?call='+me;if(navigator.share)navigator.share({title:'Call me',url:u}).catch(function(){});else{(navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).then(function(){st('Link copied',true)}).catch(function(){prompt('Copy your link',u)})}};
var rt;function ring(on){clearInterval(rt);if(on&&navigator.vibrate)rt=setInterval(function(){navigator.vibrate(400)},1200)}
function awake(){if('wakeLock' in navigator)navigator.wakeLock.request('screen').then(function(w){wake=w}).catch(function(){})}
document.addEventListener('visibilitychange',function(){if(!document.hidden){awake();if(peer&&peer.disconnected)try{peer.reconnect()}catch(e){};link()}});
if('serviceWorker' in navigator)window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){})});
