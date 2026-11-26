import { Fragment } from 'react';
import { linkTasks } from './TaskLink.jsx';

// Minimal markdown renderer (headings, bullets, bold) – avoids an extra dependency.
const inline = (text) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{linkTasks(part.slice(2, -2))}</strong> : <Fragment key={i}>{linkTasks(part)}</Fragment>,
  );

export default function Markdown({ text }) {
  const blocks = [];
  let list = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={`u${blocks.length}`}>{list}</ul>);
    list = [];
  };
  text.split('\n').forEach((line, i) => {
    const h = line.match(/^#{1,3}\s+(.*)/);
    const li = line.match(/^\s*[-*]\s+(.*)/);
    if (li) list.push(<li key={i}>{inline(li[1])}</li>);
    else {
      flush();
      if (h) blocks.push(<h3 key={i}>{inline(h[1])}</h3>);
      else if (line.trim()) blocks.push(<p key={i}>{inline(line)}</p>);
    }
  });
  flush();
  return <div className="md">{blocks}</div>;
}
