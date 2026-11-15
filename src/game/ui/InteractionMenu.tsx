"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronUp, CornerDownLeft } from "lucide-react";
import { Button } from "@ui-sdk/react/button";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@ui-sdk/react/popover";

/**
 * Presentation-only interaction menu. The game engine still owns the target,
 * the interaction action and input. This layer adds an accessible, dismissible
 * menu around the existing prompt without changing movement or camera code.
 */
export function InteractionMenu({
  prompt,
  isTouch,
  onOpenChange,
  onInteract,
}: {
  prompt: string;
  isTouch: boolean;
  onOpenChange: (open: boolean) => void;
  onInteract: () => void;
}) {
  const [open, setOpen] = useState(false);
  const openChange = useRef(onOpenChange);
  openChange.current = onOpenChange;

  // If the target disappears and this component unmounts while open, the
  // engine must not be left with input disabled.
  useEffect(() => {
    return () => openChange.current(false);
  }, []);

  const change = (next: boolean) => {
    setOpen(next);
    onOpenChange(next);
  };

  return (
    <Popover open={open} onOpenChange={change} modal={false}>
      <PopoverTrigger
        data-testid="interaction-prompt"
        aria-label={`Interaction available: ${prompt}. Open interaction menu.`}
        className="pointer-events-auto hud-panel group flex cursor-pointer appearance-none items-center gap-3 rounded-sm px-4 py-2.5 text-left transition hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="flex size-6 items-center justify-center rounded-[3px] border border-primary/50 font-ui text-[10px] text-primary">
          {isTouch ? "•" : "E"}
        </span>
        <span className="font-ui text-xs tracking-wide text-foreground/90">{prompt}</span>
        <ChevronUp
          aria-hidden="true"
          className="size-3 text-primary/45 transition group-hover:text-primary/80"
        />
        <span className="sr-only">Open interaction menu</span>
      </PopoverTrigger>

      <PopoverContent
        data-testid="interaction-menu"
        data-navodaya-interaction-menu=""
        side="top"
        align="center"
        sideOffset={10}
        collisionPadding={12}
        finalFocus="trigger"
        className="z-[70] w-[min(22rem,calc(100vw-2rem))] rounded-sm border border-[#c9a768]/35 bg-[#0b1610]/97 p-4 text-[#f2e7d2] shadow-[0_18px_60px_rgba(0,0,0,0.75)] backdrop-blur-md"
      >
        <p className="font-ui text-[9px] uppercase tracking-[0.24em] text-[#c9a768]/80">
          Player interaction
        </p>
        <PopoverTitle className="mt-1 font-display text-lg leading-tight text-[#f4ead6]">
          Choose an action
        </PopoverTitle>
        <PopoverDescription className="mt-1.5 font-ui text-[11px] leading-relaxed text-[#e9ddc8]/65">
          {prompt}
        </PopoverDescription>

        <div className="mt-4 flex items-stretch gap-2">
          <Button
            type="button"
            onClick={() => {
              onInteract();
              change(false);
            }}
            className="flex flex-1 items-center justify-center gap-2 border border-primary/55 bg-primary/15 px-3 py-2.5 font-ui text-[10px] uppercase tracking-[0.18em] text-primary transition hover:border-primary/80 hover:bg-primary/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <CornerDownLeft aria-hidden="true" className="size-3" />
            Interact
            {!isTouch && (
              <span
                aria-hidden="true"
                className="ml-1 rounded-[2px] border border-primary/35 px-1 py-0.5 text-[8px] text-primary/75"
              >
                E
              </span>
            )}
          </Button>
          <PopoverClose className="border border-foreground/15 px-3 py-2.5 font-ui text-[10px] uppercase tracking-[0.18em] text-foreground/60 transition hover:border-foreground/30 hover:text-foreground/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            Cancel
          </PopoverClose>
        </div>

        <p className="mt-3 font-ui text-[8px] uppercase tracking-[0.16em] text-[#e9ddc8]/30">
          Enter chooses · Esc closes · E quick-acts in the world
        </p>
      </PopoverContent>
    </Popover>
  );
}
