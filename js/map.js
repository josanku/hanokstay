// Hanokstay Map + Stats — vanilla JS, fed by /data/hanokstay.json

let STATE = {
  data: null,
  mode: 'guest',
  filters: {
    sido: new Set(),
    shape: new Set(),
    roof: new Set(),
    grade: new Set(['meongpum', 'kto', 'regular']),
  },
  kakaoMap: null,
  markers: [],
  clusterer: null,
};

const COLORS = {
  meongpum: '#a83227',
  kto: '#b06a2a',
  regular: '#6f8a72',
};

const fmt = n => n.toLocaleString('ko-KR');
const pct = n => `${(n * 100).toFixed(1)}%`;

async function init() {
  try {
    const res = await fetch('data/hanokstay.json');
    STATE.data = await res.json();
  } catch (e) {
    console.error('Failed to load data/hanokstay.json', e);
    return;
  }
  renderStatsSummary();
  renderFilters();
  renderCharts();
  renderFallbackTable();
  bindAudienceToggle();

  // If Kakao SDK is ready, init map. Otherwise fallback table is already shown.
  window.__initKakaoMap = initKakaoMap;
  if (window.kakao && window.kakao.maps) {
    initKakaoMap();
  }
}

function renderStatsSummary() {
  const d = STATE.data;
  const total = d.meta.total_registered_estimate_nationwide || d.listings.length;
  const meongpum = d.listings.filter(l => l.kto_meongpum).length;
  const kto = d.listings.filter(l => l.kto_certified).length;
  const sidos = new Set(d.listings.map(l => l.sido)).size;

  const items = [
    { num: fmt(total), label: '전국 한옥체험업 등록', sub: '한옥체험업 + 도시민박업 + 농어촌민박업' },
    { num: fmt(meongpum), label: 'KTO 명품고택', sub: '시드 표본 기준' },
    { num: fmt(kto), label: 'KTO 인증 한옥스테이', sub: '시드 표본 기준' },
    { num: fmt(sidos), label: '시도', sub: '전국 분포' },
  ];

  const html = items.map(it => `
    <div class="stat-card">
      <div class="stat-num">${it.num}</div>
      <div class="stat-label">${it.label}</div>
      <div class="stat-sub">${it.sub}</div>
    </div>
  `).join('');
  document.getElementById('stats-summary').innerHTML = html;
}

function renderFilters() {
  const d = STATE.data;

  // 시도
  const sidos = [...new Set(d.listings.map(l => l.sido))].sort();
  document.getElementById('filter-sido').innerHTML = sidos.map(s => `
    <label><input type="checkbox" data-filter="sido" value="${s}" checked /> ${s}
      <span class="filter-count">${d.listings.filter(l => l.sido === s).length}</span>
    </label>
  `).join('');
  sidos.forEach(s => STATE.filters.sido.add(s));

  // 평면형
  const shapes = [...new Set(d.listings.map(l => l.shape).filter(Boolean))];
  document.getElementById('filter-shape').innerHTML = shapes.map(s => `
    <label><input type="checkbox" data-filter="shape" value="${s}" checked /> ${s}
      <span class="filter-count">${d.listings.filter(l => l.shape === s).length}</span>
    </label>
  `).join('');
  shapes.forEach(s => STATE.filters.shape.add(s));

  // 지붕
  const roofs = [...new Set(d.listings.map(l => l.roof).filter(Boolean))];
  document.getElementById('filter-roof').innerHTML = roofs.map(r => `
    <label><input type="checkbox" data-filter="roof" value="${r}" checked /> ${r}
      <span class="filter-count">${d.listings.filter(l => l.roof === r).length}</span>
    </label>
  `).join('');
  roofs.forEach(r => STATE.filters.roof.add(r));

  // Grade counts
  document.getElementById('cnt-meongpum').textContent = d.listings.filter(l => l.kto_meongpum).length;
  document.getElementById('cnt-kto').textContent = d.listings.filter(l => l.kto_certified && !l.kto_meongpum).length;
  document.getElementById('cnt-regular').textContent = d.listings.filter(l => !l.kto_certified).length;

  document.querySelectorAll('.filter-panel input[type="checkbox"]').forEach(input => {
    input.addEventListener('change', () => {
      const f = input.dataset.filter;
      const v = input.value;
      if (f === 'meongpum' || f === 'kto' || f === 'regular') {
        if (input.checked) STATE.filters.grade.add(f);
        else STATE.filters.grade.delete(f);
      } else {
        const set = STATE.filters[f];
        if (input.checked) set.add(v);
        else set.delete(v);
      }
      refreshMarkers();
      renderFallbackTable();
    });
  });
}

function filteredListings() {
  const f = STATE.filters;
  return STATE.data.listings.filter(l => {
    if (l.sido && !f.sido.has(l.sido)) return false;
    if (l.shape && !f.shape.has(l.shape)) return false;
    if (l.roof && !f.roof.has(l.roof)) return false;
    const grade = l.kto_meongpum ? 'meongpum' : (l.kto_certified ? 'kto' : 'regular');
    if (!f.grade.has(grade)) return false;
    return true;
  });
}

