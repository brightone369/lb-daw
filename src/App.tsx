import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PitchCorrectionPage from './pages/PitchCorrectionPage';
import './App.css';

const navigationItems = [
  { to: '/', label: 'Home' },
  { to: '/pitch-correction', label: 'Pitch Correction' },
];

export default function App() {
  return (
    <div className="app-shell">
      <aside className="side-nav">
        <div className="brand-block">
          <p className="brand-kicker">Workspace</p>
          <h1 className="brand-title">LB DAW</h1>
        </div>

        <nav className="nav-menu" aria-label="Primary navigation">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="app-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/pitch-correction" element={<PitchCorrectionPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
