'use client';

interface Props {
  items: string[];
}

export function Ticker({ items }: Props) {
  const line = items.join('     ·     ');
  // Duplicate the content so the -50% marquee loop is seamless.
  const doubled = `${line}     ·     ${line}     ·     `;

  return (
    <footer className="overflow-hidden border-t border-hair bg-white py-4">
      <div className="animate-ticker whitespace-nowrap will-change-transform">
        <span className="text-xl text-coal-2">{doubled}</span>
      </div>
    </footer>
  );
}
