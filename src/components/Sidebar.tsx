import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Lock, 
  Unlock, 
  Upload, 
  Plus, 
  Send,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  BookmarkPlus
} from 'lucide-react';
import { TelegramConfig } from '../types';

interface SidebarProps {
  currentTab: 'dashboard' | 'calendar' | 'admin';
  setCurrentTab: (tab: 'dashboard' | 'calendar' | 'admin') => void;
  isAdminAuthenticated: boolean;
  schoolLogo: string | null;
  onUploadLogoClick: () => void;
  onOpenBookingModal: (isPrebooking?: boolean) => void;
  todayCount: number;
  telegramConfig: TelegramConfig;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  isAdminAuthenticated,
  schoolLogo,
  onUploadLogoClick,
  onOpenBookingModal,
  todayCount,
  telegramConfig,
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const isTelegramConfigured = Boolean(telegramConfig.botToken && telegramConfig.chatId);

  const handleTabSelect = (tab: 'dashboard' | 'calendar' | 'admin') => {
    setCurrentTab(tab);
    setIsMobileOpen(false); // Auto-close drawer on mobile/tablet after tab selection
  };

  const handleOpenBooking = () => {
    onOpenBookingModal(false);
    setIsMobileOpen(false);
  };

  const handleOpenPrebooking = () => {
    onOpenBookingModal(true);
    setIsMobileOpen(false);
  };

