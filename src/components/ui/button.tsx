import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:-translate-y-px",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_16px_hsl(172_100%_38%/0.3)] rounded-lg font-semibold",
        destructive: "bg-transparent text-destructive border border-destructive/30 hover:bg-destructive/[0.08] hover:border-destructive/50 rounded-lg",
        outline: "border border-[hsl(0_0%_100%/0.15)] bg-transparent hover:border-[hsl(0_0%_100%/0.3)] hover:bg-[hsl(0_0%_100%/0.04)] text-foreground rounded-lg font-medium",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg",
        ghost: "hover:bg-[hsl(0_0%_100%/0.04)] text-muted-foreground hover:text-foreground rounded-lg",
        link: "text-primary underline-offset-4 hover:underline hover:translate-y-0",
        success: "bg-success text-success-foreground hover:bg-success/90 rounded-lg font-semibold",
        warning: "bg-warning text-warning-foreground hover:bg-warning/90 rounded-lg font-semibold",
      },
      size: {
        default: "h-10 px-5 py-2 text-[14px]",
        sm: "h-9 px-4 text-[13px]",
        lg: "h-12 px-7 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
