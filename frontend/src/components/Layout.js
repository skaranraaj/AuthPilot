import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { 
  Shield, 
  LayoutDashboard, 
  FileText, 
  BookOpen, 
  FileEdit, 
  BarChart3, 
  User, 
  LogOut,
  ChevronDown,
  AlertTriangle
} from 'lucide-react';

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/policies', label: 'Policy Library', icon: BookOpen },
    { to: '/templates', label: 'Templates', icon: FileEdit },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Compliance Banner */}
      <div className="compliance-banner flex items-center gap-2" data-testid="compliance-banner">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span className="font-medium">Administrative drafting tool.</span>
        <span>Not medical advice. Human review required before submission.</span>
      </div>

      {/* Navigation */}
      <nav className="navbar-glass" data-testid="main-navbar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <NavLink to="/dashboard" className="flex items-center gap-2 group">
              <Shield className="w-8 h-8 text-teal-700 transition-transform group-hover:scale-105" />
              <span className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
                AuthPilot
              </span>
            </NavLink>

            {/* Nav Links */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-teal-50 text-teal-700'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`
                  }
                  data-testid={`nav-${label.toLowerCase().replace(' ', '-')}`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </NavLink>
              ))}
            </div>

            {/* User Menu */}
            <div className="flex items-center gap-4">
              <Button
                onClick={() => navigate('/cases/new')}
                className="bg-teal-700 hover:bg-teal-800 text-white hidden sm:flex"
                data-testid="create-case-btn"
              >
                <FileText className="w-4 h-4 mr-2" />
                New Case
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2" data-testid="user-menu-trigger">
                    <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                      <User className="w-4 h-4 text-teal-700" />
                    </div>
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                      <p className="text-xs text-slate-500">{user?.organization_name || 'Personal'}</p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-slate-500">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer" data-testid="logout-btn">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        <div className="md:hidden border-t border-slate-200 px-4 py-2 flex justify-around">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs ${
                  isActive
                    ? 'text-teal-700'
                    : 'text-slate-500'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {label.split(' ')[0]}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
