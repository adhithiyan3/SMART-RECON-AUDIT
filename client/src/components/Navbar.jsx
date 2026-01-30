import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-2 rounded-lg group-hover:shadow-md transition-all duration-300">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              Smart Recon
            </span>
          </Link>

          <div className="flex items-center space-x-6">
            {user ? (
              <>
                <div className="hidden md:flex space-x-1">
                  <Link
                    to="/"
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive('/')
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                      }`}
                  >
                    Dashboard
                  </Link>
                  {user.role !== 'Viewer' && (
                    <Link
                      to="/upload"
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive('/upload')
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                        }`}
                    >
                      Upload
                    </Link>
                  )}
                  <Link
                    to="/results"
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive('/results')
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                      }`}
                  >
                    Results
                  </Link>
                  {user.role === 'Admin' && (
                    <Link
                      to="/settings"
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive('/settings')
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                        }`}
                    >
                      Settings
                    </Link>
                  )}
                </div>
                <div className="h-6 w-px bg-gray-200 hidden md:block"></div>
                <div className="flex items-center space-x-4">
                  <div className="hidden sm:flex flex-col items-end">
                    <span className="text-sm font-medium text-gray-900">{user.email?.split('@')[0]}</span>
                    <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                      {user.role || 'User'}
                    </span>
                  </div>
                  <button
                    onClick={logout}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50 group"
                    title="Logout"
                  >
                    <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className="text-gray-600 hover:text-blue-600 font-medium transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
