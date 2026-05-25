'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { AlertCircle, User, LogOut, PlusCircle, Archive, ShieldAlert, BookOpen } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const { user, profile, logout } = useAuth();

  const navItems = [
    { name: 'Feed', href: '/' },
    { name: 'Archive', href: '/archive', icon: Archive },
  ];

  const isActive = (path: string) => pathname === path;

  // Render hidden Admin button if email matches or phone is simulated admin
  const isUserAdmin = profile?.flagged || user?.email === 'publiceye33@gmail.com' || (user && user.phoneNumber === '+8801700000000');

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm" id="global-header-navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group" id="nav-logo-link">
              <div className="w-9 h-9 rounded-xl bg-rose-600 flex items-center justify-center text-white font-black text-xl shadow-sm group-hover:scale-105 transition-transform">
                P
              </div>
              <div className="flex flex-col">
                <span className="font-heading font-extrabold text-xl tracking-tight text-slate-900 leading-none">
                  PublicEye
                </span>
                <span className="text-[10px] text-slate-500 font-mono tracking-wider mt-0.5 uppercase">
                  Bangladesh Community
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              
              {isUserAdmin && (
                <Link
                  href="/admin"
                  className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                    isActive('/admin')
                      ? 'bg-amber-50 text-amber-900 border border-amber-200'
                      : 'text-slate-600 hover:text-amber-700 hover:bg-amber-50/50'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  Admin Moderation
                </Link>
              )}
            </nav>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {/* Create Report Button */}
                <Link
                  href="/create"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 transition-transform active:scale-95"
                  id="action-create-report"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Report Incident</span>
                  <span className="sm:hidden">Report</span>
                </Link>

                {/* Profile Link */}
                <Link
                  href={`/profile/${user.uid}`}
                  className={`p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors flex items-center gap-2 max-w-[170px] sm:max-w-[200px] ${
                    pathname.startsWith('/profile') ? 'bg-slate-100/80 text-slate-900' : ''
                  }`}
                  title="View Profile"
                  id="user-profile-navigation-button"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center border border-slate-300">
                    <User className="w-4 h-4 text-slate-700" />
                  </div>
                  <div className="hidden sm:flex flex-col text-left text-xs truncate">
                    <span className="font-semibold leading-tight text-slate-900">
                      {profile?.name || 'Onboarding...'}
                    </span>
                    <span className="text-slate-500 scale-95 origin-left leading-none truncate">
                      {profile?.area || 'Select Area'}
                    </span>
                  </div>
                </Link>

                {/* Logout */}
                <button
                  onClick={logout}
                  className="p-2.5 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-xl transition-colors"
                  title="Log Out"
                  id="button-user-logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors shadow-sm"
                id="header-login-button"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
