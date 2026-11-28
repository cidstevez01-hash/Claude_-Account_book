const data=JSON.parse(document.getElementById('preview-data').textContent)
let theme='warm',mode='cash',playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,timer
const articles=[...document.querySelectorAll('article[data-choice]')]
for(const article of articles){
 for(const target of article.querySelectorAll('.large-control,.actual-control')){
  const button=document.createElement('button');button.type='button';button.className='exchange';button.setAttribute('aria-label','切换现金／积分');
  const money=document.createElement('span');money.className='money';money.innerHTML=data.cashSvg;money.setAttribute('aria-hidden','true');
  const coin=document.createElement('img');coin.className='coin';coin.alt='';button.append(money,coin);button.onclick=()=>swap(true);target.append(button)
 }
 const phone=article.querySelector('.phone');new ResizeObserver(()=>phone.style.setProperty('--phone-scale',phone.clientWidth/390)).observe(phone)
}
function render(){
 const frame=data.themes[theme],pose=frame.poses[mode]
 document.body.classList.toggle('silver',theme==='silver')
 for(const article of articles){
  for(const [key,value] of Object.entries(frame.tokens))article.style.setProperty(key,value)
  article.style.setProperty('--mode-blush',theme==='warm'?'#FAE7DF':'#F3EAF4')
  article.querySelector('.page-image').src=theme+'-page-'+mode+'.png';article.querySelectorAll('.point-art,.point-size,.point-before').forEach(i=>i.src='point-gift-23-'+theme+'.png');article.querySelectorAll('.cash-art,.cash-size').forEach(i=>i.src='cash-current-'+theme+'.svg')
  const actual=article.querySelector('.actual-control');actual.style.left=frame.button.x/390*100+'%';actual.style.top=frame.button.y/844*100+'%'
  for(const b of article.querySelectorAll('.exchange')){
   const cash=b.querySelector('.money'),coin=b.querySelector('.coin')
   Object.assign(cash.style,pose.cash);Object.assign(coin.style,pose.coin)
   const src='point-gift-23-'+theme+'.png';if(coin.getAttribute('src')!==src)coin.src=src
   b.dataset.mode=mode
  }
 }
 document.getElementById('mode-label').textContent=mode==='cash'?'当前：金额模式':'当前：积分模式'
 document.querySelectorAll('[data-theme]').forEach(b=>b.classList.toggle('active',b.dataset.theme===theme))
 document.getElementById('play').textContent=playing?'暂停自动演示':'播放自动演示'
 document.getElementById('play').setAttribute('aria-pressed',String(playing))
}
function schedule(){clearInterval(timer);if(playing)timer=setInterval(()=>swap(false),1900)}
function swap(manual){if(manual){playing=false;schedule()}mode=mode==='cash'?'point':'cash';render()}
document.querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>{theme=b.dataset.theme;render()})
document.getElementById('play').onclick=()=>{playing=!playing;render();schedule()}
document.getElementById('swap').onclick=()=>swap(true)
render();schedule()
