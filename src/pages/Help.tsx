import { useState } from "react";
import {
  HelpCircle,
  ChevronRight,
  Search,
  BookOpen,
  Video,
  ShieldCheck,
  FileWarning,
  Eye,
  Fingerprint,
  Send,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "@/hooks/use-toast";

const faqs = [
  { question: "What file types are supported?", answer: "Truth Buddy supports images (JPG, PNG, GIF, WEBP), videos (MP4, MOV, AVI), and documents (PDF, DOC, DOCX). Maximum file size is 50MB." },
  { question: "How accurate is the analysis?", answer: "Our AI-powered analysis achieves over 99% accuracy for common manipulation techniques. Results include a confidence score to help you assess reliability." },
  { question: "Is my data secure?", answer: "Yes! Files are encrypted during upload and analysis. We never share your files or results with third parties, and you can delete your data at any time." },
  { question: "What is a confidence score?", answer: "The confidence score (0-100%) indicates how certain our AI is about the analysis result. Higher scores mean greater confidence in the authenticity determination." },
  { question: "Can I analyze multiple files at once?", answer: "Yes! Our batch processing feature lets you upload and analyze up to 10 files simultaneously. Results are provided individually for each file." },
  { question: "How does deepfake detection work?", answer: "We use advanced neural networks that analyze facial landmarks, lip-sync patterns, skin textures, and temporal consistency in videos to identify synthetic or manipulated content." },
  { question: "What is EXIF data?", answer: "EXIF (Exchangeable Image File Format) data is metadata embedded in photos by cameras and smartphones. It includes camera model, date taken, GPS coordinates, and settings. We analyze this data for inconsistencies that could indicate tampering." },
  { question: "Can I use Truth Buddy offline?", answer: "You can view previously analyzed results offline. However, new file analyses require an internet connection as processing happens on our secure cloud servers." },
];

const tutorials = [
  { icon: Eye, title: "Spotting Deepfakes", description: "Learn visual cues that indicate AI-generated faces and videos.", color: "bg-primary/10 text-primary" },
  { icon: Fingerprint, title: "Understanding Metadata", description: "How EXIF data reveals the history and origin of digital files.", color: "bg-success/10 text-success" },
  { icon: FileWarning, title: "Common Manipulation Techniques", description: "Recognize splicing, cloning, and other editing tricks.", color: "bg-warning/10 text-warning" },
  { icon: ShieldCheck, title: "Verification Best Practices", description: "A journalist's guide to verifying digital media sources.", color: "bg-destructive/10 text-destructive" },
];

const Help = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSubject, setContactSubject] = useState("");

  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactSubject.trim() || !contactMessage.trim()) {
      toast({ title: "Missing fields", description: "Please fill in subject and message.", variant: "destructive" });
      return;
    }
    toast({ title: "Message sent", description: "We'll get back to you within 24 hours." });
    setContactSubject("");
    setContactMessage("");
  };

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Help & Support</h1>
        <p className="text-sm text-muted-foreground">Find answers, learn, and get help.</p>
      </div>

      {/* Search */}
      <div className="relative animate-fade-in" style={{ animationDelay: "0.1s", opacity: 0 }}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search help topics..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* FAQ */}
      <div className="animate-fade-in" style={{ animationDelay: "0.15s", opacity: 0 }}>
        <h2 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-primary" />
          Frequently Asked Questions
        </h2>
        {filteredFaqs.length === 0 ? (
          <Card className="border-border">
            <CardContent className="py-8 text-center">
              <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No matching questions found</p>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="single" collapsible className="space-y-2">
            {filteredFaqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border border-border rounded-lg px-4"
              >
                <AccordionTrigger className="text-sm font-medium text-left py-3">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground leading-relaxed pb-3">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>

      {/* Educational Resources / Tutorials */}
      <div className="animate-fade-in" style={{ animationDelay: "0.2s", opacity: 0 }}>
        <h2 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          Learn & Explore
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {tutorials.map((tutorial) => {
            const Icon = tutorial.icon;
            return (
              <Card
                key={tutorial.title}
                className="border-border hover:border-primary/20 hover:shadow-sm transition-all cursor-pointer group"
                onClick={() => toast({ title: "Coming soon", description: `"${tutorial.title}" tutorial will be available soon.` })}
              >
                <CardContent className="p-4">
                  <div className={cn("rounded-lg p-2 inline-flex mb-2.5 transition-colors", tutorial.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-xs font-bold text-foreground mb-1 leading-tight">{tutorial.title}</h3>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{tutorial.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Video Tutorials Teaser */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent animate-fade-in" style={{ animationDelay: "0.25s", opacity: 0 }}>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="rounded-full bg-primary/10 p-3 shrink-0">
            <Video className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground">Video Tutorials</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Watch step-by-step guides on using Truth Buddy</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </CardContent>
      </Card>

      {/* Contact Form */}
      <div className="animate-fade-in" style={{ animationDelay: "0.3s", opacity: 0 }}>
        <h2 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
          <Send className="h-4 w-4 text-primary" />
          Contact Support
        </h2>
        <Card className="border-border">
          <CardContent className="p-4">
            <form onSubmit={handleContactSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="subject" className="text-xs font-medium">Subject</Label>
                <Input
                  id="subject"
                  placeholder="What do you need help with?"
                  value={contactSubject}
                  onChange={(e) => setContactSubject(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="message" className="text-xs font-medium">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Describe your issue or question..."
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  rows={4}
                />
              </div>
              <Button type="submit" variant="trust" className="w-full gap-2 font-semibold">
                <Send className="h-4 w-4" />
                Send Message
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="pb-4" />
    </div>
  );
};

export default Help;
