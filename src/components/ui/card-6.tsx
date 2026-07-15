import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface WaitlistCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode;
  title: string;
  description: string;
  footerContent?: React.ReactNode;
}

const WaitlistCard = React.forwardRef<HTMLDivElement, WaitlistCardProps>(
  ({ className, icon, title, description, footerContent, ...props }, ref) => {
    const titleId = React.useId();

    // Animation variants for the container to stagger children
    const containerVariants = {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: 0.15, // Delay between each child animation
        },
      },
    };

    // Animation variants for each child item
    const itemVariants = {
      hidden: { opacity: 0, y: 20 },
      visible: {
        opacity: 1,
        y: 0,
        transition: {
          duration: 0.5,
        },
      },
    };

    return (
      <motion.div
        initial="hidden"
        animate="visible"
        exit="hidden"
        variants={containerVariants}
        ref={ref}
        className="w-full max-w-md mx-auto"
      >
        <Card
          className={cn("w-full text-center border-red-500/30 bg-black/80 backdrop-blur-md shadow-[0_0_50px_rgba(255,0,80,0.2)]", className)}
          role="region"
          aria-labelledby={titleId}
          {...props}
        >
          <CardHeader className="items-center">
            <motion.div variants={itemVariants}>
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 text-red-500 border border-red-500/30">
                {icon}
              </div>
            </motion.div>
            <motion.div variants={itemVariants}>
              <CardTitle id={titleId} className="text-red-500 font-display font-black tracking-widest uppercase text-2xl">{title}</CardTitle>
            </motion.div>
          </CardHeader>
          <CardContent>
            <motion.p variants={itemVariants}>
              <CardDescription className="text-gray-400 font-mono tracking-wider uppercase leading-relaxed text-sm">
                {description}
              </CardDescription>
            </motion.p>
          </CardContent>
          {footerContent && (
            <CardFooter className="flex justify-center pt-4">
              <motion.div variants={itemVariants}>{footerContent}</motion.div>
            </CardFooter>
          )}
        </Card>
      </motion.div>
    );
  }
);

WaitlistCard.displayName = "WaitlistCard";

export { WaitlistCard };
