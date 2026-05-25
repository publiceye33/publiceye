import { UserProfile } from '../types';
import { ShieldAlert, User, LogOut, Wifi, WifiOff, RefreshCw, LayoutGrid, Clock } from 'lucide-react';

interface HeaderProps {
  currentUser: UserProfile | null;
  currentView: string;
  onNavigate: (view: 'home' | 'login' | 'create' | 'profile' | 'archive' | 'admin', targetId?: string) => void;
  isOnline: boolean;
  onToggleOnline: () => void;
  onLogout: () => void;
  syncOfflineCount: number;
}

export default function Header({
  currentUser,
  currentView,
  onNavigate,
  isOnline,
  onToggleOnline,
  onLogout,
  syncOfflineCount,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-150 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        
        {/* Logo and Brand */}
        <div 
          onClick={() => onNavigate('home')} 
          className="flex cursor-pointer items-center space-x-2 transition hover:opacity-90 py-1"
          id="brand-logo"
        >
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-sans font-extrabold text-xl tracking-tight text-gray-900">
                Public<span className="text-red-600">Eye</span>
              </span>
            </div>
            <p className="font-mono text-[9px] text-gray-400">Community Incident Tracker</p>
          </div>
        </div>

        {/* Network & Nav Center */}
        <div className="hidden md:flex items-center space-x-6">
          <button 
            onClick={() => onNavigate('home')}
            className={`font-sans text-sm font-medium transition ${
              currentView === 'home' ? 'text-red-600' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Feed
          </button>
          <button 
            onClick={() => onNavigate('archive')}
            className={`font-sans text-sm font-medium transition ${
              currentView === 'archive' ? 'text-red-600' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Archive
          </button>
          <button 
            onClick={() => onNavigate('admin')}
            className={`font-sans text-sm font-medium transition ${
              currentView === 'admin' ? 'text-red-600' : 'text-gray-500 hover:text-gray-900'
            }`}
            id="admin-link-mobile"
          >
            Moderation
          </button>
        </div>

        {/* Actions Zone */}
        <div className="flex items-center space-x-3">

          {/* User Status / Action Button */}
          {currentUser ? (
            <div className="flex items-center space-x-1 sm:space-x-2">
              <button
                onClick={() => onNavigate('profile', currentUser.id)}
                className={`flex items-center space-x-1.5 rounded-lg px-2.5 py-1.5 transition ${
                  currentView === 'profile' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'
                }`}
                id="profile-nav-button"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline font-sans text-xs font-semibold">
                  {currentUser.name}
                </span>
              </button>
              
              <button
                onClick={onLogout}
                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                title="Log Out"
                id="logout-button"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onNavigate('login')}
              className="rounded-lg bg-gray-900 px-3 py-1.5 font-sans text-xs font-bold text-white transition hover:bg-gray-800"
              id="header-login-button"
            >
              Sign In
            </button>
          )}
        </div>

      </div>

      {/* Mobile Quick Utility Indicators */}
      <div className="flex md:hidden border-t border-gray-100 bg-gray-50 px-4 py-1.5 justify-around text-xs">
        <button 
          onClick={() => onNavigate('home')}
          className={`font-semibold ${currentView === 'home' ? 'text-red-700' : 'text-gray-500'}`}
        >
          Active Feed
        </button>
        <button 
          onClick={() => onNavigate('archive')}
          className={`font-semibold ${currentView === 'archive' ? 'text-red-700' : 'text-gray-500'}`}
        >
          Archive Postings
        </button>
        <button 
          onClick={() => onNavigate('admin')}
          className={`font-semibold ${currentView === 'admin' ? 'text-red-600' : 'text-gray-400'}`}
        >
          Review List
        </button>
      </div>

      {/* Offline sync banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-white font-mono text-center text-xs py-1 flex items-center justify-center space-x-1">
          <WifiOff className="h-3.5 w-3.5" />
          <span>Offline state active. Reports & comments are safely stored as local drafts.</span>
        </div>
      )}
      
      {isOnline && syncOfflineCount > 0 && (
        <div className="bg-emerald-600 text-white font-mono text-center text-xs py-1.5 flex items-center justify-center space-x-1.5 animate-pulse">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          <span>Reconnected! Syncing {syncOfflineCount} local draft(s) with cloud storage...</span>
        </div>
      )}
    </header>
  );
}
