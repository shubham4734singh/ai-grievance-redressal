import React, { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import FileGrievance from './pages/FileGrievance';
import TrackGrievance from './pages/TrackGrievance';
import AdminDashboard from './pages/AdminDashboard';
import Analytics from './pages/Analytics';
import ProtectedRoute from './components/ProtectedRoute';
import Chatbot from './components/Chatbot';
import NotificationBell from './components/NotificationBell';

const OFFICER_EMAIL = 'shubham.cybersky@gmail.com';

const slides = [
  { image: '/img1.png', eyebrow: 'Step 01 · Detect', title: 'See a civic issue?', accent: 'Make it visible.', copy: 'Spot a problem in your neighbourhood and document it in a moment. Your report is the first step toward a better public space.', cta: 'Report an issue', to: '/file', icon: FilePlus2 },
  { image: '/img2.png', eyebrow: 'Step 02 · Register', title: 'Turn an observation', accent: 'into accountable action.', copy: 'Submit a clear, complete complaint through one trusted digital channel and receive a unique tracking reference immediately.', cta: 'Register complaint', to: '/file', icon: CheckCircle2 },
  { image: '/img3.png', eyebrow: 'Step 03 · Resolve', title: 'Track progress until', accent: 'the work is done.', copy: 'Follow every important update, from assignment to resolution, and know when your concern has been addressed.', cta: 'Track complaint', to: '/track', icon: Search },
];

  useEffect(() => {
    // Inject Google Translate script when App mounts
    window.googleTranslateElementInit = () => {
      new window.google.translate.TranslateElement(
        { pageLanguage: 'en', includedLanguages: 'en,hi,mr,gu,ta,te,bn', autoDisplay: false },
        'google_translate_element'
      );
    };

    const addScript = document.createElement('script');
    addScript.setAttribute('src', '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit');
    document.body.appendChild(addScript);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleLanguageChange = (e) => {
    const lang = e.target.value;
    if (lang === 'en') {
      document.cookie = `googtrans=/en/en; path=/; domain=${window.location.hostname}`;
      document.cookie = `googtrans=/en/en; path=/`;
    } else {
      document.cookie = `googtrans=/en/${lang}; path=/; domain=${window.location.hostname}`;
      document.cookie = `googtrans=/en/${lang}; path=/`;
    }
    window.location.reload();
  };

  // Check current language from cookie
  const currentLang = document.cookie.split('; ').find(row => row.startsWith('googtrans='))?.split('/')[2] || 'en';


  return (
    <div className="min-h-screen bg-surface-bg flex flex-col">
      {/* Basic Nav */}
      <nav className="bg-primary-500 text-white p-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex gap-4 items-center">
          <a href="/" className="font-bold hover:text-primary-100">Home</a>
          {user?.role !== 'admin' && (
            <>
              <a href="/file" className="hover:text-primary-100">File Grievance</a>
              <a href="/track" className="hover:text-primary-100">Track Status</a>
            </>
          )}
          {user?.role === 'admin' && (
            <>
              <a href="/admin" className="font-semibold text-yellow-300 hover:text-yellow-100">Admin Dashboard</a>
              <a href="/analytics" className="font-semibold text-yellow-300 hover:text-yellow-100">Analytics</a>
            </>
          )}
          
          {/* Secret Google Translate Element */}
          <div id="google_translate_element"></div>

          {/* Custom Native Dropdown */}
          <select 
            className="bg-primary-600 text-white border border-primary-400 rounded-md px-2 py-1 text-sm font-semibold cursor-pointer outline-none hover:bg-primary-700 ml-4"
            onChange={handleLanguageChange}
            value={currentLang}
          >
            <option value="en">English</option>
            <option value="hi">हिंदी (Hindi)</option>
            <option value="mr">मराठी (Marathi)</option>
            <option value="gu">ગુજરાતી (Gujarati)</option>
          </select>

          {token ? (
            <div className="flex items-center gap-6 ml-4">
              <NotificationBell />
              <div className="flex items-center gap-4 border-l border-primary-400 pl-6">
                <span className="text-primary-100 text-sm">Hello, {user?.full_name}</span>
                <button onClick={handleLogout} className="hover:text-primary-100 font-semibold">Logout</button>
              </div>
            </div>
          ) : (
            <a href="/login" className="hover:text-primary-100 font-semibold ml-4">Login</a>
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
          <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </main>

      {/* Global AI Chatbot */}
      {user?.role !== 'admin' && <Chatbot />}
    </div>
  );
}

function App() { const token=localStorage.getItem('token'); const user=JSON.parse(localStorage.getItem('user')||'null'); const navigate=useNavigate(); const location=useLocation(); const [open,setOpen]=useState(false); const admin=user?.role==='admin'; const isAdmin=location.pathname==='/admin'; const logout=()=>{localStorage.removeItem('token');localStorage.removeItem('user');navigate('/login')}; return <div className={isAdmin?'min-h-screen bg-[#f5f6f8]':'min-h-screen bg-surface-bg flex flex-col'}><header className={`${isAdmin?'bg-white border-slate-200':'bg-white/90 backdrop-blur-md border-[#dce5ed]'} sticky top-0 z-40 border-b`}><div className="max-w-7xl mx-auto px-5 h-[68px] flex items-center justify-between gap-5"><Link to="/" className="flex items-center gap-2.5 text-slate-900 font-bold"><span className="grid place-items-center w-9 h-9 bg-primary-500 rounded-xl text-white shadow-sm"><Landmark className="w-5 h-5"/></span><span>JanSewa <span className="font-normal text-slate-500">Portal</span></span></Link><button aria-label="Toggle menu" onClick={()=>setOpen(!open)} className="md:hidden p-2 text-slate-600">{open?<X/>:<Menu/>}</button><nav className={`${open?'flex':'hidden'} md:flex absolute md:static top-[68px] inset-x-0 bg-white md:bg-transparent p-5 md:p-0 flex-col md:flex-row items-stretch md:items-center gap-1 md:gap-4 z-30 border-b md:border-0 border-slate-200 text-sm font-semibold text-slate-600`}><Link to="/" className="px-3 py-2 hover:text-primary-600">Home</Link>{!isAdmin&&<><Link to="/file" className="px-3 py-2 hover:text-primary-600">Register grievance</Link><Link to="/track" className="px-3 py-2 hover:text-primary-600">Track status</Link></>}{admin&&<Link to="/admin" className="px-3 py-2 hover:text-primary-600">Officer workspace</Link>}{token?<><button aria-label="Notifications" className="hidden md:block p-2 hover:text-primary-600"><Bell className="w-5 h-5"/></button><button onClick={logout} className="px-3 py-2 text-primary-600">Sign out</button></>:<Link to="/login" className="rounded-xl bg-primary-500 text-white px-4 py-2.5 text-center hover:bg-primary-600 shadow-sm">Sign in</Link>}</nav></div></header><main className={isAdmin?'w-full':'flex-1 w-full'}><Routes><Route path="/" element={<Home/>}/><Route path="/file" element={<ProtectedRoute><FileGrievance/></ProtectedRoute>}/><Route path="/track" element={<ProtectedRoute><TrackGrievance/></ProtectedRoute>}/><Route path="/admin" element={<ProtectedRoute><AdminDashboard/></ProtectedRoute>}/><Route path="/login" element={<Login/>}/><Route path="/register" element={<Register/>}/></Routes></main>{!isAdmin&&<><footer className="mt-16 border-t border-slate-200 bg-white py-6 text-center text-sm text-slate-500">JanSewa Citizen Service Portal <span className="mx-2">•</span> Your information is handled securely.</footer><Chatbot/></>}</div> }
export default App;
