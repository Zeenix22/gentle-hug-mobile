import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import {
  ArrowLeft,
  Bell,
  BellOff,
  Moon,
  Sun,
  Monitor,
  Lock,
  Trash2,
  Download,
  Eye,
  EyeOff,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type ThemeOption = "light" | "dark" | "system";

const themeOptions: { value: ThemeOption; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const Settings = () => {
  const navigate = useNavigate();
  const { theme, setTheme: applyTheme } = useTheme();

  // Notification preferences
  const [analysisComplete, setAnalysisComplete] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);
  const [productUpdates, setProductUpdates] = useState(true);

  // Privacy
  const [shareAnalytics, setShareAnalytics] = useState(true);
  const [publicProfile, setPublicProfile] = useState(false);

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 animate-fade-in">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9 min-h-0 min-w-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
          <p className="text-xs text-muted-foreground">Customize your experience</p>
        </div>
      </div>

      {/* Notifications */}
      <Card className="border-border animate-fade-in" style={{ animationDelay: "0.1s", opacity: 0 }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { id: "analysis", label: "Analysis Complete", description: "Get notified when your file analysis finishes", checked: analysisComplete, onChange: setAnalysisComplete },
            { id: "weekly", label: "Weekly Report", description: "Receive a weekly summary of your analyses", checked: weeklyReport, onChange: setWeeklyReport },
            { id: "updates", label: "Product Updates", description: "News about new features and improvements", checked: productUpdates, onChange: setProductUpdates },
          ].map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <Label htmlFor={item.id} className="text-sm font-medium cursor-pointer">{item.label}</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">{item.description}</p>
              </div>
              <Switch
                id={item.id}
                checked={item.checked}
                onCheckedChange={item.onChange}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card className="border-border animate-fade-in" style={{ animationDelay: "0.15s", opacity: 0 }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sun className="h-4 w-4 text-primary" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isActive = theme === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    applyTheme(option.value);
                    toast({ title: "Theme updated", description: `Switched to ${option.label} mode.` });
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all min-h-0",
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/30"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{option.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card className="border-border animate-fade-in" style={{ animationDelay: "0.2s", opacity: 0 }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { id: "analytics", label: "Share Anonymous Analytics", description: "Help us improve by sharing anonymous usage data", checked: shareAnalytics, onChange: setShareAnalytics },
            { id: "public", label: "Public Profile", description: "Allow others to see your verification activity", checked: publicProfile, onChange: setPublicProfile },
          ].map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <Label htmlFor={item.id} className="text-sm font-medium cursor-pointer">{item.label}</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">{item.description}</p>
              </div>
              <Switch
                id={item.id}
                checked={item.checked}
                onCheckedChange={item.onChange}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="border-border animate-fade-in" style={{ animationDelay: "0.25s", opacity: 0 }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Data Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-sm font-medium"
            onClick={() => toast({ title: "Coming soon", description: "Data export will be available in a future update." })}
          >
            <Download className="h-4 w-4 text-primary" />
            Export My Data
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-sm font-medium"
            onClick={() => toast({ title: "Coming soon", description: "Analysis history clearing will be available after auth is set up." })}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
            Clear Analysis History
          </Button>
          <Separator className="my-2" />
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sm font-medium text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => toast({ title: "Coming soon", description: "Account deletion will be available after authentication is set up." })}
          >
            <Trash2 className="h-4 w-4" />
            Delete Account
          </Button>
        </CardContent>
      </Card>

      <div className="pb-4" />
    </div>
  );
};

export default Settings;