  // Reusable Navigation Links
  const navContent = (isCollapsed: boolean) => (
    <div className="flex flex-col h-full justify-between">
      <div>
        {/* School Logo & Title */}
        <div className={`p-4 border-b border-stone-800 ${isCollapsed ? 'text-center' : ''}`}>
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            {schoolLogo ? (
              <div 
                className="relative group cursor-pointer shrink-0" 
                onClick={onUploadLogoClick} 
                title="Click to manage logo"
              >
                <img 
                  src={schoolLogo} 
                  alt="SAKURA Logo" 
                  className="w-10 h-10 object-contain rounded-xl bg-stone-50 p-1 border border-stone-700 shadow-sm"
                />
                <div className="absolute inset-0 bg-stone-900/60 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Upload className="w-3.5 h-3.5 text-stone-200" />
                </div>
              </div>
            ) : (
              <div 
                onClick={onUploadLogoClick}
                className="w-10 h-10 rounded-xl bg-rose-200/90 text-rose-950 flex items-center justify-center font-bold text-lg shadow-xs border border-rose-300/60 cursor-pointer group relative shrink-0"
                title="Click to upload school logo"
              >
                <span>🌸</span>
                <div className="absolute inset-0 bg-stone-900/70 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[9px] text-white">
                  Logo
                </div>
              </div>
            )}

            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <h2 className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider truncate">
                  SM Sains Kuching Utara
                </h2>
                <div className="text-sm font-bold text-rose-300 tracking-wide">
                  SAKURA
                </div>
                <p className="text-[10px] text-stone-400 truncate font-medium">
                  English Lab Booking System
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Booking Buttons */}
        <div className="p-3 space-y-1.5">
          <button
            onClick={handleOpenBooking}
            className={`w-full py-2.5 px-3 rounded-xl bg-rose-400/90 hover:bg-rose-400 text-rose-950 font-semibold text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 ${
              isCollapsed ? 'px-0' : ''
            }`}
            title="Book English Lab (Today)"
          >
            <Clock className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Book Lab (Today)</span>}
          </button>

          <button
            onClick={handleOpenPrebooking}
            className={`w-full py-2 px-3 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border border-amber-400/30 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 ${
              isCollapsed ? 'px-0' : ''
            }`}
            title="Advance Pre-Booking (Future Dates)"
          >
            <BookmarkPlus className="w-4 h-4 shrink-0 text-amber-300" />
            {!isCollapsed && <span>Advance Pre-Booking</span>}
          </button>
        </div>

        {/* Navigation Tabs */}
        <nav className="px-2 space-y-1 text-xs">
          {/* Tab 1: Dashboard */}
          <button
            onClick={() => handleTabSelect('dashboard')}
            title="Dashboard"
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium transition-all ${
              currentTab === 'dashboard'
                ? 'bg-stone-800 text-rose-200 font-bold border border-stone-700'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            } ${isCollapsed ? 'justify-center px-0' : ''}`}
          >
            <div className="flex items-center gap-2.5">
              <LayoutDashboard className="w-4 h-4 text-rose-300 shrink-0" />
              {!isCollapsed && <span>Dashboard</span>}
            </div>
            {!isCollapsed && todayCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800">
                {todayCount} Today
              </span>
            )}
          </button>

          {/* Tab 2: Calendar & Booking */}
          <button
            onClick={() => handleTabSelect('calendar')}
            title="Calendar & Booking"
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium transition-all ${
              currentTab === 'calendar'
                ? 'bg-stone-800 text-teal-200 font-bold border border-stone-700'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            } ${isCollapsed ? 'justify-center px-0' : ''}`}
          >
            <div className="flex items-center gap-2.5">
              <CalendarDays className="w-4 h-4 text-teal-300 shrink-0" />
              {!isCollapsed && <span>Calendar &amp; Booking</span>}
            </div>
          </button>

          {/* Tab 3: Admin Portal */}
          <button
            onClick={() => handleTabSelect('admin')}
            title="Admin Portal"
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium transition-all ${
              currentTab === 'admin'
                ? 'bg-stone-800 text-amber-200 font-bold border border-stone-700'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            } ${isCollapsed ? 'justify-center px-0' : ''}`}
          >
            <div className="flex items-center gap-2.5">
              {isAdminAuthenticated ? (
                <Unlock className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <Lock className="w-4 h-4 text-amber-300 shrink-0" />
              )}
              {!isCollapsed && <span>Admin Portal</span>}
            </div>
            {!isCollapsed && (
              isAdminAuthenticated ? (
                <span className="text-[10px] text-emerald-400 font-semibold">Unlocked</span>
              ) : (
                <span className="text-[10px] text-stone-500 font-mono">PIN</span>
              )
            )}
          </button>
        </nav>
      </div>

      {/* Footer Info */}
      <div className={`p-3.5 border-t border-stone-800 text-[11px] text-stone-400 space-y-2 ${isCollapsed ? 'text-center' : ''}`}>
        {!isCollapsed ? (
          <>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-stone-400">
                <Send className="w-3 h-3 text-sky-400" />
                <span>Telegram Bot</span>
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                isTelegramConfigured ? 'bg-sky-950 text-sky-300 border border-sky-800' : 'bg-stone-800 text-stone-500'
              }`}>
                {isTelegramConfigured ? 'Connected' : 'Offline'}
              </span>
            </div>

            <button
              onClick={() => {
                onUploadLogoClick();
                setIsMobileOpen(false);
              }}
              className="w-full text-left py-1 text-stone-400 hover:text-stone-200 text-[11px] flex items-center gap-1.5 transition-colors"
            >
              <Upload className="w-3 h-3 text-stone-400" />
              <span>Upload School Logo</span>
            </button>

            <div className="text-[10px] text-stone-600 pt-1 border-t border-stone-800">
              SAKURA English Lab
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span 
              className={`w-2 h-2 rounded-full ${isTelegramConfigured ? 'bg-sky-400' : 'bg-stone-600'}`} 
              title={isTelegramConfigured ? 'Telegram Connected' : 'Telegram Offline'} 
            />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* MOBILE & TABLET TOP HEADER BAR (< lg) */}
      <header className="lg:hidden sticky top-0 z-30 bg-stone-900 text-stone-200 border-b border-stone-800 px-4 py-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors"
            aria-label="Toggle Navigation Menu"
            title="Open Navigation Menu"
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2" onClick={() => handleTabSelect('dashboard')}>
            {schoolLogo ? (
              <img 
                src={schoolLogo} 
                alt="Logo" 
                className="w-7 h-7 object-contain rounded-lg bg-stone-50 p-0.5" 
              />
            ) : (
              <span className="text-base">🌸</span>
            )}
            <div>
              <div className="text-xs font-bold text-rose-300 leading-none">SAKURA</div>
              <div className="text-[10px] text-stone-400 leading-tight">English Lab</div>
            </div>
          </div>
        </div>

        {/* Quick action on mobile header */}
        <div className="flex items-center gap-2">
          {todayCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800">
              {todayCount} Today
            </span>
          )}

          <button
            onClick={handleOpenBooking}
            className="px-2.5 py-1.5 rounded-xl bg-rose-400 text-rose-950 font-bold text-xs flex items-center gap-1 shadow-xs hover:bg-rose-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Book</span>
          </button>
        </div>
      </header>

      {/* MOBILE & TABLET OVERLAY DRAWER (< lg) */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-stone-950/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsMobileOpen(false)}
          />

          {/* Slide-in Drawer */}
          <div className="relative w-72 max-w-[80vw] bg-stone-900 text-stone-200 h-full flex flex-col z-50 shadow-2xl animate-in slide-in-from-left duration-200 border-r border-stone-800">
            <div className="absolute top-3 right-3">
              <button
                onClick={() => setIsMobileOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {navContent(false)}
          </div>
        </div>
      )}

      {/* DESKTOP SIDEBAR (lg and up) */}
      <aside 
        className={`hidden lg:flex flex-col justify-between bg-stone-900 text-stone-200 border-r border-stone-800 shrink-0 min-h-screen sticky top-0 z-20 font-sans shadow-xs transition-all duration-200 ${
          isDesktopCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className="relative h-full flex flex-col justify-between">
          {/* Desktop Collapse / Expand Toggle Button */}
          <button
            onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
            className="absolute -right-3 top-5 w-6 h-6 rounded-full bg-stone-800 border border-stone-700 text-stone-300 hover:text-white flex items-center justify-center shadow-xs transition-colors z-30"
            title={isDesktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isDesktopCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>

          {navContent(isDesktopCollapsed)}
        </div>
      </aside>
    </>
  );
};
