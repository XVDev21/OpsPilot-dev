import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-sm font-semibold transition-[background-color,color,border-color,box-shadow,transform] duration-180 ease-out disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-[0_8px_22px_color-mix(in_srgb,var(--primary)_24%,transparent)] hover:bg-primary-hover",
        secondary:
          "border border-border-strong bg-surface-raised text-foreground shadow-[var(--shadow-sm)] hover:border-primary/45 hover:bg-surface-accent",
        ghost: "text-foreground-muted hover:bg-surface-soft hover:text-foreground",
        quiet: "bg-surface-soft text-foreground hover:bg-surface-accent",
        danger: "bg-danger text-white hover:brightness-95",
      },
      size: {
        default: "h-11",
        sm: "h-10 min-h-10 px-3 text-[0.8125rem]",
        lg: "h-12 min-h-12 px-5 text-[0.9375rem]",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
