import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Mail,
  Camera,
  BarChart3,
  Settings,
  Shield,
  Crown,
  ChevronRight,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import AnimatedProgress from "@/components/ui/animated-progress";
import { toast } from "@/hooks/use-toast";
import { mockAnalysisResults } from "@/data/mock-analyses";

const Profile = () => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("Guest User");
  const [email] = useState("guest@truthbuddy.app");
  const [editName, setEditName] = useState(displayName);

  const totalAnalyses = mockAnalysisResults.length;
  const authenticCount = mockAnalysisResults.filter((a) => a.authenticityLevel === "authentic").length;
  const flaggedCount = totalAnalyses - authenticCount;

  const handleSave = () => {
    if (!editName.trim()) {
      toast({ title: "Name required", description: "Please enter a display name.", variant: "destructive" });
      return;
    }
    setDisplayName(editName.trim());
    setIsEditing(false);
    toast({ title: "Profile updated", description: "Your display name has been saved." });
  };

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your account and preferences.</p>
      </div>

      {/* Profile Card */}
      <Card className="border-border animate-fade-in" style={{ animationDelay: "0.1s", opacity: 0 }}>
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                  {displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <button
                className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md min-h-0 min-w-0 hover:bg-primary/90 transition-colors"
                onClick={() => toast({ title: "Coming soon", description: "Avatar upload will be available after authentication is set up." })}
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8 min-h-0 min-w-0 text-success" onClick={handleSave}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 min-h-0 min-w-0 text-muted-foreground" onClick={() => { setIsEditing(false); setEditName(displayName); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground">{displayName}</p>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-muted-foreground hover:text-primary min-h-0 min-w-0"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Mail className="h-3 w-3" />
                {email}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card className="border-border animate-fade-in" style={{ animationDelay: "0.15s", opacity: 0 }}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-warning/10 p-2">
                <Crown className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Free Plan</p>
                <p className="text-[10px] text-muted-foreground">10 analyses / month</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs font-medium gap-1"
              onClick={() => toast({ title: "Coming soon", description: "Plan upgrades will be available soon." })}
            >
              Upgrade <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          <div className="mt-3">
            <AnimatedProgress value={totalAnalyses} max={10} showLabel size="sm" variant={totalAnalyses > 7 ? "warning" : "default"} />
            <p className="text-[10px] text-muted-foreground mt-1">{totalAnalyses} of 10 analyses used this month</p>
          </div>
        </CardContent>
      </Card>

      {/* Usage Stats */}
      <Card className="border-border animate-fade-in" style={{ animationDelay: "0.2s", opacity: 0 }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Usage Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Total Analyses", value: String(totalAnalyses) },
            { label: "Files Marked Authentic", value: String(authenticCount) },
            { label: "Files Flagged", value: String(flaggedCount) },
            { label: "Member Since", value: "March 2026" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground text-xs">{item.label}</span>
              <span className="font-medium text-foreground text-xs">{item.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="space-y-2 animate-fade-in" style={{ animationDelay: "0.25s", opacity: 0 }}>
        {[
          { label: "Settings & Preferences", icon: Settings, path: "/settings" },
          { label: "Help & Support", icon: Shield, path: "/help" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/20 hover:shadow-sm transition-all min-h-[44px]"
            >
              <div className="rounded-lg bg-primary/10 p-2">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground flex-1 text-left">{item.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          );
        })}
      </div>

      <div className="pb-4" />
    </div>
  );
};

export default Profile;