function renderCharts() {
  const s = STATE.data.stats;
  drawBars('chart-sido', s.by_sido.slice(0, 10).map(x => ({ label: x.sido, value: x.count, sub: pct(x.share) })));
  drawBars('chart-shape', s.by_shape.map(x => ({ label: x.shape, value: x.count, sub: pct(x.share) })));
  drawBars('chart-growth', s.growth_by_year.map(x => ({ label: String(x.year), value: x.registered, sub: '' })));
  drawBars('chart-license', s.by_license_type.map(x => ({ label: x.type, value: x.count, sub: pct(x.share) })));
}

function drawBars(elId, rows) {
  const max = Math.max(...rows.map(r => r.value));
  const html = rows.map(r => {
    const w = (r.value / max) * 100;
    return `
      <div class="bar-row">
        <span class="bar-label">${r.label}</span>
        <span class="bar-track"><span class="bar-fill" style="width: ${w}%"></span></span>
        <span class="bar-val">${fmt(r.value)}${r.sub ? ' · ' + r.sub : ''}</span>
      </div>
    `;
  }).join('');
  document.getElementById(elId).innerHTML = html;
}

function renderFallbackTable() {
  const el = document.getElementById('fallback-table');
  if (!el) return;
  const items = filteredListings().slice(0, 30);
  const html = `
    <table style="width:100%; border-collapse: collapse;">
      <thead><tr style="border-bottom: 1px solid #d9cfbd;">
        <th style="text-align: left; padding: 6px;">한옥명</th>
        <th style="text-align: left; padding: 6px;">지역</th>
        <th style="text-align: left; padding: 6px;">등급</th>
      </tr></thead>
      <tbody>
        ${items.map(l => `
          <tr style="border-bottom: 1px solid #f0e8d6;">
            <td style="padding: 6px;">${l.name}</td>
            <td style="padding: 6px; color: #6f6760;">${l.sido} ${l.sigungu || ''}</td>
            <td style="padding: 6px;">${l.kto_meongpum ? '<span style="color:#a83227">명품고택</span>' : (l.kto_certified ? '<span style="color:#b06a2a">KTO 인증</span>' : '<span style="color:#6f8a72">일반</span>')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  el.innerHTML = html;
}

function bindAudienceToggle() {
  document.querySelectorAll('.audience-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.audience-toggle button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.mode = btn.dataset.mode;
      // mode-specific: guest → emphasize stays; researcher → keep stats prominent
      // (placeholder for future divergence)
    });
  });
}

// ============================ KAKAO MAP ============================
function initKakaoMap() {
  const container = document.getElementById('map');
  const placeholder = document.getElementById('map-placeholder');
  if (placeholder) placeholder.remove();

  const center = new kakao.maps.LatLng(36.5, 127.8);
  STATE.kakaoMap = new kakao.maps.Map(container, { center, level: 13 });

  if (kakao.maps.MarkerClusterer) {
    STATE.clusterer = new kakao.maps.MarkerClusterer({
      map: STATE.kakaoMap,
      averageCenter: true,
      minLevel: 7,
      gridSize: 60,
    });
  }
  refreshMarkers();
}

function refreshMarkers() {
  if (!STATE.kakaoMap) return;
  if (STATE.clusterer) STATE.clusterer.clear();
  STATE.markers.forEach(m => m.setMap(null));
  STATE.markers = [];

  const data = filteredListings();
  data.forEach(l => {
    if (!l.lat || !l.lng) return;
    const grade = l.kto_meongpum ? 'meongpum' : (l.kto_certified ? 'kto' : 'regular');
    const color = COLORS[grade];
    const pos = new kakao.maps.LatLng(l.lat, l.lng);

    const marker = new kakao.maps.Marker({
      position: pos,
      image: customMarkerImage(color, l.kto_meongpum ? 18 : 14),
      title: l.name,
    });

    const info = new kakao.maps.InfoWindow({
      content: `
        <div style="padding: 12px 16px; min-width: 200px; font-family: -apple-system, 'Apple SD Gothic Neo', sans-serif;">
          <div style="font-weight: 600; margin-bottom: 4px;">${l.name}</div>
          <div style="font-size: 12px; color: #6f6760; margin-bottom: 6px;">${l.address || ''}</div>
          <div style="font-size: 12px; color: ${color};">
            ${l.kto_meongpum ? '★ KTO 명품고택' : (l.kto_certified ? '✓ KTO 인증' : '한옥체험업')}
          </div>
          ${l.cultural_property ? `<div style="font-size: 11px; color: #6f6760; margin-top: 4px;">${l.cultural_property}</div>` : ''}
          ${l.year_built_circa ? `<div style="font-size: 11px; color: #6f6760;">건립 ${l.year_built_circa}년경</div>` : ''}
        </div>`,
    });

    kakao.maps.event.addListener(marker, 'click', () => {
      info.open(STATE.kakaoMap, marker);
    });

    STATE.markers.push(marker);
    if (STATE.clusterer) STATE.clusterer.addMarker(marker);
    else marker.setMap(STATE.kakaoMap);
  });
}

function customMarkerImage(color, size) {
  // SVG data URL as a marker image
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size * 2}" height="${size * 2}" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="11" fill="${color}" stroke="#fff" stroke-width="2"/>
    </svg>`;
  return new kakao.maps.MarkerImage(
    'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
    new kakao.maps.Size(size * 2, size * 2),
    { offset: new kakao.maps.Point(size, size) }
  );
}

document.addEventListener('DOMContentLoaded', init);
