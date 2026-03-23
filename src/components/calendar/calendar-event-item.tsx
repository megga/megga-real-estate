/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { cn } from "@/lib/utils";
import { format, isPast } from "date-fns";
import type {
  CalendarEvent,
  CalendarEventItemProps,
  EventColor,
  VisitStatus,
} from "@/components/calendar/week-view-types";
import { EventContextMenu } from "@/components/calendar/event-context-menu";
import { Check, X as XIcon } from "lucide-react";

/** Small inline status indicator for visit events */
function VisitStatusBadge({ status }: { status?: VisitStatus }) {
  if (!status || status === "planned") return null;
  if (status === "confirmed") return <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />;
  if (status === "done") return <Check className="w-2.5 h-2.5 text-emerald-400 shrink-0" />;
  if (status === "no_show") return <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />;
  if (status === "cancelled") return <XIcon className="w-2.5 h-2.5 opacity-50 shrink-0" />;
  return null;
}

export const eventColorStyles: Record<
  EventColor,
  {
    bg: string;
    bgHover: string;
    border: string;
    borderLine: string;
    text: string;
  }
> = {
  red: {
    bg: "bg-event-red-bg",
    bgHover: "hover:bg-event-red-bg/70",
    border: "bg-event-red-border",
    borderLine: "border-event-red-border",
    text: "text-event-red",
  },
  orange: {
    bg: "bg-event-orange-bg",
    bgHover: "hover:bg-event-orange-bg/70",
    border: "bg-event-orange-border",
    borderLine: "border-event-orange-border",
    text: "text-event-orange",
  },
  yellow: {
    bg: "bg-event-yellow-bg",
    bgHover: "hover:bg-event-yellow-bg/70",
    border: "bg-event-yellow-border",
    borderLine: "border-event-yellow-border",
    text: "text-event-yellow",
  },
  green: {
    bg: "bg-event-green-bg",
    bgHover: "hover:bg-event-green-bg/70",
    border: "bg-event-green-border",
    borderLine: "border-event-green-border",
    text: "text-event-green",
  },
  blue: {
    bg: "bg-event-blue-bg",
    bgHover: "hover:bg-event-blue-bg/70",
    border: "bg-event-blue-border",
    borderLine: "border-event-blue-border",
    text: "text-event-blue",
  },
  purple: {
    bg: "bg-event-purple-bg",
    bgHover: "hover:bg-event-purple-bg/70",
    border: "bg-event-purple-border",
    borderLine: "border-event-purple-border",
    text: "text-event-purple",
  },
  gray: {
    bg: "bg-event-gray-bg",
    bgHover: "hover:bg-event-gray-bg/70",
    border: "bg-event-gray-border",
    borderLine: "border-event-gray-border",
    text: "text-event-gray",
  },
};

/**
 * Formats time showing only minutes if not on the hour
 * e.g., "10" for 10:00, "2:45" for 2:45
 */
function formatTimeShort(date: Date): string {
  const minutes = date.getMinutes();
  if (minutes === 0) {
    return format(date, "h");
  }
  return format(date, "h:mm");
}

/**
 * Formats event time as a compact range like "10–11 AM" or "11 AM–2 PM"
 */
function formatEventTimeRange(event: CalendarEvent): string {
  const startTime = formatTimeShort(event.start);
  const endTime = formatTimeShort(event.end);
  const endPeriod = format(event.end, "a");
  const startPeriod = format(event.start, "a");

  // If same period (both AM or both PM), only show period at the end
  if (startPeriod === endPeriod) {
    return `${startTime}\u2013${endTime} ${endPeriod}`;
  }

  // Different periods, show both
  return `${startTime} ${startPeriod}\u2013${endTime} ${endPeriod}`;
}

