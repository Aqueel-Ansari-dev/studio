"use client"

import { useToast } from "@/hooks/use-toast"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { cn } from "@/lib/utils"

export function Toaster() {
  const { toasts } = useToast()
  const isMobile = useMediaQuery("(max-width: 640px)")

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport 
        className={cn(
          // Mobile: top
          "sm:top-0 sm:flex-col sm:p-4",
          // Desktop: bottom-right
          "sm:bottom-0 sm:right-0 sm:flex-col sm:p-4 md:max-w-[420px]"
        )}
      />
    </ToastProvider>
  )
}
