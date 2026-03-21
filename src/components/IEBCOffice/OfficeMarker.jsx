import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// ── Diaspora state config ─────────────────────────────────────────────────────
const DIASPORA_COLOURS = {
  embassy_only: { fill: '#16A34A', opacity: 0.75, badge: '#DCFCE7', badgeText: '#166534', label: 'Embassy' },
  embassy_probable: { fill: '#D97706', opacity: 0.90, badge: '#FEF3C7', badgeText: '#92400E', label: 'Probable' },
  iebc_confirmed: { fill: '#1E6BFF', opacity: 1.00, badge: '#EFF4FF', badgeText: '#1452CC', label: 'Confirmed' },
};

// ── Style injection (once) ────────────────────────────────────────────────────
const RIPPLE_STYLE = `

  @keyframes nasaka-pulse {
    0%   { transform: scale(1); }
    50%  { transform: scale(1.1); }
    100% { transform: scale(1); }
  }
  @keyframes nasaka-ring {
    0%   { transform: scale(1); opacity: 1; }
    100% { transform: scale(1.5); opacity: 0; }
  }
`;

let styleInjected = false;
function injectStyles() {
  if (styleInjected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.textContent = RIPPLE_STYLE;
  document.head.appendChild(el);
  styleInjected = true;
}

// ── Icon builders ─────────────────────────────────────────────────────────────

function buildDiasporaIcon(designationState = 'embassy_only') {
  injectStyles();
  const cfg = DIASPORA_COLOURS[designationState] || DIASPORA_COLOURS.embassy_only;
  const { fill, opacity } = cfg;
  const isConfirmed = designationState === 'iebc_confirmed';
  const isProbable = designationState === 'embassy_probable';



  const innerIcon = isConfirmed
    ? `<svg width="13" height="13" viewBox="0 0 1080 1080" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(0,1080) scale(0.1,-0.1)" fill="${fill}">
          <path d="M5135 9223 c-559 -49 -1092 -260 -1555 -616 -117 -90 -384 -351 -477 -467 -290 -360 -500 -803 -593 -1250 -72 -351 -79 -741 -19 -1089 104 -604 429 -1261 949 -1922 103 -132 1951 -2309 1959 -2308 7 0 1719 2051 1854 2219 560 701 899 1332 1026 1905 50 227 56 288 56 580 0 294 -7 370 -52 595 -254 1267 -1318 2228 -2601 2350 -98 9 -453 11 -547 3z m575 -638 c250 -35 478 -104 692 -208 249 -122 436 -255 633 -452 356 -355 580 -799 657 -1299 31 -204 31 -519 0 -701 -86 -502 -308 -938 -653 -1284 -439 -438 -1025 -681 -1644 -681 -864 0 -1643 471 -2055 1243 -176 330 -261 685 -261 1092 0 476 126 888 394 1290 116 173 289 364 453 497 427 348 970 536 1514 523 85 -2 207 -11 270 -20z"/>
          <path d="M5250 7760 c-597 -83 -1055 -488 -1213 -1070 -30 -112 -31 -122 -31 -330 -1 -172 3 -232 17 -300 125 -583 579 -1025 1157 -1125 126 -22 354 -22 485 0 575 96 1033 540 1161 1125 15 67 19 127 19 280 0 209 -10 279 -61 443 l-26 80 -119 -119 -120 -120 16 -88 c69 -397 -86 -810 -399 -1065 -134 -109 -267 -175 -450 -224 -69 -18 -108 -21 -266 -21 -159 0 -196 3 -265 21 -164 45 -307 116 -427 212 -214 170 -351 396 -409 673 -30 148 -23 372 16 503 36 121 74 211 125 292 206 327 541 524 920 540 296 12 569 -85 790 -283 l63 -56 106 107 106 106 -65 60 c-181 166 -432 292 -685 344 -94 19 -352 28 -445 15z"/>
          <path d="M6780 7494 c-30 -8 -78 -29 -107 -46 -32 -20 -258 -238 -614 -594 l-563 -564 -196 195 c-170 169 -206 199 -266 227 -66 31 -75 33 -184 33 -105 0 -120 -2 -170 -27 -30 -15 -71 -41 -90 -57 l-35 -30 450 -450 c442 -443 451 -451 490 -451 39 0 49 9 867 827 l827 827 -20 22 c-31 33 -127 80 -187 93 -70 15 -135 13 -202 -5z"/>
        </g>
       </svg>`
    : isProbable
      ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${fill}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 15"></polyline></svg>`
      : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${fill}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 21h18"></path>
        <path d="M3 7v1a3 3 0 0 0 6 0V7"></path>
        <path d="M9 7v1a3 3 0 0 0 6 0V7"></path>
        <path d="M15 7v1a3 3 0 0 0 6 0V7"></path>
        <path d="M19 21V11"></path>
        <path d="M5 21V11"></path>
        <path d="M2 3h20"></path>
        <path d="M12 11v10"></path>
       </svg>`;

  return L.divIcon({
    className: 'diaspora-marker',
    html: `
      <div style="position:relative;width:40px;height:44px;">
        <svg width="20" height="28" viewBox="0 0 20 28" style="position:absolute;top:0;left:10px;">
          <path d="M20 14 C20 8.48 15.52 4 10 4 C4.48 4 0 8.48 0 14 C0 19.52 10 28 10 28 S20 19.52 20 14Z" fill="${fill}" fill-opacity="${opacity}"/>
          <circle cx="10" cy="14" r="7" fill="white" opacity="0.93"/>
        </svg>
        <div style="position:absolute;top:8px;left:13.5px;width:13px;height:13px;display:flex;align-items:center;justify-content:center;">
          ${innerIcon}
        </div>
      </div>
    `,
    iconSize: [40, 44],
    iconAnchor: [20, 44],
    popupAnchor: [0, -44],
  });
}

function buildOfficeIcon(isSelected, isNearest) {
  injectStyles();
  const backgroundColor = isSelected ? '#FF3B30' : isNearest ? '#34C759' : '#007AFF';
  const shadow = isSelected
    ? '0 0 0 4px rgba(255,59,48,0.3)'
    : '0 2px 8px rgba(0,0,0,0.15)';

  // Nasaka logo: exact paths from nasaka.svg
  const nasakaIcon = `
    <svg width="13" height="13" viewBox="0 0 1080 1080" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(0,1080) scale(0.1,-0.1)" fill="white">
        <path d="M5135 9223 c-559 -49 -1092 -260 -1555 -616 -117 -90 -384 -351 -477 -467 -290 -360 -500 -803 -593 -1250 -72 -351 -79 -741 -19 -1089 104 -604 429 -1261 949 -1922 103 -132 1951 -2309 1959 -2308 7 0 1719 2051 1854 2219 560 701 899 1332 1026 1905 50 227 56 288 56 580 0 294 -7 370 -52 595 -254 1267 -1318 2228 -2601 2350 -98 9 -453 11 -547 3z m575 -638 c250 -35 478 -104 692 -208 249 -122 436 -255 633 -452 356 -355 580 -799 657 -1299 31 -204 31 -519 0 -701 -86 -502 -308 -938 -653 -1284 -439 -438 -1025 -681 -1644 -681 -864 0 -1643 471 -2055 1243 -176 330 -261 685 -261 1092 0 476 126 888 394 1290 116 173 289 364 453 497 427 348 970 536 1514 523 85 -2 207 -11 270 -20z"/>
        <path d="M5250 7760 c-597 -83 -1055 -488 -1213 -1070 -30 -112 -31 -122 -31 -330 -1 -172 3 -232 17 -300 125 -583 579 -1025 1157 -1125 126 -22 354 -22 485 0 575 96 1033 540 1161 1125 15 67 19 127 19 280 0 209 -10 279 -61 443 l-26 80 -119 -119 -120 -120 16 -88 c69 -397 -86 -810 -399 -1065 -134 -109 -267 -175 -450 -224 -69 -18 -108 -21 -266 -21 -159 0 -196 3 -265 21 -164 45 -307 116 -427 212 -214 170 -351 396 -409 673 -30 148 -23 372 16 503 36 121 74 211 125 292 206 327 541 524 920 540 296 12 569 -85 790 -283 l63 -56 106 107 106 106 -65 60 c-181 166 -432 292 -685 344 -94 19 -352 28 -445 15z"/>
        <path d="M6780 7494 c-30 -8 -78 -29 -107 -46 -32 -20 -258 -238 -614 -594 l-563 -564 -196 195 c-170 169 -206 199 -266 227 -66 31 -75 33 -184 33 -105 0 -120 -2 -170 -27 -30 -15 -71 -41 -90 -57 l-35 -30 450 -450 c442 -443 451 -451 490 -451 39 0 49 9 867 827 l827 827 -20 22 c-31 33 -127 80 -187 93 -70 15 -135 13 -202 -5z"/>
      </g>
    </svg>
  `;

  const ring = isNearest ? `
    <div style="
      position:absolute;top:-6px;left:-6px;right:-6px;bottom:-6px;
      border:2px solid ${backgroundColor};border-radius:50%;
      animation:nasaka-ring 2s infinite;
    "></div>` : '';

  return L.divIcon({
    className: 'office-marker',
    html: `
      <div style="position:relative;width:40px;height:44px;${isNearest ? 'animation:nasaka-pulse 2s infinite;' : ''}">
        <svg width="20" height="28" viewBox="0 0 20 28" style="position:absolute;top:0;left:10px;filter:drop-shadow(${shadow});">
          <path d="M20 14 C20 8.48 15.52 4 10 4 C4.48 4 0 8.48 0 14 C0 19.52 10 28 10 28 S20 19.52 20 14Z" fill="${backgroundColor}"/>
          <circle cx="10" cy="14" r="7" fill="white" opacity="0.15"/>
        </svg>
        <div style="position:absolute;top:8px;left:13.5px;width:13px;height:13px;display:flex;align-items:center;justify-content:center;">
          ${nasakaIcon}
        </div>
        ${ring}
      </div>
    `,
    iconSize: [40, 44],
    iconAnchor: [20, 44],
    popupAnchor: [0, -44],
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

const OfficeMarker = ({ office, isSelected, isNearest, onSelect }) => {
  const isDiaspora = office?.type === 'diaspora' ||
    office?.designation_state !== undefined;

  const lat = office?.latitude ?? office?.lat;
  const lng = office?.longitude ?? office?.lng;

  if (!lat || !lng) return null;

  const position = [lat, lng];

  const icon = isDiaspora
    ? buildDiasporaIcon(office.designation_state)
    : buildOfficeIcon(isSelected, isNearest);

  return (
    <Marker
      position={position}
      icon={icon}
      eventHandlers={{ click: () => onSelect(office) }}
      zIndexOffset={isSelected ? 1000 : isNearest ? 500 : 0}
    >
      <Popup>
        {isDiaspora ? (
          <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', minWidth: 220, maxWidth: 280 }}>
            {(() => {
              const cfg = DIASPORA_COLOURS[office.designation_state] || DIASPORA_COLOURS.embassy_only;
              const isConfirmed = office.designation_state === 'iebc_confirmed';
              const isProbable = office.designation_state === 'embassy_probable';
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ background: cfg.badge, color: cfg.badgeText, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {cfg.label}
                    </span>
                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>
                      {(office.mission_type || '').replace('_', ' ')}
                    </span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#111214', lineHeight: 1.2, marginBottom: 3 }}>
                    {office.mission_name || office.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#4A5568', marginBottom: 8 }}>
                    {office.city}, {office.country}
                  </div>
                  {(office.designated_2017 || office.designated_2022) && (
                    <div style={{ marginBottom: 8, display: 'flex', gap: 4, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: '#9CA3AF' }}>Designated:</span>
                      {office.designated_2017 && <span style={{ background: '#EFF4FF', color: '#1452CC', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99 }}>2017</span>}
                      {office.designated_2022 && <span style={{ background: '#EFF4FF', color: '#1452CC', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99 }}>2022</span>}
                    </div>
                  )}
                  {office.address && <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>📍 {office.address}</div>}
                  {office.phone && <a href={`tel:${office.phone}`} style={{ display: 'block', fontSize: 12, color: '#1E6BFF', fontWeight: 600, marginBottom: 2 }}>📞 {office.phone}</a>}
                  {office.email && <a href={`mailto:${office.email}`} style={{ display: 'block', fontSize: 11, color: '#1E6BFF', marginBottom: 2 }}>✉️ {office.email}</a>}
                  {isConfirmed && office.registration_opens_at && (
                    <div style={{ marginTop: 8, padding: 8, background: '#F0FDF4', borderRadius: 8, fontSize: 11, color: '#166534' }}>
                      <strong>Registration:</strong><br />
                      {new Date(office.registration_opens_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' → '}
                      {new Date(office.registration_closes_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  )}
                  {isProbable && (
                    <div style={{ marginTop: 8, padding: 8, background: '#FFFBEB', borderRadius: 8, fontSize: 11, color: '#92400E' }}>
                      <strong>⏳ Awaiting IEBC Confirmation</strong><br />
                      Likely confirmed for 2027 based on previous cycles.
                    </div>
                  )}
                  {!isConfirmed && !isProbable && (
                    <div style={{ marginTop: 8, padding: 8, background: '#EFF4FF', borderRadius: 8, fontSize: 11, color: '#1E40AF' }}>
                      <strong>📋 Inquiry Centre</strong><br />
                      Contact for diaspora voter registration queries.
                    </div>
                  )}
                  {office.distance && (
                    <p style={{ fontSize: 12, color: '#1E6BFF', fontWeight: 600, marginTop: 6 }}>
                      {typeof office.distance === 'number' ? `${office.distance.toFixed(1)} km away` : office.distance}
                    </p>
                  )}
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #F3F4F6', fontSize: 10, color: '#9CA3AF' }}>
                    IEBC Diaspora Registration · 2027 General Election
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          <div className="p-2 min-w-[200px]">
            <h3 className="font-semibold text-ios-gray-900 text-sm mb-1">
              {office.constituency_name}
            </h3>
            <p className="text-ios-gray-600 text-xs mb-2">
              {office.office_location}
            </p>
            <p className="text-ios-gray-500 text-xs">
              {office.county} County
            </p>
            {office.distance && (
              <p className="text-ios-blue text-xs font-medium mt-1">
                {typeof office.distance === 'number'
                  ? `${office.distance.toFixed(1)} km away`
                  : office.distance}
              </p>
            )}
          </div>
        )}
      </Popup>
    </Marker>
  );
};

export default OfficeMarker;
