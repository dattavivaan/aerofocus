import { shortDate } from '../lib/format';

export interface StampInfo {
  iata: string;
  city: string;
  date: number;
  flightNo?: string;
  gold?: boolean;
  visits?: number;
}

const INK = '#8EC1FF';
const GOLD = '#FFD978';

/** A round passport stamp. */
export function StampMark({ stamp, size = 180 }: { stamp: StampInfo; size?: number }) {
  const c = stamp.gold ? GOLD : INK;
  const id = `arc-${stamp.iata}-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label={`Passport stamp: ${stamp.city}, ${shortDate(stamp.date)}`}>
      <defs>
        <path id={id} d="M 100 100 m -72 0 a 72 72 0 1 1 144 0" />
      </defs>
      <g fill="none" stroke={c} transform="rotate(-8 100 100)">
        <circle cx="100" cy="100" r="94" strokeWidth="4" />
        <circle cx="100" cy="100" r="84" strokeWidth="1.5" strokeDasharray="3 5" />
        <circle cx="100" cy="100" r="56" strokeWidth="1.5" />
        <text fill={c} stroke="none" fontFamily="'JetBrains Mono Variable', monospace" fontSize="13" fontWeight="700" letterSpacing="3">
          <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
            {stamp.city.toUpperCase().slice(0, 22)}
          </textPath>
        </text>
        <text x="100" y="108" textAnchor="middle" fill={c} stroke="none" fontFamily="'JetBrains Mono Variable', monospace" fontSize="44" fontWeight="700">
          {stamp.iata}
        </text>
        <text x="100" y="128" textAnchor="middle" fill={c} stroke="none" fontFamily="'JetBrains Mono Variable', monospace" fontSize="10" letterSpacing="1.5">
          {shortDate(stamp.date).toUpperCase()}
        </text>
        <text x="100" y="176" textAnchor="middle" fill={c} stroke="none" fontFamily="'JetBrains Mono Variable', monospace" fontSize="10" letterSpacing="2.5">
          {stamp.gold ? '★ FIRST CLASS ★' : `AEROFOCUS${stamp.flightNo ? ` · ${stamp.flightNo}` : ''}`}
        </text>
      </g>
    </svg>
  );
}

/** Draw the stamp to a PNG for sharing. */
export async function stampPng(stamp: StampInfo): Promise<Blob> {
  const S = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const g = canvas.getContext('2d')!;
  const c = stamp.gold ? GOLD : INK;
  g.fillStyle = '#060B17';
  g.fillRect(0, 0, S, S);
  const glow = g.createRadialGradient(S * 0.3, S * 0.2, 0, S * 0.3, S * 0.2, S * 0.8);
  glow.addColorStop(0, 'rgba(78,128,214,0.35)');
  glow.addColorStop(1, 'rgba(78,128,214,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, S, S);

  await document.fonts?.ready;
  const mono = "'JetBrains Mono Variable', ui-monospace, monospace";
  g.save();
  g.translate(S / 2, S / 2 - 30);
  g.rotate((-8 * Math.PI) / 180);
  g.strokeStyle = c;
  g.fillStyle = c;
  g.lineWidth = 14;
  g.beginPath();
  g.arc(0, 0, 360, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 5;
  g.setLineDash([10, 18]);
  g.beginPath();
  g.arc(0, 0, 322, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  g.beginPath();
  g.arc(0, 0, 214, 0, Math.PI * 2);
  g.stroke();
  // City name around the top arc.
  const city = stamp.city.toUpperCase().slice(0, 22);
  g.font = `700 50px ${mono}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const step = 0.105;
  [...city].forEach((ch, i) => {
    const a = -Math.PI / 2 + (i - (city.length - 1) / 2) * step;
    g.save();
    g.rotate(a + Math.PI / 2);
    g.fillText(ch, 0, -268);
    g.restore();
  });
  g.font = `700 168px ${mono}`;
  g.fillText(stamp.iata, 0, 0);
  g.font = `500 38px ${mono}`;
  g.fillText(shortDate(stamp.date).toUpperCase(), 0, 110);
  g.font = `600 36px ${mono}`;
  g.fillText(stamp.gold ? '★ FIRST CLASS ★' : `AEROFOCUS${stamp.flightNo ? ` · ${stamp.flightNo}` : ''}`, 0, 280);
  g.restore();

  g.fillStyle = '#B7C5DF';
  g.font = `500 34px ${mono}`;
  g.textAlign = 'center';
  g.fillText('EVERY FOCUS SESSION IS A FLIGHT', S / 2, S - 70);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw the stamp'))), 'image/png'));
}

/** Web Share with the PNG where possible; otherwise download it. */
export async function shareStamp(stamp: StampInfo): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = await stampPng(stamp);
  const file = new File([blob], `aerofocus-${stamp.iata}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Landed in ${stamp.city}`, text: `Focus flight to ${stamp.city} complete.` });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}
