import { MAP_FOOTPRINTS, MAP_ROADS, worldToMap, type MapFootprint } from "../data/liveMap";

const TONE: Record<
  MapFootprint["tone"],
  { fill: string; stroke: string; fillOpacity?: number }
> = {
  building: { fill: "#d8c8aa", stroke: "#a9987b", fillOpacity: 0.2 },
  field: { fill: "#4d6a3d", stroke: "#8fa67a", fillOpacity: 0.62 },
  garden: { fill: "#3e5b38", stroke: "#8da779", fillOpacity: 0.58 },
  court: { fill: "#b6a47f", stroke: "#a99775", fillOpacity: 0.22 },
  house: { fill: "#b7a67f", stroke: "#e1d3b4", fillOpacity: 0.55 },
};

function footprintShape(footprint: MapFootprint) {
  const a = worldToMap(footprint.minX, footprint.minZ);
  const b = worldToMap(footprint.maxX, footprint.maxZ);
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const width = Math.abs(b.x - a.x);
  const height = Math.abs(b.y - a.y);
  return { x, y, width, height, cx: x + width / 2, cy: y + height / 2 };
}

/**
 * The shared top-down plan. Every shape and marker uses worldToMap, so the
 * compact and expanded maps agree with the 3D scene's ground coordinates.
 */
export function CampusMapPlan({
  className,
  showLabels = false,
}: {
  className?: string;
  showLabels?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="map-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#152015" />
          <stop offset="1" stopColor="#0c130e" />
        </linearGradient>
        <pattern id="map-grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#8ba077" strokeOpacity="0.08" strokeWidth="0.35" />
        </pattern>
      </defs>

      <rect width="100" height="100" fill="url(#map-ground)" />
      <rect width="100" height="100" fill="url(#map-grid)" />

      {/* Perimeter wall and open lawn. */}
      <rect
        x="4.5"
        y="4.5"
        width="91"
        height="91"
        rx="4"
        fill="#172316"
        stroke="#8b9c74"
        strokeOpacity="0.35"
        strokeWidth="0.7"
      />
      <rect
        x="8"
        y="8"
        width="84"
        height="84"
        rx="2.5"
        fill="#1b2a18"
        fillOpacity="0.55"
        stroke="#758864"
        strokeOpacity="0.16"
        strokeWidth="0.35"
      />

      {/* Actual walkable paths/drive. */}
      {MAP_ROADS.map((road, index) => (
        <polyline
          key={index}
          points={road.points
            .map((point) => {
              const mapped = worldToMap(point.x, point.z);
              return `${mapped.x},${mapped.y}`;
            })
            .join(" ")}
          fill="none"
          stroke="#c8b48b"
          strokeOpacity="0.24"
          strokeWidth="1.45"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {/* Real building footprints. */}
      {MAP_FOOTPRINTS.map((footprint) => {
        const shape = footprintShape(footprint);
        const tone = TONE[footprint.tone];
        const fill = footprint.color ?? tone.fill;
        const stroke = footprint.color ?? tone.stroke;
        if (footprint.shape === "oval") {
          return (
            <ellipse
              key={footprint.id}
              cx={shape.cx}
              cy={shape.cy}
              rx={shape.width / 2}
              ry={shape.height / 2}
              fill={fill}
              fillOpacity={tone.fillOpacity}
              stroke={stroke}
              strokeOpacity="0.55"
              strokeWidth="0.45"
            />
          );
        }
        return (
          <rect
            key={footprint.id}
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            rx={0.65}
            fill={fill}
            fillOpacity={tone.fillOpacity}
            stroke={stroke}
            strokeOpacity="0.55"
            strokeWidth="0.45"
          />
        );
      })}

      {/* House doors face the south lawn, matching the 3D house row. */}
      {MAP_FOOTPRINTS.filter((footprint) => footprint.tone === "house").map((footprint) => {
        const shape = footprintShape(footprint);
        return (
          <line
            key={`${footprint.id}-door`}
            x1={shape.cx - 1.3}
            y1={shape.y - 0.2}
            x2={shape.cx + 1.3}
            y2={shape.y - 0.2}
            stroke="#f2e7d1"
            strokeOpacity="0.75"
            strokeWidth="0.5"
          />
        );
      })}

      {showLabels &&
        MAP_FOOTPRINTS.filter(
          (footprint) => footprint.label && footprint.tone !== "house" && footprint.tone !== "building",
        ).map((footprint) => {
          const shape = footprintShape(footprint);
          return (
            <text
              key={`${footprint.id}-label`}
              x={shape.cx}
              y={shape.cy}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="2.15"
              fill="#efe4cd"
              fillOpacity="0.68"
              stroke="#10160f"
              strokeWidth="0.55"
              paintOrder="stroke"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              letterSpacing="0.08"
            >
              {footprint.shortName}
            </text>
          );
        })}
    </svg>
  );
}
