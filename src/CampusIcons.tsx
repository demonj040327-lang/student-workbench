import type { CSSProperties } from 'react';
const paths: Record<string, string> = {
  mic: 'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5Zm-3 6v1a6 6 0 0 0 12 0v-1M12 18v4m-4 0h8',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M13 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  search: 'M20 20l-5-5m2-6a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  home: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  book: 'M12 5C8 2 4 3 2 4v16c3-2 7-1 10 1m0-16c4-3 8-2 10-1v16c-3-2-7-1-10 1V5Z',
  calendar: 'M4 5h16v16H4ZM8 2v6M16 2v6M4 11h16M8 15h2m4 0h2m-8 3h2',
  check: 'm5 12 4 4L19 6',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',
  file: 'M14 2H5v20h14V7Zm0 0v6h5M8 13h8m-8 4h6',
  message: 'M4 3h16v14H9l-5 4V3ZM8 8h8m-8 4h5',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6',
  plus: 'M12 5v14M5 12h14',
  settings: 'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6',
  chevron: 'm9 5 7 7-7 7',
  close: 'm6 6 12 12M6 18 18 6',
  key: 'M14 14a6 6 0 1 0-4-4l-7 7v4h4v-3h3v-3Z',
  layers: 'm12 2 10 5-10 5L2 7Zm-10 9 10 5 10-5M2 17l10 5 10-5',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 6v6l4 2',
  download: 'M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4',
  logout: 'M9 3H3v18h6m0-9h13m-5-5 5 5-5 5',
};
export default function Icon({
  name,
  size = 20,
  style,
  className,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
      className={className}
    >
      <path d={paths[name] || paths.file} />
    </svg>
  );
}
