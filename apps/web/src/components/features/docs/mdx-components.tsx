import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

function h1({ className, ...props }: ComponentProps<"h1">) {
  return (
    <h1
      className={cn(
        "scroll-m-20 text-4xl font-bold tracking-tight text-foreground mt-2 mb-6",
        className,
      )}
      {...props}
    />
  )
}

function h2({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "scroll-m-20 text-2xl font-semibold tracking-tight text-foreground mt-12 mb-4 border-b border-border pb-2 [&>a]:no-underline [&>a]:text-foreground",
        className,
      )}
      {...props}
    />
  )
}

function h3({ className, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      className={cn(
        "scroll-m-20 text-xl font-semibold tracking-tight text-foreground mt-8 mb-3 [&>a]:no-underline [&>a]:text-foreground",
        className,
      )}
      {...props}
    />
  )
}

function h4({ className, ...props }: ComponentProps<"h4">) {
  return (
    <h4
      className={cn(
        "scroll-m-20 text-lg font-semibold tracking-tight text-foreground mt-6 mb-2 [&>a]:no-underline [&>a]:text-foreground",
        className,
      )}
      {...props}
    />
  )
}

function p({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("leading-7 text-foreground/80 mb-4 not-first:mt-0", className)}
      {...props}
    />
  )
}

function a({ className, ...props }: ComponentProps<"a">) {
  return (
    <a
      className={cn(
        "font-medium text-blue underline underline-offset-4 hover:text-blue/80 transition-colors",
        className,
      )}
      {...props}
    />
  )
}

function ul({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul className={cn("my-4 ml-6 list-disc space-y-1.5 text-foreground/80", className)} {...props} />
  )
}

function ol({ className, ...props }: ComponentProps<"ol">) {
  return (
    <ol
      className={cn("my-4 ml-6 list-decimal space-y-1.5 text-foreground/80", className)}
      {...props}
    />
  )
}

function li({ className, ...props }: ComponentProps<"li">) {
  return <li className={cn("leading-7", className)} {...props} />
}

function blockquote({ className, ...props }: ComponentProps<"blockquote">) {
  return (
    <blockquote
      className={cn(
        "mt-4 mb-4 border-l-2 border-blue pl-4 italic text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}

function code({ className, ...props }: ComponentProps<"code">) {
  const isInline = !className?.includes("language-")
  if (isInline) {
    return (
      <code
        className={cn(
          "relative rounded-md bg-muted px-[0.4em] py-[0.2em] font-mono text-[0.875em] font-medium text-foreground",
          className,
        )}
        {...props}
      />
    )
  }
  return <code className={cn("font-mono text-sm", className)} {...props} />
}

function pre({ className, ...props }: ComponentProps<"pre">) {
  return (
    <pre
      className={cn(
        "my-4 overflow-x-auto rounded-xl border border-border bg-card px-4 py-4 font-mono text-sm leading-relaxed",
        className,
      )}
      {...props}
    />
  )
}

function hr({ className, ...props }: ComponentProps<"hr">) {
  return <hr className={cn("my-8 border-border", className)} {...props} />
}

function table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="my-6 w-full overflow-x-auto rounded-xl border border-border">
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  )
}

function thead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("border-b border-border bg-muted/50", className)} {...props} />
}

function tbody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("[&>tr:last-child]:border-0", className)} {...props} />
}

function tr({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn("border-b border-border transition-colors hover:bg-muted/30", className)}
      {...props}
    />
  )
}

function th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "h-10 px-4 text-left align-middle font-semibold text-foreground not-last:border-r not-last:border-border",
        className,
      )}
      {...props}
    />
  )
}

function td({ className, ...props }: ComponentProps<"td">) {
  return (
    <td
      className={cn(
        "px-4 py-2.5 align-middle text-foreground/80 not-last:border-r not-last:border-border",
        className,
      )}
      {...props}
    />
  )
}

function strong({ className, ...props }: ComponentProps<"strong">) {
  return <strong className={cn("font-semibold text-foreground", className)} {...props} />
}

export const mdxComponents = {
  h1,
  h2,
  h3,
  h4,
  p,
  a,
  ul,
  ol,
  li,
  blockquote,
  code,
  pre,
  hr,
  table,
  thead,
  tbody,
  tr,
  th,
  td,
  strong,
}
