import { Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Register = () => {
  return (
    <div className="px-4 py-10 max-w-sm mx-auto flex flex-col items-center">
      <Shield className="h-12 w-12 text-primary mb-4" />
      <Card className="w-full border-border">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">Create Account</CardTitle>
          <p className="text-sm text-muted-foreground">Start verifying media authenticity</p>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">Registration form coming in Phase 5</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;
