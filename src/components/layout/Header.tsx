import { Menu, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
  onMenuToggle: () => void;
}

const Header = ({ onMenuToggle }: HeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex h-14 items-center justify-between px-4">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 min-h-0 min-w-0"
        >
          <Shield className="h-7 w-7 text-primary" />
          <span className="text-lg font-bold text-foreground tracking-tight">
            Truth Buddy
          </span>
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuToggle}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
};

export default Header;
