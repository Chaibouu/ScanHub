"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { adminNavigation } from "@/settings/navigation";
import appConfig from "@/settings";
import { Icon } from "@iconify/react";
import { ChevronDown, Menu, X, PanelLeft, PanelLeftClose } from "lucide-react";

const OPEN_WIDTH = 272;
const CLOSED_WIDTH = 72;

export function SidebarClear() {
  const [hoverOpen, setHoverOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Restaurer l'état pinned depuis localStorage
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-pinned");
    if (saved === "true") {
      setPinned(true);
    }
  }, []);

  const isOpen = pinned || hoverOpen;

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    localStorage.setItem("sidebar-pinned", String(next));
    if (!next) setHoverOpen(false);
  };

  return (
    <>
      {/* Bouton mobile */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
        className="md:hidden fixed top-4 left-4 z-[60] p-2.5 rounded-xl shadow-lg border border-white/20 hover:opacity-90 transition-all"
        style={{ backgroundColor: appConfig.primaryColor }}
      >
        {mobileOpen ? (
          <X className="h-5 w-5 text-white" />
        ) : (
          <Menu className="h-5 w-5 text-white" />
        )}
      </button>

      {/* Overlay mobile */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar desktop */}
      <motion.aside
        initial={false}
        animate={{ width: isOpen ? OPEN_WIDTH : CLOSED_WIDTH }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        onMouseEnter={() => !pinned && setHoverOpen(true)}
        onMouseLeave={() => !pinned && setHoverOpen(false)}
        className="hidden md:flex h-screen flex-col flex-shrink-0 shadow-2xl relative z-30 overflow-hidden"
        style={{ backgroundColor: appConfig.primaryColor }}
      >
        <SidebarContent
          open={isOpen}
          pinned={pinned}
          onTogglePin={togglePin}
          pathname={pathname}
        />
      </motion.aside>

      {/* Sidebar mobile */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="md:hidden fixed left-0 top-0 h-screen w-[272px] max-w-[85vw] shadow-2xl z-50 flex flex-col overflow-hidden"
            style={{ backgroundColor: appConfig.primaryColor }}
          >
            <SidebarContent
              open={true}
              pinned={false}
              onTogglePin={() => {}}
              pathname={pathname}
              isMobile
              onNavigate={() => setMobileOpen(false)}
            />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── SidebarContent ─────────────────────────────────────────────── */

interface SidebarContentProps {
  open: boolean;
  pinned: boolean;
  onTogglePin: () => void;
  pathname: string;
  isMobile?: boolean;
  onNavigate?: () => void;
}

function SidebarContent({
  open,
  pinned,
  onTogglePin,
  pathname,
  isMobile,
  onNavigate,
}: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header : logo + bouton pin */}
      <div
        className="flex items-center justify-between px-3 py-4 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}
      >
        <Logo open={open} />

        {/* Bouton pin — toujours visible, même en mode réduit */}
        {!isMobile && (
          <motion.button
            onClick={onTogglePin}
            title={pinned ? "Détacher la sidebar" : "Fixer la sidebar ouverte"}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className={cn(
              "flex-shrink-0 p-1.5 rounded-lg transition-all duration-200",
              pinned
                ? "bg-white/25 text-white shadow-inner"
                : "text-white/50 hover:bg-white/15 hover:text-white"
            )}
          >
            {pinned ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeft className="h-4 w-4" />
            )}
          </motion.button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        <nav className="space-y-0.5">
          {adminNavigation.map((item, idx) => (
            <NavItem
              key={idx}
              item={item}
              pathname={pathname}
              open={open}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div
              key="footer-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="px-4 py-3 text-center"
            >
              <p className="text-xs font-medium text-white/70">
                © {new Date().getFullYear()} {appConfig.appName}
              </p>
              <p className="text-[10px] text-white/40 mt-0.5">Version 1.0.0</p>
            </motion.div>
          ) : (
            <motion.div
              key="footer-icon"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="py-3 flex justify-center"
            >
              <span className="text-white/30 text-[10px] font-bold">v1</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─── Logo ───────────────────────────────────────────────────────── */

function Logo({ open }: { open: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3 group min-w-0">
      {/* Icône logo */}
      <div className="relative h-10 w-10 flex-shrink-0">
        <div
          className="absolute inset-0 rounded-xl blur-md opacity-30 group-hover:opacity-50 transition-opacity duration-300"
          style={{ backgroundColor: "rgba(255,255,255,0.3)" }}
        />
        <div
          className="relative h-10 w-10 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300"
          style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
        >
          <Image
            src={appConfig.sidebarClearlogoUrl}
            className="rounded-lg object-contain transition-transform duration-300 group-hover:scale-110"
            width={34}
            height={34}
            alt="Logo"
          />
        </div>
      </div>

      {/* Texte logo */}
      <AnimatePresence mode="wait">
        {open && (
          <motion.div
            key="logo-text"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col min-w-0 overflow-hidden"
          >
            <span className="font-bold text-sm text-white whitespace-nowrap leading-tight">
              {appConfig.appName}
            </span>
            <span className="text-[10px] text-white/60 font-medium whitespace-nowrap">
              {
                appConfig.websiteTitle
              }
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </Link>
  );
}

/* ─── NavItem ────────────────────────────────────────────────────── */

interface NavItemProps {
  item: any;
  pathname: string;
  open: boolean;
  onNavigate?: () => void;
}

function NavItem({ item, pathname, open, onNavigate }: NavItemProps) {
  const hasChildren = item.children && item.children.length > 0;
  const isActive =
    pathname === item.path ||
    (hasChildren && item.children?.some((c: any) => pathname === c.path)) ||
    (item.path !== "/" && pathname.startsWith(item.path));

  const [expanded, setExpanded] = useState(isActive);

  const handleClick = (e: React.MouseEvent) => {
    if (hasChildren) {
      e.preventDefault();
      setExpanded((prev : boolean) => !prev);
    } else if (onNavigate) {
      onNavigate();
    }
  };

  const btnClass = cn(
    "w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
    isActive ? "text-white" : "text-white/70 hover:text-white hover:bg-white/10"
  );

  const activeStyle = isActive ? { backgroundColor: "rgba(255,255,255,0.18)" } : {};

  /* Icône commune */
  const iconEl = (
    <div
      className={cn(
        "flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200",
        isActive ? "bg-white/20" : "bg-white/10 group-hover:bg-white/15"
      )}
    >
      <Icon icon={item.icon} className="h-4 w-4" />
    </div>
  );

  /* Titre animé commun */
  const titleEl = (
    <AnimatePresence mode="wait">
      {open && (
        <motion.span
          key="title"
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: "auto" }}
          exit={{ opacity: 0, width: 0 }}
          transition={{ duration: 0.15 }}
          className="flex-1 text-left whitespace-nowrap overflow-hidden"
        >
          {item.title}
        </motion.span>
      )}
    </AnimatePresence>
  );

  if (hasChildren) {
    return (
      <div>
        {/* Wrapper relatif : l'indicateur est positionné ici, pas dans le bouton */}
        <div className="relative">
          {/* Indicateur de page active — flush avec le bord gauche du nav container */}
          {isActive && (
            <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-r-full bg-white" />
          )}
          <button
            onClick={handleClick}
            className={btnClass}
            style={activeStyle}
          >
            {iconEl}
            {titleEl}
            {open && (
              <motion.div
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.25 }}
                className="flex-shrink-0 text-white/50"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </motion.div>
            )}
          </button>
        </div>

        {/* Enfants */}
        <AnimatePresence>
          {expanded && open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div
                className="ml-5 mt-0.5 mb-1 space-y-0.5 pl-3"
                style={{ borderLeft: "1px solid rgba(255,255,255,0.2)" }}
              >
                {item.children.map((child: any, idx: number) => {
                  const isChildActive = pathname === child.path;
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                    >
                      <Link
                        href={child.path}
                        onClick={onNavigate}
                        className={cn(
                          "block px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200",
                          isChildActive
                            ? "text-white font-semibold"
                            : "text-white/60 hover:text-white hover:bg-white/10"
                        )}
                        style={isChildActive ? { backgroundColor: "rgba(255,255,255,0.15)" } : {}}
                      >
                        {child.title}
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    /* Wrapper relatif : l'indicateur est positionné ici, pas dans le Link */
    <div className="relative">
      {isActive && (
        <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-r-full bg-white" />
      )}
      <Link
        href={item.path}
        onClick={onNavigate}
        className={btnClass}
        style={activeStyle}
      >
        {iconEl}
        {titleEl}
      </Link>
    </div>
  );
}
