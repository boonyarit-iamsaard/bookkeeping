import { Button } from "@/shared/components/ui/button";

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center space-y-2 p-4">
        <h1 className="font-bold text-2xl">Welcome to Bookkeeping</h1>
        <Button>
          <span>Get Started</span>
        </Button>
      </div>
    </div>
  );
}
