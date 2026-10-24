import { GRADE_COLOR } from "@/lib/client/labels";

const SIZE = 132;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ScoreRing({
  score,
  grade,
  provisional,
}: {
  score: number;
  grade: string;
  provisional: boolean;
}) {
  const color = GRADE_COLOR[grade] ?? "#475569";
  return (
    <figure
      className="relative"
      style={{ width: SIZE, height: SIZE }}
      aria-label={`Score ${score} out of 100, grade ${grade}`}
    >
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - score / 100)}
        />
      </svg>
      <figcaption className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-semibold leading-none">{score}</span>
        <span className="mt-1 text-sm font-semibold" style={{ color }}>
          Grade {grade}
        </span>
        {provisional && <span className="text-xs text-muted-foreground">Provisional</span>}
      </figcaption>
    </figure>
  );
}