function computeOverrideStyle(
  positionedEvent: CalendarEventItemProps["positionedEvent"],
  hourHeight: number,
  overrideStart: Date,
  overrideEnd: Date,
) {
  const startMinutes =
    overrideStart.getHours() * 60 + overrideStart.getMinutes();
  let endMinutes = overrideEnd.getHours() * 60 + overrideEnd.getMinutes();
  // If end is midnight and on a different day than start, treat as 1440 (end of day)
  if (endMinutes === 0 && overrideEnd.getDate() !== overrideStart.getDate()) {
    endMinutes = 1440;
  }
  const topPx = (startMinutes / 60) * hourHeight;
  const heightPx = ((endMinutes - startMinutes) / 60) * hourHeight;

  return {
    top: `${topPx}px`,
    height: `${heightPx}px`,
    left: `${positionedEvent.left}%`,
    width: `${positionedEvent.width}%`,
    minHeight: "20px",
  };
}

const RESIZE_HOTZONE_PX = 8;

export function CalendarEventItem({
  positionedEvent,
  hourHeight,
  isPast: isPastProp,
  isSelected,
  onClick,
  dragVariant = "default",
  overrideStart,
  overrideEnd,
  onDragMouseDown,
  onResizeMouseDown,
  onEventChange,
  cursorY,
  cursorX,
  fixedWidth,
  fixedHeight,
  onContextMenuOpenChange,
  onDuplicate,
  onDelete,
  hasConflict,
  className,
}: CalendarEventItemProps) {
  const { event, segmentPosition = "full" } = positionedEvent;
  const color = event.color ?? "blue";
  const styles = eventColorStyles[color];
  const eventIsPast = isPastProp ?? isPast(event.end);

  const hasTopRounding =
    segmentPosition === "start" || segmentPosition === "full";
  const hasBottomRounding =
    segmentPosition === "end" || segmentPosition === "full";
  const showTopResize =
    segmentPosition === "start" || segmentPosition === "full";
  const showBottomResize =
    segmentPosition === "end" || segmentPosition === "full";

  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
  } | null>(null);

  const closeContextMenu = React.useCallback(() => {
    setContextMenu(null);
    onContextMenuOpenChange?.(false);
  }, [onContextMenuOpenChange]);

  const displayStart = overrideStart ?? event.start;
  const displayEnd = overrideEnd ?? event.end;

  const displayEvent: CalendarEvent =
    overrideStart && overrideEnd
      ? { ...event, start: displayStart, end: displayEnd }
      : event;

  const defaultStyle = {
    top: `${positionedEvent.top}%`,
    height: `${positionedEvent.height}%`,
    left: `${positionedEvent.left}%`,
    width: `${positionedEvent.width}%`,
    minHeight: "20px",
    zIndex: isSelected ? 20 : positionedEvent.column,
  };

  const posStyle =
    overrideStart && overrideEnd
      ? computeOverrideStyle(
          positionedEvent,
          hourHeight,
          overrideStart,
          overrideEnd,
        )
      : defaultStyle;

  const heightInPixels =
    overrideStart && overrideEnd
      ? Number.parseFloat(String(posStyle.height))
      : (positionedEvent.height / 100) * 24 * hourHeight;
  const isCompact = heightInPixels < 40;

  if (dragVariant === "ghost") {
    return (
      <div
        className={cn(
          "absolute rounded-sm px-2 py-1 pointer-events-none opacity-30 overflow-hidden",
          className,
        )}
        style={{
          top: `${positionedEvent.top}%`,
          height: `${positionedEvent.height}%`,
          left: `${positionedEvent.left}%`,
          width: `${positionedEvent.width}%`,
          minHeight: "20px",
          zIndex: 15,
        }}
      >
        <div className="absolute inset-0 rounded-sm bg-white dark:bg-[#191919]" />
        <div className={cn("absolute inset-0 rounded-sm", styles.bg)} />
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[4px] rounded-l-md dark:bg-white dark:mix-blend-overlay",
            styles.border,
          )}
        />
        <div
          className={cn(
            "relative flex flex-col h-full pl-1 overflow-hidden",
            isCompact && "flex-row items-center gap-1",
          )}
        >
          <span
            className={cn(
              "font-medium text-[0.625rem] leading-tight break-words",
              styles.text,
              "dark:text-white/80",
            )}
          >
            {event.title}
          </span>
          {!isCompact && (
            <span
              className={cn(
                "text-[0.625rem] whitespace-nowrap",
                styles.text,
                "dark:text-white dark:mix-blend-overlay",
              )}
            >
              {formatEventTimeRange(event)}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (dragVariant === "placeholder") {
    return (
      <div
        className={cn(
          "absolute rounded-sm pointer-events-none border-2",
          styles.borderLine,
          className,
        )}
        style={{
          ...posStyle,
          left: "0%",
          width: "100%",
          zIndex: 25,
        }}
      />
    );
  }

  const isDraggingCopy = dragVariant === "dragging";

  if (isDraggingCopy) {
    const durationMinutes =
      (displayEnd.getTime() - displayStart.getTime()) / 60000;
    const heightPx = fixedHeight ?? (durationMinutes / 60) * hourHeight;

    const useFixed = cursorX != null && cursorY != null;

    const draggingStyle: React.CSSProperties = useFixed
      ? {
          position: "fixed",
          top: `${cursorY}px`,
          left: `${cursorX}px`,
          height: `${heightPx}px`,
          width: fixedWidth != null ? `${fixedWidth}px` : "200px",
          minHeight: "20px",
          zIndex: 30,
        }
      : {
          top: posStyle.top,
          height: `${heightPx}px`,
          left: `${positionedEvent.left}%`,
          width: `${positionedEvent.width}%`,
          minHeight: "20px",
          zIndex: 30,
        };

    return (
      <div
        tabIndex={-1}
        className={cn(
          "absolute rounded-sm px-2 py-1",
          "pointer-events-none cursor-grabbing",
          "overflow-hidden select-none opacity-80 shadow-lg",
          className,
        )}
        style={draggingStyle}
      >
        <div className="absolute inset-0 rounded-sm bg-white dark:bg-[#191919]" />
        <div className={cn("absolute inset-0 rounded-sm", styles.bg)} />
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[4px] rounded-l-md dark:bg-white dark:mix-blend-overlay",
            styles.border,
          )}
        />
        <div
          className={cn(
            "relative flex flex-col h-full pl-1 overflow-hidden",
            heightPx < 40 && "flex-row items-center gap-1",
          )}
        >
          <span className="font-medium text-[0.625rem] leading-tight break-words text-white dark:text-white flex items-center gap-0.5">
            {event.title}
          </span>
          {heightPx >= 40 && (
            <span className="text-[0.625rem] whitespace-nowrap text-white dark:text-white">
              {formatEventTimeRange(displayEvent)}
            </span>
          )}
        </div>
      </div>
    );
  }

  function handleMouseMove(e: React.MouseEvent) {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const height = rect.height;

    if (showTopResize && showBottomResize && height < RESIZE_HOTZONE_PX * 2) {
      target.style.cursor = "ns-resize";
      return;
    }

    if (showTopResize && offsetY <= RESIZE_HOTZONE_PX) {
      target.style.cursor = "ns-resize";
      return;
    }

    if (showBottomResize && offsetY >= height - RESIZE_HOTZONE_PX) {
      target.style.cursor = "ns-resize";
      return;
    }

    target.style.cursor = "pointer";
  }

  function handleMouseDown(e: React.MouseEvent) {
    e.stopPropagation();

    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const height = rect.height;

    if (showTopResize && showBottomResize && height < RESIZE_HOTZONE_PX * 2) {
      const edge = offsetY < height / 2 ? "top" : "bottom";
      onResizeMouseDown?.(e, event, edge);
      return;
    }

    if (showTopResize && offsetY <= RESIZE_HOTZONE_PX) {
      onResizeMouseDown?.(e, event, "top");
      return;
    }

    if (showBottomResize && offsetY >= height - RESIZE_HOTZONE_PX) {
      onResizeMouseDown?.(e, event, "bottom");
      return;
    }

    onDragMouseDown?.(e, event);
  }

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onClick) return;
    onClick(event);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onClick?.(event);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
    onContextMenuOpenChange?.(true);
  }

  const eventElement = (
    <div
      role="button"
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      className={cn(
        "absolute px-2 py-1",
        hasTopRounding && "rounded-t-md",
        hasBottomRounding && "rounded-b-md",
        "cursor-pointer hover:z-10 focus:outline-none focus-visible:outline-none",
        "overflow-hidden select-none",
        isSelected && "z-20",
        className,
      )}
      style={{
        ...posStyle,
        zIndex: isSelected ? 20 : positionedEvent.column,
      }}
    >
      {/* Solid background layer to prevent transparency bleed-through */}
      <div
        className={cn(
          "absolute inset-0 bg-white dark:bg-[#191919]",
          hasTopRounding && "rounded-t-md",
          hasBottomRounding && "rounded-b-md",
        )}
      />

      {/* Colored background layer - uses border color when selected */}
      <div
        className={cn(
          "absolute inset-0",
          hasTopRounding && "rounded-t-md",
          hasBottomRounding && "rounded-b-md",
          isSelected ? styles.border : styles.bg,
          eventIsPast && !isSelected && "opacity-60",
        )}
      />

      {/* Left border - hidden when selected (merges with bg) */}
      {!isSelected && (
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[4px] dark:bg-white dark:mix-blend-overlay",
            hasTopRounding && "rounded-tl-md",
            hasBottomRounding && "rounded-bl-md",
            styles.border,
            eventIsPast && "opacity-60",
          )}
        />
      )}
      <div
        className={cn(
          "relative flex flex-col h-full pl-1 overflow-hidden",
          isCompact && "flex-row items-center gap-1",
        )}
      >
        <span
          className={cn(
            "font-medium text-[0.625rem] leading-tight break-words flex items-center gap-0.5",
            isSelected
              ? "text-white dark:text-white"
              : cn(
                  styles.text,
                  "dark:text-white/80",
                  eventIsPast && "opacity-60",
                ),
            event.visitStatus === "cancelled" && "line-through opacity-50",
          )}
        >
          {event.title}
          <VisitStatusBadge status={event.visitStatus} />
          {hasConflict && (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 ml-0.5" title="Conflit horaire" />
          )}
        </span>
        {!isCompact && (
          <span
            className={cn(
              "text-[0.625rem] whitespace-nowrap",
              isSelected
                ? "text-white dark:text-white"
                : cn(
                    styles.text,
                    "dark:text-white dark:mix-blend-overlay",
                    eventIsPast && "opacity-60 dark:opacity-100",
                  ),
            )}
          >
            {formatEventTimeRange(displayEvent)}
          </span>
        )}
      </div>
    </div>
  );


  return (
    <>
      {eventElement}
      {contextMenu && (
        <EventContextMenu
          event={event}
          position={contextMenu}
          onClose={closeContextMenu}
          onEventChange={onEventChange}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      )}
    </>
  );
}

