import { tierOf, TIERS } from '../lib/rank';

/** Icone originali: gemme geometriche, una forma per famiglia di rank. */
export default function RankBadge({ level, size = 56 }: { level: number; size?: number }) {
  const { tier, division } = tierOf(level);
  const idx = TIERS.indexOf(tier);
  const id = `g${level}-${size}`;
  const shapes = [
    'M32 6 L54 32 L32 58 L10 32 Z', // rame: rombo
    'M32 5 L55 18 L55 46 L32 59 L9 46 L9 18 Z', // bronzo: esagono
    'M32 4 L50 12 L58 30 L50 50 L32 60 L14 50 L6 30 L14 12 Z', // argento: ottagono
    'M32 4 L40 24 L60 24 L44 37 L50 58 L32 46 L14 58 L20 37 L4 24 L24 24 Z', // oro: stella
    'M32 4 L56 20 L48 58 L16 58 L8 20 Z', // platino: pentagono
    'M18 8 L46 8 L60 26 L32 60 L4 26 Z', // diamante: taglio brillante
    'M32 3 L42 14 L58 12 L54 28 L62 40 L48 46 L42 60 L32 52 L22 60 L16 46 L2 40 L10 28 L6 12 L22 14 Z', // champion: sole
    'M32 2 L60 18 L60 46 L32 62 L4 46 L4 18 Z', // grand champion: esagono doppio
    'M32 2 L38 22 L58 12 L44 30 L62 40 L42 42 L44 62 L32 46 L20 62 L22 42 L2 40 L20 30 L6 12 L26 22 Z', // super lega: esplosione
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={division ? `${tier.name} ${division}` : tier.name}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={tier.color} />
          <stop offset="1" stopColor={tier.color2} />
        </linearGradient>
      </defs>
      <path d={shapes[idx]} fill={`url(#${id})`} stroke="#0a0a0a" strokeWidth="2" strokeLinejoin="round" />
      {idx === 7 && <path d="M32 14 L50 24 L50 40 L32 50 L14 40 L14 24 Z" fill="none" stroke="#0a0a0a" strokeWidth="2" opacity="0.5" />}
      <path d={shapes[idx]} fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1" transform="translate(32 32) scale(0.72) translate(-32 -32)" />
      {division && (
        <g>
          {Array.from({ length: division }, (_, i) => (
            <circle key={i} cx={32 + (i - (division - 1) / 2) * 9} cy={33} r={3.4} fill="#0a0a0a" />
          ))}
        </g>
      )}
    </svg>
  );
}
