import type React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"

import { cn } from "@/lib/utils"

export function Card({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">): React.ReactElement {
  const defaultProps = {
    className: cn(
      "relative flex flex-col rounded-2xl border border-white/8 bg-[#0e0e10] text-white shadow-[0_32px_80px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)] overflow-hidden",
      className
    ),
    "data-slot": "card",
  }

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  })
}

export function CardFrame({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">): React.ReactElement {
  const defaultProps = {
    className: cn(
      "relative flex flex-col rounded-2xl border border-white/8 bg-[#0e0e10] text-white shadow-[0_32px_80px_rgba(0,0,0,0.7)] [--clip-bottom:-1rem] [--clip-top:-1rem] overflow-hidden",
      className
    ),
    "data-slot": "card-frame",
  }

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  })
}

export function CardFrameHeader({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">): React.ReactElement {
  const defaultProps = {
    className: cn(
      "grid auto-rows-min grid-rows-[auto_auto] items-start gap-x-4 px-6 py-4 has-data-[slot=card-frame-action]:grid-cols-[1fr_auto]",
      className
    ),
    "data-slot": "card-frame-header",
  }

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  })
}

export function CardFrameTitle({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">): React.ReactElement {
  const defaultProps = {
    className: cn("self-center text-sm font-semibold text-white", className),
    "data-slot": "card-frame-title",
  }

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  })
}

export function CardFrameDescription({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">): React.ReactElement {
  const defaultProps = {
    className: cn("self-center text-sm text-gray-400", className),
    "data-slot": "card-frame-description",
  }

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  })
}

export function CardFrameAction({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">): React.ReactElement {
  const defaultProps = {
    className: cn(
      "col-start-2 inline-flex self-center justify-self-end",
      className
    ),
    "data-slot": "card-frame-action",
  }

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  })
}

export function CardFrameFooter({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">): React.ReactElement {
  const defaultProps = {
    className: cn("px-6 py-4 border-t border-white/8", className),
    "data-slot": "card-frame-footer",
  }

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  })
}

export function CardHeader({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">): React.ReactElement {
  const defaultProps = {
    className: cn(
      "grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 p-6 has-data-[slot=card-action]:grid-cols-[1fr_auto]",
      className
    ),
    "data-slot": "card-header",
  }

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  })
}

export function CardTitle({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">): React.ReactElement {
  const defaultProps = {
    className: cn("text-lg leading-none font-bold tracking-tight text-white", className),
    "data-slot": "card-title",
  }

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  })
}

export function CardDescription({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">): React.ReactElement {
  const defaultProps = {
    className: cn("text-sm text-gray-400 leading-relaxed", className),
    "data-slot": "card-description",
  }

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  })
}

export function CardAction({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">): React.ReactElement {
  const defaultProps = {
    className: cn(
      "col-start-2 row-span-2 row-start-1 inline-flex self-start justify-self-end",
      className
    ),
    "data-slot": "card-action",
  }

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  })
}

export function CardPanel({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">): React.ReactElement {
  const defaultProps = {
    className: cn(
      "flex-1 p-6",
      className
    ),
    "data-slot": "card-panel",
  }

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  })
}

export function CardFooter({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">): React.ReactElement {
  const defaultProps = {
    className: cn(
      "flex items-center gap-3 p-6 border-t border-white/8",
      className
    ),
    "data-slot": "card-footer",
  }

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  })
}

export { CardPanel as CardContent }

export default Card
