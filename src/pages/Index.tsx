import {
  Shield,
  Upload,
  BarChart3,
  FileSearch,
  ArrowRight,
  Fingerprint,
  ScanEye,
  Lock,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import TrustScore from "@/components/ui/trust-score";
import StatusBadge from "@/components/ui/status-badge";

const features = [
  {
    icon: ScanEye,
    title: "Deepfake Detection",
    description: "Advanced AI identifies manipulated faces, voice clones, and synthetic media with high confidence.",
  },
  {
    icon: Fingerprint,
    title: "EXIF & Metadata Analysis",
    description: "Extract and cross-reference metadata to detect hidden inconsistencies and tampering signs.",
  },
  {
    icon: BarChart3,
    title: "Confidence Scoring",
    description: "Get clear percentage-based authenticity scores with detailed AI-powered explanations.",
  },
  {
    icon: Lock,
    title: "Hash Verification",
    description: "Generate and compare cryptographic hashes to verify file integrity and detect modifications.",
  },
];

const steps = [
  { number: "01", title: "Upload", description: "Drop any image, video, or document" },
  { number: "02", title: "Analyze", description: "AI scans for manipulations in seconds" },
  { number: "03", title: "Results", description: "Get a detailed authenticity report" },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative px-4 pt-10 pb-12 text-center overflow-hidden">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

        <div className="relative mx-auto max-w-lg">
          {/* Badge */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary animate-fade-in">
            <Shield className="h-4 w-4" />
            AI-Powered Verification
          </div>

          {/* Heading */}
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl animate-fade-in" style={{ animationDelay: "0.1s", opacity: 0 }}>
            Verify Media{" "}
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Authenticity
            </span>
          </h1>

          <p className="mb-8 text-base text-muted-foreground leading-relaxed max-w-md mx-auto animate-fade-in" style={{ animationDelay: "0.2s", opacity: 0 }}>
            Detect deepfakes, photoshop edits, and digital manipulations with advanced AI. Know what's real.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center animate-fade-in" style={{ animationDelay: "0.3s", opacity: 0 }}>
            <Button
              size="xl"
              variant="trust"
              onClick={() => navigate("/upload")}
              className="gap-2 font-semibold"
            >
              <Upload className="h-5 w-5" />
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

        {/* Demo Score */}
        <div className="mt-10 flex justify-center animate-slide-up" style={{ animationDelay: "0.5s", opacity: 0 }}>
          <Card className="border-border shadow-lg inline-flex">
            <CardContent className="flex items-center gap-5 p-5">
              <TrustScore score={94} level="authentic" size="sm" />
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground mb-1">sample_photo.jpg</p>
                <StatusBadge status="authentic" size="sm" />
                <p className="text-[10px] text-muted-foreground mt-1.5">Analyzed 2 seconds ago</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="px-4 pb-10">
        <div className="mx-auto max-w-lg grid grid-cols-3 gap-3">
          {[
            { value: "50K+", label: "Files Analyzed", delay: "0.1s" },
            { value: "99.2%", label: "Accuracy Rate", delay: "0.2s" },
            { value: "< 30s", label: "Avg. Speed", delay: "0.3s" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl bg-card border border-border p-4 text-center hover:border-primary/20 transition-all duration-200 hover:shadow-sm animate-fade-in"
              style={{ animationDelay: stat.delay, opacity: 0 }}
            >
              <div className="text-xl font-extrabold text-primary">{stat.value}</div>
              <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works - Steps */}
      <section className="px-4 pb-10">
        <div className="mx-auto max-w-lg">
          <h2 className="text-xl font-bold text-foreground mb-6 text-center">
            How It Works
          </h2>
          <div className="flex flex-col gap-4">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className="flex items-center gap-4 animate-fade-in"
                style={{ animationDelay: `${0.1 + index * 0.15}s`, opacity: 0 }}
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-extrabold text-primary">{step.number}</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{step.title}</h3>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-4 pb-10">
        <div className="mx-auto max-w-lg">
          <h2 className="text-xl font-bold text-foreground mb-2 text-center">
            Powerful Features
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Everything you need to verify digital media
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={feature.title}
                  className="border-border hover:border-primary/20 transition-all duration-200 hover:shadow-sm group animate-fade-in"
                  style={{ animationDelay: `${0.1 + index * 0.1}s`, opacity: 0 }}
                >
                  <CardContent className="p-4">
                    <div className="rounded-lg bg-primary/10 p-2.5 inline-flex mb-3 group-hover:bg-primary/15 transition-colors">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="px-4 pb-10">
        <div className="mx-auto max-w-lg">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-primary/10 p-3 animate-float">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                Ready to verify?
              </h3>
              <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
                Upload any image, video, or document and get instant AI-powered analysis.
              </p>
              <Button
                variant="trust"
                size="lg"
                onClick={() => navigate("/upload")}
                className="gap-2 font-semibold"
              >
                <Upload className="h-4 w-4" />
                Start Analyzing
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 pb-24 pt-4 border-t border-border">
        <div className="mx-auto max-w-lg flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium">Truth Buddy</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            © 2026 All rights reserved
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
