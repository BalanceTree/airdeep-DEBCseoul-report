/* ============================================================
   서울 본사 장애인기업지원센터 월간 모니터링 리포트 (5월)
   그래프 1개 = CSV 1개 구조. data/ 폴더의 CSV만 고치면 갱신됨.
     temp_zone.csv      구역별 온도 (+실외최고기온)
     temp_ctrl_low.csv  1·2·3·별관 제어기 온도 (+실외)
     temp_ctrl_6f.csv   6층 제어기 온도 (+실외)
     temp_ctrl_7f.csv   7층 제어기 온도 (+실외)
     oper_zone.csv      층별 일평균 가동시간
     oper_bar.csv       층별 근무내/외 총가동시간
     increase_work.csv  전월대비 증가(근무시간)
     increase_off.csv   전월대비 증가(근무외)
     holidays.csv       주말·공휴일 날짜 목록 (x축 라벨 빨강) — 매달 이 파일만 수정
   ============================================================ */

const DAYS = Array.from({length:31},(_,i)=>i+1);          // 5월 = 31일
const LC   = ['#2D6BFF','#E5484D','#22C55E','#F59E0B','#7C3AED','#0F766E','#BE185D','#0EA5E9','#78716C','#DB2777'];
const TT   = {backgroundColor:'#0B1220',titleColor:'#fff',bodyColor:'#E5E9F0',padding:10,cornerRadius:8,displayColors:true,boxWidth:10,boxHeight:10,boxPadding:3};
const OUTDOOR_KEY = '최고기온(℃)';
let HOLIDAYS = new Set();                                  // holidays.csv에서 채움

/* ── CSV 파서 ──────────────────────────────────────────────── */
function parseCSV(text){
  text = text.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  return lines.map(line => {
    const cells = []; let cur = '', inQ = false;
    for(let i=0;i<line.length;i++){
      const c = line[i];
      if(inQ){
        if(c === '"'){ if(line[i+1] === '"'){ cur += '"'; i++; } else inQ = false; }
        else cur += c;
      } else {
        if(c === '"') inQ = true;
        else if(c === ','){ cells.push(cur); cur = ''; }
        else cur += c;
      }
    }
    cells.push(cur);
    return cells.map(s => s.trim());
  });
}
function num(v){
  if(v === undefined || v === null || v === '') return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}
function toSeriesMap(rows){
  const names = rows[0].slice(1);
  const map = {}; names.forEach(n => map[n] = []);
  for(let r=1;r<rows.length;r++){
    names.forEach((n,ci)=> map[n].push(num(rows[r][ci+1])));
  }
  return { names, map };
}
function toObjects(rows){
  const header = rows[0];
  return rows.slice(1).map(row=>{
    const o = {}; header.forEach((h,i)=> o[h] = row[i] ?? ''); return o;
  });
}

/* ── 주말·공휴일 x축 라벨 빨강 처리용 콜백 ────────────────── */
function tickColor(){
  // 라벨(날짜)이 휴일이면 빨강, 아니면 기본색
  return (ctx)=> HOLIDAYS.has(DAYS[ctx.index]) ? '#E5484D' : '#5B6577';
}

/* ── 온도 라인차트 (실외 점선 오버레이) ───────────────────── */
function mkTempChart(canvasId, legendId, series){
  const el = document.getElementById(canvasId);
  if(!el) return;
  // 실외 계열은 검은 점선, 나머지는 컬러 실선
  const innerNames = series.names.filter(n => n !== OUTDOOR_KEY);
  const datasets = innerNames.map((label,i)=>({
    label, data:series.map[label],
    borderColor:LC[i%LC.length], backgroundColor:'transparent',
    borderWidth:1.9, fill:false, spanGaps:true, tension:.35,
    pointRadius:0, pointHoverRadius:4
  }));
  if(series.map[OUTDOOR_KEY]){
    datasets.push({
      label:'실외 최고기온', data:series.map[OUTDOOR_KEY],
      borderColor:'#111827', backgroundColor:'transparent',
      borderWidth:2, borderDash:[5,4], fill:false, spanGaps:true, tension:.35,
      pointRadius:0, pointHoverRadius:4
    });
  }
  new Chart(el,{
    type:'line',
    data:{labels:DAYS, datasets},
    options:{
      responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:{...TT,callbacks:{
        title:items=>`${items[0].label}일`,
        label:c=>` ${c.dataset.label}: ${c.parsed.y}℃`
      }}},
      scales:{
        x:{grid:{display:false},ticks:{maxRotation:0,autoSkip:false,font:{size:9},color:tickColor()}},
        y:{min:14,suggestedMax:34,ticks:{callback:v=>v+'℃',font:{size:9.5}},grid:{color:'#EEF1F6'}}
      },
      elements:{line:{tension:.35}}
    }
  });
  // 범례 자동 생성
  if(legendId){
    const lg = document.getElementById(legendId);
    if(lg){
      let html = innerNames.map((n,i)=>`<span><i style="background:${LC[i%LC.length]}"></i>${n}</span>`).join('');
      html += `<span><i style="background:#111827;height:0;border-top:2px dashed #111827;width:18px"></i>실외 최고기온</span>`;
      lg.innerHTML = html;
    }
  }
}

