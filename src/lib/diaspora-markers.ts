// src/lib/diaspora-markers.ts
// Three marker icon types for diaspora centres
// embassy_only (blue), embassy_probable (amber), iebc_confirmed (green)

import L from 'leaflet';

export type DiasporaState = 'embassy_only' | 'embassy_probable' | 'iebc_confirmed';

const MARKER_CONFIGS: Record<DiasporaState, { color: string; opacity: number; label: string; badgeText: string }> = {
    embassy_only: {
        color: '#007AFF',
        opacity: 0.7,
        label: 'Kenyan Mission',
        badgeText: 'Embassy',
    },
    embassy_probable: {
        color: '#D97706',
        opacity: 0.9,
        label: 'Likely IEBC Centre',
        badgeText: 'Probable',
    },
    iebc_confirmed: {
        color: '#16A34A',
        opacity: 1.0,
        label: 'IEBC Registration Centre',
        badgeText: 'Confirmed',
    },
};

export function buildDiasporaMarkerIcon(state: DiasporaState): L.DivIcon {
    const config = MARKER_CONFIGS[state];

    const svg = `
    <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="dshadow-${state}" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.25"/>
        </filter>
      </defs>
      <path
        d="M16 0C9.373 0 4 5.373 4 12c0 9 12 28 12 28S28 21 28 12C28 5.373 22.627 0 16 0z"
        fill="${config.color}"
        fill-opacity="${config.opacity}"
        filter="url(#dshadow-${state})"
      />
      <circle cx="16" cy="12" r="6" fill="white" fill-opacity="0.95"/>
      <circle cx="16" cy="12" r="5" fill="none" stroke="${config.color}" stroke-width="1.5"/>
      ${state === 'iebc_confirmed' ? `
        <path d="M12.5 12l2.5 2.5 4.5-4.5" stroke="${config.color}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      ` : state === 'embassy_probable' ? `
        <circle cx="16" cy="12" r="3.5" fill="none" stroke="${config.color}" stroke-width="1"/>
        <path d="M16 9.5v2.5l1.5 1.5" stroke="${config.color}" stroke-width="1" stroke-linecap="round"/>
      ` : `
        <rect x="13" y="10" width="6" height="5" fill="${config.color}" opacity="0.5" rx="0.5"/>
        <rect x="14" y="11.5" width="1.5" height="3.5" fill="${config.color}" rx="0.5"/>
        <rect x="16.5" y="11.5" width="1.5" height="3.5" fill="${config.color}" rx="0.5"/>
      `}
    </svg>
  `;

    return L.divIcon({
        html: svg,
        iconSize: [32, 40],
        iconAnchor: [16, 40],
        popupAnchor: [0, -40],
        className: '',
    });
}

export function buildDiasporaPopup(mission: any): string {
    const state = (mission.designation_state || 'embassy_only') as DiasporaState;
    const config = MARKER_CONFIGS[state];
    const isConfirmed = state === 'iebc_confirmed';
    const isProbable = state === 'embassy_probable';

    const historicalBadges = [
        mission.designated_2017 ? '<span style="background:#EFF4FF;color:#007AFF;font-size:9px;font-weight:700;padding:2px 6px;border-radius:99px;">2017</span>' : '',
        mission.designated_2022 ? '<span style="background:#EFF4FF;color:#007AFF;font-size:9px;font-weight:700;padding:2px 6px;border-radius:99px;">2022</span>' : '',
    ].filter(Boolean).join(' ');

    const registrationWindow = isConfirmed && mission.registration_opens_at
        ? `<div style="margin-top:8px;padding:8px;background:#F0FDF4;border-radius:8px;font-size:11px;color:#166534;">
        <strong>Registration:</strong><br>
        ${new Date(mission.registration_opens_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
        →
        ${mission.registration_closes_at ? new Date(mission.registration_closes_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBD'}
       </div>`
        : '';

    const probableNote = isProbable
        ? `<div style="margin-top:8px;padding:8px;background:#FFFBEB;border-radius:8px;font-size:11px;color:#92400E;">
        <strong>⏳ Awaiting IEBC Confirmation</strong><br>
        Designated in ${mission.designation_count || 0} previous election${(mission.designation_count || 0) > 1 ? 's' : ''}. Likely to be confirmed for 2027.
       </div>`
        : '';

    const embassyOnlyNote = !isConfirmed && !isProbable
        ? `<div style="margin-top:8px;padding:8px;background:#EFF4FF;border-radius:8px;font-size:11px;color:#1E40AF;">
        <strong>📋 Inquiry Centre</strong><br>
        Not yet designated as an IEBC registration centre. Contact for diaspora voter queries.
       </div>`
        : '';

    return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-width:220px;max-width:280px;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
        <span style="background:${config.color};color:#fff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:99px;text-transform:uppercase;letter-spacing:0.05em;">
          ${config.badgeText}
        </span>
        <span style="font-size:10px;color:#9CA3AF;">${(mission.mission_type || '').replace('_', ' ')}</span>
      </div>
      <div style="font-weight:800;font-size:14px;color:#111214;line-height:1.2;margin-bottom:3px;">
        ${mission.mission_name || ''}
      </div>
      <div style="font-size:12px;color:#4A5568;margin-bottom:8px;">
        ${mission.city || ''}, ${mission.country || ''}
      </div>
      ${historicalBadges ? `<div style="margin-bottom:8px;display:flex;gap:4px;align-items:center;"><span style="font-size:10px;color:#9CA3AF;">Designated:</span>${historicalBadges}</div>` : ''}
      ${mission.address ? `<div style="font-size:11px;color:#6B7280;margin-bottom:4px;">📍 ${mission.address}</div>` : ''}
      ${mission.phone ? `<a href="tel:${mission.phone}" style="display:block;font-size:12px;color:#007AFF;font-weight:600;margin-bottom:2px;">📞 ${mission.phone}</a>` : ''}
      ${mission.email ? `<a href="mailto:${mission.email}" style="display:block;font-size:11px;color:#007AFF;margin-bottom:2px;">✉️ ${mission.email}</a>` : ''}
      ${mission.whatsapp ? `<a href="https://wa.me/${(mission.whatsapp || '').replace(/[^0-9]/g, '')}" target="_blank" style="display:block;font-size:11px;color:#16A34A;margin-bottom:2px;">💬 WhatsApp</a>` : ''}
      ${registrationWindow}
      ${probableNote}
      ${embassyOnlyNote}
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid #F3F4F6;font-size:10px;color:#9CA3AF;">
        IEBC Diaspora Registration · 2027 General Election
      </div>
    </div>
  `;
}
