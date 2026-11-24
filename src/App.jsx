import { useEffect, useState } from 'react';
import Home from './pages/Home.jsx';
import PersonPage from './pages/PersonPage.jsx';
import OrgPage from './pages/OrgPage.jsx';
import ProjectPage from './pages/ProjectPage.jsx';
import DailyPage from './pages/DailyPage.jsx';

// Tiny hash router: #/ , #/work , #/org , #/person/:id
function useRoute() {
  const read = () => window.location.hash.replace(/^#/, '') || '/';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

const NAV = [
  { href: '#/', label: 'בית', match: (r) => r === '/' },
  { href: '#/work', label: 'העבודה שלי', match: (r) => r === '/work' },
  { href: '#/daily', label: 'דיילי', match: (r) => r === '/daily' },
  { href: '#/org', label: 'המבנה הארגוני', match: (r) => r === '/org' || r.startsWith('/person/') || r.startsWith('/project/') },
];

export default function App() {
  const route = useRoute();
  let page;
  if (route === '/work') page = <PersonPage key="me" id="me" />;
  else if (route === '/org') page = <OrgPage />;
  else if (route === '/daily') page = <DailyPage />;
  else if (route.startsWith('/project/')) page = <ProjectPage key={route} id={route.split('/')[2]} />;
  else if (route.startsWith('/person/')) {
    const id = route.split('/')[2];
    page = <PersonPage key={id} id={id} />;
  } else page = <Home />;

  return (
    <div className="shell">
      <nav className="nav">
        <a className="brand" href="#/">
          <span className="logo">M</span>
          <span className="name">MoniMentor</span>
        </a>
        <div className="links">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className={n.match(route) ? 'active' : ''}>
              {n.label}
            </a>
          ))}
        </div>
      </nav>
      <div className="page">{page}</div>
    </div>
  );
}
