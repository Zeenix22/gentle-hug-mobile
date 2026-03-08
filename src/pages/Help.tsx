import { HelpCircle, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "What file types are supported?",
    answer: "Truth Buddy supports images (JPG, PNG, GIF, WEBP), videos (MP4, MOV, AVI), and documents (PDF, DOC, DOCX).",
  },
  {
    question: "How accurate is the analysis?",
    answer: "Our AI-powered analysis achieves over 99% accuracy for common manipulation techniques. Results include a confidence score to help you assess reliability.",
  },
  {
    question: "Is my data secure?",
    answer: "Yes! Files are encrypted during upload and analysis. We never share your files or results with third parties, and you can delete your data at any time.",
  },
  {
    question: "What is a confidence score?",
    answer: "The confidence score (0-100%) indicates how certain our AI is about the analysis result. Higher scores mean greater confidence in the authenticity determination.",
  },
  {
    question: "Can I analyze multiple files at once?",
    answer: "Yes! Our batch processing feature lets you upload and analyze multiple files simultaneously. Results are provided individually for each file.",
  },
];

const Help = () => {
  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Help & Support</h1>
        <p className="text-sm text-muted-foreground">Find answers and get help.</p>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-3">
          Frequently Asked Questions
        </h2>
        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`} className="border border-border rounded-lg px-4">
              <AccordionTrigger className="text-sm font-medium text-left">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground leading-relaxed">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      {/* Contact */}
      <Card className="border-border">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <HelpCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Need more help?</p>
              <p className="text-xs text-muted-foreground">Contact our support team</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </CardContent>
      </Card>
    </div>
  );
};

export default Help;
