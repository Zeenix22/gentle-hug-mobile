import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Shield, Settings, Info, Lock, FileText, LogOut, Database } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";

interface HamburgerMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const menuItems = [
  { label: "Settings", icon: Settings, path: "/settings" },
  { label: "About", icon: Info, path: "/help" },
  { label: "Privacy Policy", icon: Lock, path: "/settings" },
  { label: "Terms of Service", icon: FileText, path: "/help" },
];

const HamburgerMenu = ({ open, onOpenChange }: HamburgerMenuProps) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleNavigation = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  const handleLogout = async () => {
    await signOut();
    onOpenChange(false);
    navigate("/login");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-72 p-0">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">Truth Buddy</span>
          </SheetTitle>
        </SheetHeader>

        <Separator />

        <div className="flex flex-col py-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => handleNavigation(item.path)}
                className="flex items-center gap-3 px-6 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors min-h-[44px]"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                {item.label}
              </button>
            );
          })}
        </div>

        <Separator />

        <div className="py-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-6 py-3 text-sm font-medium text-destructive hover:bg-accent transition-colors w-full min-h-[44px]"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default HamburgerMenu;
