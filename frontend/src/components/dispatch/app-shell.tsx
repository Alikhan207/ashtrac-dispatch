import { appConfig } from "@/utils/app-config";

interface AppShellProps {
  children: React.ReactNode;
  right?: React.ReactNode;
}

const AppShell = ({ children, right }: AppShellProps) => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-baseline gap-3">
            <span className="text-[15px] font-semibold tracking-tight text-foreground">
              {appConfig.name}
            </span>
            <span className="hidden sm:inline text-xs text-muted-foreground">
              {appConfig.tagline}
            </span>
          </div>
          {right}
        </div>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
};

export default AppShell;
