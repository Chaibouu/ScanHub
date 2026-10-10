import { cn } from "@/lib/utils";

interface LoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

const Loader = ({ size = "md", className, text }: LoaderProps) => {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-16 w-16",
    lg: "h-24 w-24",
  };

  return (
    <div className={cn("flex h-screen items-center justify-center bg-background", className)}>
      <div className="flex flex-col items-center space-y-4">
        <div
          className={cn(
            "animate-spin rounded-full border-4 border-solid border-primary border-t-transparent",
            sizeClasses[size]
          )}
        />
        {text && (
          <p className="text-sm text-muted-foreground animate-pulse">
            {text}
          </p>
        )}
      </div>
    </div>
  );
};

export { Loader };
