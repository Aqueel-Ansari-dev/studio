
"use client"

import * as React from "react"
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxOption {
    value: string;
    label: string;
    description?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange: (value: string, option?: ComboboxOption) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  onCustomValueCreate?: (value: string) => void;
}

export function Combobox({
    options,
    value,
    onValueChange,
    placeholder = "Select an option...",
    emptyMessage = "No option found.",
    className,
    onCustomValueCreate
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value || '');

  React.useEffect(() => {
      setInputValue(value || '');
  }, [value]);

  const handleSelect = (option: ComboboxOption) => {
    setInputValue(option.label);
    onValueChange(option.label, option);
    setOpen(false);
  }
  
  const handleCreate = () => {
    if (onCustomValueCreate && inputValue) {
        onCustomValueCreate(inputValue);
    }
    setOpen(false);
  }
  
  const filteredOptions = inputValue
    ? options.filter(option =>
        option.label.toLowerCase().includes(inputValue.toLowerCase())
      )
    : options;

  const showCustomOption = onCustomValueCreate && inputValue.trim().length > 0 && !options.some(o => o.label.toLowerCase() === inputValue.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
            <span className="truncate">
                {value || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={placeholder}
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            {filteredOptions.length === 0 && !showCustomOption && <CommandEmpty>{emptyMessage}</CommandEmpty>}
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => handleSelect(option)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.label ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div>
                    {option.label}
                    {option.description && (
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                    )}
                  </div>
                </CommandItem>
              ))}
               {showCustomOption && (
                <CommandItem onSelect={handleCreate} value={inputValue}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  <span>Create "{inputValue.trim()}"</span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
