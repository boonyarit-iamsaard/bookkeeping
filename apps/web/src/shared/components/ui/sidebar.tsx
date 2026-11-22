import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "cn";
import { PanelLeftIcon } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";

// shadcn's sidebar, cut to the desktop shell's use: it only renders from
// 1024px, where it collapses to icons. Phones keep their own chrome, so the
// mobile sheet, the offcanvas and floating variants, and the parts the shell
// does not use are gone. The device remembers the choice, as it does
// Appearance, in local storage rather than shadcn's cookie.

const SIDEBAR_STORAGE_KEY = "bookkeeping.sidebar";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

interface SidebarContextProps {
  state: "expanded" | "collapsed";
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextProps | null>(null);

function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return context;
}

/** Open unless this device last left it collapsed. */
function readSidebarOpen() {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) !== "collapsed";
  } catch {
    return true;
  }
}

function writeSidebarOpen(open: boolean) {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, open ? "expanded" : "collapsed");
  } catch {
    // Blocked site data: the choice lasts as long as the page.
  }
}

function SidebarProvider({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const [open, setOpen] = useState(readSidebarOpen);

  const toggleSidebar = useCallback(() => {
    setOpen((wasOpen) => {
      writeSidebarOpen(!wasOpen);
      return !wasOpen;
    });
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  const contextValue = useMemo<SidebarContextProps>(
    () => ({ state: open ? "expanded" : "collapsed", toggleSidebar }),
    [open, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-wrapper"
        className={cn("group/sidebar-wrapper flex min-h-svh w-full", className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

/** Collapses to its icons; the gap beside it keeps the page out from under it. */
function Sidebar({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const { state } = useSidebar();
  return (
    <div
      className="group peer text-foreground"
      data-state={state}
      data-collapsible={state === "collapsed" ? "icon" : ""}
      data-slot="sidebar"
    >
      <div
        data-slot="sidebar-gap"
        className="relative w-60 bg-transparent transition-[width] duration-200 ease-linear group-data-[collapsible=icon]:w-14 motion-reduce:transition-none"
      />
      <div
        data-slot="sidebar-container"
        className={cn(
          "fixed inset-y-0 left-0 z-10 flex h-svh w-60 border-r transition-[width] duration-200 ease-linear group-data-[collapsible=icon]:w-14 motion-reduce:transition-none",
          className,
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="bg-chrome flex size-full flex-col"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function SidebarTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { state, toggleSidebar } = useSidebar();
  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon"
      aria-label={state === "expanded" ? "Collapse sidebar" : "Expand sidebar"}
      aria-keyshortcuts="Control+B Meta+B"
      className={className}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <PanelLeftIcon aria-hidden="true" strokeWidth={1.75} />
    </Button>
  );
}

/** A thin edge to click; the trigger is the keyboard's way, so this skips the tab order. */
function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      type="button"
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-hidden="true"
      tabIndex={-1}
      onClick={toggleSidebar}
      className={cn(
        "hover:after:bg-border absolute inset-y-0 -right-4 z-20 flex w-4 -translate-x-1/2 cursor-w-resize transition-all ease-linear group-data-[state=collapsed]:cursor-e-resize after:absolute after:inset-y-0 after:left-1/2 after:w-0.5",
        className,
      )}
      {...props}
    />
  );
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  );
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      {...props}
    />
  );
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      {...props}
    />
  );
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn("group/menu-item relative", className)}
      {...props}
    />
  );
}

// The link's own `data-status` marks the current destination with the tonal
// Iris pill, as the old header's nav links did.
const sidebarMenuButtonClass =
  "text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/45 data-[status=active]:bg-secondary data-[status=active]:text-secondary-foreground flex h-10 w-full items-center gap-3 overflow-hidden rounded-md px-3 text-left text-sm font-semibold outline-none transition-[width,padding,background-color,color] duration-150 group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:px-3 focus-visible:ring-[3px] motion-reduce:transition-none [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate";

interface SidebarMenuButtonProps
  extends useRender.ComponentProps<"button">,
    Omit<React.ComponentProps<"button">, "children"> {
  children?: React.ReactNode;
  /** Named beside the icon when collapsed, where the word is hidden. */
  tooltip: string;
}

function SidebarMenuButton({
  render,
  tooltip,
  className,
  ...props
}: Readonly<SidebarMenuButtonProps>) {
  const { state } = useSidebar();
  const button = useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      { className: cn(sidebarMenuButtonClass, className) },
      props,
    ),
    render: <TooltipTrigger render={render} />,
  });

  return (
    <Tooltip>
      {button}
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== "collapsed"}
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
};
