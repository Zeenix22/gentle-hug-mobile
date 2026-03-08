import { Shield, Upload, BarChart3, FileSearch, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

const features = [
  {
    icon: FileSearch,
    title: "Deepfake Detection",
    description: "Advanced AI algorithms identify manipulated faces and synthetic media.",
  },
  {
    icon: Shield,
    title: "EXIF Analysis",
    description: "Extract and verify metadata to detect hidden inconsistencies.",
  },
  {
    icon: BarChart3,
    title: "Confidence Scoring",
    description: "Get clear percentage-based authenticity scores with explanations.",
  },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative px-4 pt-8 pb-10 text-center">
        <div className="mx-auto max-w-lg">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <Shield className="h-4 w-4" />
            AI-Powered Verification
          </div>

          <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Verify Media
            <span className="text-primary"> Authenticity</span>
          </h1>

          <p className="mb-6 text-base text-muted-foreground leading-relaxed">
            Detect deepfakes, photoshop edits, and digital manipulations with advanced AI analysis. Trust what you see.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              onClick={() => navigate("/upload")}
              className="gap-2 font-semibold"
            >
              <Upload className="h-4 w-4" />
              Analyze a File
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/register")}
              className="gap-2 font-semibold"
            >
              Create Account
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="px-4 pb-8">
        <div className="mx-auto max-w-lg grid grid-cols-3 gap-3">
          {[
            { value: "50K+", label: "Files Analyzed" },
            { value: "99.2%", label: "Accuracy" },
            { value: "< 30s", label: "Avg. Time" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl bg-card border border-border p-3 text-center"
            >
              <div className="text-xl font-bold text-primary">{stat.value}</div>
              <div className="text-[11px] text-muted-foreground font-medium">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-4 pb-10">
        <div className="mx-auto max-w-lg space-y-3">
          <h2 className="text-lg font-bold text-foreground mb-4">
            How It Works
          </h2>
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="border-border">
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default Index;
