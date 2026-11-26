// No real photos yet: falls back to a deterministic initials avatar. Set `photo` on a person to use an image.
const initials = (name) =>
  name
    .replace(/["״]/g, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');

const hue = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

export default function Avatar({ person, size = 56 }) {
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (person.photo) return <img className="avatar" style={style} src={person.photo} alt={person.fullName} />;
  const h = hue(person.id);
  return (
    <span
      className="avatar"
      style={{ ...style, background: `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 50) % 360} 70% 45%))` }}
      aria-label={person.fullName}
    >
      {initials(person.fullName)}
    </span>
  );
}
