import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
const variants = cva("btn", {
  variants: {
    variant: {
      default: "primary",
      outline: "outline",
      destructive: "danger",
      ghost: "ghost",
    },
  },
  defaultVariants: { variant: "outline" },
});
export function Button({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof variants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={twMerge(clsx(variants({ variant }), className))}
      {...props}
    />
  );
}