/** Drag visual variant for all-day events */
export type AllDayDragVariant = "ghost" | "placeholder" | "dragging";

export interface AllDayEventItemProps {
  event: CalendarEvent;
  isPast?: boolean;
  isSelected?: boolean;
  onClick?: (event: CalendarEvent) => void;
  className?: string;
  /** For multi-day events: position info */
  spanStart?: boolean;
  spanEnd?: boolean;
  /** Mousedown handler to initiate horizontal resize or drag */
  onResizeMouseDown?: (
    e: React.MouseEvent,
    event: CalendarEvent,
    edge: "left" | "right" | "move",
  ) => void;
  /** Callback when an event is changed (e.g. color change from context menu) */
  onEventChange?: (event: CalendarEvent) => void;
  /** Callback when context menu open state changes */
  onContextMenuOpenChange?: (open: boolean) => void;
  /** Callback to duplicate an event */
  onDuplicate?: (event: CalendarEvent) => void;
  /** Callback to delete an event */
  onDelete?: (eventId: string) => void;
  /**
   * Percentage of the event's width that is hidden off-screen to the left.
   * Used in day view to offset the title into the visible area so multi-day
   * events always show their title \u2014 \u201csticky title\u201d effect.
   */
  titleOffsetPercent?: number;
  /** Visual variant during drag operations */
  dragVariant?: AllDayDragVariant;
}

