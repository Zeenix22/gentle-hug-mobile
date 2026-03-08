import { useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import BottomNavigation from "./BottomNavigation";
import HamburgerMenu from "./HamburgerMenu";

const Layout = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header onMenuToggle={() => setMenuOpen(true)} />
      <HamburgerMenu open={menuOpen} onOpenChange={setMenuOpen} />

      <main className="flex-1 pb-20">
        <Outlet />
      </main>

      <BottomNavigation />
    </div>
  );
};

export default Layout;
