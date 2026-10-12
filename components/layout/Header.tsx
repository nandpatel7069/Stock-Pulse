'use client';

import React from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { Search, Sun, Moon } from 'lucide-react';

interface HeaderProps {
  onOpenCommandPalette: () => void;
}

export function Header({ onOpenCommandPalette }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 h-14 bg-background/80 backdrop-blur-sm border-b border-border px-6 flex items-center justify-between">
      {/* Search Bar / Cmd+K Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-md bg-muted/50 hover:bg-muted border border-border text-muted-foreground hover:text-foreground text-xs transition-colors w-60 md:w-72 text-left"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="flex-1 truncate">Search products, orders, customers...</span>
          <kbd className="hidden md:inline-flex items-center text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>
      </div>
    </header>
  );
}