/**
 * Formats start time for all-day events like "8:45 AM" or "4 PM"
 */
function formatAllDayStartTime(date: Date): string {
  const minutes = date.getMinutes();
  if (minutes === 0) {
    return format(date, "h a");
  }
  return format(date, "h:mm a");
}

const ALL_DAY_RESIZE_HOTZONE_PX = 6;

export function AllDayEventItem({
  event,
  isPast: isPastProp,
  isSelected,
  onClick,
  className,
  spanStart = true,
  spanEnd = true,
  onResizeMouseDown,
  onEventChange,
  onContextMenuOpenChange,
  onDuplicate,
  onDelete,
  titleOffsetPercent = 0,
  dragVariant,
}: AllDayEventItemProps) {
  const color = event.color ?? "blue";
  const styles = eventColorStyles[color];
  const eventIsPast = isPastProp ?? isPast(event.end);

  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
  } | null>(null);

  const closeContextMenu = React.useCallback(() => {
    setContextMenu(null);
    onContextMenuOpenChange?.(false);
  }, [onContextMenuOpenChange]);

  // Ghost: faded version at original position during move
  if (dragVariant === "ghost") {
    return (
      <div
        className={cn(
          "relative h-6 px-2 py-0.5 pointer-events-none opacity-30",
          "overflow-hidden select-none flex items-center gap-1",
          spanStart && "rounded-l-md",
          spanEnd && "rounded-r-md",
          className,
        )}
      >
        <div
          className={cn(
            "absolute inset-0 bg-white dark:bg-[#191919]",
            spanStart && "rounded-l-md",
            spanEnd && "rounded-r-md",
          )}
        />
        <div
          className={cn(
            "absolute inset-0",
            styles.bg,
            spanStart && "rounded-l-md",
            spanEnd && "rounded-r-md",
          )}
        />
        {spanStart && (
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 w-[4px] dark:bg-white dark:mix-blend-overlay",
              spanStart && "rounded-l-md",
              styles.border,
            )}
          />
        )}
        <span
          className={cn(
            "relative font-medium text-[0.625rem] leading-tight whitespace-nowrap",
            spanStart && "pl-1",
            styles.text,
            "dark:text-white/80",
          )}
        >
          {event.title}
        </span>
      </div>
    );
  }

  // Placeholder: border-only outline at target position
  if (dragVariant === "placeholder") {
    return (
      <div
        className={cn(
          "relative h-6 pointer-events-none border-2 rounded-sm",
          styles.borderLine,
          className,
        )}
      />
    );
  }

  // Dragging copy: floating replica following cursor
  if (dragVariant === "dragging") {
    return (
      <div
        className={cn(
          "h-6 px-2 py-0.5 pointer-events-none cursor-grabbing",
          "overflow-hidden select-none flex items-center gap-1",
          "rounded-sm opacity-80 shadow-lg",
          className,
        )}
      >
        <div className="absolute inset-0 rounded-sm bg-white dark:bg-[#191919]" />
        <div
          className={cn("absolute inset-0 rounded-sm", styles.bg)}
        />
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[4px] rounded-l-md dark:bg-white dark:mix-blend-overlay",
            styles.border,
          )}
        />
        <span
          className={cn(
            "relative font-medium text-[0.625rem] leading-tight whitespace-nowrap pl-1",
            styles.text,
            "dark:text-white/80",
          )}
        >
          {event.title}
        </span>
      </div>
    );
  }

  // Check if event has a specific start time (not midnight)
  const hasStartTime =
    event.start.getHours() !== 0 || event.start.getMinutes() !== 0;

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onClick) {
      return;
    }
    onClick(event);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter" && e.key !== " ") {
      return;
    }
    e.preventDefault();
    onClick?.(event);
  }

  function handleAllDayMouseMove(e: React.MouseEvent) {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const width = rect.width;

    if (spanStart && offsetX <= ALL_DAY_RESIZE_HOTZONE_PX) {
      target.style.cursor = "ew-resize";
      return;
    }

    if (spanEnd && offsetX >= width - ALL_DAY_RESIZE_HOTZONE_PX) {
      target.style.cursor = "ew-resize";
      return;
    }

    target.style.cursor = "grab";
  }

  function handleAllDayMouseDown(e: React.MouseEvent) {
    if (!onResizeMouseDown) return;

    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const width = rect.width;

    if (spanStart && offsetX <= ALL_DAY_RESIZE_HOTZONE_PX) {
      e.stopPropagation();
      onResizeMouseDown(e, event, "left");
      return;
    }

    if (spanEnd && offsetX >= width - ALL_DAY_RESIZE_HOTZONE_PX) {
      e.stopPropagation();
      onResizeMouseDown(e, event, "right");
      return;
    }

    // Middle area: initiate drag (move)
    e.stopPropagation();
    onResizeMouseDown(e, event, "move");
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
    onContextMenuOpenChange?.(true);
  }


  const eventElement = (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      onMouseMove={handleAllDayMouseMove}
      onMouseDown={handleAllDayMouseDown}
      className={cn(
        "relative h-6 px-2 py-0.5 cursor-pointer",
        "hover:z-10 focus:outline-none focus-visible:outline-none",
        "overflow-hidden select-none flex items-center gap-1",
        spanStart && "rounded-l-md",
        spanEnd && "rounded-r-md",
        isSelected && "z-20",
        className,
      )}
      style={
        titleOffsetPercent > 0
          ? { paddingLeft: `${titleOffsetPercent}%` }
          : undefined
      }
    >
      {/* Solid background layer to prevent transparency bleed-through */}
      <div
        className={cn(
          "absolute inset-0 bg-white dark:bg-[#191919]",
          spanStart && "rounded-l-md",
          spanEnd && "rounded-r-md",
        )}
      />

      {/* Colored background layer - uses border color when selected */}
      <div
        className={cn(
          "absolute inset-0",
          isSelected ? styles.border : styles.bg,
          spanStart && "rounded-l-md",
          spanEnd && "rounded-r-md",
          eventIsPast && !isSelected && "opacity-60",
        )}
      />

      {/* Left border - hidden when selected (merges with bg) */}
      {spanStart && !isSelected && (
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[4px] dark:bg-white dark:mix-blend-overlay",
            spanStart && "rounded-l-md",
            styles.border,
            eventIsPast && "opacity-60",
          )}
        />
      )}
      <span
        className={cn(
          "relative font-medium text-[0.625rem] leading-tight whitespace-nowrap",
          spanStart && "pl-1",
          isSelected
            ? "text-white dark:text-white"
            : cn(
                styles.text,
                "dark:text-white/80",
                eventIsPast && "opacity-60",
              ),
        )}
      >
        {event.title}
      </span>
      {hasStartTime && (
        <span
          className={cn(
            "relative text-[0.625rem] leading-tight whitespace-nowrap shrink-0",
            isSelected
              ? "text-white dark:text-white"
              : cn(
                  styles.text,
                  "dark:text-white dark:mix-blend-overlay",
                  eventIsPast && "opacity-60",
                ),
          )}
        >
          {formatAllDayStartTime(event.start)}
        </span>
      )}
    </div>
  );


  return (
    <>
      {eventElement}
      {contextMenu && (
        <EventContextMenu
          event={event}
          position={contextMenu}
          onClose={closeContextMenu}
          onEventChange={onEventChange}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      )}
    </>
  );
}
