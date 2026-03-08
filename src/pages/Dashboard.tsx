import { Upload, Clock, BarChart3, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welcome back! Here's your overview.</p>
      </div>

      {/* Quick Upload */}
      <Button
        onClick={() => navigate("/upload")}
        className="w-full gap-2 font-semibold h-12"
        size="lg"
      >
        <Upload className="h-5 w-5" />
        Upload New File
      </Button>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Total Analyses", value: "0", icon: BarChart3 },
          { label: "This Month", value: "0", icon: Clock },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Analyses */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            Recent Analyses
            <Button variant="ghost" size="sm" onClick={() => navigate("/history")} className="text-xs gap-1 text-primary">
              View All <ArrowRight className="h-3 w-3" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No analyses yet</p>
            <p className="text-xs text-muted-foreground/70">Upload a file to get started</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
