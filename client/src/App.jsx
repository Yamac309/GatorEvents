import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import Feed from './pages/Feed.jsx';
import MapView from './pages/Map.jsx';
import Submit from './pages/Submit.jsx';
import Admin from './pages/Admin.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-gray-950">
        <Sidebar />
        <main className="flex-1 flex flex-col bg-gray-900 overflow-hidden text-gray-100" style={{ minHeight: '100vh' }}>
          <Routes>
            <Route path="/" element={<Feed />} />
            <Route path="/map" element={<MapView />} />
            <Route path="/submit" element={<Submit />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
