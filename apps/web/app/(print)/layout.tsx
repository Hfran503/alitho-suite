export default function PrintLayout({ children }: { children: React.ReactNode }) {
  // Minimal layout for print pages - no wrapper, just children
  return <>{children}</>
}
