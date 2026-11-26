import { useEffect, useState } from 'react';
import GlobalSearch from './components/GlobalSearch.jsx';
import ChatPopup from './chat/ChatPopup.jsx';
import AgentPage from './pages/agent/AgentPage.jsx';
import PersonPage from './pages/people/PersonPage.jsx';
import OrgPage from './pages/people/OrgPage.jsx';
import ProjectsPage from './pages/projects/ProjectsPage.jsx';
import TaskPage from './pages/projects/TaskPage.jsx';
import SchedulePage from './pages/people/SchedulePage.jsx';
import ProjectPage from './pages/projects/ProjectPage.jsx';
import WeeklyPage from './pages/agent/WeeklyPage.jsx';
import DailyPage from './pages/agent/DailyPage.jsx';
import FeedbackPage from './pages/agent/FeedbackPage.jsx';

// Tiny hash router: #/ (my desk, the landing page) , #/agent , #/daily , #/org , #/person/:id , #/project/:id
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
  { href: '#/', label: 'שולחן עבודה', match: (r) => r === '/' || r === '/work' },
  { href: '#/agent', label: 'סוכן', match: (r) => ['/agent', '/daily', '/weekly'].includes(r) },
  { href: '#/projects', label: 'פרויקטים', match: (r) => r === '/projects' || r.startsWith('/project/') },
  { href: '#/org', label: 'המבנה הארגוני', match: (r) => r === '/org' || r.startsWith('/person/') },
  { href: '#/feedback', label: 'משוב', match: (r) => r === '/feedback' },
];

export default function App() {
  const route = useRoute();
  let page;
  if (route === '/agent') page = <AgentPage />;
  else if (route === '/org') page = <OrgPage />;
  else if (route === '/projects') page = <ProjectsPage />;
  else if (route === '/weekly') page = <WeeklyPage />;
  else if (route === '/daily') page = <DailyPage />;
  else if (route === '/feedback') page = <FeedbackPage />;
  else if (route.startsWith('/schedule/')) page = <SchedulePage key={route} id={route.split('/')[2]} />;
  else if (route.startsWith('/task/')) page = <TaskPage key={route} id={route.split('/')[2]} />;
  else if (route.startsWith('/project/')) page = <ProjectPage key={route} id={route.split('/')[2]} />;
  else if (route.startsWith('/person/')) {
    const id = route.split('/')[2];
    page = <PersonPage key={id} id={id} />;
  } else page = <PersonPage key="me" id="me" />;

  return (
    <div className="shell">
      <nav className="nav">
        <a className="brand" href="#/" title="לשולחן העבודה">
          <span className="logo">M</span>
          <span className="name">MoniMentor</span>
        </a>
        <GlobalSearch />
        <div className="links">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className={n.match(route) ? 'active' : ''}>
              {n.label}
            </a>
          ))}
        </div>
      </nav>
      <div className="page">{page}</div>
      <ChatPopup hidden={route === '/agent'} />
    </div>
  );
}
