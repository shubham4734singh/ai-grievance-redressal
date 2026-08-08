import { Routes, Route, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import FileGrievance from './pages/FileGrievance';
import TrackGrievance from './pages/TrackGrievance';
import AdminDashboard from './pages/AdminDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import Chatbot from './components/Chatbot';

// Placeholder Pages
const Home = () => (
  <div className="p-8 max-w-4xl mx-auto text-center mt-20">
    <h1 className="text-4xl md:text-5xl font-bold text-gray-900">Resolve your issues faster with AI.</h1>
    <p className="mt-6 text-xl text-gray-600">The transparent, intelligent, and seamless way to file and track grievances with government services.</p>
    <div className="mt-10 flex gap-4 justify-center">
      <a href="/file" className="bg-primary-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-primary-600">File a Grievance</a>
      <a href="/track" className="bg-white border-2 border-primary-500 text-primary-500 px-8 py-3 rounded-xl font-bold hover:bg-primary-50">Track Status</a>
    </div>
  </div>
);

function App() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-surface-bg flex flex-col">
      {/* Basic Nav */}
      <nav className="bg-primary-500 text-white p-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex gap-4 items-center">
          <a href="/" className="font-bold hover:text-primary-100">Home</a>
          <a href="/file" className="hover:text-primary-100">File Grievance</a>
          <a href="/track" className="hover:text-primary-100">Track Status</a>
          {user?.role === 'admin' && (
            <a href="/admin" className="font-semibold text-yellow-300 hover:text-yellow-100">Admin Dashboard</a>
          )}
          <div className="flex-1"></div>
          {token ? (
            <div className="flex items-center gap-4">
              <span className="text-primary-100 text-sm">Hello, {user?.full_name}</span>
              <button onClick={handleLogout} className="hover:text-primary-100">Logout</button>
            </div>
          ) : (
            <a href="/login" className="hover:text-primary-100">Login</a>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto md:p-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/file" element={<ProtectedRoute><FileGrievance /></ProtectedRoute>} />
          <Route path="/track" element={<ProtectedRoute><TrackGrievance /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </main>

      {/* Global AI Chatbot */}
      <Chatbot />
    </div>
  );
}

export default App;
