'use strict';
const MAIN=document.querySelector('#main');
document.querySelector('.skip').addEventListener('click',e=>{e.preventDefault();MAIN.tabIndex=-1;MAIN.focus();MAIN.scrollIntoView();});
const ROUTES={A:'AI 요소 활용',B:'실사 + AI',C:'3D·정밀 합성',D:'편집·그래픽'};
const GROUPS=['전체','공간·배경','반사·광학','모션·물리','전환·그래픽'];
let PROJECTS=[];
const projectOf=r=>PROJECTS.find(p=>p.id===r.projectId);
const WORKFLOWS={
 A:[['공간과 빛의 기준 고정','원본의 수평선·가까운 구조물·주광원을 기준으로 공간 마스터를 정합니다.'],['AI 요소 제작','배경·하늘·안개 등 바꿀 요소를 각각 준비하고, 승인된 이미지를 공유합니다.'],['깊이별 합성','전경·중경·원경 마스크를 나누고 대기 원근·반사·가림을 조절합니다.'],['시간 일관성 확인','카메라 이동, 경계, 밝기와 질감이 연속 프레임에서 안정적인지 확인합니다.']],
 B:[['실사 플레이트 보존','배우의 연기·손·접촉·카메라 움직임 등 바꾸지 않을 정보를 먼저 잠급니다.'],['보조 요소 생성','AI로 배경이나 복원 패치의 후보를 만들고, 원본의 빛과 원근에 맞는 안을 고릅니다.'],['로토·트래킹 결합','인물 보호 매트와 카메라/화면 트래킹을 사용해 요소를 따로 합성합니다.'],['경계와 연속성 마감','머리카락·손·유리 경계와 앞뒤 컷의 공간·조명·동작 연결을 검수합니다.']],
 C:[['지오메트리와 동작 설계','공간·접촉면·카메라·궤적을 실사 또는 3D 가이드로 고정합니다.'],['필수 플레이트·패스 확보','클린 플레이트, 반사, 인물, 깊이 등 해당 장면의 제어에 필요한 재료를 분리합니다.'],['AI를 보조 요소에 사용','룩·원경·재질·에셋 후보 제작에 AI를 활용하고, 정밀 구조와 물리는 유지합니다.'],['레이어별 검수','가림·접촉·반사·심도를 각각 확인한 뒤 모션블러·색·그레인을 통일합니다.']],
 D:[['연결 기준점 정하기','형태·시선·동작·텍스트 중 무엇이 앞뒤 이미지를 이어주는지 정합니다.'],['소스와 그래픽 분리','영상·지도·문자·그래프·골격 등의 소스를 별도 레이어로 준비합니다.'],['편집 곡선으로 연결','스케일·원근·마스크·초점·불투명도의 변화 시점을 직접 조절합니다.'],['전환의 의미 검수','임의의 모핑이 생기지 않는지, 기준점이 유지되고 정보가 의도대로 넘어가는지 확인합니다.']]
};
let CUTS=[],BY_ID={},archiveState={projectId:'',category:'전체',query:'',route:'',shown:20},videoCleanup=null,sectionObserver=null;
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const precise=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${(t%60).toFixed(2).padStart(5,'0')}`;
const range=r=>`${r.approx?'약 ':''}${precise(r.start)} — ${precise(r.end)}`;
const thumb=(r,n=1)=>`${projectOf(r).thumbBase}/${r.id}_${n}.jpg`;
function category(r){
 if(r.category)return r.category;
 if(r.route==='D')return '전환·그래픽';
 if(/등반|절벽|추락|하강|모래|소용돌이|파도 속|옥상 달리기/.test(r.title))return '모션·물리';
 if(/거울|미러|차창|유리|눈|초점|시점|광학|쌍안경|시계|개미/.test(r.title))return '반사·광학';
 return '공간·배경';
}
function go(id){location.hash=`clip/${id}`;}
function setActive(name){document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===name));}
function toast(message){const t=document.querySelector('#toast');t.textContent=message;t.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('visible'),2600);}
function wireClipLinks(root=MAIN){root.querySelectorAll('[data-clip]').forEach(el=>el.addEventListener('click',()=>go(el.dataset.clip)));}
function projectCard(p){
 const rs=CUTS.filter(r=>r.projectId===p.id);
 return `<a class="project-card" href="#project/${p.id}" aria-label="${E(p.title)} 작품별 분석 보기"><div class="project-cover"><img loading="lazy" src="${thumb(BY_ID[p.hero])}" alt="${E(p.title)} VFX 분석 대표 프레임"><span>CASE ${p.number} · ${p.format} / ${p.year}</span></div><div class="project-card-title"><h3>${E(p.title)}</h3><span aria-hidden="true">↗</span></div><p>${E(p.summary)}</p><div class="project-tags">${p.tags.map(t=>`<span>${E(t)}</span>`).join('')}</div><div class="project-card-meta"><span>${E(p.studio)}</span><span>${rs.length} CLIPS · ${rs.length*3} FRAMES</span></div></a>`;
}
function archive(projectId=''){
 const p=PROJECTS.find(p=>p.id===projectId);archiveState.projectId=p?.id||'';
 const rs=p?CUTS.filter(r=>r.projectId===p.id):CUTS;
 const featured=p?p.featured:['M03','S39','M22','S50','M40','M43'];
 setActive('archive');document.title=p?`${p.title} — VFX Notes`:'VFX Notes — 장면의 안쪽';
 MAIN.innerHTML=`<div class="wrap">${p?`<div class="detail-breadcrumb"><a href="#archive">작품 아카이브</a><span>/</span><span>CASE ${p.number}</span></div><section class="intro project-intro"><div><p class="eyebrow red">CASE STUDY ${p.number} / ${p.format} · ${p.year}</p><h1>${E(p.title)}</h1><p class="project-subtitle">${E(p.english)} · ${E(p.studio)}</p></div><p class="intro-copy">${E(p.summary)}</p></section><button class="hero" data-clip="${p.hero}" aria-label="${E(BY_ID[p.hero].title)} 분석 보기"><img src="${thumb(BY_ID[p.hero])}" alt="${E(BY_ID[p.hero].title)}"><span class="hero-label">${E(p.director)} · ${p.year}</span><span class="hero-text"><p>${E(p.studio)}</p><h2>${E(BY_ID[p.hero].title)}</h2><span>대표 클립 분석 보기 →</span></span></button><div class="film-caption"><strong>${E(p.description)}</strong><span>릴 ${clock(p.duration)} · 분석 ${p.date}</span></div>`:`<section class="intro"><div><p class="eyebrow red">VISUAL EFFECTS RESEARCH ARCHIVE</p><h1>보이지 않는 기술,<br>보이는 이야기.</h1></div><p class="intro-copy">작품에서 장면으로, 장면에서 기술로.<br>구도와 합성의 원리를 차곡차곡 기록합니다.<br>작품·기법·구현 방식으로 필요한 장면을 찾아보세요.</p></section><section class="project-library" aria-labelledby="project-title"><div class="section-heading"><div><p class="eyebrow">FILM & SERIES LIBRARY</p><h2 id="project-title">작품별 분석</h2></div><p>${PROJECTS.length}개의 작품 · 계속 쌓이는 장면의 기록</p></div><div class="project-grid">${PROJECTS.map(projectCard).join('')}</div></section>`}
 <section class="overview" aria-label="아카이브 개요"><div><p class="overview-title">${p?'이 작품을,':'한 장면을,'}<br>네 가지 관점으로 읽습니다.</p></div><div><b>${rs.length}<small>CLIPS</small></b><p>숏·전환 분석 구간</p></div><div><b>${rs.length*3}<small>FRAMES</small></b><p>클립별 대표 프레임</p></div><div><b>04<small>VIEWS</small></b><p>구도 · VFX · 구현 · 검수</p></div></section>
 <section aria-labelledby="selected-title"><div class="section-heading"><div><p class="eyebrow">SELECTED STUDIES</p><h2 id="selected-title">먼저 들여다볼 장면</h2></div><p>서로 다른 합성 원리를 보여주는 여섯 클립.</p></div><div class="featured-grid">${featured.map(id=>{const r=BY_ID[id],work=projectOf(r);return `<button class="feature" data-clip="${id}" aria-label="${E(r.title)} 분석 보기"><div class="feature-image"><img loading="lazy" src="${thumb(r)}" alt="${E(r.title)}"><span>${range(r)}</span></div><div class="feature-top"><span>${work.title} / ${id}</span><span class="arrow" aria-hidden="true">↗</span></div><h3>${E(r.title)}</h3><p>${category(r)} · ${ROUTES[r.route]}</p></button>`;}).join('')}</div></section>
 <section class="archive-section" id="clip-archive"><div class="section-heading archive-top"><div><p class="eyebrow">CLIP INDEX</p><h2>클립별 분석 기록</h2></div><p>작품과 기법을 함께 찾아보세요.</p></div>
 <div class="tools"><div class="category-tabs" role="group" aria-label="VFX 유형">${GROUPS.map(g=>`<button data-category="${g}" class="${g===archiveState.category?'active':''}" aria-pressed="${g===archiveState.category}">${g}</button>`).join('')}</div><label class="search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg><input id="clip-search" type="search" value="${E(archiveState.query)}" placeholder="작품, 기법, 클립, 타임코드" aria-label="클립 검색"></label></div>
 <div class="subtools"><span id="result-count"></span><div class="filter-selects"><select id="project-filter" aria-label="작품 필터"><option value="">모든 작품</option>${PROJECTS.map(work=>`<option value="${work.id}" ${work.id===archiveState.projectId?'selected':''}>${E(work.title)}</option>`).join('')}</select><select id="route-filter" aria-label="구현 방식 필터"><option value="">모든 구현 방식</option>${Object.entries(ROUTES).map(([k,v])=>`<option value="${k}" ${archiveState.route===k?'selected':''}>${k} · ${v}</option>`).join('')}</select></div></div>
 <div id="clip-list" class="clip-list"></div><button id="load-more" class="more"></button><p class="archive-note">촬영본·CG·최종 결과의 비교는 같은 분석 구간으로 묶었습니다. 카드 수는 본편의 편집 컷 수와 다릅니다. 타임코드는 각 작품의 분석 릴 기준입니다.</p></section>${p?`<section class="work-notes"><p class="eyebrow">SOURCE & SCOPE</p><p>${E(p.provenance)}</p><p>${E(p.method)}</p><a class="quiet-link" href="${p.analysis}" download>이 작품의 분석 원문 ↓</a></section><section class="related-projects"><div class="section-heading"><h2>다른 작품 살펴보기</h2></div><div class="project-grid">${PROJECTS.filter(x=>x!==p).map(projectCard).join('')}</div></section>`:''}</div>`;
 wireClipLinks();
 document.querySelector('#clip-search').addEventListener('input',e=>{archiveState.query=e.target.value;archiveState.shown=20;renderList();});
 document.querySelector('#project-filter').addEventListener('change',e=>{archiveState.projectId=e.target.value;archiveState.shown=20;renderList();});
 document.querySelector('#route-filter').addEventListener('change',e=>{archiveState.route=e.target.value;archiveState.shown=20;renderList();});
 MAIN.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{archiveState.category=b.dataset.category;archiveState.shown=20;MAIN.querySelectorAll('[data-category]').forEach(x=>{const a=x===b;x.classList.toggle('active',a);x.setAttribute('aria-pressed',String(a));});renderList();});
 document.querySelector('#load-more').onclick=()=>{archiveState.shown+=20;renderList();};renderList();
}
function renderList(){
 const q=archiveState.query.trim().toLocaleLowerCase();
 const filtered=CUTS.filter(r=>(!archiveState.projectId||r.projectId===archiveState.projectId)&&(archiveState.category==='전체'||category(r)===archiveState.category)&&(!archiveState.route||r.route===archiveState.route)&&(!q||[projectOf(r).title,projectOf(r).english,projectOf(r).studio,r.id,r.title,...(r.tags||[]),r.composition,r.vfx,r.implementation,range(r),clock(r.start)].join(' ').toLocaleLowerCase().includes(q)));
 document.querySelector('#result-count').textContent=`${String(filtered.length).padStart(2,'0')}개 기록 / 전체 ${CUTS.length}개`;
 document.querySelector('#clip-list').innerHTML=filtered.length?filtered.slice(0,archiveState.shown).map(r=>`<button class="clip-row route-${r.route}" data-clip="${r.id}" aria-label="${r.id} ${E(r.title)} 분석 보기"><span class="clip-number">${r.id}</span><span class="row-thumb"><img loading="lazy" src="${thumb(r)}" alt=""></span><span><span class="row-work">${E(projectOf(r).title)}</span><span class="clip-title">${E(r.title)}</span><span class="clip-meta">${category(r)} · ${precise(r.start)}–${precise(r.end)} · AI 근사 ${r.ai}</span>${r.tags?`<span class="row-tags">${r.tags.map(E).join(' / ')}</span>`:''}</span><span class="route-label"><i class="route-dot"></i>${ROUTES[r.route]}</span><span class="clip-time">${(r.end-r.start).toFixed(1)} SEC</span><span class="arrow" aria-hidden="true">↗</span></button>`).join(''):'<div class="empty">조건에 맞는 클립이 없습니다.<br>다른 작품·단어·구현 방식을 선택해 주세요.</div>';
 const more=document.querySelector('#load-more');more.hidden=filtered.length<=archiveState.shown;more.textContent=`기록 더 보기 (${Math.min(filtered.length,archiveState.shown)} / ${filtered.length}) +`;wireClipLinks(document.querySelector('#clip-list'));
}
function sourcesFor(p,r){
 return `<li><a href="${p.video}" target="_blank" rel="noopener"><span>분석 기준 VFX Breakdown 릴<small>${E(p.studio)} · ${range(r)} / 브라우저 재생용 720p 사본</small></span><span>↗</span></a></li>${p.sources.map(x=>`<li><a href="${E(x.url)}" target="_blank" rel="noopener"><span>${E(x.title)}<small>${E(x.note)}</small></span><span>↗</span></a></li>`).join('')}<li><a href="https://open.higgsfield.ai/models/bytedance/seedance-2.5/video-edit/api-reference" target="_blank" rel="noopener"><span>Higgsfield · Seedance 2.5 공식 문서<small>기능 지원은 정밀 재현의 성공률과 별개입니다. 2026.10.22 확인</small></span><span>↗</span></a></li><li><a href="${p.analysis}" download><span>${E(p.title)} 컷별 분석 원문<small>화면 관찰·구현 제안·검수 기준 / Markdown</small></span><span>↓</span></a></li>`;
}
function insightFor(r){
 if(r.insight)return E(r.insight);
 if(r.id==='S39'||r.id==='S40')return '거울 자체보다 초점의 독립성이 핵심입니다. 실체 두 인물과 반사 속 두 인물을 별도 레이어로 두어야, 공간 관계를 유지한 채 시선의 우선순위를 바꿀 수 있습니다.';
 if(r.id==='S50')return '두 이미지 사이에서 끝까지 남는 기준점은 사각형 외곽과 붉은 위치점입니다. 소스 제작에는 AI를 쓸 수 있지만, 연결은 직접 정렬한 그래픽과 편집 곡선으로 제어하는 편이 정확합니다.';
 if(r.id==='S34')return '작게 보일 때 자연스러운 소품도 확대되면 바늘·날짜·베젤의 일관성을 검증받습니다. 고해상도 생성보다 정확한 에셋과 손목의 가림 관계가 먼저입니다.';
 if(r.id==='S67')return '파도가 얼굴처럼 보이는 순간과 자연의 흐름으로 보이는 순간 사이의 균형이 중요합니다. 알아볼 수 있는 윤곽을 설계하되, 물리적인 파도 움직임 속에 숨겨야 합니다.';
 if(r.id==='S75'||r.id==='S78')return '물은 배경이면서 인물·모래와 상호작용하는 전경이기도 합니다. 멀리 있는 바다는 생성할 수 있어도, 접촉하는 물과 가림은 별도로 고정할 가치가 큽니다.';
 return {A:'분위기를 바꾸더라도 장면의 지리와 빛의 방향은 유지되어야 합니다. 생성한 요소를 깊이별로 나눌수록 수정할 수 있는 범위가 넓어집니다.',B:'보존할 정보와 바꿀 정보를 먼저 나누는 것이 출발점입니다. 얼굴·손·연기를 유지하면 AI를 배경과 보조 요소에 더 명확하게 사용할 수 있습니다.',C:'겉보기 사실감과 정밀한 통제는 별개의 문제입니다. 공간·접촉·광학 관계를 먼저 고정하고, AI의 역할을 좁혀가는 방식이 적합합니다.',D:'전환의 힘은 이미지가 바뀌는 이유에서 나옵니다. 형태·시선·동작의 연결점을 직접 잠그면, 불필요한 모핑 없이 수정 가능한 전환을 만들 수 있습니다.'}[r.route];
}
function sectionTitle(n,title,label){return `<div class="analysis-title"><h2><small>${n} / ${label.toUpperCase()}</small>${title}</h2><span class="evidence">${n==='03'?'구현 제안':n==='04'?'검수 제안':'화면 관찰'}</span></div>`;}
function detail(id){
 const r=BY_ID[id];if(!r){notFound();return;}setActive('archive');document.title=`${r.title} — VFX Notes`;
 const p=projectOf(r),siblings=CUTS.filter(x=>x.projectId===r.projectId),i=siblings.indexOf(r),prev=siblings[i-1],next=siblings[i+1];
 MAIN.innerHTML=`<div class="wrap"><div class="detail-breadcrumb"><a href="#archive">아카이브</a><span>/</span><a href="#project/${p.id}">${E(p.title)}</a><span>/</span><span>${r.id}</span></div>
 <div class="detail-heading"><div><p class="eyebrow red">${r.id} · ${category(r)} / ${E(p.english).toUpperCase()}</p><h1>${E(r.title)}</h1></div><span class="id-counter">${String(i+1).padStart(2,'0')} / ${siblings.length}</span></div>
 <div class="detail-media"><div class="video-box"><video id="clip-video" controls playsinline preload="metadata" poster="${thumb(r)}" src="${p.video}" aria-label="${E(r.title)} 원본 구간 영상"></video></div><aside class="media-aside"><p class="eyebrow">CLIP INFORMATION</p><div class="media-field"><small>원본 릴 재생 구간</small><span>${range(r)}</span></div><div class="media-field"><small>구간 길이</small><span>${(r.end-r.start).toFixed(2)}초</span></div><div class="media-field"><small>권장 구현 경로</small><span>${r.route} · ${ROUTES[r.route]}</span></div><div class="media-field"><small>AI 단독 외형 근사</small><span>${r.ai}</span></div><button class="play-segment" id="play-segment">▶ 이 클립 재생</button><p class="media-note">분석 릴의 720p 재생용 사본.<br>선택 구간 끝에서 자동으로 정지합니다.</p></aside></div>
 <div class="clip-nav"><button id="previous-clip" ${prev?'':'disabled'} aria-label="이전 클립">← ${prev?`${prev.id} 이전 클립`:'첫 번째 클립'}</button><span>${r.id} / ${clock(r.start)}—${clock(r.end)}</span><button id="next-clip" ${next?'':'disabled'} aria-label="다음 클립">${next?`${next.id} 다음 클립`:'마지막 클립'} →</button></div>
 <div class="notebook"><nav class="notebook-nav" aria-label="분석 섹션"><p class="eyebrow">IN THIS STUDY</p><a href="#composition" data-section="composition" class="active"><b>01</b>구도와 시선</a><a href="#vfx" data-section="vfx"><b>02</b>VFX와 합성</a><a href="#implementation" data-section="implementation"><b>03</b>AI 구현 설계</a><a href="#quality" data-section="quality"><b>04</b>한계와 검수</a><a href="#sources" data-section="sources"><b>05</b>자료와 근거</a></nav>
 <div class="notebook-body"><section id="composition" class="analysis-section">${sectionTitle('01','구도와 시선','Composition')}<p class="analysis-copy">${E(r.composition)}</p><div class="frames">${r.frames.map((t,j)=>`<button class="frame" data-seek="${t}" aria-label="${precise(t)} 프레임부터 보기"><img loading="lazy" src="${thumb(r,j)}" alt="${r.id} ${precise(t)} 원본 표본"><span class="frame-label"><span>FRAME 0${j+1}</span><span>${precise(t)} ↗</span></span></button>`).join('')}</div><p class="frames-note">구간 안의 앞 · 중간 · 뒤 시간 표본입니다. 같은 순간의 Before / After가 아니며, 원본 릴의 패스 비교나 와이프가 포함될 수 있습니다. 프레임을 누르면 해당 시점으로 이동합니다.</p></section>
 <section id="vfx" class="analysis-section">${sectionTitle('02','VFX와 합성','Visual Effects')}<p class="analysis-copy">${E(r.vfx)}</p><div class="insight"><p class="eyebrow red">READING THE SHOT</p><p>${insightFor(r)}</p></div></section>
 <section id="implementation" class="analysis-section">${sectionTitle('03','AI 구현 설계','AI & Hybrid Workflow')}<p class="analysis-copy">${E(r.implementation)}</p><div class="assessment"><div><small>AI 단독 · 비슷한 외형의 새 장면</small><strong>근사 가능성 <em>${r.ai}</em></strong></div><div><small>정밀한 제어를 위한 권장 경로</small><strong>${ROUTES[r.route]}</strong></div></div><p class="eyebrow">권장 작업 순서 / 제작 제안</p><ol class="workflow">${WORKFLOWS[r.route].map(([t,p],n)=>`<li><span class="step">0${n+1}</span><div><strong>${t}</strong><p>${p}</p></div></li>`).join('')}</ol><p class="frames-note">위 순서와 구현 설계는 이 장면을 새로 구현할 때의 제안입니다. 실제 제작사의 공정 순서나 사용 소프트웨어를 재구성한 기록은 아닙니다.</p></section>
 <section id="quality" class="analysis-section">${sectionTitle('04','한계와 검수','Quality & Limitations')}<div class="checks">${E(r.check)}</div><p class="frames-note">가능성 평가는 원본 화면과 모델 기능 사양을 바탕으로 한 추정입니다. AI 생성 테스트는 실행하지 않았으며, 성공률이나 영화급 품질을 보장하는 수치가 아닙니다.</p></section>
 <section id="sources" class="analysis-section"><div class="analysis-title"><h2><small>05 / SOURCES & EVIDENCE</small>자료와 근거</h2><span class="evidence">${p.date} 기록</span></div><ul class="source-list">${sourcesFor(p,r)}</ul></section></div></div>
 <div class="detail-end"><a href="#project/${p.id}">← 이 작품의 전체 클립으로</a>${next?`<button data-clip="${next.id}">다음 기록 · ${next.id} →</button>`:''}</div></div>`;
 wireClipLinks();if(prev)document.querySelector('#previous-clip').onclick=()=>go(prev.id);if(next)document.querySelector('#next-clip').onclick=()=>go(next.id);
 setupVideo(r);setupSections();
}
function setupVideo(r){
 const v=document.querySelector('#clip-video'),button=document.querySelector('#play-segment');let disposed=false,request=0;
 const metadata=()=>v.readyState>=1?Promise.resolve():new Promise((resolve,reject)=>{v.addEventListener('loadedmetadata',resolve,{once:true});v.addEventListener('error',reject,{once:true});});
 async function seek(t){
  await metadata();if(disposed)return;
  if(Math.abs(v.currentTime-t)<.015&&!v.seeking)return;
  await new Promise((resolve,reject)=>{v.addEventListener('seeked',resolve,{once:true});v.addEventListener('error',reject,{once:true});v.currentTime=t;});
 }
 const initialPosition=seek(r.start);initialPosition.catch(()=>{});
 async function playFrom(t){
  const ticket=++request;button.disabled=true;button.textContent='영상 구간을 불러오는 중…';
  try{await initialPosition;await seek(t);if(disposed||ticket!==request)return;await v.play();}
  catch{if(!disposed)toast('영상을 불러오지 못했습니다. 재생 버튼을 다시 눌러 주세요.');}
  finally{if(!disposed&&ticket===request){button.disabled=false;button.textContent=v.paused?'▶ 이 클립 다시 보기':'Ⅱ 일시정지';}}
 }
 function settle(){if(v.currentTime>=r.end){v.pause();v.currentTime=Math.max(r.start,r.end-.065);}}
 v.addEventListener('timeupdate',settle);
 v.addEventListener('play',()=>{if(v.readyState<1||v.currentTime<r.start-.05||v.currentTime>=r.end-.07){v.pause();playFrom(r.start);return;}button.textContent='Ⅱ 일시정지';});
 v.addEventListener('pause',()=>{button.textContent='▶ 이 클립 다시 보기';});
 v.addEventListener('error',()=>{button.textContent='영상 다시 불러오기';toast('영상을 불러오지 못했습니다. 다시 재생해 주세요.');});
 button.onclick=()=>{if(!v.paused){v.pause();return;}const t=v.currentTime>=r.end-.1||v.currentTime<r.start?r.start:v.currentTime;playFrom(t);};
 MAIN.querySelectorAll('[data-seek]').forEach(b=>b.onclick=async()=>{++request;v.pause();button.disabled=true;try{await initialPosition;await seek(Math.min(+b.dataset.seek,r.end-.065));if(disposed)return;v.scrollIntoView({behavior:'smooth',block:'center'});button.textContent='▶ 이 프레임부터 재생';}catch{toast('프레임을 불러오지 못했습니다. 다시 눌러 주세요.');}finally{if(!disposed)button.disabled=false;}});
 videoCleanup=()=>{disposed=true;++request;v.pause();v.removeAttribute('src');v.load();};
}
function setupSections(){
 const links=[...MAIN.querySelectorAll('[data-section]')];
 links.forEach(a=>a.onclick=e=>{e.preventDefault();document.getElementById(a.dataset.section).scrollIntoView({behavior:'smooth',block:'start'});links.forEach(x=>x.classList.toggle('active',x===a));});
 sectionObserver=new IntersectionObserver(entries=>{const hit=entries.find(e=>e.isIntersecting);if(hit)links.forEach(a=>a.classList.toggle('active',a.dataset.section===hit.target.id));},{rootMargin:'-10% 0px -65% 0px',threshold:0});
 MAIN.querySelectorAll('.analysis-section').forEach(s=>sectionObserver.observe(s));
}
function method(){
 setActive('method');document.title='분석 방법 — VFX Notes';MAIN.innerHTML=`<article class="text-page"><p class="eyebrow red">HOW WE READ A SHOT</p><h1>한 장면을,<br>네 가지 관점으로.</h1><p class="lead">그럴듯한 이미지와 정밀한 제작 사이에는 차이가 있습니다.<br>화면에서 확인한 것과, 새로 만들기 위해 제안한 것을 구분해 기록합니다.</p><div class="method-grid"><div><small>01 / COMPOSITION</small><h3>구도와 시선</h3><p>인물의 위치, 프레임 안팎, 깊이와 여백을 살핍니다. 무엇이 먼저 보이고, 무엇이 의도적으로 숨겨졌는지 읽습니다.</p></div><div><small>02 / VISUAL EFFECTS</small><h3>VFX와 합성</h3><p>촬영본·CG·최종 결과의 차이를 대조합니다. 원본 릴에서 드러나지 않는 작업 범위나 소프트웨어는 단정하지 않습니다.</p></div><div><small>03 / IMPLEMENTATION</small><h3>AI 구현 설계</h3><p>보존할 실사, 생성할 요소, 직접 통제할 합성을 나눕니다. 원작의 실제 공정과 새로운 제작 제안을 구분합니다.</p></div><div><small>04 / QUALITY</small><h3>한계와 검수</h3><p>얼굴·손·접촉·반사·공간 일관성을 구체적으로 점검합니다. 모델의 기능 지원을 재현 성공률로 해석하지 않습니다.</p></div></div><section class="text-block"><h2>네 가지 구현 경로</h2><table class="method-table"><thead><tr><th>분류</th><th>권장 경로</th><th>작업의 중심</th></tr></thead><tbody><tr><td>A</td><td>AI 요소 활용</td><td>배경·하늘·안개 후보와 깊이별 합성</td></tr><tr><td>B</td><td>실사 + AI</td><td>연기·접촉을 보존한 뒤 배경과 보조 요소 제작</td></tr><tr><td>C</td><td>3D·정밀 합성</td><td>기하·물리·반사·표면 추적을 고정하고 AI로 보조</td></tr><tr><td>D</td><td>편집·그래픽</td><td>형태 매치·지도·글자·초점·디졸브를 직접 제어</td></tr></tbody></table><p>AI 단독 근사 ‘높음·중간·낮음’은 비슷한 외형의 새 장면을 만드는 가능성에 대한 추정입니다. 같은 배우·같은 공간·같은 동작의 정확한 복제를 뜻하지 않습니다.</p></section><section class="text-block"><h2>컷을 나누는 기준</h2><p>〈헤어질 결심〉 제작 릴은 전체를 1초 간격으로 검토하고, 전환과 빠른 동작·미세 합성 구간은 0.5초 간격으로 추가 확인했습니다. 장면 변화 후보를 검출한 뒤 화면과 대조했습니다.</p><p>같은 숏의 촬영본·회색 CG·합성 결과를 반복해 보여주는 와이프는 한 분석 구간으로 묶었습니다. 연속된 가상 카메라 이동과 그래픽 전환도 의미에 따라 묶었으므로, 80개 기록은 본편의 편집 컷 수와 다릅니다.</p><p>타임코드는 영화 본편이 아닌 제공된 릴의 위치입니다. 자동 검출된 경계와 시각적으로 분할한 근사 경계를 구분하며, 납품용 EDL의 프레임 경계로 확정한 자료는 아닙니다.</p></section><section class="text-block"><h2>작품별 검토 범위</h2>${PROJECTS.map(p=>`<h3>${E(p.title)}</h3><p>${E(p.method)}</p>`).join('')}<p>새 영상도 작품 → 분석 구간 → 기법 태그 → 구현 방식 순서로 등록합니다. 작품별 출처·버전·분석일을 따로 유지하며 서로 다른 릴의 타임코드를 섞지 않습니다.</p></section><section class="text-block"><h2>아직 실행하지 않은 것</h2><p>이 사례에서 AI 이미지·영상 생성 테스트는 진행하지 않았습니다. 크레딧을 사용하지 않았으며, 구현 가능성은 원본 관찰과 기록일에 확인한 모델 기능 사양에 근거합니다. 실제 제작은 짧은 벤치마크로 공간 보존·수정 비용·프레임 안정성을 확인하는 단계가 필요합니다.</p><a class="quiet-link" href="data/README.md" download>상세 분석 기준과 모델 사양 내려받기 ↓</a></section><a class="quiet-link" href="#archive">아카이브 둘러보기 →</a></article>`;
}
function about(){
 setActive('about');document.title='기록에 관하여 — VFX Notes';
 MAIN.innerHTML=`<article class="text-page"><p class="eyebrow red">ABOUT THIS ARCHIVE</p><h1>장면의 안쪽에<br>남겨둔 기록.</h1><p class="lead">좋은 VFX는 스스로를 드러내지 않을 때가 많습니다.<br>작품마다 출처를 남기고, 클립마다 관찰과 제안을 나누어 쌓습니다.</p><div class="about-meta"><div><small>등록 작품</small><strong>${PROJECTS.length}개</strong></div><div><small>분석 구간</small><strong>${CUTS.length}개</strong></div><div><small>대표 프레임</small><strong>${CUTS.length*3}장</strong></div></div><section class="text-block"><h2>작품 → 클립 → 기법</h2><p>작품별 페이지에서 전체 맥락을 읽고, 통합 목록에서는 기법과 구현 방식으로 서로 다른 작품의 장면을 비교할 수 있습니다. 새 영상은 같은 네 가지 분석 관점과 출처 기록을 유지하며 추가합니다.</p><p>화면 관찰은 공개 릴에서 확인한 정보이며, AI 구현 설계와 검수는 새로운 제작을 위한 제안입니다. AI 생성 테스트는 실행하지 않았습니다. 정성적 가능성은 같은 배우·동작·공간을 정확히 복제하는 성공률이 아닙니다.</p></section>${PROJECTS.map(p=>`<section class="text-block"><p class="eyebrow">CASE ${p.number} / ${p.date}</p><h2>${E(p.title)}</h2><p>${E(p.provenance)}</p><p>${E(p.method)}</p><p><a class="quiet-link" href="#project/${p.id}">작품 분석 보기 →</a></p><ul class="source-list">${p.sources.map(x=>`<li><a href="${E(x.url)}" target="_blank" rel="noopener"><span>${E(x.title)}<small>${E(x.note)}</small></span><span>↗</span></a></li>`).join('')}<li><a href="${p.csv}" download><span>이 작품의 클립 목록<small>타임코드와 구현 방식 · CSV</small></span><span>↓</span></a></li><li><a href="${p.analysis}" download><span>이 작품의 상세 분석<small>관찰·제작 제안·검수 · Markdown</small></span><span>↓</span></a></li></ul></section>`).join('')}<section class="text-block"><h2>재생 사본과 원본 자료</h2><p>플레이어는 브라우저용 720p 사본을 사용합니다. 프레임 표본은 분석 소스에서 추출했으며, 촬영 플레이트·EXR·카메라 트래킹 자료를 보유한 분석은 아닙니다. 타임코드는 작품 본편이 아닌 각 공개 릴을 기준으로 합니다.</p><a class="quiet-link" href="data/archive-clips.csv" download>전체 작품 클립 목록 ↓</a></section></article>`;
}
function notFound(){MAIN.innerHTML='<article class="text-page"><p class="eyebrow">RECORD NOT FOUND</p><h1>이 기록을 찾을 수 없습니다.</h1><a class="quiet-link" href="#archive">전체 아카이브로 돌아가기 →</a></article>';}
function render(){
 if(videoCleanup){videoCleanup();videoCleanup=null;}if(sectionObserver){sectionObserver.disconnect();sectionObserver=null;}
 const hash=decodeURIComponent(location.hash.slice(1)||'archive');
 if(hash.startsWith('clip/'))detail(hash.split('/')[1]);else if(hash.startsWith('project/')){archiveState.shown=20;archive(hash.split('/')[1]);}else if(hash==='method')method();else if(hash==='about')about();else archive();
 window.scrollTo({top:0,behavior:'auto'});
}
window.addEventListener('hashchange',render);
async function loadArchive(){
 const response=await fetch('data/projects.json');if(!response.ok)throw Error('작품 목록 불러오기 실패');
 PROJECTS=await response.json();
 const records=await Promise.all(PROJECTS.map(async p=>{const response=await fetch(p.cuts);if(!response.ok)throw Error('분석 자료 불러오기 실패');return (await response.json()).map(r=>({...r,projectId:p.id}));}));
 CUTS=records.flat();BY_ID=Object.fromEntries(CUTS.map(r=>[r.id,r]));render();
}
loadArchive().catch(()=>{MAIN.innerHTML='<article class="text-page"><h1>분석 기록을 불러오지 못했습니다.</h1><p>페이지를 새로고침해 주세요.</p><button class="quiet-link" onclick="location.reload()">다시 불러오기 ↻</button></article>';});
