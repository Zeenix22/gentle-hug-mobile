import { User, Mail, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const Profile = () => {
  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your account settings.</p>
      </div>

      {/* Profile Card */}
      <Card className="border-border">
        <CardContent className="flex items-center gap-4 p-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
              TB
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-foreground">Guest User</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" />
              Sign in to save your analyses
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Usage Stats */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Usage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Total Analyses", value: "0" },
            { label: "This Month", value: "0" },
            { label: "Plan", value: "Free" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium text-foreground">{item.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
