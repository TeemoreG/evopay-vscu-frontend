import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import evopayLogo from '../../assets/evopay-logo.png';

const Header = ({ setSidebarOpen, sidebarOpen }) => {
  const { tin, bhfId, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-[#1a2a4a] text-white px-4 md:px-6 py-3 md:py-4 grid grid-cols-[auto_1fr_auto] items-center shadow-md border-b border-white/10 w-full sticky top-0 z-40">
      
      {/* Left - Hamburger Menu */}
      <div className="flex items-center">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-white text-2xl md:text-3xl hover:text-[#f47b20] transition md:hidden p-1"
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
      </div>

      {/* Center - Logo & Brand */}
      <div className="flex items-center justify-center gap-2 md:gap-3">
        <img
          src={evopayLogo}
          alt="Evopay Limited"
          className="h-8 md:h-12 w-auto object-contain"
          onError={(e) => {
            e.target.style.display = 'none';
            const parent = e.target.parentNode;
            const fallback = document.createElement('span');
            fallback.className = 'text-xl font-bold text-[#f47b20]';
            fallback.textContent = 'Evopay';
            parent.appendChild(fallback);
          }}
        />
        <div className="hidden sm:block border-l border-white/20 pl-2 md:pl-3">
          <h1 className="text-white font-bold text-xs md:text-base leading-tight tracking-wide">
            POS VSCU
          </h1>
          <span className="text-[8px] md:text-[10px] text-white/50 font-medium">
            KRA eTIMS Compliant
          </span>
        </div>
      </div>

      {/* Right - User Info & Logout */}
      <div className="flex items-center justify-end gap-2 md:gap-3 text-xs md:text-sm">
        <div className="hidden lg:flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/15 transition">
          <span className="text-white/50 text-[10px] font-medium">TIN:</span>
          <span className="text-white font-mono font-medium tracking-wider text-[11px]">
            {tin || 'Not Set'}
          </span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/15 transition">
          <span className="text-white/50 text-[10px] font-medium">Branch:</span>
          <span className="text-white font-mono font-medium text-[11px]">
            {bhfId || '00'}
          </span>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition text-xs font-medium duration-200"
        >
          Logout
        </button>
      </div>
    </header>
  );
};

export default Header;