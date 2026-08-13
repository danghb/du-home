export function PhotoArtwork({ variant = 0, className = '' }: { variant?: number | undefined; className?: string | undefined }) {
  const palettes = [
    ['#c9e3f5', '#f4dfa7', '#6da477', '#3f855c'],
    ['#f5d5c6', '#d8e5b0', '#85ad82', '#4d8060'],
    ['#d9d3f2', '#bee1dd', '#70a89e', '#3d7c68'],
  ];
  const palette = palettes[variant % palettes.length] ?? palettes[0]!;
  return (
    <div className={`photo-artwork ${className}`} style={{ '--sky': palette[0], '--tint': palette[1], '--hill-a': palette[2], '--hill-b': palette[3] } as React.CSSProperties}>
      <span className="photo-sun" />
      <span className="photo-hill photo-hill-a" />
      <span className="photo-hill photo-hill-b" />
    </div>
  );
}
