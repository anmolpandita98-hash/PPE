export function PolicyBadge({ name, required }: { name: string; required: boolean }) {
  const label = name.charAt(0).toUpperCase() + name.slice(1);
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs ${
        required ? 'bg-accent/20 text-accent' : 'bg-slate-600/50 text-slate-400'
      }`}
      title={required ? 'Required' : 'Optional'}
    >
      {label}
    </span>
  );
}
