declare module "*.mdx" {
  import type { ComponentType } from "react"
  const MDXContent: ComponentType<{ components?: Record<string, ComponentType> }>
  export default MDXContent
  export const frontmatter: Record<string, string | undefined>
}