/* ── 가동시간 라인차트 ─────────────────────────────────────── */
function mkOperLine(canvasId, legendId, series){
  const el = document.getElementById(canvasId);
  if(!el) return;
  new Chart(el,{
    type:'line',
    data:{labels:DAYS,datasets:series.names.map((label,i)=>({
      label, data:series.map[label], borderColor:LC[i%LC.length], backgroundColor:'transparent',
      borderWidth:1.9, fill:false, spanGaps:true, tension:.35, pointRadius:0, pointHoverRadius:4
    }))},
    options:{
      responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:{...TT,callbacks:{
        title:items=>`${items[0].label}일`, label:c=>` ${c.dataset.label}: ${c.parsed.y}h`
      }}},
      scales:{
        x:{grid:{display:false},ticks:{maxRotation:0,autoSkip:false,font:{size:9},color:tickColor()}},
        y:{min:0,suggestedMax:7,ticks:{callback:v=>v+'h',font:{size:9.5}},grid:{color:'#EEF1F6'}}
      }
    }
  });
  if(legendId){
    const lg = document.getElementById(legendId);
    if(lg) lg.innerHTML = series.names.map((n,i)=>`<span><i style="background:${LC[i%LC.length]}"></i>${n}</span>`).join('');
  }
}

/* ── 증감 표 자동 생성 ─────────────────────────────────────── */
function fillIncreaseTable(tbodyId, rows){
  const tb = document.getElementById(tbodyId);
  if(!tb) return;
  const data = rows.map(r=>{
    const zone = (r['HUB_NICKNAME'] || r['지역'] || '').replace(/^본사_/, '');
    const prev = num(r['총가동시간_시간_4월']) ?? num(r['전월']) ?? 0;
    const cur  = num(r['총가동시간_시간_5월']) ?? num(r['당월']) ?? 0;
    const diff = +(cur - prev).toFixed(1);
    const pct  = prev > 0 ? +((diff / prev) * 100).toFixed(1) : null;
    return { zone, prev, cur, diff, pct };
  }).sort((a,b)=>b.diff-a.diff);
  tb.innerHTML = data.map(r=>{
    const pctTxt = r.pct==null ? '—' : `<span class="${r.pct>0?'risk':'ok-txt'}">${r.pct>0?'▲':'▼'} ${Math.abs(r.pct)}%</span>`;
    const diffTxt = `<span class="${r.diff>0?'risk':'ok-txt'}">${r.diff>0?'+':''}${r.diff}</span>`;
    return `<tr><td class="inc-zone"><strong>${r.zone}</strong></td><td class="num inc-num">${r.prev}</td><td class="num inc-num">${r.cur}</td><td class="num inc-num">${diffTxt}</td><td class="num inc-num">${pctTxt}</td></tr>`;
  }).join('');
}

/* ── 에러 표시 ─────────────────────────────────────────────── */
function showError(msg){
  const div = document.createElement('div');
  div.style.cssText = 'background:#FEECEC;border:1px solid #E5484D;color:#B91C1C;padding:14px 18px;border-radius:10px;margin:16px 0;font-size:13px;line-height:1.6';
  div.innerHTML = `<strong>데이터를 불러오지 못했습니다.</strong><br>${msg}<br><span style="color:#7A1F1F;font-size:12px">로컬 서버에서 열었는지(예: <code>python -m http.server</code>), data 폴더의 CSV가 있는지 확인해 주세요.</span>`;
  document.body.prepend(div);
}

/* ── 메인 ──────────────────────────────────────────────────── */
async function main(){
  Chart.defaults.font.family = "'Pretendard Variable',Pretendard,system-ui,sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.color = '#5B6577';

  const files = [
    'data/temp_zone.csv','data/temp_ctrl_low.csv','data/temp_ctrl_6f.csv','data/temp_ctrl_7f.csv',
    'data/oper_zone.csv','data/oper_space.csv','data/increase_work.csv','data/increase_off.csv',
    'data/holidays.csv'
  ];
  let texts;
  try {
    const res = await Promise.all(files.map(f=>fetch(f)));
    if(res.some(r=>!r.ok)) throw new Error('CSV 파일 응답 오류 (HTTP)');
    texts = await Promise.all(res.map(r=>r.text()));
  } catch(e){ showError(e.message); return; }

  let tempZone, ctrlLow, ctrl6, ctrl7, operZone, operSpace, incWork, incOff, holiRows;
  try {
    tempZone  = toSeriesMap(parseCSV(texts[0]));
    ctrlLow   = toSeriesMap(parseCSV(texts[1]));
    ctrl6     = toSeriesMap(parseCSV(texts[2]));
    ctrl7     = toSeriesMap(parseCSV(texts[3]));
    operZone  = toSeriesMap(parseCSV(texts[4]));
    operSpace = toSeriesMap(parseCSV(texts[5]));
    incWork   = toObjects(parseCSV(texts[6]));
    incOff    = toObjects(parseCSV(texts[7]));
    holiRows  = toObjects(parseCSV(texts[8]));
  } catch(e){ showError('CSV 파싱 중 오류: ' + e.message); return; }

  // 휴일 목록 세팅 (헤더명 무관하게 첫 열 사용)
  HOLIDAYS = new Set(holiRows.map(r=>num(Object.values(r)[0])).filter(v=>v!=null));

  /* 온도 그래프 (실외 점선) */
  mkTempChart('c-temp-zone',     'lg-zone',     tempZone);
  mkTempChart('c-temp-ctrl-low', 'lg-ctrl-low', ctrlLow);
  mkTempChart('c-temp-ctrl-6f',  'lg-ctrl-6f',  ctrl6);
  mkTempChart('c-temp-ctrl-7f',  'lg-ctrl-7f',  ctrl7);

  /* 가동시간 라인 */
  mkOperLine('c-oper-line', 'lg-oper', operZone);

  /* 공간구분별 일평균 가동시간 라인 */
  mkOperLine('c-oper-bar', 'lg-oper-space', operSpace);

  /* 증감 표 */
  fillIncreaseTable('incWorkB', incWork);
  fillIncreaseTable('incOffB',  incOff);
}

window.addEventListener('DOMContentLoaded', main);
